function s(v, d = "") {
  return String(v ?? d).trim();
}

const counters = new Map();

export function incrementRuntimeMetric(name) {
  const key = s(name);
  counters.set(key, Number(counters.get(key) || 0) + 1);
  return counters.get(key);
}

export function getRuntimeMetricsSnapshot() {
  return Object.fromEntries(counters.entries());
}

export function resetRuntimeMetrics() {
  counters.clear();
}

export const __test__ = {
  counters,
};
