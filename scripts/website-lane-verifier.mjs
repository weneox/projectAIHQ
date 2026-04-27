function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function uniqStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => s(item).toLowerCase()).filter(Boolean))];
}

function normalizeBaseUrl(value = "") {
  return s(value).replace(/\/+$/, "");
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function collectBlockerReasonCodes(source = {}) {
  const explicit = uniqStrings(source.blockerReasonCodes);
  if (explicit.length) return explicit;

  return uniqStrings(
    (Array.isArray(source.blockers) ? source.blockers : []).map((item) =>
      typeof item === "string" ? item : item?.reasonCode || item?.reason_code
    )
  );
}

export function buildWebsiteLaneHealthUrl(
  baseUrl = "",
  { tenantKey = "", domain = "" } = {}
) {
  const root = normalizeBaseUrl(baseUrl);
  if (!root) return "";

  const search = new URLSearchParams();
  if (s(tenantKey)) search.set("tenantKey", s(tenantKey));
  if (s(domain)) search.set("domain", s(domain));

  const query = search.toString();
  return `${root}/api/health/website-lane${query ? `?${query}` : ""}`;
}

export function buildWebsiteLaneHeaders({
  internalToken = "",
  audience = "aihq-backend.health.website-lane",
} = {}) {
  const headers = {};

  if (s(internalToken)) {
    headers["x-internal-token"] = s(internalToken);
  }

  if (s(audience)) {
    headers["x-internal-audience"] = s(audience);
  }

  return headers;
}

export function buildMissingWebsiteLaneTenantKeyResult({
  name = "website_lane_launch",
  required = false,
  strictEnv = "",
} = {}) {
  const strictEnvName = s(strictEnv);
  const strictEnvMessage = strictEnvName
    ? `${strictEnvName}=1`
    : "a strict website lane flag is enabled";

  const details = {
    env: "WEBSITE_LANE_TENANT_KEY",
    strictRequired: required,
    strictEnv: strictEnvName,
    reasonCode: "missing_required_env",
    message: required
      ? `WEBSITE_LANE_TENANT_KEY is required because ${strictEnvMessage}. Production launch verification must exercise a real tenant website lane.`
      : "WEBSITE_LANE_TENANT_KEY is not configured, so website lane verification is skipped for local/dev mode only. Enable the strict website lane flag in production CI.",
  };

  if (required) {
    return {
      name,
      ok: false,
      status: 0,
      details,
    };
  }

  return {
    name,
    skipped: true,
    warning: true,
    reason: "WEBSITE_LANE_TENANT_KEY missing; website lane smoke not exercised",
    details,
  };
}

export function classifyWebsiteLaneHealth(json = {}) {
  const source = obj(json?.websiteLane || json?.lane || json);
  const handoffs = obj(source.handoffs);
  const productionLaunchAllowed =
    source.productionLaunchAllowed === true || source.productionReady === true;
  const blockerReasonCodes = collectBlockerReasonCodes(source);

  return {
    tenantKey: s(source.tenantKey),
    tenantId: s(source.tenantId),
    tenantFound: source.tenantFound === true,
    status: s(source.status),
    channelConfigured: source.channelConfigured === true,
    configurationReady: source.configurationReady === true,
    widgetEnabled: source.widgetEnabled === true,
    launchEnabled: source.launchEnabled === true,
    publicWidgetId: s(source.publicWidgetId),
    publicWidgetIdPresent:
      source.publicWidgetIdPresent === true || Boolean(s(source.publicWidgetId)),
    allowedOriginsPresent: source.allowedOriginsPresent === true,
    allowedOriginCount: n(source.allowedOriginCount),
    allowedDomainsPresent: source.allowedDomainsPresent === true,
    allowedDomainCount: n(source.allowedDomainCount),
    originRulesPresent: source.originRulesPresent === true,
    targetDomain: s(source.targetDomain),
    domainVerificationRequired: source.domainVerificationRequired !== false,
    domainVerificationState: s(source.domainVerificationState, "unverified"),
    domainVerified: source.domainVerified === true,
    productionBlocked: source.productionBlocked === true,
    productionLaunchAllowed,
    productionReady: productionLaunchAllowed,
    testingOnly: source.testingOnly === true,
    testReady: source.testReady === true || productionLaunchAllowed,
    installSurfaceReady: source.installSurfaceReady === true,
    reasonCode: s(source.reasonCode || blockerReasonCodes[0]),
    message: s(source.message),
    blockerReasonCodes,
    handoffs: {
      developer: {
        ready: obj(handoffs.developer).ready === true,
        productionReady: obj(handoffs.developer).productionReady === true,
        testingOnly: obj(handoffs.developer).testingOnly === true,
      },
      gtm: {
        ready: obj(handoffs.gtm).ready === true,
        productionReady: obj(handoffs.gtm).productionReady === true,
        testingOnly: obj(handoffs.gtm).testingOnly === true,
      },
      wordpress: {
        ready: obj(handoffs.wordpress).ready === true,
        productionReady: obj(handoffs.wordpress).productionReady === true,
        testingOnly: obj(handoffs.wordpress).testingOnly === true,
      },
    },
  };
}
