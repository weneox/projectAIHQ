import { cfg } from "../config.js";
import { enqueueChannelOutboundExecution } from "../services/durableExecutionService.js";
import {
  getMessageById,
  getThreadById,
  listRetryableOutboundAttempts,
  expireStaleOutboundReservations,
  markOutboundAttemptFailed,
  scheduleOutboundRetry,
  updateOutboundMessageDeliveryFailure,
} from "../routes/api/inbox/repository.js";
import { writeAudit } from "../utils/auditLog.js";
import { createLogger } from "../utils/logger.js";
import { emitRealtimeEvent } from "../realtime/events.js";
import { reconcileStaleTenantUsageReservations } from "../db/helpers/tenantUsage.js";
import {
  runWithSystemDbContext,
  runWithTenantContext,
} from "../db/tenantContext.js";
import {
  markWorkerStarted,
  markWorkerStopped,
  recordRuntimeSignal,
  touchWorkerHeartbeat,
} from "../observability/runtimeSignals.js";

const META_PROVIDER = "meta";
const TELEGRAM_PROVIDER = "telegram";

function s(v) {
  return String(v ?? "").trim();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getWorkerConfig() {
  return {
    enabled: Boolean(cfg?.workers?.outboundRetryEnabled ?? true),
    batchSize: Math.max(1, n(cfg?.workers?.outboundRetryBatchSize, 10)),
    intervalMs: Math.max(1000, n(cfg?.workers?.outboundRetryIntervalMs, 15000)),
    defaultTenantKey: s(cfg?.tenant?.defaultTenantKey || "default"),
  };
}

function resolveAttemptProvider({ attempt = {}, thread = {}, message = {} } = {}) {
  const explicit =
    s(attempt?.provider || attempt?.delivery_provider).toLowerCase() ||
    s(message?.provider).toLowerCase() ||
    s(thread?.provider).toLowerCase();

  if (explicit) return explicit;
  if (s(attempt?.channel || thread?.channel).toLowerCase() === "telegram") {
    return TELEGRAM_PROVIDER;
  }
  return META_PROVIDER;
}

function resolveRecipientId({ attempt = {}, thread = {}, message = {} } = {}) {
  const messageMeta = obj(message?.meta);
  return (
    s(attempt?.recipient_id) ||
    s(messageMeta?.recipientId) ||
    s(messageMeta?.recipient_id) ||
    s(messageMeta?.chatId) ||
    s(messageMeta?.chat_id) ||
    s(thread?.external_thread_id) ||
    s(thread?.external_user_id) ||
    ""
  );
}

function buildLegacyOutboundPayload({
  attempt = {},
  thread = {},
  message = {},
  provider = META_PROVIDER,
  defaultTenantKey = "default",
} = {}) {
  const tenantKey =
    attempt?.tenant_key || message?.tenant_key || s(defaultTenantKey || "default");
  const channel = attempt?.channel || thread?.channel || "instagram";
  const recipientId = resolveRecipientId({ attempt, thread, message });

  return {
    tenantKey,
    provider,
    channel,
    threadId: attempt?.thread_id,
    recipientId,
    text: message?.text || "",
    senderType: message?.sender_type || "ai",
    messageType: message?.message_type || "text",
    attachments: Array.isArray(message?.attachments) ? message.attachments : [],
    meta: {
      ...(message?.meta && typeof message.meta === "object" ? message.meta : {}),
      skipOutboundAck: true,
      internalOutbound: true,
      alreadyTrackedInAiHq: true,
      resendAttemptId: attempt?.id,
      threadId: attempt?.thread_id,
      tenantKey,
      worker: "outbound_retry",
      provider,
    },
  };
}

async function processAttempt({ db, wsHub, attempt, workerCfg }) {
  if (!attempt?.id) return;

  const logger = createLogger({
    service: "ai-hq-backend",
    component: "outbound-retry-worker",
    tenantKey: s(attempt?.tenant_key),
    attemptId: s(attempt?.id),
    threadId: s(attempt?.thread_id),
    messageId: s(attempt?.message_id),
  });

  const tenantScope = {
    tenantKey: attempt?.tenant_key,
    source: "worker.outbound-retry",
  };

  const message = await getMessageById(db, attempt.message_id, tenantScope);
  if (!message) {
    await markOutboundAttemptFailed({
      db,
      attemptId: attempt.id,
      tenantKey: attempt?.tenant_key,
      error: "message not found",
      errorCode: "message_missing",
      providerResponse: {},
      retryDelaySeconds: 300,
    });
    await updateOutboundMessageDeliveryFailure({
      db,
      messageId: attempt.message_id,
      status: "failed",
      error: "message not found",
      errorCode: "message_missing",
      providerResponse: {},
      tenantKey: attempt?.tenant_key,
    });
    return;
  }

  const thread = await getThreadById(db, attempt.thread_id, tenantScope);
  if (!thread) {
    await markOutboundAttemptFailed({
      db,
      attemptId: attempt.id,
      tenantKey: attempt?.tenant_key,
      error: "thread not found",
      errorCode: "thread_missing",
      providerResponse: {},
      retryDelaySeconds: 300,
    });
    await updateOutboundMessageDeliveryFailure({
      db,
      messageId: message.id,
      status: "failed",
      error: "thread not found",
      errorCode: "thread_missing",
      providerResponse: {},
      tenantKey: attempt?.tenant_key,
    });
    return;
  }

  const provider = resolveAttemptProvider({ attempt, thread, message });
  const durablePayload = buildLegacyOutboundPayload({
    attempt,
    thread,
    message,
    provider,
    defaultTenantKey: workerCfg?.defaultTenantKey,
  });

  const queued = await enqueueChannelOutboundExecution({
    db,
    tenantId: thread?.tenant_id || message?.tenant_id || "",
    tenantKey: attempt?.tenant_key || message?.tenant_key || "",
    channel: attempt?.channel || thread?.channel || "",
    provider,
    threadId: attempt?.thread_id || "",
    messageId: attempt?.message_id || "",
    payload: durablePayload,
    safeMetadata: {
      provider,
      inboxOutboundAttemptId: s(attempt?.id),
      threadId: s(attempt?.thread_id),
      messageId: s(attempt?.message_id),
      recipientId: resolveRecipientId({ attempt, thread, message }),
      legacyOutboundRetryBridge: true,
    },
    correlationIds: {
      threadId: s(attempt?.thread_id),
      messageId: s(attempt?.message_id),
      outboundAttemptId: s(attempt?.id),
      legacyOutboundRetryBridge: true,
    },
    maxAttempts: Math.max(1, Number(attempt?.max_attempts || 5)),
  });

  const deferred = await scheduleOutboundRetry({
    db,
    attemptId: attempt.id,
    tenantKey: attempt?.tenant_key,
    retryDelaySeconds: 3600,
  });

  try {
    await writeAudit(db, {
      actor: "system",
      action: "inbox.outbound.deferred_to_durable_execution",
      objectType: "inbox_outbound_attempt",
      objectId: String(attempt.id),
      meta: {
        provider,
        threadId: String(attempt.thread_id || ""),
        messageId: String(attempt.message_id || ""),
        durableExecutionId: String(queued?.id || ""),
      },
    });
  } catch {}

  try {
    emitRealtimeEvent(wsHub, {
      type: "inbox.outbound.attempt.updated",
      audience: "operator",
      tenantKey: deferred?.tenant_key || attempt?.tenant_key,
      attempt: deferred || attempt,
    });
  } catch {}

  logger.info("outbound_retry.deferred_to_durable_execution", {
    provider,
    durableExecutionId: s(queued?.id),
  });
}

export function startOutboundRetryWorker({ db, wsHub }) {
  const workerCfg = getWorkerConfig();
  const logger = createLogger({
    service: "ai-hq-backend",
    component: "outbound-retry-worker",
  });

  let stopped = false;
  let timer = null;
  let running = false;
  let started = false;
  let startedAt = null;
  let lastHeartbeatAt = null;
  let lastCompletedAt = null;
  let lastOutcome = "";

  function getState() {
    return {
      enabled: workerCfg.enabled,
      intervalMs: workerCfg.intervalMs,
      batchSize: workerCfg.batchSize,
      running,
      stopped,
      startedAt,
      lastHeartbeatAt,
      lastCompletedAt,
      lastOutcome,
    };
  }

  const tick = async () => {
    if (stopped || running) return;

    running = true;
    lastHeartbeatAt = new Date().toISOString();
    touchWorkerHeartbeat("outbound-retry-worker", getState());

    try {
      const attempts = await runWithSystemDbContext(
        "outbound_retry_worker_claim",
        () => listRetryableOutboundAttempts(db, workerCfg.batchSize)
      );

      const expiredReservations = await runWithSystemDbContext(
        "outbound_retry_worker_expire_stale_reservations",
        () => expireStaleOutboundReservations(db, { limit: workerCfg.batchSize })
      );

      for (const expired of expiredReservations) {
        logger.warn("outbound_retry.reservation_expired", {
          tenantKey: s(expired?.tenant_key),
          attemptId: s(expired?.id),
          threadId: s(expired?.thread_id),
          messageId: s(expired?.message_id),
          operationType: "outbound_retry.recovery",
          executionState: s(expired?.status),
        });
      }

      const reconciledQuotaRows = await runWithSystemDbContext(
        "outbound_retry_worker_reconcile_quota_reservations",
        () =>
          reconcileStaleTenantUsageReservations(db, {
            limit: workerCfg.batchSize,
          })
      );

      for (const row of reconciledQuotaRows) {
        logger.warn("tenant_quota.reservation_reconciled", {
          tenantId: s(row?.tenant_id),
          tenantKey: s(row?.tenant_key),
          operationType: "quota.reservation_reconciliation",
          executionState: "released",
        });
      }

      const attemptsById = new Map();
      for (const attempt of [...expiredReservations, ...attempts]) {
        if (attempt?.id && !attemptsById.has(attempt.id)) {
          attemptsById.set(attempt.id, attempt);
        }
      }

      for (const attempt of attemptsById.values()) {
        if (stopped) break;

        try {
          await runWithTenantContext(
            {
              tenantKey: attempt?.tenant_key,
              source: "worker.outbound-retry",
            },
            () => processAttempt({ db, wsHub, attempt, workerCfg })
          );
          lastCompletedAt = new Date().toISOString();
          lastOutcome = "processed";
          lastHeartbeatAt = lastCompletedAt;
          touchWorkerHeartbeat("outbound-retry-worker", getState());
          await sleep(150);
        } catch (e) {
          lastCompletedAt = new Date().toISOString();
          lastOutcome = "attempt_failed";
          lastHeartbeatAt = lastCompletedAt;
          touchWorkerHeartbeat("outbound-retry-worker", getState());
          logger.error("outbound_retry.worker.attempt_failed", e, {
            attemptId: s(attempt?.id),
            tenantKey: s(attempt?.tenant_key),
            threadId: s(attempt?.thread_id),
            messageId: s(attempt?.message_id),
          });
          recordRuntimeSignal({
            level: "error",
            category: "worker",
            code: "outbound_retry_attempt_failed",
            reasonCode: "attempt_failed",
            message: s(e?.message || e),
            context: {
              attemptId: s(attempt?.id),
              tenantKey: s(attempt?.tenant_key),
              threadId: s(attempt?.thread_id),
            },
          });
        }
      }
    } catch (e) {
      lastOutcome = "tick_failed";
      logger.error("outbound_retry.worker.tick_failed", e);
      recordRuntimeSignal({
        level: "error",
        category: "worker",
        code: "outbound_retry_tick_failed",
        reasonCode: "tick_failed",
        message: s(e?.message || e),
      });
    } finally {
      running = false;
      lastHeartbeatAt = new Date().toISOString();
      touchWorkerHeartbeat("outbound-retry-worker", getState());

      if (!stopped && started) {
        timer = setTimeout(tick, workerCfg.intervalMs);
      }
    }
  };

  return {
    start() {
      if (!workerCfg.enabled) {
        logger.info("outbound_retry.worker.disabled");
        return;
      }

      if (started) return;

      started = true;
      stopped = false;
      startedAt = new Date().toISOString();
      lastHeartbeatAt = startedAt;
      timer = setTimeout(tick, workerCfg.intervalMs);

      markWorkerStarted("outbound-retry-worker", getState());
      logger.info("outbound_retry.worker.started", {
        intervalMs: workerCfg.intervalMs,
        batchSize: workerCfg.batchSize,
      });
    },

    stop() {
      stopped = true;
      started = false;
      if (timer) clearTimeout(timer);
      timer = null;
      markWorkerStopped("outbound-retry-worker", getState());
      logger.info("outbound_retry.worker.stopped");
    },

    getState,
  };
}
