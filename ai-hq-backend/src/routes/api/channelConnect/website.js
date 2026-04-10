import { dbUpsertTenantChannel } from "../../../db/helpers/settings.js";
import {
  dbGetLatestTenantDomainVerification,
  dbGetTenantDomainVerification,
  dbUpsertTenantDomainVerification,
} from "../../../db/helpers/tenantDomainVerifications.js";
import {
  buildWebsiteDomainVerificationChallenge,
  buildWebsiteDomainVerificationPayload,
  evaluateWebsiteDomainVerification,
  normalizeWebsiteVerificationDomain,
  WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
  WEBSITE_DOMAIN_VERIFICATION_METHOD,
  WEBSITE_DOMAIN_VERIFICATION_SCOPE,
} from "../../../services/websiteDomainVerification.js";
import { getNormalizedAuthRole } from "../../../utils/auth.js";
import { canManageSettings } from "../../../utils/roles.js";
import {
  buildWebsiteWidgetInstallSurface,
  normalizeUrl,
  normalizeWidgetConfig,
  normalizeWidgetConfigForSave,
  resolveWidgetEnabled,
  resolveWebsiteWidgetStatus,
  widgetStatusAllowsInstall,
} from "../websiteWidget/config.js";
import { auditSafe, getTenantByKey } from "./repository.js";
import { getReqActor, getReqTenantKey, s } from "./utils.js";

const WEBSITE_DOMAIN_VERIFICATION_ENFORCEMENT = false;

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function uniq(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

function createHttpError(message, status = 400, reasonCode = "") {
  const error = new Error(message);
  error.status = status;
  if (reasonCode) error.reasonCode = reasonCode;
  return error;
}

function buildWebsiteDomainCandidates(status = {}) {
  const config = normalizeWidgetConfig(status.widgetConfig, {
    defaultEnabled: widgetStatusAllowsInstall(status.widgetChannelStatus),
  });

  const rawCandidates = [
    s(status.websiteUrl),
    ...config.allowedDomains,
    ...config.allowedOrigins
      .map((origin) => normalizeUrl(origin)?.hostname || "")
      .filter(Boolean),
  ];

  const candidates = [];

  for (const rawCandidate of rawCandidates) {
    const normalized = normalizeWebsiteVerificationDomain(rawCandidate);
    if (normalized.ok) {
      candidates.push(normalized.domain);
    }
  }

  return uniq(candidates);
}

function resolveWebsiteDomainSelection(rawDomain = "", status = {}, options = {}) {
  const requireDomain = options?.requireDomain === true;
  const candidateDomains = buildWebsiteDomainCandidates(status);
  const requested = s(rawDomain);

  if (requested) {
    const normalized = normalizeWebsiteVerificationDomain(requested);
    if (!normalized.ok) {
      throw createHttpError(
        normalized.detail,
        400,
        normalized.reasonCode || "website_domain_invalid"
      );
    }

    return {
      domain: normalized.domain,
      candidateDomains,
      requestedExplicitly: true,
    };
  }

  if (candidateDomains.length) {
    return {
      domain: candidateDomains[0],
      candidateDomains,
      requestedExplicitly: false,
    };
  }

  if (requireDomain) {
    throw createHttpError(
      "Add a public website domain or allowed domain before starting ownership verification.",
      400,
      "website_domain_missing"
    );
  }

  return {
    domain: "",
    candidateDomains,
    requestedExplicitly: false,
  };
}

async function loadWebsiteDomainVerificationSurface(
  db,
  status = {},
  { requestedDomain = "" } = {}
) {
  if (!status?.id) {
    return buildWebsiteDomainVerificationPayload(null, {
      candidateDomain: "",
      candidateDomains: [],
      enforcementActive: WEBSITE_DOMAIN_VERIFICATION_ENFORCEMENT,
    });
  }

  const selection = resolveWebsiteDomainSelection(requestedDomain, status);
  let record = null;

  if (selection.domain) {
    record = await dbGetTenantDomainVerification(db, status.id, {
      channelType: WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
      normalizedDomain: selection.domain,
    });
  }

  if (!record && !selection.requestedExplicitly) {
    record = await dbGetLatestTenantDomainVerification(db, status.id, {
      channelType: WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
    });
  }

  return buildWebsiteDomainVerificationPayload(record, {
    candidateDomain: selection.domain || record?.normalized_domain || "",
    candidateDomains: selection.candidateDomains,
    enforcementActive: WEBSITE_DOMAIN_VERIFICATION_ENFORCEMENT,
  });
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

function buildWebsiteWidgetStatusPayload(
  req,
  status = {},
  viewerRole = "member",
  domainVerification = null
) {
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
    domainVerification:
      domainVerification ||
      buildWebsiteDomainVerificationPayload(null, {
        candidateDomain: "",
        candidateDomains: [],
        enforcementActive: WEBSITE_DOMAIN_VERIFICATION_ENFORCEMENT,
      }),
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
    throw createHttpError("Missing tenant context", 401);
  }

  const status = await resolveWebsiteWidgetStatus(db, tenantKey);
  if (!status?.id) {
    throw createHttpError("Tenant not found", 404);
  }

  const viewerRole = getNormalizedAuthRole(req);
  const domainVerification = await loadWebsiteDomainVerificationSurface(db, status, {
    requestedDomain: req?.query?.domain || "",
  });

  return buildWebsiteWidgetStatusPayload(
    req,
    status,
    viewerRole,
    domainVerification
  );
}

export async function getWebsiteDomainVerificationStatus({ db, req }) {
  const tenantKey = getReqTenantKey(req);
  if (!tenantKey) {
    throw createHttpError("Missing tenant context", 401);
  }

  const status = await resolveWebsiteWidgetStatus(db, tenantKey);
  if (!status?.id) {
    throw createHttpError("Tenant not found", 404);
  }

  return loadWebsiteDomainVerificationSurface(db, status, {
    requestedDomain: req?.query?.domain || "",
  });
}

export async function createWebsiteDomainVerificationChallenge({ db, req }) {
  const tenantKey = getReqTenantKey(req);
  if (!tenantKey) {
    throw createHttpError("Missing tenant context", 401);
  }

  const viewerRole = getNormalizedAuthRole(req);
  if (!canManageSettings(viewerRole)) {
    throw createHttpError(
      "Only owner/admin can manage website domain verification",
      403
    );
  }

  const tenant = await getTenantByKey(db, tenantKey);
  if (!tenant?.id) {
    throw createHttpError("Tenant not found", 404);
  }

  const status = await resolveWebsiteWidgetStatus(db, tenantKey);
  const selection = resolveWebsiteDomainSelection(
    obj(req.body).domain || obj(req.body).websiteUrl,
    status,
    { requireDomain: true }
  );

  const existing = await dbGetTenantDomainVerification(db, tenant.id, {
    channelType: WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
    normalizedDomain: selection.domain,
  });
  const challenge = buildWebsiteDomainVerificationChallenge(selection.domain);
  const challengeVersion = Math.max(
    1,
    Number(existing?.challenge_version || 0) + 1
  );

  const saved = await dbUpsertTenantDomainVerification(db, tenant.id, {
    channel_type: WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
    verification_scope: WEBSITE_DOMAIN_VERIFICATION_SCOPE,
    verification_method: WEBSITE_DOMAIN_VERIFICATION_METHOD,
    domain: selection.domain,
    normalized_domain: selection.domain,
    status: "pending",
    challenge_token: challenge.challenge_token,
    challenge_dns_name: challenge.challenge_dns_name,
    challenge_dns_value: challenge.challenge_dns_value,
    challenge_version: challengeVersion,
    requested_by: getReqActor(req),
    last_checked_at: null,
    verified_at: null,
    status_reason_code: "dns_txt_challenge_created",
    status_message:
      "Publish the TXT record for this domain, then run verification after DNS propagates.",
    verification_meta: {
      source: selection.requestedExplicitly ? "request_body" : "website_status_candidate",
    },
    last_seen_values: [],
  });

  await auditSafe(
    db,
    getReqActor(req),
    tenant,
    "settings.channel.webchat.domain_verification.challenge_created",
    "tenant_domain_verification",
    selection.domain,
    {
      channelType: WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
      method: WEBSITE_DOMAIN_VERIFICATION_METHOD,
      domain: selection.domain,
      challengeVersion,
    }
  );

  return buildWebsiteDomainVerificationPayload(saved, {
    candidateDomain: selection.domain,
    candidateDomains: selection.candidateDomains,
    enforcementActive: WEBSITE_DOMAIN_VERIFICATION_ENFORCEMENT,
  });
}

export async function checkWebsiteDomainVerification({
  db,
  req,
  resolveTxtFn,
}) {
  const tenantKey = getReqTenantKey(req);
  if (!tenantKey) {
    throw createHttpError("Missing tenant context", 401);
  }

  const viewerRole = getNormalizedAuthRole(req);
  if (!canManageSettings(viewerRole)) {
    throw createHttpError(
      "Only owner/admin can manage website domain verification",
      403
    );
  }

  const tenant = await getTenantByKey(db, tenantKey);
  if (!tenant?.id) {
    throw createHttpError("Tenant not found", 404);
  }

  const status = await resolveWebsiteWidgetStatus(db, tenantKey);
  const selection = resolveWebsiteDomainSelection(
    obj(req.body).domain || obj(req.body).websiteUrl || req?.query?.domain || "",
    status,
    { requireDomain: false }
  );

  let existing = null;
  if (selection.domain) {
    existing = await dbGetTenantDomainVerification(db, tenant.id, {
      channelType: WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
      normalizedDomain: selection.domain,
    });
  }

  if (!existing && selection.requestedExplicitly) {
    throw createHttpError(
      "Create a DNS TXT challenge for this domain before checking website domain verification.",
      404,
      "website_domain_verification_missing"
    );
  }

  if (!existing) {
    existing = await dbGetLatestTenantDomainVerification(db, tenant.id, {
      channelType: WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
    });
  }

  if (!existing?.id) {
    throw createHttpError(
      "Create a DNS TXT challenge before checking website domain verification.",
      404,
      "website_domain_verification_missing"
    );
  }

  const evaluated = await evaluateWebsiteDomainVerification(existing, {
    resolveTxtFn,
  });
  const saved = await dbUpsertTenantDomainVerification(db, tenant.id, {
    ...evaluated,
    channel_type: WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
    verification_scope: WEBSITE_DOMAIN_VERIFICATION_SCOPE,
    verification_method: WEBSITE_DOMAIN_VERIFICATION_METHOD,
  });

  await auditSafe(
    db,
    getReqActor(req),
    tenant,
    "settings.channel.webchat.domain_verification.checked",
    "tenant_domain_verification",
    saved.normalized_domain || selection.domain,
    {
      channelType: WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
      method: WEBSITE_DOMAIN_VERIFICATION_METHOD,
      domain: saved.normalized_domain || selection.domain,
      verificationStatus: saved.status,
      reasonCode: saved.status_reason_code,
    }
  );

  return buildWebsiteDomainVerificationPayload(saved, {
    candidateDomain:
      selection.domain || saved.normalized_domain || existing.normalized_domain,
    candidateDomains: selection.candidateDomains,
    enforcementActive: WEBSITE_DOMAIN_VERIFICATION_ENFORCEMENT,
  });
}

export async function saveWebsiteWidgetConfig({ db, req }) {
  const tenantKey = getReqTenantKey(req);
  if (!tenantKey) {
    throw createHttpError("Missing tenant context", 401);
  }

  const viewerRole = getNormalizedAuthRole(req);
  if (!canManageSettings(viewerRole)) {
    throw createHttpError(
      "Only owner/admin can manage website widget settings",
      403
    );
  }

  const tenant = await getTenantByKey(db, tenantKey);
  if (!tenant?.id) {
    throw createHttpError("Tenant not found", 404);
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

  await dbUpsertTenantChannel(db, tenant.id, WEBSITE_DOMAIN_VERIFICATION_CHANNEL, {
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
    WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
    {
      channelType: WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
      provider: "website_widget",
      enabled: nextConfig.enabled,
      publicWidgetId: nextConfig.publicWidgetId,
    }
  );

  const refreshed = await resolveWebsiteWidgetStatus(db, tenantKey);
  const domainVerification = await loadWebsiteDomainVerificationSurface(db, refreshed);

  return buildWebsiteWidgetStatusPayload(
    req,
    refreshed,
    viewerRole,
    domainVerification
  );
}
