import { createDurableExecutionHelpers } from "../db/helpers/durableExecutions.js";
import {
  buildExecutionIdempotencyKey,
  buildExecutionRetryPlan,
  buildVoiceSyncIdempotencyKey,
  classifyMetaGatewayFailure,
  classifyVoiceSyncFailure,
} from "./durableExecutionCore.js";
import {
  sendCommentActionsViaMetaGateway,
  sendOutboundViaMetaGateway,
} from "./metaGatewayClient.js";
import {
  getMessageById,
  getThreadById,
  markOutboundAttemptDead,
  markOutboundAttemptFailed,
  markOutboundAttemptSent,
  updateOutboundMessageDeliveryFailure,
  updateOutboundMessageProviderId,
} from "../routes/api/inbox/repository.js";
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

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
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
  return {
    tenantId,
    tenantKey,
    channel,
    provider,
    actionType: "meta.outbound.send",
    targetType: "thread",
    targetId: targetId || threadId || messageId,
    threadId,
    messageId,
    idempotencyKey: buildExecutionIdempotencyKey({
      provider,
      actionType: "meta.outbound.send",
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
  const helpers = createDurableExecutionHelpers({ db });
  return helpers.enqueueExecution(
    buildMetaOutboundExecutionInput({
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
    // Durable execution is the primary control plane for voice sync.
    // Duplicate Twilio-side requests collapse through ledger idempotency.
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

async function processMetaOutboundExecution({ db, wsHub, execution, logger }) {
  const metadata = obj(execution.safe_metadata);
  const payload = obj(execution.payload_summary);
  // Durable execution drives control decisions. The inbox attempt row is only
  // compatibility/history state for thread tooling and provider breadcrumbs.
  const attemptId = s(metadata.inboxOutboundAttemptId);
  const messageId = s(execution.message_id || metadata.messageId);
  const threadId = s(execution.thread_id || metadata.threadId);

  const message = await getMessageById(db, messageId);
  const thread = await getThreadById(db, threadId);

  if (!message || !thread) {
    const missing = !message ? "message_missing" : "thread_missing";
    if (attemptId) {
      await markOutboundAttemptFailed({
        db,
        attemptId,
        error: missing === "message_missing" ? "message not found" : "thread not found",
        errorCode: missing,
        providerResponse: {},
        retryDelaySeconds: 300,
      });
    }
    if (messageId) {
      await updateOutboundMessageDeliveryFailure({
        db,
        messageId,
        status: "failed",
        error: missing === "message_missing" ? "message not found" : "thread not found",
        errorCode: missing,
        providerResponse: {},
      });
    }

    return {
      ok: false,
      retryable: true,
      errorCode: missing,
      errorMessage: missing === "message_missing" ? "message not found" : "thread not found",
      classification: "runtime_missing",
      resultSummary: {},
    };
  }

  const gateway = await sendOutboundViaMetaGateway(payload);
  if (!gateway.ok) {
    const failure = classifyMetaGatewayFailure(gateway);

    if (attemptId) {
      if (failure.retryable) {
        await markOutboundAttemptFailed({
          db,
          attemptId,
          error: failure.errorMessage,
          errorCode: failure.errorCode,
          providerResponse: gateway.json || {},
          retryDelaySeconds: 120,
        });
      } else {
        await markOutboundAttemptDead(db, attemptId);
      }
    }
    await updateOutboundMessageDeliveryFailure({
      db,
      messageId: message.id,
      status: failure.retryable ? "failed" : "dead",
      error: failure.errorMessage,
      errorCode: failure.errorCode,
      providerResponse: gateway.json || {},
    });

    logger.warn("durable_execution.meta.failed", {
      executionId: execution.id,
      gatewayStatus: failure.status,
      retryable: failure.retryable,
      errorCode: failure.errorCode,
    });

    return {
      ok: false,
      retryable: failure.retryable,
      errorCode: failure.errorCode,
      errorMessage: failure.errorMessage,
      classification: failure.classification,
      resultSummary: {
        gatewayStatus: failure.status,
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

  if (attemptId) {
    await markOutboundAttemptSent({
      db,
      attemptId,
      providerMessageId,
      providerResponse,
    });
  }

  const updatedMessage = await updateOutboundMessageProviderId({
    db,
    messageId: message.id,
    providerMessageId,
    providerResponse,
  });

  try {
    await writeAudit(db, {
      actor: "system",
      action: "durable_execution.meta_succeeded",
      objectType: "durable_execution",
      objectId: execution.id,
      meta: {
        threadId,
        messageId,
        providerMessageId: s(providerMessageId),
      },
    });
  } catch {}

  try {
    emitRealtimeEvent(wsHub, {
      type: "inbox.message.updated",
      audience: "operator",
      tenantKey: updatedMessage?.tenant_key || message?.tenant_key || execution.tenant_key,
      threadId: String(updatedMessage?.thread_id || message.thread_id || ""),
      message: updatedMessage || message,
    });
  } catch {}

  return {
    ok: true,
    retryable: false,
    resultSummary: {
      providerMessageId: s(providerMessageId),
      gatewayStatus: Number(gateway?.status || 0),
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
  const replyText =
    s(metadata.replyText) ||
    s(payload?.actions?.[0]?.text) ||
    s(payload?.actions?.[0]?.meta?.replyText);

  const comment = await getCommentById(db, commentId);
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

  const gateway = await sendCommentActions(payload);
  if (!gateway.ok) {
    const failure = classifyMetaGatewayFailure(gateway);
    const deliveryStatus = failure.retryable ? "failed" : "dead";
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
      nextRaw
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
      retryable: failure.retryable,
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
    nextRaw
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

  const comment = await getCommentById(db, commentId);
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
    nextRaw
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

export async function processDurableExecution({
  db,
  wsHub,
  execution,
}) {
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

  if (execution?.action_type === "meta.outbound.send") {
    return processMetaOutboundExecution({ db, wsHub, execution, logger });
  }

  if (execution?.action_type === "meta.comment.reply") {
    return processMetaCommentReplyExecution({ db, wsHub, execution, logger });
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

export async function finalizeDurableExecution({
  db,
  execution,
  result,
}) {
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
