import { createDurableExecutionHelpers } from "../db/helpers/durableExecutions.js";
import {
  buildExecutionIdempotencyKey,
  buildExecutionRetryPlan,
  buildVoiceSyncIdempotencyKey,
  classifyTelegramDeliveryFailure,
  classifyMetaGatewayFailure,
  classifyVoiceSyncFailure,
} from "./durableExecutionCore.js";
import { sendCommentActionsViaMetaGateway } from "./metaGatewayClient.js";
import { deliverChannelOutbound } from "./channelDelivery.js";
import {
  getMessageById,
  getThreadById,
  refreshThread,
  getOutboundAttemptById,
  markOutboundAttemptSending,
  markOutboundAttemptDead,
  markOutboundAttemptFailed,
  markOutboundAttemptSent,
  updateOutboundMessageDeliveryFailure,
  updateOutboundMessageProviderId,
} from "../routes/api/inbox/repository.js";
import {
  markExternalSideEffectFailed,
  markExternalSideEffectSent,
  reserveExternalSideEffect,
} from "../db/helpers/externalIdempotency.js";
import {
  getCommentById,
  updateCommentState,
} from "../routes/api/comments/repository.js";
import {
  mergeClassificationForReply,
  mergeClassificationForReplyPending,
} from "../routes/api/comments/state.js";
import {
  buildReplyPendingRaw,
  buildReplyRaw,
  emitCommentUpdatedRealtime,
} from "../routes/api/comments/handlers/shared.js";
import { processCommentWebhookJob } from "../routes/api/comments/handlers/ingest.js";
import { emitRealtimeEvent } from "../realtime/events.js";
import { writeAudit } from "../utils/auditLog.js";
import { createLogger } from "../utils/logger.js";
import {
  processVoiceOperatorJoin,
  processVoiceSessionState,
  processVoiceSessionUpsert,
  processVoiceTranscript,
} from "./voiceInternalRuntime.js";
import { recordDurableExecutionFinalized } from "../observability/runtimeSignals.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function resolveExecutionProvider(execution = {}) {
  return (
    lower(execution?.provider) ||
    lower(s(execution?.action_type).split(".")[0]) ||
    "meta"
  );
}

function emitOutboundDeliveryTruth({
  wsHub,
  tenantKey = "",
  threadId = "",
  message = null,
  attempt = null,
  reason = "",
} = {}) {
  const safeTenantKey = s(
    tenantKey ||
      message?.tenant_key ||
      message?.tenantKey ||
      attempt?.tenant_key ||
      attempt?.tenantKey
  );
  const safeThreadId = s(
    threadId ||
      message?.thread_id ||
      message?.threadId ||
      attempt?.thread_id ||
      attempt?.threadId
  );

  if (message?.id) {
    try {
      emitRealtimeEvent(wsHub, {
        type: "inbox.message.updated",
        audience: "operator",
        tenantKey: safeTenantKey,
        threadId: safeThreadId,
        message,
        reason,
      });
    } catch {}
  }

  if (attempt?.id) {
    try {
      emitRealtimeEvent(wsHub, {
        type: "inbox.outbound.attempt.updated",
        audience: "operator",
        tenantKey: safeTenantKey,
        threadId: safeThreadId,
        attempt,
        reason,
      });
    } catch {}
  }
}

function resolveOutboundPayloadActionType(payload = {}, message = {}) {
  const meta = obj(payload?.meta);
  const messageMeta = obj(message?.meta);

  const explicit =
    lower(meta?.actionType) ||
    lower(payload?.actionType) ||
    lower(payload?.action_type);

  if (explicit) return explicit;

  const payloadMessageType =
    lower(payload?.messageType) ||
    lower(payload?.message_type) ||
    lower(meta?.messageType) ||
    lower(meta?.message_type);

  if (payloadMessageType) return payloadMessageType;

  const originalMessageType =
    lower(messageMeta?.originalMessageType) ||
    lower(messageMeta?.original_message_type);

  if (originalMessageType) return originalMessageType;

  return lower(message?.message_type) || "send_message";
}

function isControlOutboundActionType(actionType = "") {
  return [
    "typing",
    "typing_on",
    "typing_off",
    "mark_seen",
    "send_seen",
    "seen",
    "read",
    "delivery",
  ].includes(lower(actionType));
}

function hasRenderableOutboundText(message = {}) {
  return Boolean(s(message?.text));
}

function isInternalMetaBridgeError({ failure = {}, delivery = {} } = {}) {
  const code = lower(
    failure?.errorCode ||
      delivery?.reasonCode ||
      delivery?.errorCode ||
      delivery?.error_code ||
      ""
  );

  const text = lower(
    failure?.errorMessage ||
      delivery?.error ||
      delivery?.message ||
      ""
  );

  if (code === "meta_delivery_unconfirmed") return true;

  if (
    code === "meta_delivery_failed" &&
    (
      text.includes("unauthorized") ||
      text.includes("text_or_attachments_required")
    )
  ) {
    return true;
  }

  if (text.includes("unauthorized")) return true;
  if (text.includes("text_or_attachments_required")) return true;

  return false;
}

function shouldKeepBubbleSentOnMetaInternalError({
  provider = "",
  actionType = "",
  message = {},
  failure = {},
  delivery = {},
} = {}) {
  return false;
}

function buildInternalMetaBridgeProviderResponse({
  delivery = {},
  failure = {},
  actionType = "",
} = {}) {
  return {
    ...(obj(delivery?.providerResponse)),
    internalBridgeWarning: true,
    internalBridgeActionType: s(actionType),
    internalBridgeErrorCode: s(failure?.errorCode),
    internalBridgeError: s(failure?.errorMessage),
    originalDeliveryStatus: Number(delivery?.status || 0),
    originalDeliveryReasonCode: s(delivery?.reasonCode),
    originalDeliveryError: s(delivery?.error),
  };
}

function classifyChannelOutboundFailure({ execution = {}, delivery = {} } = {}) {
  const provider = resolveExecutionProvider(execution);

  let classified = null;
  try {
    classified =
      provider === "telegram"
        ? classifyTelegramDeliveryFailure(delivery)
        : classifyMetaGatewayFailure(delivery);
  } catch {
    classified = null;
  }

  const status = Number(classified?.status ?? delivery?.status ?? 0);
  const reasonCode = s(
    delivery?.reasonCode ||
      classified?.errorCode ||
      delivery?.status ||
      "delivery_failed"
  );
  const errorMessage = s(
    classified?.errorMessage || delivery?.error || "delivery failed"
  );

  let retryable = Boolean(classified?.retryable);
  if (classified?.retryable == null) {
    retryable =
      status === 0 ||
      status === 429 ||
      status >= 500 ||
      reasonCode === "telegram_rate_limited" ||
      reasonCode === "telegram_request_timeout" ||
      reasonCode === "telegram_network_error" ||
      reasonCode === "telegram_upstream_unavailable";
  }

  return {
    retryable,
    status,
    errorCode: reasonCode,
    errorMessage,
    classification: s(
      classified?.classification ||
        (provider === "telegram"
          ? "telegram_delivery_failure"
          : "meta_gateway_failure")
    ),
  };
}

function deliveryState(message = {}) {
  const meta = obj(message?.meta);
  const delivery = obj(meta?.delivery);
  return lower(
    delivery?.status ||
      message?.delivery_status ||
      message?.status ||
      ""
  );
}

function messageLooksSent(message = {}, providerMessageId = "") {
  const state = deliveryState(message);
  if (state === "sent") return true;
  if (providerMessageId) return true;
  if (["pending", "failed", "retrying", "reserved"].includes(state)) return false;
  return lower(message?.direction) === "outbound" && Boolean(message?.sent_at);
}

function failureHasUnknownProviderOutcome({ failure = {}, delivery = {} } = {}) {
  const status = Number(failure?.status ?? delivery?.status ?? 0);
  const text = lower(
    failure?.errorMessage ||
      delivery?.error ||
      delivery?.reasonCode ||
      ""
  );

  return (
    status === 0 ||
    text.includes("timeout") ||
    text.includes("network") ||
    text.includes("aborted") ||
    text.includes("fetch failed")
  );
}

function sideEffectKeyForExecution({ execution = {}, payload = {}, attempt = {}, fallback = "" } = {}) {
  const meta = obj(payload?.meta);
  return s(
    execution?.idempotency_key ||
      attempt?.idempotency_key ||
      meta?.idempotencyKey ||
      meta?.idempotency_key ||
      fallback ||
      (execution?.id ? `durable_execution:${execution.id}` : "")
  );
}

export function buildMetaOutboundExecutionInput({
  tenantId = "",
  tenantKey = "",
  channel = "instagram",
  provider = "meta",
  threadId = "",
  messageId = "",
  targetId = "",
  payload = {},
  safeMetadata = {},
  correlationIds = {},
  maxAttempts = 5,
} = {}) {
  return buildChannelOutboundExecutionInput({
    tenantId,
    tenantKey,
    channel,
    provider,
    threadId,
    messageId,
    targetId,
    payload,
    safeMetadata,
    correlationIds,
    maxAttempts,
  });
}

export function buildChannelOutboundExecutionInput({
  tenantId = "",
  tenantKey = "",
  channel = "instagram",
  provider = "meta",
  threadId = "",
  messageId = "",
  targetId = "",
  payload = {},
  safeMetadata = {},
  correlationIds = {},
  maxAttempts = 5,
} = {}) {
  const actionType = `${s(provider || "meta")}.outbound.send`;

  return {
    tenantId,
    tenantKey,
    channel,
    provider,
    actionType,
    targetType: "thread",
    targetId: targetId || threadId || messageId,
    threadId,
    messageId,
    idempotencyKey: buildExecutionIdempotencyKey({
      provider,
      actionType,
      messageId,
      threadId,
    }),
    payloadSummary: payload,
    safeMetadata,
    correlationIds,
    maxAttempts,
    nextRetryAt: new Date().toISOString(),
  };
}

export async function enqueueMetaOutboundExecution({
  db,
  tenantId = "",
  tenantKey = "",
  channel = "instagram",
  provider = "meta",
  threadId = "",
  messageId = "",
  payload = {},
  safeMetadata = {},
  correlationIds = {},
  maxAttempts = 5,
}) {
  return enqueueChannelOutboundExecution({
    db,
    tenantId,
    tenantKey,
    channel,
    provider,
    threadId,
    messageId,
    payload,
    safeMetadata,
    correlationIds,
    maxAttempts,
  });
}

export async function enqueueChannelOutboundExecution({
  db,
  tenantId = "",
  tenantKey = "",
  channel = "instagram",
  provider = "meta",
  threadId = "",
  messageId = "",
  payload = {},
  safeMetadata = {},
  correlationIds = {},
  maxAttempts = 5,
}) {
  const helpers = createDurableExecutionHelpers({ db });

  return helpers.enqueueExecution(
    buildChannelOutboundExecutionInput({
      tenantId,
      tenantKey,
      channel,
      provider,
      threadId,
      messageId,
      payload,
      safeMetadata,
      correlationIds,
      maxAttempts,
    })
  );
}

function normalizeCommentReplyChannel(channel = "instagram") {
  return s(channel || "instagram").toLowerCase() || "instagram";
}

export function mapDurableExecutionToCommentDeliveryStatus(status = "") {
  const value = s(status).toLowerCase();
  if (value === "succeeded") return "sent";
  if (value === "dead_lettered" || value === "terminal") return "dead";
  if (value === "retryable") return "failed";
  return "pending";
}

export function buildMetaCommentReplyExecutionInput({
  tenantId = "",
  tenantKey = "",
  channel = "instagram",
  provider = "meta",
  commentId = "",
  externalCommentId = "",
  externalPostId = "",
  externalUserId = "",
  replyText = "",
  actor = "operator",
  approved = true,
  maxAttempts = 5,
} = {}) {
  const safeChannel = normalizeCommentReplyChannel(channel);

  const action = {
    type: "reply_comment",
    channel: safeChannel,
    commentId: s(externalCommentId),
    text: s(replyText),
    meta: {
      tenantKey: s(tenantKey),
      commentId: s(commentId),
      externalCommentId: s(externalCommentId),
      externalPostId: s(externalPostId),
      actor: s(actor || "operator"),
    },
  };

  const payload = {
    tenantKey: s(tenantKey),
    actions: [action],
    context: {
      tenantKey: s(tenantKey),
      channel: safeChannel,
      commentId: s(externalCommentId),
      externalCommentId: s(externalCommentId),
      externalPostId: s(externalPostId),
      recipientId: s(externalUserId),
      userId: s(externalUserId),
    },
  };

  return {
    tenantId,
    tenantKey,
    channel: safeChannel,
    provider,
    actionType: "meta.comment.reply",
    targetType: "comment",
    targetId: commentId || externalCommentId,
    conversationId: externalPostId || externalCommentId,
    idempotencyKey: buildExecutionIdempotencyKey({
      provider,
      actionType: "meta.comment.reply",
      commentId: s(commentId),
      externalCommentId: s(externalCommentId),
      replyText: s(replyText),
      actor: s(actor || "operator"),
    }),
    payloadSummary: payload,
    safeMetadata: {
      commentId: s(commentId),
      externalCommentId: s(externalCommentId),
      externalPostId: s(externalPostId),
      externalUserId: s(externalUserId),
      replyText: s(replyText),
      actor: s(actor || "operator"),
      approved: Boolean(approved),
    },
    correlationIds: {
      commentId: s(commentId),
      externalCommentId: s(externalCommentId),
      externalPostId: s(externalPostId),
    },
    maxAttempts,
    nextRetryAt: new Date().toISOString(),
  };
}

export async function enqueueMetaCommentReplyExecution({
  db,
  tenantId = "",
  tenantKey = "",
  channel = "instagram",
  provider = "meta",
  commentId = "",
  externalCommentId = "",
  externalPostId = "",
  externalUserId = "",
  replyText = "",
  actor = "operator",
  approved = true,
  maxAttempts = 5,
}) {
  const helpers = createDurableExecutionHelpers({ db });

  return helpers.enqueueExecution(
    buildMetaCommentReplyExecutionInput({
      tenantId,
      tenantKey,
      channel,
      provider,
      commentId,
      externalCommentId,
      externalPostId,
      externalUserId,
      replyText,
      actor,
      approved,
      maxAttempts,
    })
  );
}

export async function enqueueVoiceSyncExecution({
  db,
  actionType,
  tenantId = "",
  tenantKey = "",
  providerCallSid = "",
  payload = {},
  idempotencyKey = "",
  correlationIds = {},
}) {
  const helpers = createDurableExecutionHelpers({ db });

  return helpers.enqueueExecution({
    tenantId,
    tenantKey,
    channel: "voice",
    provider: "twilio",
    actionType,
    targetType: "voice_call",
    targetId: providerCallSid,
    conversationId: providerCallSid,
    idempotencyKey:
      s(idempotencyKey) || buildVoiceSyncIdempotencyKey(actionType, payload),
    payloadSummary: payload,
    safeMetadata: {
      providerCallSid,
    },
    correlationIds,
    maxAttempts: 5,
    nextRetryAt: new Date().toISOString(),
  });
}

async function processChannelOutboundExecution({ db, wsHub, execution, logger }) {
  const metadata = obj(execution.safe_metadata);
  const payload = obj(execution.payload_summary);
  const attemptId = s(metadata.inboxOutboundAttemptId);
  const messageId = s(execution.message_id || metadata.messageId);
  const executionThreadId = s(execution.thread_id || metadata.threadId);
  const provider = resolveExecutionProvider(execution);
  const tenantKey = s(execution.tenant_key || metadata.tenantKey || "");
  const tenantId = s(execution.tenant_id || metadata.tenantId || "");

  const message = await getMessageById(db, messageId, { tenantId, tenantKey });
  const messageThreadId = s(message?.thread_id);
  let resolvedThreadId = executionThreadId || messageThreadId || "";

  let thread = await getThreadById(db, resolvedThreadId, { tenantId, tenantKey });

  if (!thread && messageThreadId && messageThreadId !== resolvedThreadId) {
    thread = await getThreadById(db, messageThreadId, { tenantId, tenantKey });
    if (thread) {
      resolvedThreadId = messageThreadId;
    }
  }

  if (!thread && messageThreadId) {
    thread = await refreshThread(db, messageThreadId, null, { tenantId, tenantKey });
    if (thread) {
      resolvedThreadId = messageThreadId;
    }
  }

  if (
    thread &&
    executionThreadId &&
    messageThreadId &&
    executionThreadId !== messageThreadId
  ) {
    logger.warn("durable_execution.thread_link_recovered", {
      executionId: execution.id,
      provider,
      executionThreadId,
      messageThreadId,
      resolvedThreadId,
      tenantKey,
    });
  }

  if (!message || !thread) {
    const missing = !message ? "message_missing" : "thread_missing";
    const missingMessage =
      missing === "message_missing" ? "message not found" : "thread not found";

    if (attemptId) {
      await markOutboundAttemptFailed({
        db,
        attemptId,
        tenantKey,
        error: missingMessage,
        errorCode: missing,
        providerResponse: {
          executionThreadId,
          messageThreadId,
          resolvedThreadId,
          tenantKey,
        },
        retryDelaySeconds: 300,
      });
    }

    if (messageId) {
      await updateOutboundMessageDeliveryFailure({
        db,
        messageId,
        tenantKey,
        status: "failed",
        error: missingMessage,
        errorCode: missing,
        providerResponse: {
          executionThreadId,
          messageThreadId,
          resolvedThreadId,
          tenantKey,
        },
      });
    }

    logger.warn("durable_execution.runtime_missing", {
      executionId: execution.id,
      provider,
      missing,
      tenantKey,
      messageId,
      executionThreadId,
      messageThreadId,
      resolvedThreadId,
    });

    return {
      ok: false,
      retryable: true,
      errorCode: missing,
      errorMessage: missingMessage,
      classification: "runtime_missing",
      resultSummary: {
        executionThreadId,
        messageThreadId,
        resolvedThreadId,
        tenantKey,
      },
    };
  }

  const existingAttempt = attemptId
    ? await getOutboundAttemptById(db, attemptId, tenantKey)
    : null;
  const messageDelivery = obj(message?.meta?.delivery);
  const alreadySentProviderMessageId = s(
    existingAttempt?.provider_message_id ||
      message?.external_message_id ||
      messageDelivery?.providerMessageId ||
      messageDelivery?.provider_message_id
  );
  const alreadySent =
    lower(existingAttempt?.status) === "sent" ||
    messageLooksSent(message, alreadySentProviderMessageId);

  if (alreadySent) {
    let updatedAttempt = existingAttempt;
    if (attemptId && lower(existingAttempt?.status) !== "sent") {
      updatedAttempt = await markOutboundAttemptSent({
        db,
        attemptId,
        tenantKey,
        providerMessageId: alreadySentProviderMessageId || null,
        providerResponse: {
          duplicateSuppressed: true,
          reason: "message_already_sent",
          executionId: execution.id,
        },
      });
    }

    emitOutboundDeliveryTruth({
      wsHub,
      tenantKey,
      threadId: resolvedThreadId,
      message,
      attempt: updatedAttempt,
      reason: "delivery_already_sent",
    });

    logger.warn("durable_execution.channel.duplicate_suppressed", {
      executionId: execution.id,
      provider,
      tenantKey,
      messageId,
      attemptId,
      providerMessageId: alreadySentProviderMessageId,
      resolvedThreadId,
    });

    return {
      ok: true,
      retryable: false,
      resultSummary: {
        provider,
        providerMessageId: alreadySentProviderMessageId,
        duplicateSuppressed: true,
        resolvedThreadId,
      },
    };
  }

  const reservedAttempt = attemptId
    ? await markOutboundAttemptSending(db, attemptId, tenantKey)
    : existingAttempt;

  if (attemptId && !reservedAttempt?.id) {
    const latestAttempt = await getOutboundAttemptById(db, attemptId, tenantKey);
    if (lower(latestAttempt?.status) === "sent") {
      return {
        ok: true,
        retryable: false,
        resultSummary: {
          provider,
          duplicateSuppressed: true,
          reason: "attempt_already_sent",
          resolvedThreadId,
        },
      };
    }

    return {
      ok: false,
      retryable: false,
      errorCode: "outbound_attempt_not_reservable",
      errorMessage: "outbound attempt could not be reserved for delivery",
      classification: "idempotency_reserved",
      resultSummary: {
        provider,
        attemptStatus: lower(latestAttempt?.status),
        resolvedThreadId,
      },
    };
  }

  const sideEffectIdempotencyKey = sideEffectKeyForExecution({
    execution,
    payload,
    attempt: reservedAttempt || existingAttempt || {},
    fallback: `${provider}:${message.id}`,
  });
  const sideEffectReservation = await reserveExternalSideEffect(db, {
    tenantId,
    tenantKey,
    provider,
    actionType: execution.action_type,
    idempotencyKey: sideEffectIdempotencyKey,
    executionId: execution.id,
    attemptId: attemptId || "",
    leaseToken: execution.lease_token,
  });

  if (!sideEffectReservation.acquired) {
    const record = sideEffectReservation.record || {};
    if (lower(record.state) === "sent") {
      const providerResponse = obj(record.provider_response);
      const providerMessageId = s(record.provider_message_id) || null;
      let updatedAttempt = existingAttempt;

      if (attemptId) {
        updatedAttempt = await markOutboundAttemptSent({
          db,
          attemptId,
          tenantKey,
          providerMessageId,
          providerResponse: {
            ...providerResponse,
            duplicateSuppressed: true,
            reason: "external_idempotency_sent",
            executionId: execution.id,
          },
        });
      }

      const updatedMessage = await updateOutboundMessageProviderId({
        db,
        messageId: message.id,
        tenantKey,
        providerMessageId,
        providerResponse,
      });

      emitOutboundDeliveryTruth({
        wsHub,
        tenantKey,
        threadId: resolvedThreadId,
        message: updatedMessage || message,
        attempt: updatedAttempt,
        reason: "external_idempotency_sent",
      });

      return {
        ok: true,
        retryable: false,
        resultSummary: {
          provider,
          providerMessageId: s(providerMessageId),
          duplicateSuppressed: true,
          idempotencyKey: sideEffectIdempotencyKey,
          resolvedThreadId,
        },
      };
    }

    return {
      ok: false,
      retryable: false,
      errorCode: "external_side_effect_already_reserved",
      errorMessage: "external side effect idempotency key is already reserved",
      classification: "idempotency_reserved",
      resultSummary: {
        provider,
        idempotencyKey: sideEffectIdempotencyKey,
        idempotencyState: lower(record.state),
        resolvedThreadId,
      },
    };
  }

  const delivery = await deliverChannelOutbound({
    db,
    execution: {
      ...execution,
      thread_id: resolvedThreadId,
    },
    payload,
    message,
    thread,
  });

  if (!delivery.ok) {
    const failure = classifyChannelOutboundFailure({
      execution,
      delivery,
    });

    const actionType = resolveOutboundPayloadActionType(payload, message);

    if (
      shouldKeepBubbleSentOnMetaInternalError({
        provider,
        actionType,
        message,
        failure,
        delivery,
      })
    ) {
      const providerResponse = buildInternalMetaBridgeProviderResponse({
        delivery,
        failure,
        actionType,
      });

      await markExternalSideEffectSent(db, {
        tenantKey,
        provider,
        actionType: execution.action_type,
        idempotencyKey: sideEffectIdempotencyKey,
        leaseToken: sideEffectReservation.leaseToken,
        providerMessageId: delivery?.providerMessageId || "",
        providerResponse,
      });

      let updatedAttempt = null;

      if (attemptId) {
        updatedAttempt = await markOutboundAttemptSent({
          db,
          attemptId,
          tenantKey,
          providerMessageId: delivery?.providerMessageId || null,
          providerResponse,
        });
      }

      const updatedMessage = hasRenderableOutboundText(message)
        ? await updateOutboundMessageProviderId({
            db,
            messageId: message.id,
            tenantKey,
            providerMessageId: delivery?.providerMessageId || null,
            providerResponse,
          })
        : message;

      emitOutboundDeliveryTruth({
        wsHub,
        tenantKey,
        threadId: resolvedThreadId,
        message: updatedMessage || message,
        attempt: updatedAttempt,
        reason: "internal_meta_bridge_error_ignored",
      });

      try {
        await writeAudit(db, {
          actor: "system",
          action: "durable_execution.meta_internal_bridge_error_ignored",
          objectType: "durable_execution",
          objectId: execution.id,
          meta: {
            threadId: resolvedThreadId,
            messageId,
            provider,
            actionType,
            errorCode: failure.errorCode,
            error: failure.errorMessage,
          },
        });
      } catch {}

      logger.warn("durable_execution.meta_internal_bridge_error_ignored", {
        executionId: execution.id,
        provider,
        actionType,
        errorCode: failure.errorCode,
        resolvedThreadId,
      });

      return {
        ok: true,
        retryable: false,
        resultSummary: {
          provider,
          actionType,
          internalBridgeErrorIgnored: true,
          originalErrorCode: failure.errorCode,
          originalError: failure.errorMessage,
          resolvedThreadId,
        },
      };
    }

    const providerOutcomeUnknown = failureHasUnknownProviderOutcome({
      failure,
      delivery,
    });
    const retryableDelivery = Boolean(failure.retryable && !providerOutcomeUnknown);

    await markExternalSideEffectFailed(db, {
      tenantKey,
      provider,
      actionType: execution.action_type,
      idempotencyKey: sideEffectIdempotencyKey,
      leaseToken: sideEffectReservation.leaseToken,
      retryable: retryableDelivery,
      retryDelaySeconds: 120,
      errorCode: providerOutcomeUnknown
        ? "provider_outcome_unknown"
        : failure.errorCode,
      errorMessage: providerOutcomeUnknown
        ? `provider outcome unknown: ${failure.errorMessage}`
        : failure.errorMessage,
      providerResponse: delivery.providerResponse || delivery.json || {},
    });

    if (providerOutcomeUnknown) {
      failure.retryable = false;
      failure.errorCode = "provider_outcome_unknown";
      failure.errorMessage = `provider outcome unknown: ${failure.errorMessage}`;
      failure.classification = "provider_outcome_unknown";
    }

    let updatedAttempt = null;

    if (attemptId) {
      if (retryableDelivery) {
        updatedAttempt = await markOutboundAttemptFailed({
          db,
          attemptId,
          tenantKey,
          error: failure.errorMessage,
          errorCode: failure.errorCode,
          providerResponse: delivery.providerResponse || delivery.json || {},
          retryDelaySeconds: 120,
        });
      } else {
        updatedAttempt = await markOutboundAttemptDead(db, attemptId, tenantKey);
      }
    }

    const updatedMessage = await updateOutboundMessageDeliveryFailure({
      db,
      messageId: message.id,
      tenantKey,
      status: retryableDelivery ? "failed" : "dead",
      error: failure.errorMessage,
      errorCode: failure.errorCode,
      providerResponse: delivery.providerResponse || delivery.json || {},
    });

    emitOutboundDeliveryTruth({
      wsHub,
      tenantKey,
      threadId: resolvedThreadId,
      message: updatedMessage || message,
      attempt: updatedAttempt,
      reason: "delivery_failed",
    });

    try {
      await writeAudit(db, {
        actor: "system",
        action: `durable_execution.${provider}_failed`,
        objectType: "durable_execution",
        objectId: execution.id,
        meta: {
          threadId: resolvedThreadId,
          messageId,
          provider,
          errorCode: failure.errorCode,
          error: failure.errorMessage,
          providerStatus: failure.status,
        },
      });
    } catch {}

    logger.warn("durable_execution.channel.failed", {
      executionId: execution.id,
      provider,
      status: failure.status,
      retryable: retryableDelivery,
      errorCode: failure.errorCode,
      resolvedThreadId,
    });

    return {
      ok: false,
      retryable: retryableDelivery,
      errorCode: failure.errorCode,
      errorMessage: failure.errorMessage,
      classification: failure.classification,
      resultSummary: {
        provider,
        providerStatus: failure.status,
        resolvedThreadId,
      },
    };
  }

  const providerResponse = obj(delivery.providerResponse);
  const providerMessageId = s(delivery.providerMessageId) || null;

  await markExternalSideEffectSent(db, {
    tenantKey,
    provider,
    actionType: execution.action_type,
    idempotencyKey: sideEffectIdempotencyKey,
    leaseToken: sideEffectReservation.leaseToken,
    providerMessageId,
    providerResponse,
  });

  let updatedAttempt = null;

  if (attemptId) {
    updatedAttempt = await markOutboundAttemptSent({
      db,
      attemptId,
      tenantKey,
      providerMessageId,
      providerResponse,
    });
  }

  const updatedMessage = await updateOutboundMessageProviderId({
    db,
    messageId: message.id,
    tenantKey,
    providerMessageId,
    providerResponse,
  });

  try {
    await writeAudit(db, {
      actor: "system",
      action: `durable_execution.${provider}_succeeded`,
      objectType: "durable_execution",
      objectId: execution.id,
      meta: {
        threadId: resolvedThreadId,
        messageId,
        provider,
        providerMessageId: s(providerMessageId),
      },
    });
  } catch {}

  emitOutboundDeliveryTruth({
    wsHub,
    tenantKey:
      updatedMessage?.tenant_key ||
      message?.tenant_key ||
      execution.tenant_key,
    threadId: String(updatedMessage?.thread_id || message.thread_id || ""),
    message: updatedMessage || message,
    attempt: updatedAttempt,
    reason: "delivery_sent",
  });

  return {
    ok: true,
    retryable: false,
    resultSummary: {
      provider,
      providerMessageId: s(providerMessageId),
      providerStatus: Number(delivery?.status || 0),
      resolvedThreadId,
    },
  };
}

async function processVoiceSyncExecution({ db, execution, logger }) {
  const payload = obj(execution.payload_summary);
  let result = null;

  if (execution.action_type === "voice.sync.session_upsert") {
    result = await processVoiceSessionUpsert({ db, body: payload });
  } else if (execution.action_type === "voice.sync.transcript") {
    result = await processVoiceTranscript({
      db,
      providerCallSid: s(payload.providerCallSid || payload.callSid),
      text: s(payload.text),
      role: s(payload.role || "customer"),
      ts: payload.ts || new Date().toISOString(),
    });
  } else if (execution.action_type === "voice.sync.state") {
    result = await processVoiceSessionState({
      db,
      providerCallSid: s(payload.providerCallSid || payload.callSid),
      body: payload,
    });
  } else if (execution.action_type === "voice.sync.operator_join") {
    result = await processVoiceOperatorJoin({
      db,
      providerCallSid: s(payload.providerCallSid || payload.callSid),
      body: payload,
    });
  } else {
    result = {
      ok: false,
      statusCode: 400,
      error: "unsupported_voice_sync_action",
    };
  }

  if (!result?.ok) {
    const failure = classifyVoiceSyncFailure({
      status: result?.statusCode || 0,
      text: result?.error || "voice sync failed",
    });

    logger.warn("durable_execution.voice.failed", {
      executionId: execution.id,
      actionType: execution.action_type,
      errorCode: failure.errorCode,
      retryable: failure.retryable,
    });

    return {
      ok: false,
      retryable: failure.retryable,
      errorCode: failure.errorCode || s(result?.error),
      errorMessage: s(result?.error || "voice sync failed"),
      classification: failure.classification,
      resultSummary: {
        statusCode: Number(result?.statusCode || 0),
      },
    };
  }

  return {
    ok: true,
    retryable: false,
    resultSummary: {
      statusCode: Number(result?.statusCode || 200),
      actionType: execution.action_type,
    },
  };
}

export async function processMetaCommentReplyExecution({
  db,
  wsHub,
  execution,
  logger,
  sendCommentActions = sendCommentActionsViaMetaGateway,
}) {
  const metadata = obj(execution.safe_metadata);
  const payload = obj(execution.payload_summary);
  const commentId = s(metadata.commentId || execution.target_id);
  const actor = s(metadata.actor || "operator");
  const approved = Boolean(metadata.approved !== false);
  const actionType = s(
    execution?.action_type ||
      payload?.actionType ||
      payload?.action_type ||
      "meta.comment.reply"
  );
  const replyText =
    s(metadata.replyText) ||
    s(payload?.actions?.[0]?.text) ||
    s(payload?.actions?.[0]?.meta?.replyText);

  const tenantKey = s(execution?.tenant_key || payload?.tenantKey);
  const comment = await getCommentById(db, commentId, tenantKey);
  if (!comment) {
    return {
      ok: false,
      retryable: true,
      errorCode: "comment_missing",
      errorMessage: "comment not found",
      classification: "runtime_missing",
      resultSummary: {},
    };
  }

  const existingReply = obj(comment?.classification?.reply || comment?.raw?.reply);
  const existingDeliveryStatus = lower(
    existingReply?.deliveryStatus ||
      existingReply?.delivery_status ||
      existingReply?.status
  );
  if (existingDeliveryStatus === "sent") {
    return {
      ok: true,
      retryable: false,
      resultSummary: {
        commentId: comment.id,
        duplicateSuppressed: true,
        reason: "comment_reply_already_sent",
      },
    };
  }

  const commentSideEffectKey = sideEffectKeyForExecution({
    execution,
    payload,
    fallback: `meta.comment.reply:${comment.id}:${replyText}`,
  });
  const commentSideEffectReservation = await reserveExternalSideEffect(db, {
    tenantId: execution?.tenant_id || comment?.tenant_id || "",
    tenantKey,
    provider: "meta",
    actionType,
    idempotencyKey: commentSideEffectKey,
    executionId: execution.id,
    leaseToken: execution.lease_token,
  });

  if (!commentSideEffectReservation.acquired) {
    const record = commentSideEffectReservation.record || {};
    if (lower(record.state) === "sent") {
      return {
        ok: true,
        retryable: false,
        resultSummary: {
          commentId: comment.id,
          providerMessageId: s(record.provider_message_id),
          duplicateSuppressed: true,
          idempotencyKey: commentSideEffectKey,
        },
      };
    }

    return {
      ok: false,
      retryable: false,
      errorCode: "external_side_effect_already_reserved",
      errorMessage: "external side effect idempotency key is already reserved",
      classification: "idempotency_reserved",
      resultSummary: {
        commentId: comment.id,
        idempotencyKey: commentSideEffectKey,
        idempotencyState: lower(record.state),
      },
    };
  }

  const sendPayload = {
    ...payload,
    idempotencyKey: commentSideEffectKey,
    context: {
      ...obj(payload.context),
      idempotencyKey: commentSideEffectKey,
      meta: {
        ...obj(payload.context?.meta),
        idempotencyKey: commentSideEffectKey,
      },
    },
    actions: Array.isArray(payload.actions)
      ? payload.actions.map((action) => ({
          ...action,
          idempotencyKey: s(action?.idempotencyKey || action?.idempotency_key || commentSideEffectKey),
          meta: {
            ...obj(action?.meta),
            idempotencyKey: s(
              action?.meta?.idempotencyKey ||
                action?.meta?.idempotency_key ||
                action?.idempotencyKey ||
                action?.idempotency_key ||
                commentSideEffectKey
            ),
          },
        }))
      : [],
  };

  const gateway = await sendCommentActions(sendPayload);
  if (!gateway.ok) {
    const failure = classifyMetaGatewayFailure(gateway);
    const providerOutcomeUnknown = failureHasUnknownProviderOutcome({
      failure,
      delivery: gateway,
    });
    const retryableDelivery = Boolean(failure.retryable && !providerOutcomeUnknown);
    if (providerOutcomeUnknown) {
      failure.retryable = false;
      failure.errorCode = "provider_outcome_unknown";
      failure.errorMessage = `provider outcome unknown: ${failure.errorMessage}`;
      failure.classification = "provider_outcome_unknown";
    }
    const deliveryStatus = retryableDelivery ? "failed" : "dead";

    await markExternalSideEffectFailed(db, {
      tenantKey,
      provider: "meta",
      actionType,
      idempotencyKey: commentSideEffectKey,
      leaseToken: commentSideEffectReservation.leaseToken,
      retryable: retryableDelivery,
      retryDelaySeconds: 120,
      errorCode: failure.errorCode,
      errorMessage: failure.errorMessage,
      providerResponse: gateway.json || {},
    });

    const nextClassification = mergeClassificationForReply(comment.classification, {
      replyText,
      actor,
      approved,
      sent: false,
      provider: gateway.json || null,
      sendError: failure.errorMessage,
      errorCode: failure.errorCode,
      deliveryStatus,
      executionId: execution.id,
    });

    const nextRaw = buildReplyRaw(comment, {
      replyText,
      actor,
      approved,
      sent: false,
      provider: gateway.json || null,
      sendError: failure.errorMessage,
      errorCode: failure.errorCode,
      deliveryStatus,
      executionId: execution.id,
    });

    const updatedComment = await updateCommentState(
      db,
      comment.id,
      nextClassification,
      nextRaw,
      tenantKey
    );

    emitCommentUpdatedRealtime(wsHub, updatedComment || comment);

    await writeAudit(db, {
      actor: "system",
      action:
        deliveryStatus === "dead"
          ? "comment.reply_delivery_dead"
          : "comment.reply_delivery_failed",
      objectType: "comment",
      objectId: String(comment.id || ""),
      meta: {
        tenantKey: comment.tenant_key,
        executionId: execution.id,
        gatewayStatus: Number(gateway?.status || 0),
        errorCode: failure.errorCode,
        error: failure.errorMessage,
      },
    });

    logger.warn("durable_execution.comment_reply.failed", {
      executionId: execution.id,
      commentId: comment.id,
      retryable: failure.retryable,
      errorCode: failure.errorCode,
      gatewayStatus: failure.status,
    });

    return {
      ok: false,
      retryable: retryableDelivery,
      errorCode: failure.errorCode,
      errorMessage: failure.errorMessage,
      classification: failure.classification,
      resultSummary: {
        gatewayStatus: failure.status,
        commentId: comment.id,
      },
    };
  }

  const providerResult = gateway?.json?.result || gateway?.json || {};
  const providerResponse =
    providerResult?.response || providerResult?.json || providerResult || {};
  const providerMessageId =
    s(
      providerResponse?.message_id ||
        providerResponse?.messageId ||
        providerResponse?.id
    ) || null;

  await markExternalSideEffectSent(db, {
    tenantKey,
    provider: "meta",
    actionType,
    idempotencyKey: commentSideEffectKey,
    leaseToken: commentSideEffectReservation.leaseToken,
    providerMessageId,
    providerResponse,
  });

  const nextClassification = mergeClassificationForReply(comment.classification, {
    replyText,
    actor,
    approved,
    sent: true,
    provider: gateway.json || null,
    sendError: "",
    errorCode: "",
    deliveryStatus: "sent",
    executionId: execution.id,
    providerMessageId,
  });

  const nextRaw = buildReplyRaw(comment, {
    replyText,
    actor,
    approved,
    sent: true,
    provider: gateway.json || null,
    sendError: "",
    errorCode: "",
    deliveryStatus: "sent",
    executionId: execution.id,
    providerMessageId,
  });

  const updatedComment = await updateCommentState(
    db,
    comment.id,
    nextClassification,
    nextRaw,
    tenantKey
  );

  emitCommentUpdatedRealtime(wsHub, updatedComment || comment);

  await writeAudit(db, {
    actor: "system",
    action: "comment.reply_delivery_sent",
    objectType: "comment",
    objectId: String(comment.id || ""),
    meta: {
      tenantKey: comment.tenant_key,
      executionId: execution.id,
      providerMessageId: s(providerMessageId),
      gatewayStatus: Number(gateway?.status || 0),
    },
  });

  logger.info("durable_execution.comment_reply.sent", {
    executionId: execution.id,
    commentId: comment.id,
    providerMessageId: s(providerMessageId),
    gatewayStatus: Number(gateway?.status || 0),
  });

  return {
    ok: true,
    retryable: false,
    resultSummary: {
      commentId: comment.id,
      providerMessageId: s(providerMessageId),
      gatewayStatus: Number(gateway?.status || 0),
    },
  };
}

export async function requeueMetaCommentReplyExecution({
  db,
  wsHub,
  execution,
  requestedBy = "system",
}) {
  const metadata = obj(execution?.safe_metadata);
  const payload = obj(execution?.payload_summary);
  const commentId = s(metadata.commentId || execution?.target_id);

  if (!commentId) {
    return {
      ok: false,
      errorCode: "comment_missing",
      errorMessage: "comment not found",
    };
  }

  const tenantKey = s(execution?.tenant_key || payload?.tenantKey);
  const comment = await getCommentById(db, commentId, tenantKey);
  if (!comment) {
    return {
      ok: false,
      errorCode: "comment_missing",
      errorMessage: "comment not found",
    };
  }

  const executionTenantId = s(execution?.tenant_id);
  const executionTenantKey = s(execution?.tenant_key).toLowerCase();
  const commentTenantId = s(comment?.tenant_id);
  const commentTenantKey = s(comment?.tenant_key).toLowerCase();

  if (
    (executionTenantId && commentTenantId && executionTenantId !== commentTenantId) ||
    (executionTenantKey && commentTenantKey && executionTenantKey !== commentTenantKey)
  ) {
    return {
      ok: false,
      errorCode: "comment_tenant_mismatch",
      errorMessage: "comment tenant mismatch",
    };
  }

  const replyText =
    s(metadata.replyText) ||
    s(payload?.actions?.[0]?.text) ||
    s(comment?.classification?.reply?.text) ||
    s(comment?.raw?.reply?.text);

  const actor =
    s(metadata.actor) ||
    s(comment?.classification?.reply?.actor) ||
    s(comment?.raw?.reply?.actor) ||
    "operator";

  const approved = metadata.approved !== false;

  const nextClassification = mergeClassificationForReplyPending(
    comment.classification,
    {
      replyText,
      actor,
      approved,
      executionId: execution.id,
    }
  );

  const nextRaw = buildReplyPendingRaw(comment, {
    replyText,
    actor,
    approved,
    executionId: execution.id,
  });

  const updatedComment = await updateCommentState(
    db,
    comment.id,
    nextClassification,
    nextRaw,
    tenantKey
  );

  emitCommentUpdatedRealtime(wsHub, updatedComment || comment);

  await writeAudit(db, {
    actor: s(requestedBy || "system"),
    action: "comment.reply_delivery_requeued",
    objectType: "comment",
    objectId: String(comment.id || ""),
    meta: {
      tenantKey: comment.tenant_key,
      executionId: s(execution.id),
      requestedBy: s(requestedBy || "system"),
      deliveryStatus: "pending",
      durableExecutionStatus: s(execution.status || ""),
    },
  });

  return {
    ok: true,
    comment: updatedComment || comment,
  };
}

export async function processDurableExecution({ db, wsHub, execution }) {
  const logger = createLogger({
    service: "ai-hq-backend",
    component: "durable-execution-runner",
    executionId: s(execution?.id),
    tenantKey: s(execution?.tenant_key),
    provider: s(execution?.provider),
    channel: s(execution?.channel),
    actionType: s(execution?.action_type),
    threadId: s(execution?.thread_id),
    conversationId: s(execution?.conversation_id),
  });

  if (s(execution?.action_type).endsWith(".outbound.send")) {
    return processChannelOutboundExecution({ db, wsHub, execution, logger });
  }

  if (execution?.action_type === "meta.comment.reply") {
    return processMetaCommentReplyExecution({ db, wsHub, execution, logger });
  }

  if (execution?.action_type === "comments.webhook.process") {
    return processCommentWebhookJob({
      db,
      wsHub,
      payload: obj(execution.payload_summary),
    });
  }

  if (s(execution?.action_type).startsWith("voice.sync.")) {
    return processVoiceSyncExecution({ db, execution, logger });
  }

  return {
    ok: false,
    retryable: false,
    errorCode: "unsupported_execution_action",
    errorMessage: `unsupported action type: ${s(execution?.action_type)}`,
    classification: "unsupported",
    resultSummary: {},
  };
}

export async function finalizeDurableExecution({ db, execution, result }) {
  const helpers = createDurableExecutionHelpers({ db });
  const attemptNumber = Number(execution?.attempt_count || 0);

  if (result?.ok) {
    await helpers.completeAttempt({
      executionId: execution.id,
      attemptNumber,
      statusTo: "succeeded",
      resultSummary: obj(result?.resultSummary),
      correlationIds: obj(execution?.correlation_ids),
    });

    const updated = await helpers.markExecutionSucceeded({
      executionId: execution.id,
      leaseToken: execution.lease_token,
    });

    recordDurableExecutionFinalized({
      provider: execution.provider,
      channel: execution.channel,
      actionType: execution.action_type,
      status: updated?.status || "succeeded",
    });

    return updated;
  }

  const retryPlan = buildExecutionRetryPlan({
    attemptCount: attemptNumber,
    maxAttempts: execution?.max_attempts,
    retryable: Boolean(result?.retryable),
  });

  await helpers.completeAttempt({
    executionId: execution.id,
    attemptNumber,
    statusTo: retryPlan.nextStatus,
    errorCode: s(result?.errorCode),
    errorMessage: s(result?.errorMessage),
    errorClassification: s(result?.classification),
    resultSummary: obj(result?.resultSummary),
    correlationIds: obj(execution?.correlation_ids),
  });

  if (retryPlan.nextStatus === "retryable") {
    const updated = await helpers.markExecutionRetryable({
      executionId: execution.id,
      leaseToken: execution.lease_token,
      nextRetryAt: retryPlan.nextRetryAt,
      errorCode: s(result?.errorCode),
      errorMessage: s(result?.errorMessage),
      errorClassification: s(result?.classification),
    });

    recordDurableExecutionFinalized({
      provider: execution.provider,
      channel: execution.channel,
      actionType: execution.action_type,
      status: updated?.status || "retryable",
    });

    return updated;
  }

  const updated = await helpers.markExecutionTerminal({
    executionId: execution.id,
    leaseToken: execution.lease_token,
    errorCode: s(result?.errorCode),
    errorMessage: s(result?.errorMessage),
    errorClassification: s(result?.classification),
    deadLetter: retryPlan.nextStatus === "dead_lettered",
  });

  recordDurableExecutionFinalized({
    provider: execution.provider,
    channel: execution.channel,
    actionType: execution.action_type,
    status: updated?.status || retryPlan.nextStatus,
  });

  return updated;
}
