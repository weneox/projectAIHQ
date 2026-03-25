import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDurableOperationalStatus,
  classifyWorkerHealth,
  getMetricsSnapshot,
  markWorkerStarted,
  recordDurableExecutionClaimed,
  recordDurableExecutionCreated,
  recordDurableExecutionFinalized,
  recordRealtimeAuthFailure,
  recordSourceSyncOutcome,
  resetRuntimeSignals,
} from "../src/observability/runtimeSignals.js";
import { cfg } from "../src/config.js";

test("durable execution metrics emit on created, claimed, retryable, and dead-lettered transitions", () => {
  resetRuntimeSignals();

  recordDurableExecutionCreated({
    provider: "meta",
    channel: "instagram",
    actionType: "meta.outbound.send",
  });
  recordDurableExecutionClaimed({
    provider: "meta",
    channel: "instagram",
    actionType: "meta.outbound.send",
    recovered: true,
  });
  recordDurableExecutionFinalized({
    provider: "meta",
    channel: "instagram",
    actionType: "meta.outbound.send",
    status: "retryable",
  });
  recordDurableExecutionFinalized({
    provider: "meta",
    channel: "instagram",
    actionType: "meta.outbound.send",
    status: "dead_lettered",
  });

  const metrics = getMetricsSnapshot();
  assert.equal(metrics.durable_executions_created_total?.[0]?.value, 1);
  assert.equal(metrics.durable_executions_claimed_total?.[0]?.value, 1);
  assert.equal(metrics.durable_execution_stuck_recoveries_total?.[0]?.value, 1);
  assert.equal(metrics.durable_executions_retryable_total?.[0]?.value, 1);
  assert.equal(metrics.durable_execution_retry_attempts_total?.[0]?.value, 1);
  assert.equal(metrics.durable_executions_dead_lettered_total?.[0]?.value, 1);
});

test("stale worker heartbeat and repeated failure signals produce attention status", () => {
  resetRuntimeSignals();
  const previousWindow = cfg.observability.recentSignalWindowMs;
  const previousRealtimeThreshold = cfg.observability.realtimeAuthFailureAttentionCount;
  const previousSourceSyncThreshold = cfg.observability.sourceSyncAttentionCount;
  const previousStaleMs = cfg.observability.staleWorkerHeartbeatMs;

  try {
    cfg.observability.recentSignalWindowMs = 60_000;
    cfg.observability.realtimeAuthFailureAttentionCount = 2;
    cfg.observability.sourceSyncAttentionCount = 1;
    cfg.observability.staleWorkerHeartbeatMs = 1_000;

    for (let i = 0; i < 2; i += 1) {
      recordRealtimeAuthFailure({ reason: "invalid_ticket" });
    }
    recordSourceSyncOutcome({ outcome: "partial" });

    const worker = markWorkerStarted("durable-execution-worker", {
      enabled: true,
      running: false,
      lastHeartbeatAt: new Date(Date.now() - 35_000).toISOString(),
    });

    const health = classifyWorkerHealth(worker);
    const operational = buildDurableOperationalStatus({
      summary: {
        counts: {
          retryable: 0,
        },
        deadLetterCount: 0,
      },
      durableWorker: worker,
      sourceSyncWorker: {
        enabled: true,
        running: true,
        lastHeartbeatAt: new Date().toISOString(),
      },
    });

    assert.equal(health.stale, true);
    assert.equal(operational.status, "attention");
    assert.ok(operational.alerts.some((item) => item.code === "durable_worker_stale"));
    assert.ok(operational.alerts.some((item) => item.code === "realtime_auth_failures"));
    assert.ok(operational.alerts.some((item) => item.code === "source_sync_attention"));
  } finally {
    cfg.observability.recentSignalWindowMs = previousWindow;
    cfg.observability.realtimeAuthFailureAttentionCount = previousRealtimeThreshold;
    cfg.observability.sourceSyncAttentionCount = previousSourceSyncThreshold;
    cfg.observability.staleWorkerHeartbeatMs = previousStaleMs;
  }
});
