import crypto from "crypto";
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
} from "../inbox/internal/persistence.js";import { auditSafe, getTenantByKey } from "./repository.js";
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
    launchReadiness
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

  return {
    tenantKey: s(payload.tenantKey || tenantKey),
    tenantId: s(payload.tenantId),
    tenantFound: true,
    ...obj(payload.launchReadiness),
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




