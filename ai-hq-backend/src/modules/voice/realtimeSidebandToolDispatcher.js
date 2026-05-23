import {
  executeVoiceAction,
} from "./actions/voiceActionRuntime.js";
import {
  normalizeRealtimeSidebandEvent,
} from "./realtimeSidebandEvents.js";
import {
  buildRealtimeProviderToolOutputEvents,
  getRealtimeProviderAdapter,
} from "./realtimeProviderAdapters.js";
import {
  markVoiceRealtimeToolExecutionFailed,
  markVoiceRealtimeToolExecutionSent,
  reserveVoiceRealtimeToolExecution,
} from "./realtimeToolExecutionIdempotency.js";
import {
  buildVoiceToolCallPatchWithSinkDelivery,
  buildVoiceToolSinkRuntimeConfig,
  dispatchVoiceToolBusinessActionSinks,
  readVoiceToolReservationProviderResponse,
  redriveStoredVoiceToolBusinessActionResult,
} from "./tooling/voiceToolSinkOrchestrator.js";

export const VOICE_REALTIME_SIDEBAND_TOOL_DISPATCHER_VERSION =
  "voice-realtime-sideband-tool-dispatcher-v1";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
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
  providerAdapter = null,
  normalized = {},
  target = {},
  toolCall = {},
  result = {},
  includeResponseCreate = true,
} = {}) {
  if (typeof providerAdapter?.buildToolOutputEvents === "function") {
    const built = providerAdapter.buildToolOutputEvents({
      toolCall,
      result,
      includeResponseCreate,
    });

    if (Array.isArray(built)) {
      return {
        ok: true,
        provider: s(providerAdapter.provider || normalized.provider || target.provider),
        reasonCode: "",
        outboundEvents: built,
      };
    }

    return {
      ok: built?.ok !== false,
      provider: s(built?.provider || providerAdapter.provider || normalized.provider || target.provider),
      reasonCode: s(built?.reasonCode),
      outboundEvents: arr(built?.outboundEvents),
    };
  }

  const built = buildRealtimeProviderToolOutputEvents({
    provider: normalized.provider || target.provider || providerAdapter?.provider,
    target,
    toolCall,
    result,
    includeResponseCreate,
  });

  if (Array.isArray(built)) {
    return {
      ok: true,
      provider: s(providerAdapter?.provider || normalized.provider || target.provider),
      reasonCode: "",
      outboundEvents: built,
    };
  }

  return {
    ok: built?.ok !== false,
    provider: s(built?.provider || providerAdapter?.provider || normalized.provider || target.provider),
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
  const built = buildRealtimeProviderToolOutputEvents(input);
  if (Array.isArray(built)) return built;
  return arr(built?.outboundEvents);
}

export function buildRealtimeSidebandToolResultTrace({
  normalized = {},
  toolCall = {},
  result = {},
  idempotency = {},
  sinkDispatch = null,
  sinkDelivery = null,
  inboxSinkDelivery = null,
  duplicateRedrive = null,
} = {}) {
  const dispatch = obj(sinkDispatch);
  const deliveries = arr(dispatch.deliveries);

  return {
    eventType: "voice.sideband.tool_result",
    actor: "system",
    role: "system",
    text: s(result.message || result.status || toolCall.name),
    payload: {
      sidebandToolDispatcherVersion: VOICE_REALTIME_SIDEBAND_TOOL_DISPATCHER_VERSION,
      realtimeType: s(normalized.realtimeType),
      provider: s(normalized.provider),
      providerRealtimeCallId: s(normalized.providerRealtimeCallId),
      toolCallId: s(toolCall.id),
      toolName: s(toolCall.name),
      resultStatus: s(result.status),
      missingRequired: arr(result.missingRequired),
      nextMissing: obj(result.nextMissing),
      nextPromptHint: obj(result.nextPromptHint),
      voiceState: obj(result.voiceState),
      idempotency: obj(idempotency),
      idempotencyKey: s(idempotency.idempotencyKey),
      reservationAcquired: idempotency.acquired === true,
      reservationDuplicate: idempotency.duplicate === true,
      reservationState: s(idempotency.recordState),
      reservationReasonCode: s(idempotency.reasonCode),
      sinkDispatch: sinkDispatch
        ? {
            ok: dispatch.ok !== false,
            requestId: s(dispatch.requestId),
            deliveries,
          }
        : null,
      sinkDelivery: sinkDelivery ? obj(sinkDelivery) : null,
      inboxSinkDelivery: inboxSinkDelivery ? obj(inboxSinkDelivery) : null,
      duplicateRedrive: duplicateRedrive ? obj(duplicateRedrive) : null,
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
  sinkRegistry = null,
  createSinkRegistry = undefined,
  dispatchSinks = undefined,
  buildSinkDeliverySnapshot = undefined,
  recordBusinessAction = undefined,
  applyInboxSinkDeliveryToCallPatch = undefined,
} = {}) {
  const earlyProviderAdapter = resolveProviderAdapter({
    normalized: obj(preNormalized),
    target,
    getProviderAdapter,
  });

  if (earlyProviderAdapter?.status === "unsupported") {
    return buildUnsupportedProviderDispatchResult({
      normalized: {
        eventType: "voice.sideband.tool_call",
        provider: s(target.provider || earlyProviderAdapter.provider),
        providerRealtimeCallId: s(target.providerRealtimeCallId),
      },
      toolCall: {},
      providerAdapter: earlyProviderAdapter,
    });
  }

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
    let sinkDispatch = null;
    let sinkDelivery = null;
    let inboxSinkDelivery = null;
    let callPatch = {};
    let duplicateRedrive = {
      attempted: false,
      ok: true,
      reasonCode: "",
    };

    const builtOutbound = buildProviderToolOutputEvents({
      providerAdapter,
      normalized,
      target,
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

    try {
      const redrive = await redriveStoredVoiceToolBusinessActionResult({
        storedProviderResponse:
          readVoiceToolReservationProviderResponse(reservation),
        runtimeConfig,
        call,
        sinkRegistry,
        createSinkRegistry,
        dispatchSinks,
        buildSinkDeliverySnapshot,
        recordBusinessAction,
        applyInboxSinkDeliveryToCallPatch,
      });

      callPatch = obj(redrive.callPatch);
      sinkDispatch = redrive.sinkDispatch;
      sinkDelivery = redrive.sinkDelivery;
      inboxSinkDelivery = redrive.inboxSinkDelivery;
      duplicateRedrive = {
        attempted: redrive.attempted === true,
        ok: redrive.ok !== false,
        reasonCode: s(redrive.reasonCode),
      };
    } catch (err) {
      duplicateRedrive = {
        attempted: true,
        ok: false,
        reasonCode: "sideband_duplicate_redrive_failed",
        errorMessage: s(err?.message || err),
      };
    }

    const resultTrace = buildRealtimeSidebandToolResultTrace({
      normalized,
      toolCall,
      result,
      idempotency,
      sinkDispatch,
      sinkDelivery,
      inboxSinkDelivery,
      duplicateRedrive,
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
      sinkDispatch,
      sinkDelivery,
      inboxSinkDelivery,
      duplicateRedrive,
      callPatch,
      outboundEvents: builtOutbound.outboundEvents,
      resultTrace,
    };
  }

  let result = null;
  const sinkRuntimeConfig = buildVoiceToolSinkRuntimeConfig(runtimeConfig);

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
      providerRealtimeCallId: s(normalized.providerRealtimeCallId),
      resultStatus: s(result?.status),
      result,
      runtimeConfig,
      sinkRuntimeConfig,
    },
  });

  let callPatch = buildVoiceToolCallPatchWithSinkDelivery({
    result,
    call,
  });
  let sinkDispatch = null;
  let sinkDelivery = null;
  let inboxSinkDelivery = null;

  const sinkResult = await dispatchVoiceToolBusinessActionSinks({
    result,
    runtimeConfig: sinkRuntimeConfig,
    sinkRegistry,
    createSinkRegistry,
    dispatchSinks,
    buildSinkDeliverySnapshot,
    recordBusinessAction,
  });

  if (sinkResult.attempted === true) {
    sinkDispatch = sinkResult.sinkDispatch;
    sinkDelivery = sinkResult.sinkDelivery;
    inboxSinkDelivery = sinkResult.inboxSinkDelivery;

    callPatch = buildVoiceToolCallPatchWithSinkDelivery({
      result,
      call,
      sinkDelivery,
      inboxSinkDelivery,
      applyInboxSinkDeliveryToCallPatch,
    });
  }

  const builtOutbound = buildProviderToolOutputEvents({
    providerAdapter,
    normalized,
    target,
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

  const resultTrace = buildRealtimeSidebandToolResultTrace({
    normalized,
    toolCall,
    result,
    idempotency: buildToolExecutionIdempotencyPayload(reservation, finalityRecord),
    sinkDispatch,
    sinkDelivery,
    inboxSinkDelivery,
  });

  return {
    ok: true,
    dispatched: true,
    status: "dispatched",
    reasonCode: "",
    normalized,
    toolCall,
    result,
    sinkDispatch,
    sinkDelivery,
    inboxSinkDelivery,
    callPatch,
    outboundEvents: builtOutbound.outboundEvents,
    resultTrace,
  };
}
