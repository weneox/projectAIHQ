import crypto from "crypto";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function isObj(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (isObj(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value ?? null);
}

export function buildExecutionIdempotencyKey(parts = {}) {
  return crypto
    .createHash("sha256")
    .update(stableSerialize(parts), "utf8")
    .digest("hex");
}

export function classifyMetaGatewayFailure(gateway = {}) {
  const status = n(gateway?.status || gateway?.json?.status, 0);
  const text = lower(gateway?.error || "");
  const retryable =
    status === 0 ||
    status >= 500 ||
    text.includes("timeout") ||
    text.includes("temporar") ||
    text.includes("network") ||
    text.includes("rate limit");

  return {
    retryable,
    status,
    errorCode: s(status || gateway?.code || ""),
    classification: retryable ? "retryable_gateway_failure" : "terminal_gateway_failure",
    errorMessage: s(gateway?.error || "meta gateway send failed"),
  };
}

export function classifyVoiceSyncFailure(result = {}) {
  const status = n(result?.status, 0);
  const text = lower(result?.text || result?.error || "");
  const retryable =
    status === 0 ||
    status >= 500 ||
    text.includes("timeout") ||
    text.includes("temporar") ||
    text.includes("network");

  return {
    retryable,
    status,
    errorCode: s(status || result?.code || ""),
    classification: retryable ? "retryable_voice_sync_failure" : "terminal_voice_sync_failure",
    errorMessage: s(result?.text || result?.error || "voice sync failed"),
  };
}

export function buildExecutionRetryPlan({
  attemptCount = 0,
  maxAttempts = 5,
  baseDelayMs = 30_000,
  maxDelayMs = 10 * 60_000,
  retryable = true,
  now = new Date(),
} = {}) {
  const attempts = Math.max(1, n(attemptCount, 1));
  const limit = Math.max(1, n(maxAttempts, 5));
  const exhausted = attempts >= limit;
  const terminal = !retryable || exhausted;
  const delayMs = terminal
    ? 0
    : Math.min(maxDelayMs, Math.max(baseDelayMs, baseDelayMs * Math.pow(2, attempts - 1)));

  return {
    retryable: Boolean(retryable),
    exhausted,
    terminal,
    nextStatus: terminal ? (retryable ? "dead_lettered" : "terminal") : "retryable",
    delayMs,
    nextRetryAt: terminal ? null : new Date(new Date(now).getTime() + delayMs).toISOString(),
  };
}

export function buildVoiceSyncIdempotencyKey(actionType, payload = {}) {
  return buildExecutionIdempotencyKey({
    channel: "voice",
    provider: "twilio",
    actionType: s(actionType),
    payload,
  });
}

export const __test__ = {
  stableSerialize,
};
