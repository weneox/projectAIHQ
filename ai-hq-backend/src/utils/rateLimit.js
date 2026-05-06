import { cfg } from "../config.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function hasText(value) {
  return s(value).length > 0;
}

function isProdLikeEnv(envName = cfg?.app?.env) {
  const env = s(envName, "production").toLowerCase();
  return !["", "development", "dev", "test"].includes(env);
}

function getRequestIp(req) {
  const xfwd = s(req?.headers?.["x-forwarded-for"]);
  if (xfwd) return xfwd.split(",")[0].trim().toLowerCase();
  return s(req?.ip || req?.socket?.remoteAddress || "unknown").toLowerCase();
}

const buckets = new Map();

function getBucketKey(policyName, subjectKey) {
  return `${s(policyName, "global")}::${s(subjectKey, "unknown")}`;
}

function readBucket(policyName, subjectKey, now = Date.now()) {
  const bucketKey = getBucketKey(policyName, subjectKey);
  const current = buckets.get(bucketKey) || null;

  if (!current || Number(current.resetAt || 0) <= now) {
    const fresh = {
      count: 0,
      resetAt: now,
    };
    buckets.set(bucketKey, fresh);
    return fresh;
  }

  return current;
}

function writeBucket(policyName, subjectKey, bucket) {
  buckets.set(getBucketKey(policyName, subjectKey), bucket);
}

export function applyInMemoryRateLimit(
  req,
  res,
  next,
  {
    policyName = "global",
    windowMs = 60_000,
    maxRequests = 60,
    keyFn = getRequestIp,
  } = {}
) {
  const now = Date.now();
  const limit = Math.max(1, n(maxRequests, 60));
  const window = Math.max(1000, n(windowMs, 60_000));
  const subjectKey = s(
    typeof keyFn === "function" ? keyFn(req) : getRequestIp(req),
    "unknown"
  );
  const bucket = readBucket(policyName, subjectKey, now);

  if (Number(bucket.resetAt || 0) <= now) {
    bucket.count = 0;
    bucket.resetAt = now + window;
  }

  bucket.count += 1;
  writeBucket(policyName, subjectKey, bucket);

  if (bucket.count <= limit) {
    return typeof next === "function" ? next() : true;
  }

  const retryAfterMs = Math.max(0, Number(bucket.resetAt || now) - now);
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  res.setHeader("Retry-After", String(retryAfterSeconds));
  return res.status(429).json({
    ok: false,
    error: "Too many requests",
    code: `${s(policyName, "global")}_rate_limited`,
    reason: `${s(policyName, "global")}_rate_limited`,
    requestId: req?.requestId || null,
    retryAfterMs,
    retryAfterSeconds,
    rateLimit: {
      policy: s(policyName, "global"),
      subject: subjectKey,
      limit,
      remaining: 0,
      resetAt: new Date(Number(bucket.resetAt || now)).toISOString(),
      retryAfterMs,
      retryAfterSeconds,
    },
  });
}

export function createRateLimitMiddleware({
  policyName = "global",
  windowMs = 60_000,
  maxRequests = 60,
  keyFn = null,
} = {}) {
  return function rateLimitMiddleware(req, res, next) {
    return applyInMemoryRateLimit(req, res, next, {
      policyName,
      windowMs,
      maxRequests,
      keyFn: keyFn || ((request) => getRequestIp(request)),
    });
  };
}

function keyByIpAndBody(req, bodyKeys = []) {
  const parts = [getRequestIp(req)];
  for (const key of bodyKeys) {
    const value = s(req?.body?.[key]).toLowerCase();
    if (value) parts.push(`${key}:${value}`);
  }
  return parts.join("|");
}

export function requireAuthEndpointRateLimit(req, res, next) {
  return applyInMemoryRateLimit(req, res, next, {
    policyName: "auth",
    windowMs: cfg?.rateLimit?.authWindowMs,
    maxRequests: cfg?.rateLimit?.authMaxRequests,
    keyFn: (request) => keyByIpAndBody(request, ["email"]),
  });
}

export function requireSignupRateLimit(req, res, next) {
  return applyInMemoryRateLimit(req, res, next, {
    policyName: "signup",
    windowMs: cfg?.rateLimit?.signupWindowMs,
    maxRequests: cfg?.rateLimit?.signupMaxRequests,
    keyFn: (request) => keyByIpAndBody(request, ["email", "tenantKey", "tenant_key"]),
  });
}

export function requireAiExecutionRateLimit(req, res, next) {
  return applyInMemoryRateLimit(req, res, next, {
    policyName: "ai_execution",
    windowMs: cfg?.rateLimit?.aiWindowMs,
    maxRequests: cfg?.rateLimit?.aiMaxRequests,
    keyFn: (request) =>
      s(request?.auth?.tenantId || request?.auth?.tenantKey || request?.tenantKey) ||
      getRequestIp(request),
  });
}

export function requireWebhookIngestionRateLimit(req, res, next) {
  return applyInMemoryRateLimit(req, res, next, {
    policyName: "webhook_ingestion",
    windowMs: cfg?.rateLimit?.webhookWindowMs,
    maxRequests: cfg?.rateLimit?.webhookMaxRequests,
    keyFn: (request) =>
      [
        getRequestIp(request),
        s(request?.body?.tenantKey || request?.body?.tenant_key).toLowerCase(),
        s(request?.body?.channel || request?.body?.platform).toLowerCase(),
      ]
        .filter(Boolean)
        .join("|"),
  });
}

export function requireExecutionCallbackRateLimit(req, res, next) {
  return applyInMemoryRateLimit(req, res, next, {
    policyName: "execution_callback",
    windowMs: cfg?.rateLimit?.executionCallbackWindowMs,
    maxRequests: cfg?.rateLimit?.executionCallbackMaxRequests,
    keyFn: (request) => getRequestIp(request),
  });
}

export function requireInboxManualReplyRateLimit(req, res, next) {
  return applyInMemoryRateLimit(req, res, next, {
    policyName: "inbox_manual_reply",
    windowMs: cfg?.rateLimit?.inboxManualReplyWindowMs,
    maxRequests: cfg?.rateLimit?.inboxManualReplyMaxRequests,
    keyFn: (request) =>
      [
        s(request?.auth?.tenantId || request?.auth?.tenantKey || request?.tenantKey),
        s(request?.params?.id),
        getRequestIp(request),
      ]
        .filter(Boolean)
        .join("|"),
  });
}

export function requireSourceSyncTriggerRateLimit(req, res, next) {
  return applyInMemoryRateLimit(req, res, next, {
    policyName: "source_sync_trigger",
    windowMs: cfg?.rateLimit?.sourceSyncWindowMs,
    maxRequests: cfg?.rateLimit?.sourceSyncMaxRequests,
    keyFn: (request) =>
      [
        s(request?.auth?.tenantId || request?.auth?.tenantKey || request?.tenantKey),
        s(request?.params?.id),
        getRequestIp(request),
      ]
        .filter(Boolean)
        .join("|"),
  });
}

const CRITICAL_V1_RATE_LIMIT_COVERAGE = Object.freeze([
  Object.freeze({
    surface: "auth_login_and_session",
    routes: [
      "ai-hq-backend:POST /api/admin-auth/login",
      "ai-hq-backend:POST /api/auth/login",
      "ai-hq-backend:POST /api/auth/select-workspace",
      "ai-hq-backend:POST /api/auth/signup",
    ],
    protections: ["db_attempt_window", "in_memory_edge"],
    sharedAcrossInstances: true,
    proofRequiredBeforeLaunch: true,
  }),
  Object.freeze({
    surface: "website_widget_public_endpoints",
    routes: [
      "ai-hq-backend:POST /api/public/widget/install-token",
      "ai-hq-backend:POST /api/public/widget/bootstrap",
      "ai-hq-backend:POST /api/public/widget/message",
      "ai-hq-backend:POST /api/public/widget/transcript",
    ],
    protections: ["in_memory_backend", "external_shared_or_waf_required"],
    sharedAcrossInstances: false,
    proofRequiredBeforeLaunch: true,
  }),
  Object.freeze({
    surface: "meta_webhook_public_endpoint",
    routes: ["meta-bot-backend:GET /webhook", "meta-bot-backend:POST /webhook"],
    protections: ["signature_verification", "external_shared_or_waf_required"],
    sharedAcrossInstances: false,
    proofRequiredBeforeLaunch: true,
  }),
  Object.freeze({
    surface: "inbox_manual_reply",
    routes: ["ai-hq-backend:POST /api/inbox/threads/:id/messages"],
    protections: ["in_memory_backend", "external_shared_or_waf_required"],
    sharedAcrossInstances: false,
    proofRequiredBeforeLaunch: true,
  }),
  Object.freeze({
    surface: "source_sync_trigger",
    routes: ["ai-hq-backend:POST /api/sources/:id/sync"],
    protections: ["in_memory_backend", "external_shared_or_waf_required"],
    sharedAcrossInstances: false,
    proofRequiredBeforeLaunch: true,
  }),
  Object.freeze({
    surface: "ai_runtime_user_endpoints",
    routes: [
      "ai-hq-backend:POST /api/chat",
      "ai-hq-backend:POST /api/debate",
      "ai-hq-backend:POST /api/executions/callback",
      "ai-hq-backend:POST /api/media/image",
      "ai-hq-backend:POST /api/render/slides",
    ],
    protections: ["in_memory_backend"],
    sharedAcrossInstances: false,
    proofRequiredBeforeLaunch: true,
  }),
]);

export function buildRateLimitControlStatus() {
  const strategy = s(cfg?.rateLimit?.productionStrategy, "memory").toLowerCase();
  const sharedAcrossInstances = ["shared_redis", "upstash", "provider_waf"].includes(
    strategy
  );
  const externalEvidenceConfigured = hasText(cfg?.rateLimit?.externalEvidenceUrl);
  const providerConfigured = hasText(cfg?.rateLimit?.provider);
  const prodLike = isProdLikeEnv(cfg?.app?.env);
  const memoryOnly = strategy === "memory";

  let status = "single_instance_only";
  if (sharedAcrossInstances && providerConfigured && externalEvidenceConfigured) {
    status = "shared_config_declared";
  } else if (sharedAcrossInstances) {
    status = "shared_config_missing_evidence";
  } else if (!prodLike) {
    status = "local_dev_memory_only";
  }

  return {
    status,
    safeForPublicHealth: true,
    prodLike,
    strategy,
    sharedAcrossInstances,
    providerConfigured,
    externalEvidenceConfigured,
    launchReadyByConfig: sharedAcrossInstances && providerConfigured && externalEvidenceConfigured,
    memoryModeIsLaunchReady: false,
    criticalCoverage: CRITICAL_V1_RATE_LIMIT_COVERAGE,
    excludedRoutes: [
      "ai-hq-backend:GET /api",
      "ai-hq-backend:GET /api/health",
      "ai-hq-backend:GET /api/health/website-lane",
    ],
    requiredEvidenceRef: "docs/runbooks/v1-rate-limiting.md",
  };
}

export function resetInMemoryRateLimitsForTest() {
  buckets.clear();
}

export const __test__ = {
  buildRateLimitControlStatus,
  getRequestIp,
  isProdLikeEnv,
  resetInMemoryRateLimitsForTest,
};
