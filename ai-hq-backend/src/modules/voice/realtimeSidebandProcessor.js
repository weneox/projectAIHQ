import {
  normalizeRealtimeSidebandEvent,
} from "./realtimeSidebandEvents.js";
import {
  dispatchRealtimeSidebandToolCall,
} from "./realtimeSidebandToolDispatcher.js";
import {
  persistRealtimeSidebandTrace,
} from "./realtimeSidebandPersistence.js";

export const VOICE_REALTIME_SIDEBAND_PROCESSOR_VERSION =
  "voice-realtime-sideband-processor-v1";

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function errorMessage(err) {
  return String(err?.message || err || "sideband processor failed").trim();
}

function skippedResult(reasonCode = "sideband_event_invalid") {
  return {
    ok: false,
    skipped: true,
    processorVersion: VOICE_REALTIME_SIDEBAND_PROCESSOR_VERSION,
    normalized: null,
    dispatched: false,
    dispatchResult: null,
    outboundEvents: [],
    persisted: null,
    reasonCode,
  };
}

function failedDispatchResult({ normalized = null, dispatchResult = null, err = null } = {}) {
  const reasonCode =
    dispatchResult?.reasonCode ||
    dispatchResult?.status ||
    "sideband_tool_dispatch_failed";

  return {
    ok: false,
    skipped: false,
    processorVersion: VOICE_REALTIME_SIDEBAND_PROCESSOR_VERSION,
    normalized,
    dispatched: dispatchResult?.dispatched === true,
    dispatchResult: dispatchResult || {
      ok: false,
      dispatched: false,
      reasonCode,
      error: errorMessage(err),
    },
    outboundEvents: arr(dispatchResult?.outboundEvents),
    persisted: null,
    reasonCode,
    ...(err ? { error: errorMessage(err) } : {}),
  };
}

export async function processRealtimeSidebandEvent({
  db,
  event = null,
  target = {},
  call = {},
  scope = {},
  runtimeConfig = {},
  sinkRegistry = null,
  dispatchSinks = undefined,
  buildSinkDeliverySnapshot = undefined,
  recordBusinessAction = undefined,
  applyInboxSinkDeliveryToCallPatch = undefined,
  normalizeEvent = normalizeRealtimeSidebandEvent,
  dispatchToolCall = dispatchRealtimeSidebandToolCall,
  persistTrace = persistRealtimeSidebandTrace,
} = {}) {
  if (!event) {
    return skippedResult("sideband_event_missing");
  }

  if (!isPlainObject(event)) {
    return skippedResult("sideband_event_invalid");
  }

  let normalized = null;
  try {
    normalized = normalizeEvent(event, { target });
  } catch (err) {
    return {
      ...skippedResult("sideband_event_normalize_failed"),
      error: errorMessage(err),
    };
  }

  if (!isPlainObject(normalized)) {
    return skippedResult("sideband_event_normalize_empty");
  }

  if (!normalized.toolCall) {
    const persisted = await persistTrace({
      db,
      call,
      scope,
      normalized,
    });

    return {
      ok: true,
      skipped: false,
      processorVersion: VOICE_REALTIME_SIDEBAND_PROCESSOR_VERSION,
      normalized,
      dispatched: false,
      dispatchResult: null,
      outboundEvents: [],
      persisted,
      reasonCode: "",
    };
  }

  let dispatchResult = null;
  try {
    dispatchResult = await dispatchToolCall({
      db,
      event,
      target,
      call,
      scope,
      runtimeConfig,
      normalized,
      sinkRegistry,
      dispatchSinks,
      buildSinkDeliverySnapshot,
      recordBusinessAction,
      applyInboxSinkDeliveryToCallPatch,
    });
  } catch (err) {
    return failedDispatchResult({ normalized, err });
  }

  if (dispatchResult?.ok === false) {
    return failedDispatchResult({ normalized, dispatchResult });
  }

  const outboundEvents = arr(dispatchResult?.outboundEvents);
  const persisted = await persistTrace({
    db,
    call,
    scope,
    normalized,
    resultTrace: dispatchResult?.resultTrace || null,
    callPatch: obj(dispatchResult?.callPatch),
  });

  return {
    ok: true,
    skipped: false,
    processorVersion: VOICE_REALTIME_SIDEBAND_PROCESSOR_VERSION,
    normalized,
    dispatched: dispatchResult?.dispatched === true,
    dispatchResult,
    outboundEvents,
    persisted,
    reasonCode: dispatchResult?.reasonCode || "",
  };
}
