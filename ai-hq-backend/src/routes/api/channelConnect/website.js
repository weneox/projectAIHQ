import crypto from "crypto";
import { createTenantSourcesHelpers } from "../../../db/helpers/tenantSources.js";
import { createTenantKnowledgeHelpers } from "../../../db/helpers/tenantKnowledge.js";
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
  shouldAllowUnverifiedWebsiteWidgetHandoffs,
  WEBSITE_DOMAIN_VERIFICATION_CHANNEL,
  WEBSITE_DOMAIN_VERIFICATION_METHOD,
  WEBSITE_DOMAIN_VERIFICATION_SCOPE,
} from "../../../services/websiteDomainVerification.js";
import { buildWebsiteChatInstallPlan } from "../../../services/websiteChatInstallMethods.js";
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
import {
  findOrCreateThreadForIngest,
  insertInboundMessage,
} from "../../../modules/inbox/internal/persistence.js";
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


function pickActorId(req = {}) {
  const rawActor = getReqActor(req);
  const actor = obj(rawActor);

  return s(
    actor.id ||
      actor.actorId ||
      actor.userId ||
      rawActor ||
      req?.auth?.identityId ||
      req?.auth?.userId ||
      req?.user?.id ||
      "system"
  );
}

function buildVerifiedWebsiteSourceInput({ tenant = {}, domain = "", req = {} } = {}) {
  const normalizedDomain = s(domain).toLowerCase();
  const now = new Date().toISOString();
  const actorId = pickActorId(req);

  return {
    tenantId: s(tenant.id),
    tenantKey: s(tenant.tenant_key || tenant.tenantKey),
    sourceType: "website",
    sourceKey: `website:${normalizedDomain}`,
    displayName: `Website: ${normalizedDomain}`,
    status: "connected",
    authStatus: "not_required",
    syncStatus: "queued",
    connectionMode: "crawler",
    accessScope: "public",
    sourceUrl: `https://${normalizedDomain}/`,
    isEnabled: true,
    isPrimary: true,
    lastConnectedAt: now,
    permissionsJson: {
      verifiedDomain: normalizedDomain,
      verificationMethod: WEBSITE_DOMAIN_VERIFICATION_METHOD,
      verificationScope: WEBSITE_DOMAIN_VERIFICATION_SCOPE,
      crawlAllowed: true,
    },
    settingsJson: {
      crawler: {
        enabled: true,
        seedUrl: `https://${normalizedDomain}/`,
        allowedDomains: [normalizedDomain],
        maxPages: 40,
        includeSitemap: true,
        includeRobots: true,
        preferredPaths: [
          "/",
          "/about",
          "/services",
          "/pricing",
          "/faq",
          "/contact",
          "/privacy",
          "/terms",
        ],
      },
    },
    metadataJson: {
      provisionedBy: "website_domain_verification",
      verifiedDomain: normalizedDomain,
      verifiedAt: now,
      requestId: s(req?.requestId),
      correlationId: s(req?.correlationId),
    },
    createdBy: actorId,
    updatedBy: actorId,
  };
}

async function provisionVerifiedWebsiteSource({ db, req, result = {} } = {}) {
  const verification = obj(result.domainVerification || result.verification || result);
  const verified =
    verification.verified === true ||
    s(verification.state).toLowerCase() === "verified";
  const domain = s(verification.domain || verification.candidateDomain).toLowerCase();

  if (!verified || !domain || !db?.query) {
    return {
      ok: false,
      skipped: true,
      reasonCode: verified
        ? "website_verified_domain_missing"
        : "website_domain_not_verified",
    };
  }

  const tenantKey = getReqTenantKey(req);
  const tenant = await getTenantByKey(db, tenantKey);

  if (!tenant?.id) {
    return {
      ok: false,
      skipped: true,
      reasonCode: "tenant_not_found",
    };
  }

  const sources = createTenantSourcesHelpers({ db });
  const actorId = pickActorId(req);
  const source = await sources.upsertSource(
    buildVerifiedWebsiteSourceInput({ tenant, domain, req })
  );

  const sync = await sources.beginSourceSync({
    sourceId: source.id,
    requestedBy: actorId,
    runnerKey: "website.domain_verification",
    runType: "crawl",
    triggerType: "source_change",
    metadataJson: {
      workerTaskType: "tenant_source_sync",
      sourceType: "website",
      verifiedDomain: domain,
      requestId: s(req?.requestId),
      correlationId: s(req?.correlationId),
    },
  });

  return {
    ok: true,
    source,
    run: sync?.run || null,
  };
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

function resolveWebsiteInstallTargetDomain(domainVerification = null) {
  const verification = obj(domainVerification);
  return s(verification.domain || verification.candidateDomain);
}

function buildWebsiteInstallBaseBlockers(status = {}) {
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

function buildWebsiteGuidedSetupState({
  status = {},
  domainVerification = null,
  launchReadiness = null,
} = {}) {
  const verification = obj(domainVerification);
  const launch = obj(launchReadiness);
  const config = normalizeWidgetConfig(status.widgetConfig, {
    defaultEnabled: widgetStatusAllowsInstall(status.widgetChannelStatus),
  });

  const hasDomain =
    Boolean(s(verification.domain || verification.candidateDomain)) ||
    Boolean(s(status.websiteUrl)) ||
    arr(config.allowedDomains).length > 0 ||
    arr(config.allowedOrigins).length > 0;

  const hasWidgetId = Boolean(s(config.publicWidgetId));
  const widgetEnabled = config.enabled === true;
  const verified =
    verification.verified === true ||
    s(verification.state).toLowerCase() === "verified";
  const productionReady =
    launch.productionLaunchAllowed === true ||
    launch.productionReady === true ||
    launch.productionInstallReady === true;

  let currentStep = "domain";
  if (hasDomain) currentStep = "ownership";
  if (verified) currentStep = "scan";
  if (verified && !productionReady) currentStep = "review";
  if (productionReady) currentStep = "install";

  function step(id, label, description, statusValue) {
    return { id, label, description, status: statusValue };
  }

  const steps = [
    step(
      "domain",
      "Add website domain",
      "Enter the public website that should power this assistant.",
      hasDomain ? "done" : "current"
    ),
    step(
      "ownership",
      "Verify ownership",
      "Confirm this business controls the domain before public launch.",
      !hasDomain ? "locked" : verified ? "done" : "current"
    ),
    step(
      "scan",
      "Prepare website AI",
      "AIHQ prepares a safe website source and scans content for review.",
      !verified ? "locked" : productionReady ? "done" : "running"
    ),
    step(
      "review",
      "Approve Business Info",
      "Review what the assistant is allowed to say before it goes live.",
      !verified ? "locked" : productionReady ? "done" : "current"
    ),
    step(
      "install",
      "Install widget",
      "Use the recommended WordPress, GTM, or developer install path.",
      productionReady ? "current" : "locked"
    ),
  ];

  let headline = "Connect your website AI";
  let message = "Add your domain and AIHQ will guide the rest.";
  let primaryAction = { label: "Add domain", action: "edit_settings" };

  if (hasDomain && !verified) {
    headline = "Verify your website";
    message =
      "Verification protects the widget and unlocks the guided install flow.";
    primaryAction = { label: "Verify domain", action: "verify_domain" };
  } else if (verified && !productionReady) {
    headline = "Your website AI is being prepared";
    message =
      "The domain is verified. Review Business Info before public launch.";
    primaryAction = {
      label: "Review Business Info",
      action: "open_truth",
      path: "/truth",
    };
  } else if (productionReady) {
    headline = "Website Chat is ready to install";
    message = "Choose the safest install package for this website.";
    primaryAction = { label: "Prepare install", action: "prepare_install" };
  } else if (hasWidgetId && widgetEnabled) {
    headline = "Finish website setup";
    message = "Complete verification to unlock public launch.";
    primaryAction = { label: "Continue setup", action: "verify_domain" };
  }

  return {
    mode: "guided",
    headline,
    message,
    currentStep,
    oneClickGoal:
      "Domain verification prepares website knowledge, Business Info review, and install handoff from one guided flow.",
    hasDomain,
    hasWidgetId,
    widgetEnabled,
    verified,
    productionReady,
    steps,
    primaryAction,
  };
}

function buildWebsitePackageContract(packageType = "developer", contract = {}) {
  return {
    packageType: s(packageType, "developer").toLowerCase(),
    ready: contract.ready === true,
    productionReady: contract.productionReady === true,
    testingOnly: contract.testingOnly === true,
    targetDomain: s(contract.targetDomain),
    verificationState: s(contract.verificationState, "unverified"),
    verificationRequiredForProduction:
      contract.verificationRequiredForProduction !== false,
    blockingReasonCode: s(contract.blockingReasonCode),
    blockingMessage: s(contract.blockingMessage),
    message: s(contract.message),
  };
}

function buildWebsiteLaunchReadiness(
  req,
  status = {},
  domainVerification = null
) {
  const installSurface = buildWebsiteWidgetInstallSurface(req, status);
  const verification = obj(domainVerification);
  const config = normalizeWidgetConfig(status.widgetConfig, {
    defaultEnabled: widgetStatusAllowsInstall(status.widgetChannelStatus),
  });
  const targetDomain = resolveWebsiteInstallTargetDomain(domainVerification);
  const baseBlockers = buildWebsiteInstallBaseBlockers(status);
  const productionBlocked = isProductionInstallBlocked(domainVerification);
  const unverifiedHandoffsAllowed =
    shouldAllowUnverifiedWebsiteWidgetHandoffs();
  const installSurfaceReady =
    Boolean(s(installSurface.scriptUrl)) &&
    Boolean(s(installSurface.apiBase)) &&
    Boolean(s(installSurface.embedSnippet));
  const channelConfigured = Boolean(s(status.widgetChannelId));
  const widgetEnabled = config.enabled === true;
  const launchEnabled = resolveWidgetEnabled(status);
  const publicWidgetIdPresent = Boolean(config.publicWidgetId);
  const allowedOriginsPresent = config.allowedOrigins.length > 0;
  const allowedDomainsPresent = config.allowedDomains.length > 0;
  const originRulesPresent =
    allowedOriginsPresent ||
    allowedDomainsPresent ||
    Boolean(s(status.websiteUrl));

  if (!targetDomain) {
    baseBlockers.push({
      reasonCode: "website_install_target_domain_missing",
      title: "No handoff target domain is available yet.",
      subtitle:
        "Add a public website URL or allowed domain before preparing a Website Chat install handoff.",
    });
  }

  if (!installSurfaceReady) {
    baseBlockers.push({
      reasonCode: "website_widget_install_surface_unavailable",
      title: "Website chat install assets are not addressable yet.",
      subtitle:
        "Set PUBLIC_BASE_URL or access this control-plane surface through the normal app host before preparing an install handoff.",
    });
  }

  const blockers = [...baseBlockers];

  if (widgetEnabled === true && productionBlocked === true) {
    blockers.push({
      reasonCode: s(
        verification.reasonCode,
        "website_domain_verification_required"
      ),
      title:
        "Website chat production install is blocked until domain ownership is verified.",
      subtitle: s(
        verification.message,
        "Create and verify a DNS TXT challenge for this domain before Website Chat can launch publicly."
      ),
    });
  }

  const configurationReady =
    launchEnabled && publicWidgetIdPresent && originRulesPresent;
  const baseReady = baseBlockers.length === 0;
  const productionLaunchAllowed = baseReady && productionBlocked !== true;
  const testingOnly =
    baseReady && productionBlocked === true && unverifiedHandoffsAllowed === true;

  let statusCode = "blocked";
  if (productionLaunchAllowed) statusCode = "production_ready";
  else if (testingOnly) statusCode = "testing_only";
  else if (!channelConfigured && !widgetEnabled && !publicWidgetIdPresent) {
    statusCode = "not_configured";
  }

  const primaryBlocker = obj(baseBlockers[0] || blockers[0]);
  const verificationBlocker = obj(blockers[blockers.length - 1]);
  const blockingReasonCode =
    baseReady && productionBlocked
      ? s(verification.reasonCode, "website_domain_verification_required")
      : s(primaryBlocker.reasonCode || verificationBlocker.reasonCode);
  const blockingMessage =
    baseReady && productionBlocked
      ? s(
        verification.message,
        "Create and verify a DNS TXT challenge for this domain before Website Chat can be installed on the public website."
      )
      : s(primaryBlocker.subtitle || verificationBlocker.subtitle);
  const message = productionLaunchAllowed
    ? "Website chat is configured with a publishable install ID, trusted origin controls, and verified domain ownership."
    : testingOnly
      ? "Developer, GTM, and WordPress install handoffs are available for local/dev/test only. DNS TXT verification is still required before public launch."
      : widgetEnabled !== true
        ? "Website chat is disabled until you intentionally enable and configure it."
        : launchEnabled !== true
          ? "Website chat is enabled in settings, but public launch is still blocked until the channel becomes active again."
          : configurationReady !== true
            ? "Website chat is enabled, but installation hardening is still incomplete."
            : s(
                primaryBlocker.subtitle || verification.message,
                "Website Chat is not ready for public launch yet."
              );
  const sharedPackageContract = {
    ready: baseReady && (productionBlocked !== true || unverifiedHandoffsAllowed),
    productionReady: productionLaunchAllowed,
    testingOnly,
    targetDomain,
    verificationState: s(verification.state, "unverified"),
    verificationRequiredForProduction: true,
    blockingReasonCode,
    blockingMessage,
    message:
      productionLaunchAllowed
        ? "Website Chat is ready for developer, GTM, and WordPress install handoffs."
        : testingOnly
          ? "Developer, GTM, and WordPress install handoffs are available for local/dev/test only. DNS TXT verification is still required before public launch."
          : s(
              primaryBlocker.subtitle || verification.message,
              "Website Chat is not ready for an install handoff yet."
            ),
  };

  return {
    status: statusCode,
    channelConfigured,
    configurationReady,
    widgetEnabled,
    launchEnabled,
    publicWidgetId: s(config.publicWidgetId),
    publicWidgetIdPresent,
    allowedOriginsPresent,
    allowedOriginCount: config.allowedOrigins.length,
    allowedDomainsPresent,
    allowedDomainCount: config.allowedDomains.length,
    originRulesPresent,
    targetDomain,
    domainVerificationRequired:
      verification.requiredForProductionInstall !== false,
    domainVerificationState: s(verification.state, "unverified"),
    domainVerified: verification.verified === true,
    productionBlocked,
    productionLaunchAllowed,
    productionReady: productionLaunchAllowed,
    testingOnly,
    testReady: productionLaunchAllowed || testingOnly,
    unverifiedHandoffsAllowed,
    installSurfaceReady,
    installSurface: {
      widgetBaseUrl: s(installSurface.widgetBaseUrl),
      apiBase: s(installSurface.apiBase),
      scriptUrl: s(installSurface.scriptUrl),
      iframePath: s(installSurface.iframePath),
      embedSnippetReady: installSurfaceReady,
    },
    reasonCode: blockingReasonCode,
    message,
    blockerReasonCodes: uniq(
      blockers.map((item) => s(item?.reasonCode)).filter(Boolean)
    ),
    blockers,
    handoffs: {
      developer: buildWebsitePackageContract("developer", sharedPackageContract),
      gtm: buildWebsitePackageContract("gtm", sharedPackageContract),
      wordpress: buildWebsitePackageContract("wordpress", sharedPackageContract),
    },
  };
}

function buildWebsiteInstallSurface(
  req,
  status = {},
  domainVerification = null,
  launchReadiness = null
) {
  const install = buildWebsiteWidgetInstallSurface(req, status);
  const launch = obj(
    launchReadiness || buildWebsiteLaunchReadiness(req, status, domainVerification)
  );
  const developerHandoff = obj(obj(launch.handoffs).developer);
  const gtmHandoff = obj(obj(launch.handoffs).gtm);
  const wordpressHandoff = obj(obj(launch.handoffs).wordpress);

  return {
    ...install,
    productionInstallReady: launch.productionLaunchAllowed === true,
    productionBlocked: launch.productionBlocked === true,
    blockReasonCode: s(launch.reasonCode),
    blockMessage: s(
      launch.productionBlocked
        ? developerHandoff.blockingMessage || launch.message
        : ""
    ),
    embedSnippet:
      launch.productionLaunchAllowed === true ? s(install.embedSnippet) : "",
    unverifiedHandoffsAllowed: launch.unverifiedHandoffsAllowed === true,
    handoffReady: developerHandoff.ready === true,
    developerHandoffReady: developerHandoff.ready === true,
    gtmHandoffReady: gtmHandoff.ready === true,
    wordpressHandoffReady: wordpressHandoff.ready === true,
    handoffTestingOnly: developerHandoff.testingOnly === true,
    handoffProductionReady: developerHandoff.productionReady === true,
    handoffTargetDomain: s(launch.targetDomain),
    handoffVerificationState: s(launch.domainVerificationState, "unverified"),
    handoffBlockReasonCode: s(developerHandoff.blockingReasonCode),
    handoffMessage: s(developerHandoff.message || launch.message),
    verificationRequiredForProduction: true,
    handoffs: launch.handoffs,
    launchReadiness: launch,
  };
}

function buildWebsiteInstallHandoffInstructions({
  verifiedDomain = "",
  targetDomain = verifiedDomain,
  loaderScriptUrl = "",
  apiBase = "",
  testingOnly = false,
} = {}) {
  const scriptOrigin = normalizeUrl(loaderScriptUrl)?.origin || "";
  const apiOrigin = normalizeUrl(apiBase)?.origin || "";
  const installDomain = s(targetDomain || verifiedDomain);

  const instructions = [
    `Add the loader snippet once before the closing </body> tag on pages served from ${installDomain}.`,
    "Keep the data-widget-id and data-api-base values exactly as provided.",
    `Publish the website change, then load a page on ${installDomain} and confirm Website Chat opens successfully.`,
    scriptOrigin || apiOrigin
      ? `If the website uses a strict Content Security Policy, allow ${[scriptOrigin, apiOrigin]
          .filter(Boolean)
          .join(" and ")}.`
      : "If the website uses a strict Content Security Policy, allow the Website Chat loader and API origins.",
  ];

  if (testingOnly) {
    instructions.unshift(
      "This install handoff is for local/dev/test only while DNS TXT verification is still pending for production launch."
    );
  }

  return instructions;
}

function buildWebsiteGtmInstallHandoffInstructions({
  verifiedDomain = "",
  targetDomain = verifiedDomain,
  loaderScriptUrl = "",
  apiBase = "",
  testingOnly = false,
} = {}) {
  const scriptOrigin = normalizeUrl(loaderScriptUrl)?.origin || "";
  const apiOrigin = normalizeUrl(apiBase)?.origin || "";
  const installDomain = s(targetDomain || verifiedDomain);

  const instructions = [
    `In Google Tag Manager, create a new Custom HTML tag for pages served from ${installDomain}.`,
    "Paste the GTM Custom HTML block exactly as provided below and keep the widget ID plus API base unchanged.",
    `Use a Pages trigger that covers the selected domain, then preview and publish the GTM container for ${installDomain}.`,
    `After publish, load a page on ${installDomain} and confirm Website Chat opens successfully.`,
    scriptOrigin || apiOrigin
      ? `If the website uses a strict Content Security Policy, allow ${[scriptOrigin, apiOrigin]
          .filter(Boolean)
          .join(" and ")}.`
      : "If the website uses a strict Content Security Policy, allow the Website Chat loader and API origins.",
  ];

  if (testingOnly) {
    instructions.unshift(
      "This GTM handoff is for local/dev/test only while DNS TXT verification is still pending for production launch."
    );
  }

  return instructions;
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
  targetDomain = verifiedDomain,
  testingOnly = false,
} = {}) {
  const installDomain = s(targetDomain || verifiedDomain);
  const instructions = [
    "Upload and activate the private AIHQ Website Chat WordPress plugin on the target WordPress site.",
    "Open Settings > AIHQ Website Chat in WordPress admin.",
    "Paste the WordPress package JSON exactly as provided below, save the settings, then enable Website Chat.",
    `Confirm the WordPress site is served from ${installDomain} before going live.`,
    `After saving, load a page on ${installDomain} and confirm Website Chat opens successfully.`,
  ];

  if (testingOnly) {
    instructions.unshift(
      "This WordPress package is for local/dev/test only while DNS TXT verification is still pending for production launch."
    );
  }

  return instructions;
}

function buildWebsiteWordpressInstallConfig({
  targetDomain = "",
  verifiedDomain = "",
  widgetId = "",
  loaderScriptUrl = "",
  apiBase = "",
  readiness = {},
  instructions = [],
} = {}) {
  const safeReadiness = obj(readiness);

  return {
    packageType: "wordpress",
    packageTitle: "Website Chat WordPress install package",
    ready: true,
    targetDomain,
    verifiedDomain,
    widgetId,
    loaderScriptUrl,
    apiBase,
    testingOnly: safeReadiness.testingOnly === true,
    productionReady: safeReadiness.productionReady === true,
    verificationState: s(safeReadiness.verificationState),
    verificationRequiredForProduction:
      safeReadiness.verificationRequiredForProduction === true,
    blockingReasonCode: s(safeReadiness.blockingReasonCode),
    blockingMessage: s(safeReadiness.blockingMessage),
    warning: s(safeReadiness.warning),
    message: s(safeReadiness.message),
    readiness: safeReadiness,
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
  targetDomain = "",
  verifiedDomain = "",
  widgetId = "",
  loaderScriptUrl = "",
  apiBase = "",
  packageSnippet = "",
  snippetLabel = "Embed snippet",
  readiness = {},
  instructions = [],
} = {}) {
  const safeReadiness = obj(readiness);
  const installDomain = s(targetDomain || verifiedDomain);
  const domainLabel =
    safeReadiness.productionReady === true ? "Verified domain" : "Target domain";
  const lines = [
    title,
    "",
    `${domainLabel}: ${installDomain}`,
    `Widget ID: ${widgetId}`,
    `Loader script URL: ${loaderScriptUrl}`,
    `API base: ${apiBase}`,
    `Install readiness: ${s(safeReadiness.status, "ready")}`,
    `Verification state: ${s(safeReadiness.verificationState, "verified")}`,
    `Production ready: ${safeReadiness.productionReady === true ? "Yes" : "No"}`,
    `Testing only: ${safeReadiness.testingOnly === true ? "Yes" : "No"}`,
    `DNS TXT required before public launch: ${safeReadiness.verificationRequiredForProduction === true ? "Yes" : "No"}`,
  ];

  if (s(safeReadiness.message)) {
    lines.push(`Message: ${s(safeReadiness.message)}`);
  }

  if (s(safeReadiness.blockingReasonCode)) {
    lines.push(`Blocking reason: ${s(safeReadiness.blockingReasonCode)}`);
  }

  if (s(safeReadiness.blockingMessage)) {
    lines.push(`Blocking message: ${s(safeReadiness.blockingMessage)}`);
  }

  if (s(safeReadiness.warning)) {
    lines.push(`Warning: ${s(safeReadiness.warning)}`);
  }

  if (s(safeReadiness.verifiedAt)) {
    lines.push(`Verified at: ${s(safeReadiness.verifiedAt)}`);
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
  const safePackageType = s(packageType, "developer").toLowerCase();
  const statusPayload = buildWebsiteWidgetStatusPayload(
    req,
    status,
    "owner",
    domainVerification
  );
  const launchReadiness = obj(statusPayload.launchReadiness);
  const rawInstallSurface = buildWebsiteWidgetInstallSurface(req, status);
  const widget = obj(statusPayload.widget);
  const verification = obj(statusPayload.domainVerification);
  const handoffContract = obj(
    obj(launchReadiness.handoffs)[safePackageType] ||
      obj(launchReadiness.handoffs).developer
  );
  const targetDomain = s(
    handoffContract.targetDomain ||
      launchReadiness.targetDomain ||
      verification.domain ||
      verification.candidateDomain
  );
  const verifiedDomain =
    s(verification.state).toLowerCase() === "verified" ? s(verification.domain) : "";
  const handoffReady = handoffContract.ready === true;

  if (
    handoffReady !== true ||
    !s(rawInstallSurface.scriptUrl) ||
    !s(rawInstallSurface.apiBase) ||
    !targetDomain
  ) {
    const reasonCode = s(
      handoffContract.blockingReasonCode ||
        launchReadiness.reasonCode ||
        verification.reasonCode,
      "website_widget_not_ready"
    );
    const message = s(
      handoffContract.message ||
        handoffContract.blockingMessage ||
        launchReadiness.message ||
        verification.message,
      "Website Chat is not ready for a developer install handoff yet."
    );
    const error = createHttpError(message, 409, reasonCode);
    error.payload = {
      ...handoffContract,
      ready: false,
      targetDomain,
    };
    throw error;
  }

  const packageTitle =
    safePackageType === "gtm"
      ? "Website Chat GTM install handoff"
      : safePackageType === "wordpress"
        ? "Website Chat WordPress install package"
      : "Website Chat developer install handoff";
  const testingOnly = handoffContract.testingOnly === true;
  const productionReady = handoffContract.productionReady === true;
  const warning = testingOnly
    ? "This package is for local/dev/test only. DNS TXT verification is still required before public launch."
    : "";
  const readiness = {
    status: productionReady
      ? "ready"
      : testingOnly
        ? "testing_only"
        : "blocked",
    message: s(
      handoffContract.message || launchReadiness.message,
      testingOnly
        ? "This package is for local/dev/test only while DNS TXT verification remains pending for production launch."
        : "Website Chat is ready for production install."
    ),
    productionInstallReady: productionReady,
    productionReady,
    testingOnly,
    verificationState: s(
      handoffContract.verificationState || verification.state,
      productionReady ? "verified" : "unverified"
    ),
    verifiedAt: verification.verifiedAt || null,
    targetDomain,
    verifiedDomain,
    verificationRequiredForProduction: true,
    unverifiedHandoffsAllowed:
      launchReadiness.unverifiedHandoffsAllowed === true,
    blockingReasonCode: s(handoffContract.blockingReasonCode),
    blockingMessage: s(handoffContract.blockingMessage),
    warning,
  };
  const instructions =
    safePackageType === "gtm"
      ? buildWebsiteGtmInstallHandoffInstructions({
          verifiedDomain,
          targetDomain,
          loaderScriptUrl: rawInstallSurface.scriptUrl,
          apiBase: rawInstallSurface.apiBase,
          testingOnly,
        })
      : safePackageType === "wordpress"
        ? buildWebsiteWordpressInstallHandoffInstructions({
          verifiedDomain,
          targetDomain,
          testingOnly,
        })
        : buildWebsiteInstallHandoffInstructions({
            verifiedDomain,
            targetDomain,
            loaderScriptUrl: rawInstallSurface.scriptUrl,
            apiBase: rawInstallSurface.apiBase,
            testingOnly,
          });
  const wordpressConfig =
    safePackageType === "wordpress"
      ? buildWebsiteWordpressInstallConfig({
          targetDomain,
          verifiedDomain,
          widgetId: s(widget.publicWidgetId),
          loaderScriptUrl: s(rawInstallSurface.scriptUrl),
          apiBase: s(rawInstallSurface.apiBase),
          readiness,
          instructions,
        })
      : null;
  const packageSnippet =
    safePackageType === "gtm"
      ? buildWebsiteGtmCustomHtmlSnippet({
          loaderScriptUrl: s(rawInstallSurface.scriptUrl),
          widgetId: s(widget.publicWidgetId),
          apiBase: s(rawInstallSurface.apiBase),
        })
      : safePackageType === "wordpress"
        ? JSON.stringify(wordpressConfig, null, 2)
        : s(rawInstallSurface.embedSnippet);
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
    targetDomain,
    verifiedDomain,
    widgetId: s(widget.publicWidgetId),
    loaderScriptUrl: s(rawInstallSurface.scriptUrl),
    apiBase: s(rawInstallSurface.apiBase),
    embedSnippet: s(rawInstallSurface.embedSnippet),
    productionReady,
    testingOnly,
    verificationState: readiness.verificationState,
    verificationRequiredForProduction: true,
    blockingReasonCode: s(handoffContract.blockingReasonCode),
    blockingMessage: s(handoffContract.blockingMessage),
    unverifiedHandoffsAllowed:
      launchReadiness.unverifiedHandoffsAllowed === true,
    warning,
    message: readiness.message,
    gtmCustomHtmlSnippet:
      safePackageType === "gtm" ? packageSnippet : "",
    wordpressConfig,
    packageSnippet,
    snippetLabel,
    instructions,
    readiness,
    launchReadiness,
    packageText:
      safePackageType === "wordpress"
        ? packageSnippet
        : buildWebsiteInstallHandoffText({
            title: packageTitle,
            targetDomain,
            verifiedDomain,
            widgetId: s(widget.publicWidgetId),
            loaderScriptUrl: s(rawInstallSurface.scriptUrl),
            apiBase: s(rawInstallSurface.apiBase),
            packageSnippet,
            snippetLabel,
            readiness,
            instructions,
          }),
  };
}

function normalizeWebsiteTestMessageText(value = "") {
  const text = s(value).replace(/\s+/g, " ").trim();
  if (!text) return "Salam, bu Website Chat test mesajıdır.";
  return text.slice(0, 1000);
}

function buildWebsiteTestActor(req = {}) {
  return {
    actorId: s(req?.auth?.identityId || req?.user?.id || req?.auth?.userId),
    actorEmail: s(req?.auth?.email || req?.user?.email),
    actorRole: s(getNormalizedAuthRole(req), "member"),
  };
}

async function createWebsiteChatTestMessage({
  db,
  tenant,
  text = "",
  actor = {},
} = {}) {
  if (!db?.connect) {
    throw createHttpError("Database is not available.", 503, "db_unavailable");
  }

  const tenantId = s(tenant?.id);
  const tenantKey = s(tenant?.tenant_key || tenant?.tenantKey);
  const messageText = normalizeWebsiteTestMessageText(text);
  const testId = crypto.randomUUID();
  const externalThreadId = `website-test:${tenantKey}:setup`;
  const externalMessageId = `website-test:${testId}`;
  const now = new Date().toISOString();

  let client = null;

  try {
    client = await db.connect();
    await client.query("BEGIN");

    const meta = {
      source: "website_chat_setup_test",
      test: true,
      testId,
      createdAt: now,
      actor,
      websiteChat: {
        setupTest: true,
        channel: "website",
        publicWidgetRuntime: false,
      },
    };

    const { thread, threadWasCreated } = await findOrCreateThreadForIngest({
      client,
      tenantId,
      tenantKey,
      channel: "website",
      externalThreadId,
      externalUserId: "website-chat-test-visitor",
      externalUsername: "website-chat-test",
      customerName: "Website Chat Test Visitor",
      meta,
    });

    const message = await insertInboundMessage({
      client,
      threadId: thread.id,
      tenantId,
      tenantKey,
      externalMessageId,
      text: messageText,
      meta: {
        ...meta,
        threadWasCreated,
      },
      timestamp: Date.now(),
    });

    await client.query("COMMIT");

    return {
      testId,
      thread,
      message,
      threadWasCreated,
    };
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }

    throw error;
  } finally {
    try {
      client?.release?.();
    } catch {}
  }
}
export async function createWebsiteWidgetTestMessage({ db, req }) {
  const tenantKey = getReqTenantKey(req);
  const viewerRole = getNormalizedAuthRole(req);

  if (!canManageSettings(viewerRole)) {
    throw createHttpError(
      "You do not have permission to send a Website Chat setup test message.",
      403,
      "website_test_message_forbidden"
    );
  }

  if (!tenantKey) {
    throw createHttpError(
      "Tenant is required before sending a Website Chat setup test message.",
      400,
      "tenant_required"
    );
  }

  const tenant = await getTenantByKey(db, tenantKey);
  if (!tenant?.id) {
    throw createHttpError("Tenant not found.", 404, "tenant_not_found");
  }

  const status = await resolveWebsiteWidgetStatus(db, tenantKey);
  if (!status?.id) {
    throw createHttpError(
      "Website Chat status is not available for this tenant.",
      404,
      "website_widget_status_missing"
    );
  }

  const config = normalizeWidgetConfig(status.widgetConfig, {
    defaultEnabled: widgetStatusAllowsInstall(status.widgetChannelStatus),
  });

  if (!config.publicWidgetId) {
    throw createHttpError(
      "Save Website Chat settings once before sending a test message.",
      409,
      "website_widget_public_id_missing"
    );
  }

  const result = await createWebsiteChatTestMessage({
    db,
    tenant,
    text: req?.body?.text,
    actor: buildWebsiteTestActor(req),
  });

  await auditSafe(db, {
    tenantId: tenant.id,
    tenantKey,
    actor: getReqActor(req),
    action: "website_chat.test_message_created",
    entityType: "tenant_channel",
    entityId: status.widgetChannelId || null,
    metadata: {
      testId: result.testId,
      threadId: result.thread?.id || "",
      messageId: result.message?.id || "",
      threadWasCreated: result.threadWasCreated === true,
    },
  });

  return {
    testId: result.testId,
    thread: {
      id: result.thread?.id || "",
      channel: result.thread?.channel || "website",
      externalThreadId: result.thread?.external_thread_id || "",
      customerName:
        result.thread?.customer_name || "Website Chat Test Visitor",
      status: result.thread?.status || "open",
      unreadCount: result.thread?.unread_count ?? null,
    },
    message: {
      id: result.message?.id || "",
      text: result.message?.text || "",
      direction: result.message?.direction || "inbound",
      senderType: result.message?.sender_type || "customer",
      createdAt: result.message?.created_at || null,
    },
    inbox: {
      channel: "website",
      threadId: result.thread?.id || "",
    },
  };
}

function buildBlockers(launchReadiness = null) {
  return arr(obj(launchReadiness).blockers);
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
  const launchReadiness = buildWebsiteLaunchReadiness(
    req,
    status,
    verificationSurface
  );
  const blockers = buildBlockers(launchReadiness);
  const saveAllowed = canManageSettings(viewerRole);
  const ready = launchReadiness.productionLaunchAllowed === true;
  const install = buildWebsiteInstallSurface(
    req,
    status,
    verificationSurface,
    launchReadiness,
  );
  const installPlanBase = buildWebsiteChatInstallPlan({
    websiteUrl: status.websiteUrl,
    hints: [
      status.websiteUrl,
      launchReadiness.targetDomain,
      status.widgetProvider,
      status.widgetDisplayName,
      ...config.allowedOrigins,
      ...config.allowedDomains,
    ],
    access: {
      developer: launchReadiness.handoffs?.developer?.ready === true,
      googleTagManager: launchReadiness.handoffs?.gtm?.ready === true,
      cmsAdmin: launchReadiness.handoffs?.wordpress?.ready === true,
    },
  });
  const installPlan = {
    ...installPlanBase,
    availableHandoffs: launchReadiness.handoffs || {},
    currentReadiness: {
      status: launchReadiness.status,
      productionReady: launchReadiness.productionReady === true,
      testingOnly: launchReadiness.testingOnly === true,
      testReady: launchReadiness.testReady === true,
      reasonCode: launchReadiness.reasonCode || "",
      message: launchReadiness.message || "",
    },
  };

  return {
    tenantId: s(status.id),
    tenantKey: s(status.tenantKey || status.tenant_key),
    state:
      ready
        ? "connected"
        : launchReadiness.status === "not_configured"
          ? "not_connected"
          : config.enabled
            ? "blocked"
            : "not_connected",
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
      installAccessHints: config.installAccessHints,
      websiteUrl: s(status.websiteUrl),
      channelStatus: s(status.widgetChannelStatus),
      updatedAt: status.widgetUpdatedAt || null,
    },
    install,
    installPlan,
    handoffs: launchReadiness.handoffs,
    domainVerification: verificationSurface,
    launchReadiness,
    readiness: {
      status: ready
        ? "ready"
        : launchReadiness.status === "not_configured"
          ? "attention"
          : config.enabled
          ? "blocked"
          : "attention",
      reasonCode: s(launchReadiness.reasonCode),
      message: s(launchReadiness.message),
      blockers,
    },
  
    guidedSetup: buildWebsiteGuidedSetupState({
      status,
      domainVerification,
      launchReadiness,
    }),
};
}

async function loadWebsiteWidgetStatusPayload({
  db,
  req,
  tenantKey = "",
  viewerRole = "member",
  requestedDomain = "",
} = {}) {
  const status = await resolveWebsiteWidgetStatus(db, tenantKey);
  if (!status?.id) {
    return null;
  }

  const domainVerification = await loadWebsiteDomainVerificationSurface(db, status, {
    requestedDomain,
  });

  return buildWebsiteWidgetStatusPayload(
    req,
    status,
    viewerRole,
    domainVerification
  );
}

function buildWebsiteLaneUnavailableHealthPayload({
  tenantKey = "",
  targetDomain = "",
  reasonCode = "tenant_not_found",
  message = "Tenant not found for Website lane verification.",
} = {}) {
  const sharedContract = {
    ready: false,
    productionReady: false,
    testingOnly: false,
    targetDomain,
    verificationState: "unverified",
    verificationRequiredForProduction: true,
    blockingReasonCode: reasonCode,
    blockingMessage: message,
    message,
  };

  return {
    tenantKey: s(tenantKey),
    tenantId: "",
    tenantFound: false,
    status: "not_configured",
    channelConfigured: false,
    configurationReady: false,
    widgetEnabled: false,
    launchEnabled: false,
    publicWidgetId: "",
    publicWidgetIdPresent: false,
    allowedOriginsPresent: false,
    allowedOriginCount: 0,
    allowedDomainsPresent: false,
    allowedDomainCount: 0,
    originRulesPresent: false,
    targetDomain: s(targetDomain),
    domainVerificationRequired: true,
    domainVerificationState: "unverified",
    domainVerified: false,
    productionBlocked: true,
    productionLaunchAllowed: false,
    productionReady: false,
    testingOnly: false,
    testReady: false,
    unverifiedHandoffsAllowed: false,
    installSurfaceReady: false,
    installSurface: {
      widgetBaseUrl: "",
      apiBase: "",
      scriptUrl: "",
      iframePath: "/widget/website-chat",
      embedSnippetReady: false,
    },
    reasonCode: s(reasonCode),
    message: s(message),
    blockerReasonCodes: [s(reasonCode)].filter(Boolean),
    blockers: [],
    handoffs: {
      developer: buildWebsitePackageContract("developer", sharedContract),
      gtm: buildWebsitePackageContract("gtm", sharedContract),
      wordpress: buildWebsitePackageContract("wordpress", sharedContract),
    },
  };
}

function normalizeWebsiteLaneHealthReasonCode(launchReadiness = {}) {
  const launch = obj(launchReadiness);
  if (launch.productionLaunchAllowed === true || launch.productionReady === true) {
    return "";
  }

  const reasonCodes = arr(launch.blockerReasonCodes)
    .map((item) => s(item))
    .filter(Boolean);
  const primary = s(launch.reasonCode || reasonCodes[0]);

  if (
    primary === "website_widget_public_id_missing" ||
    primary === "website_widget_origin_rules_missing" ||
    primary === "website_install_target_domain_missing" ||
    launch.channelConfigured !== true ||
    launch.publicWidgetIdPresent !== true ||
    launch.originRulesPresent !== true
  ) {
    return "website_not_configured";
  }

  if (
    primary === "website_widget_disabled" ||
    primary === "website_widget_channel_inactive" ||
    launch.widgetEnabled !== true
  ) {
    return "widget_not_enabled";
  }

  if (
    primary === "website_domain_verification_missing" ||
    primary === "website_domain_verification_required" ||
    launch.domainVerified === false
  ) {
    return "domain_unverified";
  }

  return primary || "website_not_configured";
}

export async function getWebsiteLaneHealthStatus({ db, req }) {
  const tenantKey = s(req?.query?.tenantKey || req?.query?.tenant_key);
  const requestedDomain = s(req?.query?.domain || req?.query?.targetDomain);

  if (!tenantKey) {
    throw createHttpError(
      "Missing website lane tenantKey query parameter",
      400,
      "website_lane_tenant_key_missing"
    );
  }

  const payload = await loadWebsiteWidgetStatusPayload({
    db,
    req,
    tenantKey,
    viewerRole: "owner",
    requestedDomain,
  });

  if (!payload) {
    return buildWebsiteLaneUnavailableHealthPayload({
      tenantKey,
      targetDomain: requestedDomain,
    });
  }

  const launchReadiness = obj(payload.launchReadiness);
  const healthReasonCode = normalizeWebsiteLaneHealthReasonCode(launchReadiness);

  return {
    tenantKey: s(payload.tenantKey || tenantKey),
    tenantId: s(payload.tenantId),
    tenantFound: true,
    ...launchReadiness,
    reasonCode: healthReasonCode,
    detailedReasonCode: s(launchReadiness.reasonCode),
  };
}

export async function getWebsiteWidgetStatus({ db, req }) {
  const tenantKey = getReqTenantKey(req);
  if (!tenantKey) {
    throw createHttpError("Missing tenant context", 401);
  }

  const payload = await loadWebsiteWidgetStatusPayload({
    db,
    req,
    tenantKey,
    viewerRole: getNormalizedAuthRole(req),
    requestedDomain: req?.query?.domain || "",
  });

  if (!payload) {
    throw createHttpError("Tenant not found", 404);
  }

  return payload;
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

async function checkWebsiteDomainVerificationBase({
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
      targetDomain: payload.targetDomain,
      verifiedDomain: payload.verifiedDomain,
      widgetId: payload.widgetId,
      verificationState: payload.verificationState,
      productionReady: payload.productionReady === true,
      testingOnly: payload.testingOnly === true,
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
      targetDomain: payload.targetDomain,
      verifiedDomain: payload.verifiedDomain,
      widgetId: payload.widgetId,
      packageType: "gtm",
      verificationState: payload.verificationState,
      productionReady: payload.productionReady === true,
      testingOnly: payload.testingOnly === true,
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
      targetDomain: payload.targetDomain,
      verifiedDomain: payload.verifiedDomain,
      widgetId: payload.widgetId,
      packageType: "wordpress",
      verificationState: payload.verificationState,
      productionReady: payload.productionReady === true,
      testingOnly: payload.testingOnly === true,
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






export async function checkWebsiteDomainVerification({ db, req, resolveTxtFn } = {}) {
  const result = await checkWebsiteDomainVerificationBase({ db, req, resolveTxtFn });

  try {
    const websiteSourceProvisioning = await provisionVerifiedWebsiteSource({
      db,
      req,
      result,
    });

    return {
      ...result,
      websiteSourceProvisioning,
    };
  } catch (error) {
    req?.log?.error?.("website.domain_verification.source_provisioning_failed", error, {
      reasonCode: s(error?.reasonCode || error?.message),
    });

    return {
      ...result,
      websiteSourceProvisioning: {
        ok: false,
        skipped: false,
        reasonCode: "website_source_provisioning_failed",
        message: s(error?.message || "Website source provisioning failed."),
      },
    };
  }
}


function normalizeWebsiteReviewLimit(value = 20) {
  const next = Number(value);
  if (!Number.isFinite(next)) return 20;
  return Math.max(1, Math.min(50, Math.floor(next)));
}

function isWebsiteReviewCandidate(item = {}) {
  const sourceType = s(item.source_type || item.sourceType).toLowerCase();
  const sourceName = s(item.source_display_name || item.sourceDisplayName).toLowerCase();
  const itemKey = s(item.item_key || item.itemKey).toLowerCase();

  return (
    sourceType === "website" ||
    sourceName.startsWith("website:") ||
    itemKey.startsWith("website_page:")
  );
}

function toWebsiteReviewItem(item = {}) {
  return {
    id: s(item.id),
    candidateId: s(item.id || item.candidateId || item.candidate_id),
    title: s(item.title, "Website information"),
    valueText: s(item.value_text || item.valueText),
    valueJson: obj(item.value_json || item.valueJson),
    status: s(item.status).toLowerCase(),
    category: s(item.category).toLowerCase(),
    confidence: Number(item.confidence || 0),
    confidenceLabel: s(item.confidence_label || item.confidenceLabel),
    source: {
      type: s(item.source_type || item.sourceType),
      displayName: s(item.source_display_name || item.sourceDisplayName),
      runId: s(item.source_run_id || item.sourceRunId),
    },
    evidence: arr(item.source_evidence_json || item.sourceEvidenceJson),
    reviewReason: s(item.review_reason || item.reviewReason),
    createdAt: s(item.created_at || item.createdAt),
    updatedAt: s(item.updated_at || item.updatedAt),
  };
}

export async function getWebsiteGuidedSetupReview({ db, req } = {}) {
  const tenantKey = getReqTenantKey(req);
  const tenant = await getTenantByKey(db, tenantKey);

  if (!tenant?.id) {
    throw createHttpError("Tenant not found.", 404, "tenant_not_found");
  }

  const limit = normalizeWebsiteReviewLimit(req?.query?.limit || req?.body?.limit || 20);
  const knowledge = createTenantKnowledgeHelpers({ db });

  const queue = await knowledge.listReviewQueue({
    tenantId: tenant.id,
    tenantKey: tenant.tenant_key || tenant.tenantKey || tenantKey,
    category: "business_info",
    limit: 50,
    offset: 0,
  });

  const websiteItems = arr(queue)
    .filter(isWebsiteReviewCandidate)
    .slice(0, limit)
    .map(toWebsiteReviewItem);

  const summary = {
    total: websiteItems.length,
    needsReview: websiteItems.filter((item) =>
      ["pending", "needs_review", "conflict"].includes(item.status)
    ).length,
    conflicts: websiteItems.filter((item) => item.status === "conflict").length,
    highConfidence: websiteItems.filter((item) => Number(item.confidence || 0) >= 0.8).length,
  };

  return {
    ok: true,
    mode: "guided",
    sourceType: "website",
    reviewReady: websiteItems.length > 0,
    summary,
    items: websiteItems,
    nextAction: websiteItems.length
      ? {
          label: "Review website information",
          action: "open_truth_review",
          path: "/truth?source=website&review=business_info",
        }
      : {
          label: "Waiting for website scan",
          action: "wait_for_crawl",
        },
  };
}


async function ensureWebsiteReviewCandidate({ db, req, candidateId = "" } = {}) {
  const tenantKey = getReqTenantKey(req);
  const tenant = await getTenantByKey(db, tenantKey);

  if (!tenant?.id) {
    throw createHttpError("Tenant not found.", 404, "tenant_not_found");
  }

  const knowledge = createTenantKnowledgeHelpers({ db });
  const candidate = await knowledge.getCandidateById(candidateId);

  if (!candidate?.id) {
    throw createHttpError(
      "Website review item not found.",
      404,
      "website_review_item_not_found"
    );
  }

  if (s(candidate.tenant_id) !== s(tenant.id)) {
    throw createHttpError(
      "Website review item does not belong to this tenant.",
      403,
      "website_review_item_tenant_mismatch"
    );
  }

  const queue = await knowledge.listReviewQueue({
    tenantId: tenant.id,
    tenantKey: tenant.tenant_key || tenant.tenantKey || tenantKey,
    category: "business_info",
    limit: 200,
    offset: 0,
  });

  const visible = arr(queue).find((item) => s(item.id) === s(candidate.id));

  if (!visible || !isWebsiteReviewCandidate(visible)) {
    throw createHttpError(
      "This review item is not a website business-info candidate.",
      400,
      "website_review_item_invalid_source"
    );
  }

  return {
    tenant,
    knowledge,
    candidate,
    visible,
  };
}

function getWebsiteReviewActor(req = {}) {
  const user = obj(req?.user || req?.auth || {});
  return {
    reviewerId: s(
      user.id ||
        user.userId ||
        user.identityId ||
        req?.auth?.identityId ||
        req?.auth?.userId ||
        "website_guided_setup"
    ),
    reviewerName: s(
      user.name ||
        user.email ||
        user.displayName ||
        req?.auth?.email ||
        "Website guided setup"
    ),
  };
}

export async function approveWebsiteGuidedSetupReviewItem({ db, req } = {}) {
  const candidateId = s(req?.params?.candidateId || req?.body?.candidateId);

  if (!candidateId) {
    throw createHttpError(
      "Website review item id is required.",
      400,
      "website_review_item_id_required"
    );
  }

  const { knowledge, visible } = await ensureWebsiteReviewCandidate({
    db,
    req,
    candidateId,
  });

  const actor = getWebsiteReviewActor(req);
  const result = await knowledge.approveCandidate(candidateId, {
    ...actor,
    reason: s(
      req?.body?.reason,
      "Approved from guided Website Chat setup review."
    ),
    metadataJson: {
      source: "website_guided_setup_review",
      sourceType: "website",
      category: "business_info",
    },
  });

  return {
    ok: true,
    action: "approve",
    item: toWebsiteReviewItem(visible),
    result,
  };
}

export async function rejectWebsiteGuidedSetupReviewItem({ db, req } = {}) {
  const candidateId = s(req?.params?.candidateId || req?.body?.candidateId);

  if (!candidateId) {
    throw createHttpError(
      "Website review item id is required.",
      400,
      "website_review_item_id_required"
    );
  }

  const { knowledge, visible } = await ensureWebsiteReviewCandidate({
    db,
    req,
    candidateId,
  });

  const actor = getWebsiteReviewActor(req);
  const result = await knowledge.rejectCandidate(candidateId, {
    ...actor,
    reason: s(
      req?.body?.reason,
      "Rejected from guided Website Chat setup review."
    ),
    metadataJson: {
      source: "website_guided_setup_review",
      sourceType: "website",
      category: "business_info",
    },
  });

  return {
    ok: true,
    action: "reject",
    item: toWebsiteReviewItem(visible),
    result,
  };
}
