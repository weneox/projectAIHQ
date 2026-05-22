import {
  buildVoiceActionCallPatch,
  executeVoiceAction,
} from "./actions/voiceActionRuntime.js";
import {
  normalizeRealtimeSidebandEvent,
} from "./realtimeSidebandEvents.js";
import {
  buildOpenAIRealtimeSidebandToolOutputEvents,
} from "./providers/openaiRealtimeSidebandAdapter.js";
import {
  getRealtimeProviderAdapter,
} from "./realtimeProviderAdapters.js";
import {
  markVoiceRealtimeToolExecutionFailed,
  markVoiceRealtimeToolExecutionSent,
  reserveVoiceRealtimeToolExecution,
} from "./realtimeToolExecutionIdempotency.js";

export const VOICE_REALTIME_SIDEBAND_TOOL_DISPATCHER_VERSION =
  "voice-realtime-sideband-tool-dispatcher-v1";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function buildToolExecutionIdempotencyPayload(reservation = {}, finalityRecord = null) {
  return {
    version: s(reservation.version),
    idempotencyKey: s(reservation.idempotencyKey),
    provider: s(reservation.provider),
    actionType: s(reservation.actionType),
    acquired: reservation.acquired === true,
    duplicate: reservation.duplicate === true,
    skipped: reservation.skipped === true,
    reasonCode: s(reservation.reasonCode),
    recordState: s(finalityRecord?.state || reservation.recordState || reservation.record?.state),
    source: s(reservation.source),
  };
}

function buildDuplicateToolResult({ reservation = {}, toolCall = {} } = {}) {
  return {
    ok: true,
    status: "duplicate_skipped",
    duplicate: true,
    reasonCode: s(
      reservation.reasonCode || "voice_realtime_tool_execution_duplicate"
    ),
    message: "Tool execution already processed.",
    toolCallId: s(toolCall.id || toolCall.call_id || toolCall.callId),
    toolName: s(toolCall.name),
  };
}

function resolveProviderAdapter({
  normalized = {},
  target = {},
  getProviderAdapter = getRealtimeProviderAdapter,
} = {}) {
  return getProviderAdapter(
    s(normalized.provider || target.provider || "openai")
  );
}

function buildProviderToolOutputEvents({
  adapter = null,
  toolCall = {},
  result = {},
  includeResponseCreate = true,
} = {}) {
  if (typeof adapter?.buildToolOutputEvents !== "function") {
    return {
      ok: false,
      provider: s(adapter?.provider),
      reasonCode: "unsupported_realtime_provider",
      outboundEvents: [],
    };
  }

  const built = adapter.buildToolOutputEvents({
    toolCall,
    result,
    includeResponseCreate,
  });

  if (Array.isArray(built)) {
    return {
      ok: true,
      provider: s(adapter.provider),
      reasonCode: "",
      outboundEvents: built,
    };
  }

  return {
    ok: built?.ok !== false,
    provider: s(built?.provider || adapter.provider),
    reasonCode: s(built?.reasonCode),
    outboundEvents: arr(built?.outboundEvents),
  };
}

function buildUnsupportedProviderDispatchResult({
  normalized = {},
  toolCall = {},
  providerAdapter = {},
} = {}) {
  return {
    ok: false,
    dispatched: false,
    status: "unsupported",
    reasonCode: s(providerAdapter.reasonCode || "unsupported_realtime_provider"),
    normalized,
    toolCall,
    providerAdapter: {
      provider: s(providerAdapter.provider),
      status: s(providerAdapter.status || "unsupported"),
      reasonCode: s(providerAdapter.reasonCode || "unsupported_realtime_provider"),
    },
    outboundEvents: [],
    callPatch: {},
    resultTrace: null,
  };
}

export function buildRealtimeSidebandToolOutputEvents(input = {}) {
  return buildOpenAIRealtimeSidebandToolOutputEvents(input);
}

export function buildRealtimeSidebandToolResultTrace({
  normalized = {},
  toolCall = {},
  result = {},
  idempotency = {},
} = {}) {
  return {
    eventType: "voice.sideband.tool_result",
    actor: "system",
    role: "system",
    text: s(result.message || result.status || toolCall.name),
    payload: {
      sidebandToolDispatcherVersion: VOICE_REALTIME_SIDEBAND_TOOL_DISPATCHER_VERSION,
      realtimeType: s(normalized.realtimeType),
      providerRealtimeCallId: s(normalized.providerRealtimeCallId),
      toolCallId: s(toolCall.id),
      toolName: s(toolCall.name),
      resultStatus: s(result.status),
      assistantInstruction: s(
        result.assistantInstruction || result.nextAssistantInstruction
      ),
      nextQuestion: s(result.nextQuestion),
      missingRequired: arr(result.missingRequired),
      idempotency: obj(idempotency),
      idempotencyKey: s(idempotency.idempotencyKey),
      reservationAcquired: idempotency.acquired === true,
      reservationDuplicate: idempotency.duplicate === true,
      reservationState: s(idempotency.recordState),
      reservationReasonCode: s(idempotency.reasonCode),
      result,
    },
  };
}

export async function dispatchRealtimeSidebandToolCall({
  db = null,
  event = {},
  target = {},
  call = {},
  scope = {},
  runtimeConfig = {},
  normalized: preNormalized = null,
  executeAction = executeVoiceAction,
  reserveExecution = reserveVoiceRealtimeToolExecution,
  markExecutionSent = markVoiceRealtimeToolExecutionSent,
  markExecutionFailed = markVoiceRealtimeToolExecutionFailed,
  getProviderAdapter = getRealtimeProviderAdapter,
} = {}) {
  const normalized = obj(preNormalized).eventType
    ? preNormalized
    : normalizeRealtimeSidebandEvent(event, { target });
  const toolCall = normalized.toolCall;

  if (!toolCall?.name) {
    return {
      ok: true,
      dispatched: false,
      status: "ignored",
      reasonCode: "sideband_event_not_tool_call",
      normalized,
      outboundEvents: [],
      callPatch: {},
      resultTrace: null,
    };
  }

  const providerAdapter = resolveProviderAdapter({
    normalized,
    target,
    getProviderAdapter,
  });

  if (providerAdapter?.status === "unsupported") {
    return buildUnsupportedProviderDispatchResult({
      normalized,
      toolCall,
      providerAdapter,
    });
  }

  const reservation = await reserveExecution({
    db,
    tenantId: scope.tenantId,
    tenantKey: scope.tenantKey,
    voiceCallId: call.id || call.callId,
    providerRealtimeCallId: normalized.providerRealtimeCallId,
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    args: obj(toolCall.arguments),
    source: "sideband_tool_dispatcher",
  });

  if (reservation?.ok === false) {
    return {
      ok: false,
      dispatched: false,
      status: "idempotency_unavailable",
      reasonCode: s(reservation.reasonCode || "voice_realtime_tool_idempotency_unavailable"),
      normalized,
      toolCall,
      reservation,
      outboundEvents: [],
      callPatch: {},
      resultTrace: null,
    };
  }

  if (reservation?.acquired === false) {
    const result = buildDuplicateToolResult({
      reservation,
      toolCall,
    });
    const idempotency = buildToolExecutionIdempotencyPayload(reservation);
    const builtOutbound = buildProviderToolOutputEvents({
      adapter: providerAdapter,
      toolCall,
      result,
      includeResponseCreate: false,
    });

    if (builtOutbound.ok === false) {
      return buildUnsupportedProviderDispatchResult({
        normalized,
        toolCall,
        providerAdapter: builtOutbound,
      });
    }

    const outboundEvents = builtOutbound.outboundEvents;
    const resultTrace = buildRealtimeSidebandToolResultTrace({
      normalized,
      toolCall,
      result,
      idempotency,
    });

    return {
      ok: true,
      dispatched: false,
      status: "duplicate_skipped",
      reasonCode: s(reservation.reasonCode || "voice_realtime_tool_execution_duplicate"),
      normalized,
      toolCall,
      result,
      reservation,
      callPatch: {},
      outboundEvents,
      resultTrace,
    };
  }

  let result = null;
  try {
    result = await executeAction({
      name: toolCall.name,
      args: obj(toolCall.arguments),
      call,
      scope,
      runtimeConfig,
    });
  } catch (err) {
    try {
      await markExecutionFailed({
        db,
        reservation,
        errorCode: s(err?.code || "voice_realtime_tool_execution_failed"),
        errorMessage: s(err?.message || err),
        providerResponse: {
          source: "sideband_tool_dispatcher",
          toolCallId: s(toolCall.id),
          toolName: s(toolCall.name),
        },
      });
    } catch {}
    throw err;
  }

  const finalityRecord = await markExecutionSent({
    db,
    reservation,
    providerMessageId: s(toolCall.id),
    providerResponse: {
      source: "sideband_tool_dispatcher",
      toolCallId: s(toolCall.id),
      toolName: s(toolCall.name),
      resultStatus: s(result?.status),
    },
  });

  const callPatch = buildVoiceActionCallPatch({
    result,
    call,
  });

  const builtOutbound = buildProviderToolOutputEvents({
    adapter: providerAdapter,
    toolCall,
    result,
  });

  if (builtOutbound.ok === false) {
    return buildUnsupportedProviderDispatchResult({
      normalized,
      toolCall,
      providerAdapter: builtOutbound,
    });
  }

  const outboundEvents = builtOutbound.outboundEvents;

  const resultTrace = buildRealtimeSidebandToolResultTrace({
    normalized,
    toolCall,
    result,
    idempotency: buildToolExecutionIdempotencyPayload(reservation, finalityRecord),
  });

  return {
    ok: true,
    dispatched: true,
    status: "dispatched",
    reasonCode: "",
    normalized,
    toolCall,
    result,
    callPatch,
    outboundEvents,
    resultTrace,
  };
}
