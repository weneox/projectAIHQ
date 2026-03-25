import { createDurableExecutionHelpers } from "../db/helpers/durableExecutions.js";
import {
  buildExecutionIdempotencyKey,
  buildExecutionRetryPlan,
  buildVoiceSyncIdempotencyKey,
  classifyMetaGatewayFailure,
  classifyVoiceSyncFailure,
} from "./durableExecutionCore.js";
import { sendOutboundViaMetaGateway } from "./metaGatewayClient.js";
import {
  getMessageById,
  getThreadById,
  markOutboundAttemptDead,
  markOutboundAttemptFailed,
  markOutboundAttemptSent,
  updateOutboundMessageProviderId,
} from "../routes/api/inbox/repository.js";
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
