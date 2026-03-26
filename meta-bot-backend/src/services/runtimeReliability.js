function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function nowMs() {
  return Date.now();
}

function createCounterStore() {
  const counters = new Map();

  return {
    increment(name) {
      const key = s(name);
      counters.set(key, Number(counters.get(key) || 0) + 1);
      return counters.get(key);
    },
    snapshot() {
      return Object.fromEntries(counters.entries());
    },
    clear() {
      counters.clear();
    },
  };
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

function createTtlCache({ ttlMs = 300000, maxEntries = 2000 } = {}) {
  const store = new Map();

  function sweep() {
    const cutoff = nowMs();
    for (const [key, expiresAt] of store.entries()) {
      if (expiresAt <= cutoff) {
        store.delete(key);
      }
    }

    while (store.size > maxEntries) {
      const firstKey = store.keys().next().value;
      if (!firstKey) break;
      store.delete(firstKey);
    }
  }

  return {
    has(key) {
      sweep();
      const expiresAt = store.get(key);
      if (!expiresAt) return false;
      if (expiresAt <= nowMs()) {
        store.delete(key);
        return false;
      }
      return true;
    },
    add(key) {
      sweep();
      store.set(key, nowMs() + ttlMs);
      return key;
    },
    clear() {
      store.clear();
    },
  };
}

function createFailureBuffer({ maxEntries = 200 } = {}) {
  const entries = [];

  return {
    record(entry = {}) {
      entries.unshift({
        ts: new Date().toISOString(),
        ...entry,
      });
      if (entries.length > maxEntries) {
        entries.length = maxEntries;
      }
    },
    list() {
      return entries.slice();
    },
    clear() {
      entries.length = 0;
    },
  };
}

const inboundWebhookCache = createTtlCache({
  ttlMs: 10 * 60 * 1000,
  maxEntries: 5000,
});

const outboundActionCache = createTtlCache({
  ttlMs: 5 * 60 * 1000,
  maxEntries: 5000,
});

const failureBuffer = createFailureBuffer({
  maxEntries: 250,
});
const signalBuffer = createFailureBuffer({
  maxEntries: 150,
});
const metrics = createCounterStore();
let persistenceSink = null;

function shouldPersistSignal(entry = {}) {
  const level = lower(entry?.level || "");
  const category = lower(entry?.category || "");
  return level === "error" || level === "warn" || category === "execution";
}

function persistRuntimeSignal(entry = {}) {
  if (typeof persistenceSink !== "function" || !shouldPersistSignal(entry)) return;

  Promise.resolve()
    .then(() => persistenceSink(entry))
    .catch(() => {});
}

export function buildInboundEventKey(ev = {}) {
  return [
    lower(ev?.channel || "unknown"),
    lower(ev?.eventType || "unknown"),
    s(ev?.pageId),
    s(ev?.igUserId),
    s(ev?.recipientId),
    s(ev?.userId),
    s(ev?.externalThreadId),
    s(ev?.externalCommentId || ev?.commentId),
    s(ev?.messageId || ev?.mid),
    s(ev?.externalPostId),
    String(Number(ev?.timestamp || 0) || 0),
  ].join("|");
}

export function markInboundEventProcessed(ev = {}) {
  const key = buildInboundEventKey(ev);
  if (!key || inboundWebhookCache.has(key)) {
    metrics.increment("meta_duplicate_suppressions_total");
    return {
      key,
      duplicate: true,
    };
  }

  inboundWebhookCache.add(key);
  return {
    key,
    duplicate: false,
  };
}

export function buildOutboundActionKey(action = {}, ctx = {}) {
  return stableSerialize({
    type: lower(action?.type || "unknown"),
    tenantKey: lower(action?.tenantKey || action?.meta?.tenantKey || ctx?.tenantKey),
    channel: lower(action?.channel || ctx?.channel || "instagram"),
    recipientId: s(action?.recipientId || ctx?.recipientId || ctx?.userId),
    commentId: s(
      action?.commentId ||
        action?.externalCommentId ||
        action?.meta?.externalCommentId ||
        ctx?.externalCommentId
    ),
    threadId: s(action?.meta?.threadId || ctx?.threadId),
    text: s(action?.text || action?.replyText),
    metaActionId: s(action?.meta?.actionId),
    resendAttemptId: s(action?.meta?.resendAttemptId || ctx?.meta?.resendAttemptId),
  });
}

export function markOutboundActionProcessing(action = {}, ctx = {}) {
  const key = buildOutboundActionKey(action, ctx);
  if (!key || outboundActionCache.has(key)) {
    return {
      key,
      duplicate: true,
    };
  }

  outboundActionCache.add(key);
  return {
    key,
    duplicate: false,
  };
}

export function classifyExecutionFailure(result = {}) {
  const status = Number(result?.status || 0);
  const error = lower(result?.error || "");
  const retryable =
    status >= 500 ||
    (status === 0 &&
      (error.includes("timeout") ||
        error.includes("network") ||
        error.includes("temporary") ||
        error.includes("rate limit"))) ||
    error.includes("timeout") ||
    error.includes("network") ||
    error.includes("temporary") ||
    error.includes("rate limit");

  return {
    retryable,
    classification: retryable ? "retryable" : "terminal",
  };
}

export function recordExecutionFailure(entry = {}) {
  failureBuffer.record(entry);
  const signal = {
    level: entry?.retryable ? "warn" : "error",
    category: "execution",
    code: "meta_execution_failure",
    reasonCode: s(entry?.failureClass || ""),
    tenantKey: s(entry?.tenantKey || ""),
    threadId: s(entry?.threadId || ""),
    requestId: s(entry?.requestId || ""),
    correlationId: s(entry?.correlationId || ""),
    status: Number(entry?.status || 0),
    error: s(entry?.error || ""),
  };
  signalBuffer.record(signal);
  persistRuntimeSignal(signal);
}

export function listExecutionFailures() {
  return failureBuffer.list();
}

export function recordWebhookVerificationFailure(reason = "") {
  metrics.increment(`meta_webhook_verification_failures_total:${lower(reason || "unknown")}`);
  const signal = {
    level: "warn",
    category: "webhook",
    code: "meta_webhook_verification_failure",
    reasonCode: lower(reason || "unknown"),
  };
  signalBuffer.record(signal);
  persistRuntimeSignal(signal);
}

export function recordRuntimeSignal(entry = {}) {
  const signal = {
    level: lower(entry?.level || "info"),
    category: s(entry?.category || "runtime"),
    code: s(entry?.code || "runtime_signal"),
    reasonCode: s(entry?.reasonCode || ""),
    tenantKey: s(entry?.tenantKey || ""),
    threadId: s(entry?.threadId || ""),
    requestId: s(entry?.requestId || ""),
    correlationId: s(entry?.correlationId || ""),
    status: Number(entry?.status || 0),
    error: s(entry?.error || ""),
  };
  signalBuffer.record(signal);
  persistRuntimeSignal(signal);
}

export function listRuntimeSignals() {
  return signalBuffer.list();
}

export function getRuntimeMetricsSnapshot() {
  return metrics.snapshot();
}

export function configureRuntimeSignalPersistence(sink = null) {
  persistenceSink = typeof sink === "function" ? sink : null;
}

export function resetRuntimeReliability() {
  inboundWebhookCache.clear();
  outboundActionCache.clear();
  failureBuffer.clear();
  signalBuffer.clear();
  metrics.clear();
  persistenceSink = null;
}

export const __test__ = {
  buildInboundEventKey,
  buildOutboundActionKey,
  inboundWebhookCache,
  outboundActionCache,
  failureBuffer,
  signalBuffer,
  metrics,
  shouldPersistSignal,
};
