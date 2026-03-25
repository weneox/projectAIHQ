import { cfg } from "../config.js";
import { sendOutboundViaMetaGateway } from "../services/metaGatewayClient.js";
import {
  getMessageById,
  getThreadById,
  listRetryableOutboundAttempts,
  markOutboundAttemptDead,
  markOutboundAttemptFailed,
  markOutboundAttemptSending,
  markOutboundAttemptSent,
  updateOutboundMessageProviderId,
} from "../routes/api/inbox/repository.js";
import { writeAudit } from "../utils/auditLog.js";
import { createLogger } from "../utils/logger.js";
import { emitRealtimeEvent } from "../realtime/events.js";
import { validateMetaGatewayOutboundResponse } from "@aihq/shared-contracts/critical";

function s(v) {
  return String(v ?? "").trim();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
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

function classifyGatewayFailure(gateway = {}) {
  const status = Number(gateway?.status || gateway?.json?.status || 0);
  const text = s(gateway?.error || "").toLowerCase();
  const retryable =
    status === 0 ||
    status >= 500 ||
    text.includes("timeout") ||
    text.includes("temporar") ||
    text.includes("network");

  return {
    retryable,
    status,
    reason: retryable ? "retryable_gateway_failure" : "terminal_gateway_failure",
  };
}

async function processAttempt({ db, wsHub, attempt }) {
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
    return;
  }

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

  const payload = {
    tenantKey:
      attempt.tenant_key ||
      message.tenant_key ||
      s(cfg?.tenant?.defaultTenantKey || "default"),
    channel: attempt.channel || thread.channel || "instagram",
    threadId: attempt.thread_id,
    recipientId:
      attempt.recipient_id ||
      message?.meta?.recipientId ||
      thread.external_user_id ||
      "",
    text: message.text || "",
    senderType: message.sender_type || "ai",
    messageType: message.message_type || "text",
    attachments: Array.isArray(message.attachments) ? message.attachments : [],
    meta: {
      ...(message?.meta && typeof message.meta === "object" ? message.meta : {}),
      skipOutboundAck: true,
      internalOutbound: true,
      alreadyTrackedInAiHq: true,
      resendAttemptId: attempt.id,
      threadId: attempt.thread_id,
      tenantKey: attempt.tenant_key || message.tenant_key || "",
      worker: "outbound_retry",
    },
  };

  const gateway = await sendOutboundViaMetaGateway(payload);
  const checkedGateway = validateMetaGatewayOutboundResponse(gateway?.json || { ok: false });

  if (!gateway.ok || !checkedGateway.ok) {
    const failure = classifyGatewayFailure(gateway);
    const failed = failure.retryable
      ? await markOutboundAttemptFailed({
          db,
          attemptId: attempt.id,
          error: gateway.error || checkedGateway.error || "gateway send failed",
          errorCode: String(gateway.status || ""),
          providerResponse: gateway.json || {},
          retryDelaySeconds: 120,
        })
      : await markOutboundAttemptDead(db, attempt.id);

    try {
      await writeAudit(db, {
        actor: "system",
        action: "inbox.outbound.worker_failed",
        objectType: "inbox_outbound_attempt",
        objectId: String(attempt.id),
        meta: {
          threadId: String(attempt.thread_id || ""),
          messageId: String(attempt.message_id || ""),
          status: String(failed?.status || ""),
          gatewayStatus: Number(gateway?.status || 0),
          error: String(gateway?.error || ""),
        },
      });
    } catch {}

    logger.warn("outbound_retry.attempt_failed", {
      status: failure.status,
      retryable: failure.retryable,
      reason: failure.reason,
      error: s(gateway?.error || checkedGateway.error || ""),
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

  const providerResult = gateway?.json?.result || gateway?.json || {};
  const providerResponse =
    providerResult?.response || providerResult?.json || providerResult || {};

  const providerMessageId =
    s(
      providerResponse?.message_id ||
        providerResponse?.messageId ||
        providerResponse?.id ||
        ""
    ) || null;

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
      providerMessageId: s(providerMessageId),
      gatewayStatus: Number(gateway?.status || 0),
    });
    await writeAudit(db, {
      actor: "system",
      action: "inbox.outbound.worker_sent",
      objectType: "inbox_outbound_attempt",
      objectId: String(attempt.id),
      meta: {
        threadId: String(attempt.thread_id || ""),
        messageId: String(attempt.message_id || ""),
        providerMessageId: String(providerMessageId || ""),
        gatewayStatus: Number(gateway?.status || 0),
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
    emitRealtimeEvent(wsHub, {
      type: "inbox.message.updated",
      audience: "operator",
      tenantKey: updatedMessage?.tenant_key || message?.tenant_key || attempt?.tenant_key,
      threadId: String(updatedMessage?.thread_id || message.thread_id || ""),
      message: updatedMessage || message,
    });
  } catch {}
}

export function startOutboundRetryWorker({ db, wsHub }) {
  const workerCfg = getWorkerConfig();

  let stopped = false;
  let timer = null;
  let running = false;
  let started = false;

  const tick = async () => {
    if (stopped || running) return;
    running = true;

    try {
      const attempts = await listRetryableOutboundAttempts(db, workerCfg.batchSize);

      for (const attempt of attempts) {
        if (stopped) break;

        try {
          await processAttempt({ db, wsHub, attempt });
          await sleep(150);
        } catch (e) {
          try {
            console.error(
              "[ai-hq] outbound retry attempt error:",
              String(e?.message || e)
            );
          } catch {}
        }
      }
    } catch (e) {
      try {
        console.error(
          "[ai-hq] outbound retry worker error:",
          String(e?.message || e)
        );
      } catch {}
    } finally {
      running = false;
      if (!stopped && started) {
        timer = setTimeout(tick, workerCfg.intervalMs);
      }
    }
  };

  return {
    start() {
      if (!workerCfg.enabled) {
        console.log("[ai-hq] outbound retry worker: disabled");
        return;
      }

      if (started) return;

      started = true;
      stopped = false;
      timer = setTimeout(tick, workerCfg.intervalMs);

      console.log(
        `[ai-hq] outbound retry worker: ON interval=${workerCfg.intervalMs}ms batch=${workerCfg.batchSize}`
      );
    },

    stop() {
      stopped = true;
      started = false;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
