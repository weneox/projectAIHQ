import { cfg } from "../config.js";
import { createTenantSourcesHelpers } from "../db/helpers/tenantSources.js";
import { createTenantKnowledgeHelpers } from "../db/helpers/tenantKnowledge.js";
import { createTenantSourceFusionHelpers } from "../db/helpers/tenantSourceFusion.js";
import { createTenantSourceArtifactsHelpers } from "../db/helpers/tenantSourceArtifacts.js";
import {
  buildSourceSyncRetryPlan,
  buildWorkerRunnerKey,
} from "../services/asyncTasks.js";
import { runSourceSync } from "../services/sourceSync/index.js";
import { resumeAcceptedImportRun } from "../services/workspace/import.js";
import {
  failSetupReviewSession,
  markSetupReviewSessionProcessing,
} from "../db/helpers/tenantSetupReview.js";
import { createLogger } from "../utils/logger.js";
import {
  markWorkerStarted,
  markWorkerStopped,
  recordSourceSyncOutcome,
  touchWorkerHeartbeat,
} from "../observability/runtimeSignals.js";

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

function workerConfig() {
  return {
    enabled: Boolean(cfg?.workers?.sourceSyncWorkerEnabled ?? true),
    intervalMs: Math.max(1_000, n(cfg?.workers?.sourceSyncWorkerIntervalMs, 5_000)),
    batchSize: Math.max(1, n(cfg?.workers?.sourceSyncWorkerBatchSize, 4)),
    leaseMs: Math.max(10_000, n(cfg?.workers?.sourceSyncWorkerLeaseMs, 10 * 60_000)),
    maxAttempts: Math.max(1, n(cfg?.workers?.sourceSyncWorkerMaxAttempts, 3)),
  };
}

function buildFailureDetails(resultOrError = {}) {
  return {
    errorCode: s(resultOrError?.errorCode || resultOrError?.code || "SOURCE_SYNC_FAILED"),
    errorMessage: s(
      resultOrError?.error ||
        resultOrError?.reason ||
        resultOrError?.message ||
        "source sync failed"
    ),
    stage: s(resultOrError?.stage || "source_sync"),
  };
}

async function processClaimedSyncRun({ db, claimedRun, runnerKey }) {
  const sources = createTenantSourcesHelpers({ db });
  const knowledge = createTenantKnowledgeHelpers({ db });
  const fusion = createTenantSourceFusionHelpers({ db });
  const artifacts = createTenantSourceArtifactsHelpers({ db });

  const source = await sources.getSourceById(claimedRun.source_id);
  if (!source?.id) {
    throw new Error("source sync source not found");
  }

  if (s(claimedRun.review_session_id)) {
    return resumeAcceptedImportRun({
      db,
      runId: claimedRun.id,
      deferFailureStatus: true,
    });
  }

  return runSourceSync({
    db,
    source,
    run: claimedRun,
    requestedBy: s(claimedRun.requested_by) || runnerKey,
    sources,
    knowledge,
    fusion,
    artifacts,
  });
}

async function handleTerminalFailure({ db, run, resultOrError }) {
  const failure = buildFailureDetails(resultOrError);
  const sources = createTenantSourcesHelpers({ db });

  await sources.markSourceSyncError({
    sourceId: run.source_id,
    runId: run.id,
    requestedBy: s(run.requested_by),
    errorCode: failure.errorCode,
    errorMessage: failure.errorMessage,
    resultSummaryJson: {
      stage: failure.stage,
      retry: {
        eligible: false,
        terminal: true,
        attemptCount: n(run.attempt_count, 0),
        maxAttempts: Math.max(1, n(run.max_attempts, 3)),
      },
    },
    inputSummaryJson: {
      ...run.input_summary_json,
      stage: failure.stage,
    },
    errorsCount: 1,
    logsJson: [
      {
        level: "error",
        message: failure.errorMessage,
        stage: failure.stage,
        terminal: true,
      },
    ],
  });

  if (!s(run.review_session_id)) return;

  await failSetupReviewSession(
    run.review_session_id,
    new Error(failure.errorMessage),
    {
      currentStep: "source_sync",
      payload: {
        runId: s(run.id),
        sourceId: s(run.source_id),
        stage: failure.stage,
        errorCode: failure.errorCode,
      },
    }
  );
}

async function handleRetryableFailure({
  db,
  run,
  resultOrError,
  requestedBy,
}) {
  const sources = createTenantSourcesHelpers({ db });
  const failure = buildFailureDetails(resultOrError);
  const retryPlan = buildSourceSyncRetryPlan({
    attemptCount: run.attempt_count,
    maxAttempts: run.max_attempts || cfg?.workers?.sourceSyncWorkerMaxAttempts || 3,
    resultOrError,
  });

  if (retryPlan.terminal) {
    await handleTerminalFailure({ db, run, resultOrError });
    return {
      retried: false,
      terminal: true,
      retryPlan,
    };
  }

  await sources.releaseSyncRunForRetry({
    runId: run.id,
    sourceId: run.source_id,
    requestedBy,
    errorCode: failure.errorCode,
    errorMessage: failure.errorMessage,
    retryDelayMs: retryPlan.delayMs,
    resultSummaryJson: {
      stage: failure.stage,
    },
    inputSummaryJson: {
      ...run.input_summary_json,
      stage: failure.stage,
    },
    logsJson: [
      {
        level: "warn",
        message: failure.errorMessage,
        stage: failure.stage,
        retryScheduledAt: retryPlan.nextRetryAt,
      },
    ],
  });

  if (s(run.review_session_id)) {
    await markSetupReviewSessionProcessing(run.review_session_id, {
      currentStep: "source_sync",
      payload: {
        runId: s(run.id),
        sourceId: s(run.source_id),
        retryScheduledAt: retryPlan.nextRetryAt,
        attemptCount: retryPlan.attempts,
        maxAttempts: retryPlan.maxAttempts,
        errorCode: failure.errorCode,
      },
    });
  }

  return {
    retried: true,
    terminal: false,
    retryPlan,
  };
}

export function createSourceSyncWorker({ db }) {
  const cfgWorker = workerConfig();
  const runnerKey = buildWorkerRunnerKey("source-sync-worker");
  const sources = createTenantSourcesHelpers({ db });
  const logger = createLogger({
    component: "source-sync-worker",
    runnerKey,
  });

  let timer = null;
  let stopped = false;
  let running = false;
  let startedAt = null;
  let lastHeartbeatAt = null;
  let lastClaimAt = null;
  let lastCompletedAt = null;
  let lastOutcome = "";
  let lastRunId = "";

  function getState() {
    return {
      enabled: cfgWorker.enabled,
      runnerKey,
      intervalMs: cfgWorker.intervalMs,
      batchSize: cfgWorker.batchSize,
      leaseMs: cfgWorker.leaseMs,
      maxAttempts: cfgWorker.maxAttempts,
      running,
      stopped,
      startedAt,
      lastHeartbeatAt,
      lastClaimAt,
      lastCompletedAt,
      lastOutcome,
      lastRunId,
    };
  }

  async function tick() {
    if (stopped || running || !db) return;
    running = true;
    lastHeartbeatAt = new Date().toISOString();
    touchWorkerHeartbeat("source-sync-worker", getState());

    try {
      for (let i = 0; i < cfgWorker.batchSize; i += 1) {
        const claimedRun = await sources.claimNextSyncRun({
          runnerKey,
          leaseToken: buildWorkerRunnerKey("source-sync-lease"),
          leaseMs: cfgWorker.leaseMs,
        });

        if (!claimedRun?.id) break;
        lastClaimAt = new Date().toISOString();
        lastRunId = s(claimedRun.id);
        touchWorkerHeartbeat("source-sync-worker", getState());
        const runLogger = logger.child({
          requestId: s(claimedRun.metadata_json?.requestId),
          correlationId: s(claimedRun.metadata_json?.correlationId),
          runId: s(claimedRun.id),
          sourceId: s(claimedRun.source_id),
          reviewSessionId: s(claimedRun.review_session_id),
          tenantId: s(claimedRun.tenant_id),
          tenantKey: s(claimedRun.tenant_key),
          leaseToken: s(claimedRun.lease_token),
          attemptCount: Number(claimedRun.attempt_count || 0),
        });
        runLogger.info("source_sync.claimed", {
          status: claimedRun.status,
          triggerType: claimedRun.trigger_type,
        });

        let result = null;

        try {
          runLogger.info("source_sync.execution.started");
          result = await processClaimedSyncRun({
            db,
            claimedRun,
            runnerKey,
          });
        } catch (err) {
          result = {
            ok: false,
            mode: "error",
            error: err?.message || String(err || "source sync failed"),
            code: err?.code || "",
            stage: err?.stage || "worker",
          };
        }

        const isError =
          result?.ok === false || lower(result?.mode || "") === "error";

        if (isError) {
          const resolution = await handleRetryableFailure({
            db,
            run: claimedRun,
            resultOrError: result,
            requestedBy: s(claimedRun.requested_by) || runnerKey,
          });

          if (resolution?.terminal) {
            recordSourceSyncOutcome({ outcome: "error" });
            runLogger.error(
              "source_sync.execution.terminal_failure",
              new Error(buildFailureDetails(result).errorMessage),
              {
                stage: buildFailureDetails(result).stage,
                reasonCode: s(result?.code || ""),
              }
            );
          } else {
            recordSourceSyncOutcome({ outcome: "error" });
            runLogger.warn("source_sync.execution.retry_scheduled", {
              nextRetryAt: resolution?.retryPlan?.nextRetryAt || "",
              delayMs: Number(resolution?.retryPlan?.delayMs || 0),
              reasonCode: s(result?.code || ""),
            });
          }
        } else {
          recordSourceSyncOutcome({
            outcome: lower(result?.mode || "success") === "partial" ? "partial" : "success",
          });
          runLogger.info("source_sync.execution.completed", {
            mode: s(result?.mode || "success"),
            stage: s(result?.stage),
            reasonCode: s(result?.code || ""),
          });
        }

        lastCompletedAt = new Date().toISOString();
        lastOutcome = lower(result?.mode || (isError ? "error" : "success"));
        lastHeartbeatAt = new Date().toISOString();
        touchWorkerHeartbeat("source-sync-worker", getState());
      }
    } catch (err) {
      logger.error("source_sync.tick.failed", err);
    } finally {
      running = false;
      lastHeartbeatAt = new Date().toISOString();
      touchWorkerHeartbeat("source-sync-worker", getState());
    }
  }

  return {
    start() {
      if (!cfgWorker.enabled || timer) return;
      stopped = false;
      startedAt = new Date().toISOString();
      lastHeartbeatAt = startedAt;
      timer = setInterval(tick, cfgWorker.intervalMs);
      timer.unref?.();
      tick().catch(() => {});
      markWorkerStarted("source-sync-worker", getState());
      logger.info("source_sync.worker.started", {
        intervalMs: cfgWorker.intervalMs,
        batchSize: cfgWorker.batchSize,
        leaseMs: cfgWorker.leaseMs,
      });
    },

    stop() {
      stopped = true;
      if (!timer) return;
      clearInterval(timer);
      timer = null;
      markWorkerStopped("source-sync-worker", getState());
      logger.info("source_sync.worker.stopped");
    },

    getState,
  };
}
