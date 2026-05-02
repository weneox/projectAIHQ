import { cfg } from "../config.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
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
  res.setHeader("Retry-After", String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
  return res.status(429).json({
    ok: false,
    error: "Too many requests",
    code: `${s(policyName, "global")}_rate_limited`,
    reason: `${s(policyName, "global")}_rate_limited`,
    requestId: req?.requestId || null,
    retryAfterMs,
    rateLimit: {
      policy: s(policyName, "global"),
      subject: subjectKey,
      limit,
      remaining: 0,
      resetAt: new Date(Number(bucket.resetAt || now)).toISOString(),
      retryAfterMs,
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

export function resetInMemoryRateLimitsForTest() {
  buckets.clear();
}

export const __test__ = {
  getRequestIp,
  resetInMemoryRateLimitsForTest,
};
