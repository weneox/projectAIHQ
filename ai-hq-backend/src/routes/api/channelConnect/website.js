import { dbUpsertTenantChannel } from "../../../db/helpers/settings.js";
import { getNormalizedAuthRole } from "../../../utils/auth.js";
import { canManageSettings } from "../../../utils/roles.js";
import {
  buildWebsiteWidgetInstallSurface,
  normalizeWidgetConfig,
  normalizeWidgetConfigForSave,
  resolveWidgetEnabled,
  resolveWebsiteWidgetStatus,
  widgetStatusAllowsInstall,
} from "../websiteWidget/config.js";
import { auditSafe, getTenantByKey } from "./repository.js";
import { getReqActor, getReqTenantKey, s } from "./utils.js";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function buildBlockers(status = {}) {
  const config = normalizeWidgetConfig(status.widgetConfig, {
    defaultEnabled: widgetStatusAllowsInstall(status.widgetChannelStatus),
  });
  const blockers = [];

  if (!config.publicWidgetId) {
    blockers.push({
      reasonCode: "website_widget_public_id_missing",
      title: "Public widget install ID has not been issued yet.",
      subtitle:
        "Save the website chat settings once to generate the publishable widget ID used by the loader install snippet.",
    });
  }

  if (
    !config.allowedOrigins.length &&
    !config.allowedDomains.length &&
    !s(status.websiteUrl)
  ) {
    blockers.push({
      reasonCode: "website_widget_origin_rules_missing",
      title: "No allowed website origin or domain has been configured yet.",
      subtitle:
        "Add exact origins, allowed domains, or a reference website URL before expecting public installs to verify successfully.",
    });
  }

  if (config.enabled !== true) {
    blockers.push({
      reasonCode: "website_widget_disabled",
      title: "Website chat is disabled.",
      subtitle:
        "The public loader will fail closed until this widget is explicitly enabled again.",
    });
  }

  if (config.enabled === true && !resolveWidgetEnabled(status)) {
    blockers.push({
      reasonCode: "website_widget_channel_inactive",
      title: "Website chat cannot launch because the website chat channel is not active.",
      subtitle:
        "Public website launches stay blocked until the website chat channel record is active again.",
    });
  }

  return blockers;
}

function buildWebsiteWidgetStatusPayload(req, status = {}, viewerRole = "member") {
  const config = normalizeWidgetConfig(status.widgetConfig, {
    defaultEnabled: widgetStatusAllowsInstall(status.widgetChannelStatus),
  });
  const blockers = buildBlockers(status);
  const saveAllowed = canManageSettings(viewerRole);
  const launchEnabled = resolveWidgetEnabled(status);
  const ready =
    launchEnabled &&
    Boolean(config.publicWidgetId) &&
    (config.allowedOrigins.length > 0 ||
      config.allowedDomains.length > 0 ||
      Boolean(s(status.websiteUrl)));

  return {
    state: ready ? "connected" : config.enabled ? "blocked" : "not_connected",
    viewerRole,
    permissions: {
      saveAllowed,
      requiredRoles: ["owner", "admin"],
      message: saveAllowed
        ? ""
        : "This control-plane surface is visible here, but only owner/admin can change it.",
    },
    widget: {
      enabled: config.enabled === true,
      publicWidgetId: config.publicWidgetId,
      allowedOrigins: config.allowedOrigins,
      allowedDomains: config.allowedDomains,
      title: config.title,
      subtitle: config.subtitle,
      accentColor: config.accentColor,
      initialPrompts: config.initialPrompts,
      websiteUrl: s(status.websiteUrl),
      channelStatus: s(status.widgetChannelStatus),
      updatedAt: status.widgetUpdatedAt || null,
    },
    install: buildWebsiteWidgetInstallSurface(req, status),
    readiness: {
      status: ready
        ? "ready"
        : config.enabled
          ? "blocked"
          : "attention",
      message: ready
        ? "Website chat is configured with a publishable install ID and trusted origin controls."
        : config.enabled
          ? launchEnabled
            ? "Website chat is enabled, but installation hardening is still incomplete."
            : "Website chat is enabled in settings, but public launch is still blocked until the channel becomes active again."
          : "Website chat is disabled until you intentionally enable and configure it.",
      blockers,
    },
  };
}

export async function getWebsiteWidgetStatus({ db, req }) {
  const tenantKey = getReqTenantKey(req);
  if (!tenantKey) {
    const error = new Error("Missing tenant context");
    error.status = 401;
    throw error;
  }

  const status = await resolveWebsiteWidgetStatus(db, tenantKey);
  if (!status?.id) {
    const error = new Error("Tenant not found");
    error.status = 404;
    throw error;
  }

  const viewerRole = getNormalizedAuthRole(req);
  return buildWebsiteWidgetStatusPayload(req, status, viewerRole);
}

export async function saveWebsiteWidgetConfig({ db, req }) {
  const tenantKey = getReqTenantKey(req);
  if (!tenantKey) {
    const error = new Error("Missing tenant context");
    error.status = 401;
    throw error;
  }

  const viewerRole = getNormalizedAuthRole(req);
  if (!canManageSettings(viewerRole)) {
    const error = new Error("Only owner/admin can manage website widget settings");
    error.status = 403;
    throw error;
  }

  const tenant = await getTenantByKey(db, tenantKey);
  if (!tenant?.id) {
    const error = new Error("Tenant not found");
    error.status = 404;
    throw error;
  }

  const current = await resolveWebsiteWidgetStatus(db, tenantKey);
  const raw = {
    ...obj(req.body),
    ...obj(obj(req.body).widget),
  };
  const nextConfig = normalizeWidgetConfigForSave(
    {
      ...obj(current?.widgetConfig),
      ...raw,
      enabled:
        typeof raw.enabled === "boolean"
          ? raw.enabled
          : typeof obj(req.body).enabled === "boolean"
            ? obj(req.body).enabled
            : normalizeWidgetConfig(current?.widgetConfig, {
                defaultEnabled: widgetStatusAllowsInstall(current?.widgetChannelStatus),
              }).enabled,
    },
    tenantKey
  );

  const persistedConfig = {
    ...obj(current?.widgetConfig),
    enabled: nextConfig.enabled,
    publicWidgetId: nextConfig.publicWidgetId,
    allowedOrigins: nextConfig.allowedOrigins,
    allowedDomains: nextConfig.allowedDomains,
    title: nextConfig.title,
    subtitle: nextConfig.subtitle,
    accentColor: nextConfig.accentColor,
    initialPrompts: nextConfig.initialPrompts,
  };

  await dbUpsertTenantChannel(db, tenant.id, "webchat", {
    provider: "website_widget",
    display_name: "Website chat",
    status: nextConfig.enabled ? "connected" : "disabled",
    is_primary: true,
    config: persistedConfig,
  });

  await auditSafe(
    db,
    getReqActor(req),
    tenant,
    "settings.channel.webchat.updated",
    "tenant_channel",
    "webchat",
    {
      channelType: "webchat",
      provider: "website_widget",
      enabled: nextConfig.enabled,
      publicWidgetId: nextConfig.publicWidgetId,
    }
  );

  const refreshed = await resolveWebsiteWidgetStatus(db, tenantKey);
  return buildWebsiteWidgetStatusPayload(req, refreshed, viewerRole);
}
