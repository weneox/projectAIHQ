import { cfg } from "../config.js";

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
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function nowIso() {
  return new Date().toISOString();
}

function labelsKey(labels = {}) {
  const pairs = Object.entries(labels || {})
    .map(([key, value]) => [lower(key), lower(value)])
    .filter(([, value]) => !!value)
    .sort(([a], [b]) => a.localeCompare(b));

  return pairs.map(([key, value]) => `${key}=${value}`).join(",");
}

function metricKey(name, labels = {}) {
  return `${s(name)}|${labelsKey(labels)}`;
}

function parseMetricKey(key = "") {
  const [name, labelString = ""] = String(key).split("|");
  const labels = {};

  for (const pair of labelString.split(",")) {
    if (!pair) continue;
    const [rawKey, rawValue] = pair.split("=");
    if (!rawKey || !rawValue) continue;
    labels[rawKey] = rawValue;
  }

  return {
    name,
    labels,
  };
}

const counterStore = new Map();
const recentStore = new Map();
const workerStore = new Map();
const recentEventStore = [];
let persistenceSink = null;

function pushRecentEvent(entry = {}) {
  recentEventStore.unshift({
    ts: nowIso(),
    ...entry,
  });

  const maxEntries = Math.max(
    20,
    n(cfg?.observability?.recentRuntimeSignalHistoryLimit, 100)
  );
  if (recentEventStore.length > maxEntries) {
    recentEventStore.length = maxEntries;
  }
}

function persistRuntimeEvent(entry = {}) {
  if (typeof persistenceSink !== "function") return;

  Promise.resolve()
    .then(() => persistenceSink(entry))
    .catch(() => {});
}

function incrementCounter(name, labels = {}, amount = 1) {
  const key = metricKey(name, labels);
  counterStore.set(key, n(counterStore.get(key), 0) + Math.max(1, n(amount, 1)));
  return counterStore.get(key);
}

function recordRecent(name, labels = {}) {
  const key = metricKey(name, labels);
  const list = recentStore.get(key) || [];
  const now = Date.now();
  list.push(now);

  const maxWindowMs = Math.max(
    60_000,
    n(cfg?.observability?.recentSignalWindowMs, 10 * 60_000)
  );
  const cutoff = now - maxWindowMs;
  const trimmed = list.filter((value) => value >= cutoff).slice(-2000);
  recentStore.set(key, trimmed);
  return trimmed.length;
}

function countRecent(name, { withinMs = null } = {}) {
  const windowMs = Math.max(
    1_000,
    n(
      withinMs,
      n(cfg?.observability?.recentSignalWindowMs, 5 * 60_000)
    )
  );
  const cutoff = Date.now() - windowMs;
  let total = 0;

  for (const [key, values] of recentStore.entries()) {
    if (!String(key).startsWith(`${name}|`)) continue;
    const kept = (values || []).filter((value) => value >= cutoff);
    recentStore.set(key, kept);
    total += kept.length;
  }

  return total;
}

function upsertWorkerState(workerName, patch = {}) {
  const key = s(workerName);
  const current = workerStore.get(key) || {
    workerName: key,
    startedAt: null,
    stoppedAt: null,
    lastHeartbeatAt: null,
    lastClaimAt: null,
    lastCompletedAt: null,
    lastOutcome: "",
    enabled: false,
    running: false,
    stopped: true,
  };

  const next = {
    ...current,
    ...Object.fromEntries(
      Object.entries(patch || {}).filter(([, value]) => value !== undefined)
    ),
    workerName: key,
  };

  workerStore.set(key, next);
  return next;
}

export function markWorkerStarted(workerName, state = {}) {
  return upsertWorkerState(workerName, {
    ...state,
    startedAt: state.startedAt || nowIso(),
    lastHeartbeatAt: state.lastHeartbeatAt || nowIso(),
    stoppedAt: null,
    stopped: false,
    running: Boolean(state.running),
  });
}

export function touchWorkerHeartbeat(workerName, state = {}) {
  return upsertWorkerState(workerName, {
    ...state,
    lastHeartbeatAt: nowIso(),
  });
}

export function markWorkerStopped(workerName, state = {}) {
  return upsertWorkerState(workerName, {
    ...state,
    stoppedAt: nowIso(),
    stopped: true,
    running: false,
  });
}

export function getWorkerSnapshot(workerName) {
  return workerStore.get(s(workerName)) || null;
}

export function getAllWorkerSnapshots() {
  return Object.fromEntries([...workerStore.entries()].map(([key, value]) => [key, { ...value }]));
}

function ageMs(ts) {
  const ms = new Date(ts || 0).getTime();
  return ms > 0 ? Math.max(0, Date.now() - ms) : null;
}

export function classifyWorkerHealth(state = null) {
  if (!state?.enabled) {
    return {
      status: "disabled",
      stale: false,
      ageMs: null,
    };
  }

  const staleAfterMs = Math.max(
    30_000,
    n(cfg?.observability?.staleWorkerHeartbeatMs, 2 * 60_000)
  );
  const heartbeatAgeMs = ageMs(state?.lastHeartbeatAt);
  const stale = heartbeatAgeMs !== null && heartbeatAgeMs > staleAfterMs;

  return {
    status: stale ? "stale" : state?.running ? "running" : "idle",
    stale,
    ageMs: heartbeatAgeMs,
  };
}

export function recordDurableExecutionCreated({ provider = "", channel = "", actionType = "" } = {}) {
  incrementCounter("durable_executions_created_total", {
    provider,
    channel,
    action_type: actionType,
  });
}

export function recordDurableExecutionClaimed({
  provider = "",
  channel = "",
  actionType = "",
  recovered = false,
} = {}) {
  incrementCounter("durable_executions_claimed_total", {
    provider,
    channel,
    action_type: actionType,
  });
  if (recovered) {
    incrementCounter("durable_execution_stuck_recoveries_total", {
      provider,
      channel,
      action_type: actionType,
    });
  }
}

export function recordDurableExecutionFinalized({
  provider = "",
  channel = "",
  actionType = "",
  status = "",
} = {}) {
  const normalizedStatus = lower(status);
  if (!normalizedStatus) return;

  incrementCounter(`durable_executions_${normalizedStatus}_total`, {
    provider,
    channel,
    action_type: actionType,
  });

  if (normalizedStatus === "retryable") {
    incrementCounter("durable_execution_retry_attempts_total", {
      provider,
      channel,
      action_type: actionType,
    });
  }
}

export function recordRealtimeAuthFailure({ reason = "" } = {}) {
  incrementCounter("realtime_auth_failures_total", {
    reason,
  });
  recordRecent("realtime_auth_failures_recent_total", {
    reason,
  });
  pushRecentEvent({
    level: "warn",
    category: "realtime",
    code: "realtime_auth_failure",
    reasonCode: s(reason || "unknown"),
  });
}

export function recordSourceSyncOutcome({ outcome = "" } = {}) {
  const normalized = lower(outcome || "unknown");
  incrementCounter("source_sync_outcomes_total", {
    outcome: normalized,
  });

  if (normalized === "partial" || normalized === "error") {
    recordRecent("source_sync_attention_recent_total", {
      outcome: normalized,
    });
    pushRecentEvent({
      level: normalized === "error" ? "error" : "warn",
      category: "source_sync",
      code: "source_sync_attention",
      reasonCode: normalized,
    });
  }
}

export function recordRuntimeSignal({
  level = "info",
  category = "",
  code = "",
  reasonCode = "",
  message = "",
  context = {},
  service = "ai-hq-backend",
  requestId = "",
  correlationId = "",
  tenantId = "",
  tenantKey = "",
  durable = true,
} = {}) {
  const entry = {
    level: lower(level || "info"),
    category: s(category || "runtime"),
    code: s(code || "runtime_signal"),
    reasonCode: s(reasonCode),
    message: s(message).slice(0, 240),
    service: s(service || "ai-hq-backend"),
    requestId: s(requestId),
    correlationId: s(correlationId),
    tenantId: s(tenantId),
    tenantKey: s(tenantKey),
    context: isObj(context)
      ? Object.fromEntries(
          Object.entries(context)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [
              s(key),
              typeof value === "string" ? s(value).slice(0, 240) : value,
            ])
        )
      : {},
  };
  pushRecentEvent(entry);
  if (durable) {
    persistRuntimeEvent(entry);
  }
}

export function listRecentRuntimeSignals(limit = null) {
  const max = Math.max(1, n(limit, 20));
  return recentEventStore.slice(0, max).map((item) => ({
    ...item,
    context: isObj(item?.context) ? { ...item.context } : {},
  }));
}

export function configureRuntimeSignalPersistence(sink = null) {
  persistenceSink = typeof sink === "function" ? sink : null;
}

export function getMetricsSnapshot() {
  const counters = {};

  for (const [key, value] of counterStore.entries()) {
    const { name, labels } = parseMetricKey(key);
    if (!counters[name]) counters[name] = [];
    counters[name].push({
      labels,
      value: n(value, 0),
    });
  }

  return counters;
}

export function buildDurableOperationalStatus({
  summary = {},
  durableWorker = null,
  sourceSyncWorker = null,
} = {}) {
  const durableWorkerHealth = classifyWorkerHealth(durableWorker);
  const sourceSyncWorkerHealth = classifyWorkerHealth(sourceSyncWorker);
  const retryableCount = n(summary?.counts?.retryable, 0);
  const deadLetterCount = n(summary?.deadLetterCount, 0);
  const oldestRetryableAgeMs = ageMs(
    summary?.oldestRetryable?.next_retry_at || summary?.oldestRetryable?.created_at
  );
  const oldestInProgressAgeMs = ageMs(
    summary?.oldestInProgress?.last_attempt_at || summary?.oldestInProgress?.created_at
  );
  const alerts = [];

  if (
    deadLetterCount >= Math.max(1, n(cfg?.observability?.deadLetterAttentionCount, 5))
  ) {
    alerts.push({
      code: "dead_letter_backlog",
      status: "attention",
      message: "Dead-letter backlog is above the attention threshold.",
      value: deadLetterCount,
    });
  }

  if (
    retryableCount >= Math.max(1, n(cfg?.observability?.retryableBacklogAttentionCount, 10))
  ) {
    alerts.push({
      code: "retryable_backlog",
      status: "attention",
      message: "Retryable backlog is above the attention threshold.",
      value: retryableCount,
    });
  }

  if (durableWorkerHealth.stale) {
    alerts.push({
      code: "durable_worker_stale",
      status: "attention",
      message: "Durable worker heartbeat is stale.",
      value: durableWorkerHealth.ageMs,
    });
  }

  if (
    oldestInProgressAgeMs !== null &&
    oldestInProgressAgeMs >
      Math.max(60_000, n(cfg?.observability?.stuckInProgressAttentionMs, 15 * 60_000))
  ) {
    alerts.push({
      code: "stuck_in_progress",
      status: "attention",
      message: "An in-progress durable execution appears stuck.",
      value: oldestInProgressAgeMs,
    });
  }

  const realtimeAuthFailureCount = countRecent("realtime_auth_failures_recent_total", {
    withinMs: cfg?.observability?.recentSignalWindowMs,
  });
  if (
    realtimeAuthFailureCount >=
    Math.max(1, n(cfg?.observability?.realtimeAuthFailureAttentionCount, 5))
  ) {
    alerts.push({
      code: "realtime_auth_failures",
      status: "attention",
      message: "Repeated realtime auth failures were observed recently.",
      value: realtimeAuthFailureCount,
    });
  }

  const sourceSyncAttentionCount = countRecent("source_sync_attention_recent_total", {
    withinMs: cfg?.observability?.recentSignalWindowMs,
  });
  if (
    sourceSyncAttentionCount >=
    Math.max(1, n(cfg?.observability?.sourceSyncAttentionCount, 3))
  ) {
    alerts.push({
      code: "source_sync_attention",
      status: "attention",
      message: "Recent source sync partial/error outcomes need attention.",
      value: sourceSyncAttentionCount,
    });
  }

  return {
    status: alerts.length ? "attention" : "ok",
    alerts,
    oldestRetryableAgeMs,
    oldestInProgressAgeMs,
    recentSignals: {
      realtimeAuthFailures: realtimeAuthFailureCount,
      sourceSyncAttentionEvents: sourceSyncAttentionCount,
    },
    workers: {
      durableExecution: {
        ...durableWorker,
        health: durableWorkerHealth,
      },
      sourceSync: {
        ...sourceSyncWorker,
        health: sourceSyncWorkerHealth,
      },
    },
  };
}

export function buildRuntimeSignalsSummary({
  startupOperationalReadiness = {},
  durableSummary = {},
} = {}) {
  const workers = getAllWorkerSnapshots();
  const durableWorker = workers["durable-execution-worker"] || null;
  const sourceSyncWorker = workers["source-sync-worker"] || null;
  const durableOperational = buildDurableOperationalStatus({
    summary: durableSummary,
    durableWorker,
    sourceSyncWorker,
  });

  return {
    checkedAt: nowIso(),
    startupOperationalReadiness: {
      status: lower(startupOperationalReadiness?.status || "unknown"),
      enforced: startupOperationalReadiness?.enforced === true,
      blockersTotal: n(startupOperationalReadiness?.blockers?.total, 0),
      blockerReasonCodes: Array.isArray(
        startupOperationalReadiness?.blockerReasonCodes
      )
        ? startupOperationalReadiness.blockerReasonCodes
            .map((item) => s(item))
            .filter(Boolean)
            .slice(0, 10)
        : [],
    },
    durableExecution: {
      status: durableOperational.status,
      retryableCount: n(durableSummary?.counts?.retryable, 0),
      deadLetterCount: n(durableSummary?.deadLetterCount, 0),
      oldestRetryableAgeMs: durableOperational.oldestRetryableAgeMs,
      oldestInProgressAgeMs: durableOperational.oldestInProgressAgeMs,
      alerts: Array.isArray(durableOperational.alerts)
        ? durableOperational.alerts.slice(0, 10)
        : [],
    },
    recentSignals: durableOperational.recentSignals,
    recentHistory: listRecentRuntimeSignals(20),
    workers: Object.fromEntries(
      Object.entries(workers).map(([key, state]) => [
        key,
        {
          ...state,
          health: classifyWorkerHealth(state),
        },
      ])
    ),
    metrics: getMetricsSnapshot(),
  };
}

export function resetRuntimeSignals() {
  counterStore.clear();
  recentStore.clear();
  workerStore.clear();
  recentEventStore.length = 0;
  persistenceSink = null;
}

export const __test__ = {
  incrementCounter,
  recordRecent,
  countRecent,
  ageMs,
  parseMetricKey,
  counterStore,
  recentStore,
  workerStore,
};
