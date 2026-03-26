function s(v, d = "") {
  return String(v ?? d).trim();
}

const counters = new Map();
const recentSignals = [];
let persistenceSink = null;

function shouldPersistSignal(entry = {}) {
  const level = s(entry?.level || "").toLowerCase();
  return level === "warn" || level === "error";
}

function persistRuntimeSignal(entry = {}) {
  if (typeof persistenceSink !== "function" || !shouldPersistSignal(entry)) return;

  Promise.resolve()
    .then(() => persistenceSink(entry))
    .catch(() => {});
}

export function incrementRuntimeMetric(name) {
  const key = s(name);
  counters.set(key, Number(counters.get(key) || 0) + 1);
  return counters.get(key);
}

export function recordRuntimeSignal(entry = {}) {
  const signal = {
    ts: new Date().toISOString(),
    level: s(entry?.level || "info").toLowerCase(),
    category: s(entry?.category || "runtime"),
    code: s(entry?.code || "runtime_signal"),
    reasonCode: s(entry?.reasonCode || ""),
    status: Number(entry?.status || 0),
    callSid: s(entry?.callSid || ""),
    tenantKey: s(entry?.tenantKey || ""),
    requestId: s(entry?.requestId || ""),
    correlationId: s(entry?.correlationId || ""),
    error: s(entry?.error || "").slice(0, 240),
  };
  recentSignals.unshift(signal);
  persistRuntimeSignal(signal);

  if (recentSignals.length > 150) {
    recentSignals.length = 150;
  }
}

export function getRuntimeMetricsSnapshot() {
  return Object.fromEntries(counters.entries());
}

export function listRuntimeSignals() {
  return recentSignals.slice();
}

export function configureRuntimeSignalPersistence(sink = null) {
  persistenceSink = typeof sink === "function" ? sink : null;
}

export function resetRuntimeMetrics() {
  counters.clear();
  recentSignals.length = 0;
  persistenceSink = null;
}

export const __test__ = {
  counters,
  recentSignals,
  shouldPersistSignal,
};
