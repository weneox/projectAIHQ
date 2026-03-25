import { cfg } from "../config.js";
import { createDurableExecutionHelpers } from "../db/helpers/durableExecutions.js";
import { buildWorkerRunnerKey } from "../services/asyncTasks.js";
import {
  finalizeDurableExecution,
  processDurableExecution,
} from "../services/durableExecutionService.js";
import { createLogger } from "../utils/logger.js";
import {
  markWorkerStarted,
  markWorkerStopped,
  recordDurableExecutionClaimed,
  touchWorkerHeartbeat,
} from "../observability/runtimeSignals.js";

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function s(v, d = "") {
  return String(v ?? d).trim();
}

function workerConfig() {
  return {
    enabled: Boolean(
      cfg?.workers?.durableExecutionWorkerEnabled ??
      cfg?.workers?.outboundRetryEnabled ??
      true
    ),
    intervalMs: Math.max(
      1_000,
      n(
        cfg?.workers?.durableExecutionWorkerIntervalMs,
        cfg?.workers?.outboundRetryIntervalMs ?? 5_000
      )
    ),
    batchSize: Math.max(
      1,
      n(
        cfg?.workers?.durableExecutionWorkerBatchSize,
        cfg?.workers?.outboundRetryBatchSize ?? 10
      )
    ),
    leaseMs: Math.max(
      10_000,
      n(cfg?.workers?.durableExecutionWorkerLeaseMs, 60_000)
    ),
  };
}

export function createDurableExecutionWorker({ db, wsHub }) {
  const settings = workerConfig();
  const workerId = buildWorkerRunnerKey("durable-execution-worker");
  const logger = createLogger({
    service: "ai-hq-backend",
    component: "durable-execution-worker",
    workerId,
  });

  let timer = null;
  let stopped = false;
  let running = false;
  let lastClaimAt = null;
  let lastClaimedExecutionId = "";
  let startedAt = null;
  let lastHeartbeatAt = null;
  let lastCompletedAt = null;
  let lastOutcome = "";

  function getState() {
    return {
      enabled: settings.enabled,
      workerId,
      intervalMs: settings.intervalMs,
      batchSize: settings.batchSize,
      leaseMs: settings.leaseMs,
      running,
      stopped,
      startedAt,
      lastHeartbeatAt,
      lastClaimAt,
      lastCompletedAt,
      lastOutcome,
      lastClaimedExecutionId,
    };
  }

  async function tick() {
    if (!db || stopped || running) return;
    running = true;
    lastHeartbeatAt = new Date().toISOString();
    touchWorkerHeartbeat("durable-execution-worker", getState());

    try {
      const helpers = createDurableExecutionHelpers({ db });

      for (let i = 0; i < settings.batchSize; i += 1) {
        const claimed = await helpers.claimNextExecution({
          workerId,
          leaseToken: buildWorkerRunnerKey("durable-execution-lease"),
          leaseMs: settings.leaseMs,
        });

        if (!claimed?.id) break;

        lastClaimAt = new Date().toISOString();
        lastClaimedExecutionId = claimed.id;
        touchWorkerHeartbeat("durable-execution-worker", getState());
        recordDurableExecutionClaimed({
          provider: claimed.provider,
          channel: claimed.channel,
          actionType: claimed.action_type,
          recovered: Number(claimed.attempt_count || 0) > 1,
        });

        await helpers.createAttemptStart({
          executionId: claimed.id,
          attemptNumber: claimed.attempt_count,
          statusFrom: claimed.attempt_count > 1 ? "retryable" : "pending",
          leaseToken: claimed.lease_token,
          correlationIds: claimed.correlation_ids,
        });

        logger.info("durable_execution.claimed", {
          executionId: claimed.id,
          tenantKey: s(claimed.tenant_key),
          provider: s(claimed.provider),
          channel: s(claimed.channel),
          actionType: s(claimed.action_type),
          attemptCount: Number(claimed.attempt_count || 0),
        });

        const result = await processDurableExecution({
          db,
          wsHub,
          execution: claimed,
        }).catch((err) => ({
          ok: false,
          retryable: true,
          errorCode: s(err?.code || "execution_failed"),
          errorMessage: s(err?.message || err),
          classification: "worker_error",
          resultSummary: {},
        }));

        const finalized = await finalizeDurableExecution({
          db,
          execution: claimed,
          result,
        });

        const event = result?.ok
          ? "durable_execution.succeeded"
          : finalized?.status === "retryable"
            ? "durable_execution.retried"
            : finalized?.status === "dead_lettered"
              ? "durable_execution.dead_lettered"
              : "durable_execution.terminal";

        logger.info(event, {
          executionId: claimed.id,
          tenantKey: s(claimed.tenant_key),
          provider: s(claimed.provider),
          channel: s(claimed.channel),
          actionType: s(claimed.action_type),
          nextStatus: s(finalized?.status),
          nextRetryAt: finalized?.next_retry_at || null,
          errorCode: s(result?.errorCode),
        });
        lastCompletedAt = new Date().toISOString();
        lastOutcome = s(finalized?.status || (result?.ok ? "succeeded" : "unknown"));
        lastHeartbeatAt = new Date().toISOString();
        touchWorkerHeartbeat("durable-execution-worker", getState());
      }
    } catch (err) {
      logger.error("durable_execution.tick.failed", err);
    } finally {
      running = false;
      lastHeartbeatAt = new Date().toISOString();
      touchWorkerHeartbeat("durable-execution-worker", getState());
    }
  }

  return {
    start() {
      if (!settings.enabled || timer) return;
      stopped = false;
      startedAt = new Date().toISOString();
      lastHeartbeatAt = startedAt;
      timer = setInterval(() => {
        tick().catch(() => {});
      }, settings.intervalMs);
      timer.unref?.();
      tick().catch(() => {});
      markWorkerStarted("durable-execution-worker", getState());
      logger.info("durable_execution.worker.started", {
        intervalMs: settings.intervalMs,
        batchSize: settings.batchSize,
        leaseMs: settings.leaseMs,
      });
    },

    stop() {
      stopped = true;
      if (!timer) return;
      clearInterval(timer);
      timer = null;
      markWorkerStopped("durable-execution-worker", getState());
      logger.info("durable_execution.worker.stopped");
    },

    getState,
  };
}
