import { cfg } from "../config.js";
import { deliverChannelOutbound } from "../services/channelDelivery.js";
import {
  classifyMetaGatewayFailure,
  classifyTelegramDeliveryFailure,
} from "../services/durableExecutionCore.js";
import {
  getMessageById,
  getThreadById,
  listOutboundAttemptCorrelationsByMessageIds,
  listRetryableOutboundAttempts,
  markOutboundAttemptDead,
  markOutboundAttemptFailed,
  markOutboundAttemptSending,
  markOutboundAttemptSent,
  updateOutboundMessageDeliveryFailure,
  updateOutboundMessageProviderId,
} from "../routes/api/inbox/repository.js";
import { withMessageOutboundAttemptCorrelation } from "../routes/api/inbox/shared.js";
import { writeAudit } from "../utils/auditLog.js";
import { createLogger } from "../utils/logger.js";
import { emitRealtimeEvent } from "../realtime/events.js";
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

function classifyDeliveryFailure({ provider = "", delivery = {} } = {}) {
  try {
    if (provider === TELEGRAM_PROVIDER) {
      const failure = classifyTelegramDeliveryFailure(delivery);
      return {
        retryable: Boolean(failure?.retryable),
        status: Number(failure?.status ?? delivery?.status ?? 0),
        errorCode: s(
          failure?.errorCode || delivery?.reasonCode || "telegram_delivery_failed"
        ),
        errorMessage: s(failure?.errorMessage || delivery?.error || "telegram send failed"),
        classification: s(failure?.classification || "telegram_delivery_failure"),
      };
    }

    const failure = classifyMetaGatewayFailure(delivery);
    return {
      retryable: Boolean(failure?.retryable),
      status: Number(failure?.status ?? delivery?.status ?? 0),
      errorCode: s(
        failure?.errorCode || delivery?.reasonCode || String(delivery?.status || "")
      ),
      errorMessage: s(failure?.errorMessage || delivery?.error || "gateway send failed"),
      classification: s(failure?.classification || "meta_gateway_failure"),
    };
  } catch {
    const status = Number(delivery?.status || 0);
    const reasonCode = s(delivery?.reasonCode || "delivery_failed");
    const errorMessage = s(delivery?.error || "delivery failed");
    const retryable =
      status === 0 ||
      status === 429 ||
      status >= 500 ||
      reasonCode === "telegram_rate_limited" ||
      reasonCode === "telegram_request_timeout" ||
      reasonCode === "telegram_network_error" ||
      reasonCode === "telegram_upstream_unavailable";

    return {
      retryable,
      status,
      errorCode: reasonCode,
      errorMessage,
      classification: "delivery_failure",
    };
  }
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

  const message = await getMessageById(db, attempt.message_id);
  if (!message) {
    await markOutboundAttemptFailed({
      db,
      attemptId: attempt.id,
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
    });
    return;
  }

  const thread = await getThreadById(db, attempt.thread_id);
  if (!thread) {
    await markOutboundAttemptFailed({
      db,
      attemptId: attempt.id,
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
    });
    return;
  }

  const provider = resolveAttemptProvider({ attempt, thread, message });
  const sending = await markOutboundAttemptSending(db, attempt.id);
  if (!sending?.id) return;

  try {
    emitRealtimeEvent(wsHub, {
      type: "inbox.outbound.attempt.updated",
      audience: "operator",
      tenantKey: sending?.tenant_key || attempt?.tenant_key,
      attempt: sending,
    });
  } catch {}

  const payload = buildLegacyOutboundPayload({
    attempt,
    thread,
    message,
    provider,
    defaultTenantKey: workerCfg?.defaultTenantKey,
  });

  const delivery = await deliverChannelOutbound({
    db,
    execution: {
      provider,
      tenant_id: thread?.tenant_id || message?.tenant_id || "",
      tenant_key: attempt?.tenant_key || message?.tenant_key || "",
      channel: attempt?.channel || thread?.channel || "",
      thread_id: attempt?.thread_id || "",
      message_id: attempt?.message_id || "",
    },
    payload,
    message,
    thread,
  });

  if (!delivery.ok) {
    const failure = classifyDeliveryFailure({ provider, delivery });

    const failed = failure.retryable
      ? await markOutboundAttemptFailed({
          db,
          attemptId: attempt.id,
          error: failure.errorMessage,
          errorCode: failure.errorCode,
          providerResponse: delivery.providerResponse || delivery.json || {},
          retryDelaySeconds: 120,
        })
      : await markOutboundAttemptDead(db, attempt.id);

    await updateOutboundMessageDeliveryFailure({
      db,
      messageId: message.id,
      status: failure.retryable ? "failed" : "dead",
      error: failure.errorMessage,
      errorCode: failure.errorCode,
      providerResponse: delivery.providerResponse || delivery.json || {},
    });

    try {
      await writeAudit(db, {
        actor: "system",
        action: "inbox.outbound.worker_failed",
        objectType: "inbox_outbound_attempt",
        objectId: String(attempt.id),
        meta: {
          provider,
          threadId: String(attempt.thread_id || ""),
          messageId: String(attempt.message_id || ""),
          status: String(failed?.status || ""),
          gatewayStatus: Number(delivery?.status || 0),
          error: String(failure.errorMessage || ""),
          errorCode: String(failure.errorCode || ""),
        },
      });
    } catch {}

    logger.warn("outbound_retry.attempt_failed", {
      provider,
      status: failure.status,
      retryable: failure.retryable,
      classification: failure.classification,
      error: s(failure.errorMessage || ""),
      errorCode: s(failure.errorCode || ""),
    });

    try {
      emitRealtimeEvent(wsHub, {
        type: "inbox.outbound.attempt.updated",
        audience: "operator",
        tenantKey: failed?.tenant_key || attempt?.tenant_key,
        attempt: failed,
      });
    } catch {}

    return;
  }

  const providerResponse = obj(delivery.providerResponse);
  const providerMessageId = s(delivery.providerMessageId) || null;

  const sent = await markOutboundAttemptSent({
    db,
    attemptId: attempt.id,
    providerMessageId,
    providerResponse,
  });

  const updatedMessage = await updateOutboundMessageProviderId({
    db,
    messageId: message.id,
    providerMessageId,
    providerResponse,
  });

  try {
    logger.info("outbound_retry.attempt_sent", {
      provider,
      providerMessageId: s(providerMessageId),
      providerStatus: Number(delivery?.status || 0),
    });

    await writeAudit(db, {
      actor: "system",
      action: "inbox.outbound.worker_sent",
      objectType: "inbox_outbound_attempt",
      objectId: String(attempt.id),
      meta: {
        provider,
        threadId: String(attempt.thread_id || ""),
        messageId: String(attempt.message_id || ""),
        providerMessageId: String(providerMessageId || ""),
        providerStatus: Number(delivery?.status || 0),
      },
    });
  } catch {}

  try {
    emitRealtimeEvent(wsHub, {
      type: "inbox.outbound.attempt.updated",
      audience: "operator",
      tenantKey: sent?.tenant_key || attempt?.tenant_key,
      attempt: sent,
    });
  } catch {}

  try {
    const correlations = await listOutboundAttemptCorrelationsByMessageIds(
      db,
      [message.id],
      { threadId: message.thread_id }
    );
    const correlatedMessage = withMessageOutboundAttemptCorrelation(
      updatedMessage || message,
      correlations.get(message.id) || null
    );
    emitRealtimeEvent(wsHub, {
      type: "inbox.message.updated",
      audience: "operator",
      tenantKey:
        correlatedMessage?.tenant_key ||
        message?.tenant_key ||
        attempt?.tenant_key,
      threadId: String(correlatedMessage?.thread_id || message.thread_id || ""),
      message: correlatedMessage,
    });
  } catch {}
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
      const attempts = await listRetryableOutboundAttempts(db, workerCfg.batchSize);

      for (const attempt of attempts) {
        if (stopped) break;

        try {
          await processAttempt({ db, wsHub, attempt, workerCfg });
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