function safeTaskName(value = "") {
  return String(value || "task").trim() || "task";
}

function s(value = "") {
  return String(value ?? "").trim();
}

function n(value, fallback = 0) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}

function lower(value = "") {
  return s(value).toLowerCase();
}

function iso(value) {
  if (!value) return "";

  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString();
  } catch {
    return "";
  }
}

export function dispatchDetachedTask(taskName, run) {
  const label = safeTaskName(taskName);
  const runner = typeof run === "function" ? run : async () => {};

  setImmediate(() => {
    Promise.resolve()
      .then(runner)
      .catch((err) => {
        console.error(
          `[async-task] ${label} failed:`,
          String(err?.message || err)
        );
      });
  });
}

export function buildWorkerRunnerKey(prefix = "worker") {
  const label = safeTaskName(prefix).replace(/\s+/g, "-").toLowerCase();
  return `${label}:${process.pid}:${Math.random().toString(36).slice(2, 10)}`;
}

export function isSourceSyncRunClaimable(run = {}, now = new Date()) {
  const status = lower(run?.status);
  const nowMs = new Date(now).getTime();
  const nextRetryMs = run?.next_retry_at ? new Date(run.next_retry_at).getTime() : nowMs;
  const leaseExpiresMs = run?.lease_expires_at
    ? new Date(run.lease_expires_at).getTime()
    : 0;

  if (status === "queued") {
    return nextRetryMs <= nowMs;
  }

  if (status === "running") {
    return leaseExpiresMs > 0 && leaseExpiresMs <= nowMs;
  }

  return false;
}

export function computeSourceSyncRetryDelayMs(
  attemptCount = 0,
  {
    baseMs = 15_000,
    maxMs = 10 * 60_000,
  } = {}
) {
    const safeAttempt = Math.max(1, n(attemptCount, 1));
    const computed = baseMs * Math.pow(2, safeAttempt - 1);
    return Math.max(baseMs, Math.min(maxMs, computed));
}

export function isRetryableSourceSyncFailure(resultOrError = {}) {
  const code = lower(resultOrError?.code || resultOrError?.errorCode || "");
  const stage = lower(resultOrError?.stage || "");
  const message = lower(
    resultOrError?.error ||
      resultOrError?.reason ||
      resultOrError?.message ||
      ""
  );

  if (
    code.includes("invalid") ||
    code.includes("unsupported") ||
    code.includes("not_found") ||
    code.includes("missing")
  ) {
    return false;
  }

  if (
    message.includes("valid source url is required") ||
    message.includes("source row missing") ||
    message.includes("source sync run missing") ||
    message.includes("unsupported source type") ||
    message.includes("setup review session is discarded") ||
    message.includes("setup review session is finalized") ||
    message.includes("source sync source not found") ||
    message.includes("setup review session not found")
  ) {
    return false;
  }

  if (
    code.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("temporar") ||
    message.includes("rate limit") ||
    message.includes("429") ||
    stage === "extract" ||
    stage === "resolve_google_place"
  ) {
    return true;
  }

  return true;
}

export function buildSourceSyncRetryPlan({
  attemptCount = 0,
  maxAttempts = 3,
  now = new Date(),
  retryDelayMs = null,
  resultOrError = {},
} = {}) {
  const attempts = Math.max(0, n(attemptCount, 0));
  const limit = Math.max(1, n(maxAttempts, 3));
  const retryable = isRetryableSourceSyncFailure(resultOrError);
  const exhausted = attempts >= limit;
  const terminal = !retryable || exhausted;
  const delayMs =
    retryDelayMs != null
      ? Math.max(1_000, n(retryDelayMs, 15_000))
      : computeSourceSyncRetryDelayMs(attempts);
  const nextRetryAt = terminal
    ? ""
    : new Date(new Date(now).getTime() + delayMs).toISOString();

  return {
    retryable,
    terminal,
    delayMs: terminal ? 0 : delayMs,
    nextRetryAt,
    nextStatus: terminal ? "failed" : "queued",
    attempts,
    maxAttempts: limit,
  };
}

export const __test__ = {
  safeTaskName,
  isSourceSyncRunClaimable,
  computeSourceSyncRetryDelayMs,
  isRetryableSourceSyncFailure,
  buildSourceSyncRetryPlan,
  buildWorkerRunnerKey,
  iso,
};
