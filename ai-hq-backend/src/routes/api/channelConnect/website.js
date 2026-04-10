import { dbUpsertTenantChannel } from "../../../db/helpers/settings.js";
import {
  dbGetLatestTenantDomainVerification,
  dbGetTenantDomainVerification,
  dbUpsertTenantDomainVerification,
} from "../../../db/helpers/tenantDomainVerifications.js";
import {
  buildWebsiteDomainVerificationChallenge,
  buildWebsiteDomainVerificationPayload,
  WEBSITE_DOMAIN_VERIFICATION_ENFORCEMENT,
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

function isProductionInstallBlocked(domainVerification = null) {
  const verification = obj(domainVerification);
  const readiness = obj(verification.readiness);

  return (
    verification.requiredForProductionInstall === true &&
    readiness.enforcementActive === true &&
    readiness.productionInstallReady !== true
  );
}

function buildWebsiteInstallSurface(req, status = {}, domainVerification = null) {
  const install = buildWebsiteWidgetInstallSurface(req, status);
  const productionBlocked = isProductionInstallBlocked(domainVerification);

  return {
    ...install,
    productionInstallReady: productionBlocked !== true,
    productionBlocked,
    blockReasonCode: productionBlocked
      ? s(obj(domainVerification).reasonCode, "website_domain_verification_required")
      : "",
    blockMessage: productionBlocked
      ? s(
          obj(domainVerification).message,
          "Create and verify a DNS TXT challenge for this domain before Website Chat can be installed on the public website."
        )
      : "",
    embedSnippet: productionBlocked ? "" : s(install.embedSnippet),
  };
}

function buildWebsiteInstallHandoffInstructions({
  verifiedDomain = "",
  loaderScriptUrl = "",
  apiBase = "",
} = {}) {
  const scriptOrigin = normalizeUrl(loaderScriptUrl)?.origin || "";
  const apiOrigin = normalizeUrl(apiBase)?.origin || "";

  return [
    `Add the loader snippet once before the closing </body> tag on pages served from ${verifiedDomain}.`,
    "Keep the data-widget-id and data-api-base values exactly as provided.",
    `Publish the website change, then load a page on ${verifiedDomain} and confirm Website Chat opens successfully.`,
    scriptOrigin || apiOrigin
      ? `If the website uses a strict Content Security Policy, allow ${[scriptOrigin, apiOrigin]
          .filter(Boolean)
          .join(" and ")}.`
      : "If the website uses a strict Content Security Policy, allow the Website Chat loader and API origins.",
  ];
}

function buildWebsiteGtmInstallHandoffInstructions({
  verifiedDomain = "",
  loaderScriptUrl = "",
  apiBase = "",
} = {}) {
  const scriptOrigin = normalizeUrl(loaderScriptUrl)?.origin || "";
  const apiOrigin = normalizeUrl(apiBase)?.origin || "";

  return [
    `In Google Tag Manager, create a new Custom HTML tag for pages served from ${verifiedDomain}.`,
    "Paste the GTM Custom HTML block exactly as provided below and keep the widget ID plus API base unchanged.",
    `Use a Pages trigger that covers the verified domain, then preview and publish the GTM container for ${verifiedDomain}.`,
    `After publish, load a page on ${verifiedDomain} and confirm Website Chat opens successfully.`,
    scriptOrigin || apiOrigin
      ? `If the website uses a strict Content Security Policy, allow ${[scriptOrigin, apiOrigin]
          .filter(Boolean)
          .join(" and ")}.`
      : "If the website uses a strict Content Security Policy, allow the Website Chat loader and API origins.",
  ];
}

function buildWebsiteGtmCustomHtmlSnippet({
  loaderScriptUrl = "",
  widgetId = "",
  apiBase = "",
} = {}) {
  if (!loaderScriptUrl || !widgetId || !apiBase) return "";

  return [
    "<!-- Website Chat GTM Custom HTML tag -->",
    `<script src="${loaderScriptUrl}" data-widget-id="${widgetId}" data-api-base="${apiBase}" async></script>`,
  ].join("\n");
}

function buildWebsiteWordpressInstallHandoffInstructions({
  verifiedDomain = "",
} = {}) {
  return [
    "Upload and activate the private AIHQ Website Chat WordPress plugin on the target WordPress site.",
    "Open Settings > AIHQ Website Chat in WordPress admin.",
    "Paste the WordPress package JSON exactly as provided below, save the settings, then enable Website Chat.",
    `Confirm the WordPress site is served from ${verifiedDomain} before going live.`,
    `After saving, load a page on ${verifiedDomain} and confirm Website Chat opens successfully.`,
  ];
}

function buildWebsiteWordpressInstallConfig({
  verifiedDomain = "",
  widgetId = "",
  loaderScriptUrl = "",
  apiBase = "",
  readiness = {},
  instructions = [],
} = {}) {
  return {
    packageType: "wordpress",
    packageTitle: "Website Chat WordPress install package",
    ready: true,
    verifiedDomain,
    widgetId,
    loaderScriptUrl,
    apiBase,
    readiness,
    instructions,
    wordpressPlugin: {
      slug: "aihq-website-chat",
      pluginDirectory: "integrations/wordpress/aihq-website-chat",
      mainFile: "aihq-website-chat.php",
    },
  };
}

function buildWebsiteInstallHandoffText({
  title = "Website Chat developer install handoff",
  verifiedDomain = "",
  widgetId = "",
  loaderScriptUrl = "",
  apiBase = "",
  packageSnippet = "",
  snippetLabel = "Embed snippet",
  readiness = {},
  instructions = [],
} = {}) {
  const lines = [
    title,
    "",
    `Verified domain: ${verifiedDomain}`,
    `Widget ID: ${widgetId}`,
    `Loader script URL: ${loaderScriptUrl}`,
    `API base: ${apiBase}`,
    `Install readiness: ${s(readiness.status, "ready")}`,
    `Verification state: ${s(readiness.verificationState, "verified")}`,
  ];

  if (s(readiness.verifiedAt)) {
    lines.push(`Verified at: ${s(readiness.verifiedAt)}`);
  }

  lines.push(
    "",
    `${snippetLabel}:`,
    packageSnippet,
    "",
    "Install instructions:"
  );

  instructions.forEach((item, index) => {
    lines.push(`${index + 1}. ${s(item)}`);
  });

  return lines.join("\n");
}

function buildWebsiteInstallHandoffPayload(
  req,
  status = {},
  domainVerification = null,
  {
    packageType = "developer",
  } = {}
) {
  const statusPayload = buildWebsiteWidgetStatusPayload(
    req,
    status,
    "owner",
    domainVerification
  );
  const widget = obj(statusPayload.widget);
  const install = obj(statusPayload.install);
  const verification = obj(statusPayload.domainVerification);
  const blockers = arr(obj(statusPayload.readiness).blockers);
  const verifiedDomain = s(verification.domain);

  if (
    obj(statusPayload.readiness).status !== "ready" ||
    install.productionInstallReady !== true ||
    !s(install.embedSnippet) ||
    !verifiedDomain
  ) {
    const reasonCode = s(
      install.blockReasonCode ||
        blockers[0]?.reasonCode ||
        verification.reasonCode,
      "website_widget_not_ready"
    );
    const message = s(
      install.blockMessage ||
        blockers[0]?.subtitle ||
        verification.message ||
        obj(statusPayload.readiness).message,
      "Website Chat is not ready for a developer install handoff yet."
    );

    throw createHttpError(message, 409, reasonCode);
  }

  const safePackageType = s(packageType, "developer").toLowerCase();
  const packageTitle =
    safePackageType === "gtm"
      ? "Website Chat GTM install handoff"
      : safePackageType === "wordpress"
        ? "Website Chat WordPress install package"
      : "Website Chat developer install handoff";
  const readiness = {
    status: s(obj(statusPayload.readiness).status, "ready"),
    message: s(
      obj(statusPayload.readiness).message,
      "Website Chat is ready for production install."
    ),
    productionInstallReady: install.productionInstallReady === true,
    verificationState: s(verification.state, "verified"),
    verifiedAt: verification.verifiedAt || null,
  };
  const instructions =
    safePackageType === "gtm"
      ? buildWebsiteGtmInstallHandoffInstructions({
          verifiedDomain,
          loaderScriptUrl: install.scriptUrl,
          apiBase: install.apiBase,
        })
      : safePackageType === "wordpress"
        ? buildWebsiteWordpressInstallHandoffInstructions({
            verifiedDomain,
          })
        : buildWebsiteInstallHandoffInstructions({
            verifiedDomain,
            loaderScriptUrl: install.scriptUrl,
            apiBase: install.apiBase,
          });
  const wordpressConfig =
    safePackageType === "wordpress"
      ? buildWebsiteWordpressInstallConfig({
          verifiedDomain,
          widgetId: s(widget.publicWidgetId),
          loaderScriptUrl: s(install.scriptUrl),
          apiBase: s(install.apiBase),
          readiness,
          instructions,
        })
      : null;
  const packageSnippet =
    safePackageType === "gtm"
      ? buildWebsiteGtmCustomHtmlSnippet({
          loaderScriptUrl: s(install.scriptUrl),
          widgetId: s(widget.publicWidgetId),
          apiBase: s(install.apiBase),
        })
      : safePackageType === "wordpress"
        ? JSON.stringify(wordpressConfig, null, 2)
        : s(install.embedSnippet);
  const snippetLabel =
    safePackageType === "gtm"
      ? "GTM Custom HTML tag"
      : safePackageType === "wordpress"
        ? "WordPress plugin package JSON"
        : "Embed snippet";

  return {
    ready: true,
    generatedAt: new Date().toISOString(),
    audience: "developer",
    packageType: safePackageType,
    packageTitle,
    verifiedDomain,
    widgetId: s(widget.publicWidgetId),
    loaderScriptUrl: s(install.scriptUrl),
    apiBase: s(install.apiBase),
    embedSnippet: s(install.embedSnippet),
    gtmCustomHtmlSnippet:
      safePackageType === "gtm" ? packageSnippet : "",
    wordpressConfig,
    packageSnippet,
    snippetLabel,
    instructions,
    readiness,
    packageText:
      safePackageType === "wordpress"
        ? packageSnippet
        : buildWebsiteInstallHandoffText({
            title: packageTitle,
            verifiedDomain,
            widgetId: s(widget.publicWidgetId),
            loaderScriptUrl: s(install.scriptUrl),
            apiBase: s(install.apiBase),
            packageSnippet,
            snippetLabel,
            readiness,
            instructions,
          }),
  };
}

function buildBlockers(status = {}, domainVerification = null) {
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

  if (config.enabled === true && isProductionInstallBlocked(domainVerification)) {
    blockers.push({
      reasonCode: s(
        obj(domainVerification).reasonCode,
        "website_domain_verification_required"
      ),
      title: "Website chat production install is blocked until domain ownership is verified.",
      subtitle: s(
        obj(domainVerification).message,
        "Create and verify a DNS TXT challenge for this domain before Website Chat can launch publicly."
      ),
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
  const verificationSurface =
    domainVerification ||
    buildWebsiteDomainVerificationPayload(null, {
      candidateDomain: "",
      candidateDomains: [],
      enforcementActive: WEBSITE_DOMAIN_VERIFICATION_ENFORCEMENT,
    });
  const config = normalizeWidgetConfig(status.widgetConfig, {
    defaultEnabled: widgetStatusAllowsInstall(status.widgetChannelStatus),
  });
  const blockers = buildBlockers(status, verificationSurface);
  const saveAllowed = canManageSettings(viewerRole);
  const launchEnabled = resolveWidgetEnabled(status);
  const launchReady =
    launchEnabled &&
    Boolean(config.publicWidgetId) &&
    (config.allowedOrigins.length > 0 ||
      config.allowedDomains.length > 0 ||
      Boolean(s(status.websiteUrl)));
  const ready = launchReady && !isProductionInstallBlocked(verificationSurface);
  const install = buildWebsiteInstallSurface(req, status, verificationSurface);

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
    install,
    domainVerification: verificationSurface,
    readiness: {
      status: ready
        ? "ready"
        : config.enabled
          ? "blocked"
          : "attention",
      message: ready
        ? "Website chat is configured with a publishable install ID and trusted origin controls."
        : config.enabled && isProductionInstallBlocked(verificationSurface)
          ? s(
              verificationSurface.message,
              "Website chat is blocked for public install until domain ownership is verified."
            )
        : config.enabled
          ? launchReady
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

export async function createWebsiteWidgetInstallHandoff({ db, req }) {
  const tenantKey = getReqTenantKey(req);
  if (!tenantKey) {
    throw createHttpError("Missing tenant context", 401);
  }

  const viewerRole = getNormalizedAuthRole(req);
  if (!canManageSettings(viewerRole)) {
    throw createHttpError(
      "Only owner/admin can prepare a website install handoff",
      403
    );
  }

  const tenant = await getTenantByKey(db, tenantKey);
  if (!tenant?.id) {
    throw createHttpError("Tenant not found", 404);
  }

  const status = await resolveWebsiteWidgetStatus(db, tenantKey);
  if (!status?.id) {
    throw createHttpError("Tenant not found", 404);
  }

  const domainVerification = await loadWebsiteDomainVerificationSurface(db, status, {
    requestedDomain: obj(req.body).domain || req?.query?.domain || "",
  });
  const payload = buildWebsiteInstallHandoffPayload(
    req,
    status,
    domainVerification
  );

  await auditSafe(
    db,
    getReqActor(req),
    tenant,
    "settings.channel.webchat.install_handoff.generated",
    "tenant_channel",
    WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
    {
      channelType: WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
      verifiedDomain: payload.verifiedDomain,
      widgetId: payload.widgetId,
    }
  );

  return payload;
}

export async function createWebsiteWidgetGtmInstallHandoff({ db, req }) {
  const tenantKey = getReqTenantKey(req);
  if (!tenantKey) {
    throw createHttpError("Missing tenant context", 401);
  }

  const viewerRole = getNormalizedAuthRole(req);
  if (!canManageSettings(viewerRole)) {
    throw createHttpError(
      "Only owner/admin can prepare a GTM website install handoff",
      403
    );
  }

  const tenant = await getTenantByKey(db, tenantKey);
  if (!tenant?.id) {
    throw createHttpError("Tenant not found", 404);
  }

  const status = await resolveWebsiteWidgetStatus(db, tenantKey);
  if (!status?.id) {
    throw createHttpError("Tenant not found", 404);
  }

  const domainVerification = await loadWebsiteDomainVerificationSurface(db, status, {
    requestedDomain: obj(req.body).domain || req?.query?.domain || "",
  });
  const payload = buildWebsiteInstallHandoffPayload(
    req,
    status,
    domainVerification,
    {
      packageType: "gtm",
    }
  );

  await auditSafe(
    db,
    getReqActor(req),
    tenant,
    "settings.channel.webchat.install_handoff.gtm_generated",
    "tenant_channel",
    WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
    {
      channelType: WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
      verifiedDomain: payload.verifiedDomain,
      widgetId: payload.widgetId,
      packageType: "gtm",
    }
  );

  return payload;
}

export async function createWebsiteWidgetWordpressInstallHandoff({ db, req }) {
  const tenantKey = getReqTenantKey(req);
  if (!tenantKey) {
    throw createHttpError("Missing tenant context", 401);
  }

  const viewerRole = getNormalizedAuthRole(req);
  if (!canManageSettings(viewerRole)) {
    throw createHttpError(
      "Only owner/admin can prepare a WordPress website install handoff",
      403
    );
  }

  const tenant = await getTenantByKey(db, tenantKey);
  if (!tenant?.id) {
    throw createHttpError("Tenant not found", 404);
  }

  const status = await resolveWebsiteWidgetStatus(db, tenantKey);
  if (!status?.id) {
    throw createHttpError("Tenant not found", 404);
  }

  const domainVerification = await loadWebsiteDomainVerificationSurface(db, status, {
    requestedDomain: obj(req.body).domain || req?.query?.domain || "",
  });
  const payload = buildWebsiteInstallHandoffPayload(
    req,
    status,
    domainVerification,
    {
      packageType: "wordpress",
    }
  );

  await auditSafe(
    db,
    getReqActor(req),
    tenant,
    "settings.channel.webchat.install_handoff.wordpress_generated",
    "tenant_channel",
    WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
    {
      channelType: WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
      verifiedDomain: payload.verifiedDomain,
      widgetId: payload.widgetId,
      packageType: "wordpress",
    }
  );

  return payload;
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
