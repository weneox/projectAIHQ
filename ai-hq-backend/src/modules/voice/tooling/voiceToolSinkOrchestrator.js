import {
  buildVoiceActionCallPatch,
  applyVoiceInboxSinkDeliveryToCallPatch,
} from "../actions/voiceActionRuntime.js";
import { shouldRecordBusinessActionVoiceEvent } from "../events/businessActionEvents.js";
import {
  buildBusinessActionSinkDeliverySnapshot,
  createBusinessActionSinkRegistry,
  dispatchBusinessActionSinks,
} from "../sinks/businessActionSinkRegistry.js";
import { s } from "../shared.js";

const obj = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

export function readVoiceToolReservationProviderResponse(reservation = {}) {
  const record = obj(reservation.record);
  const value =
    record.providerResponse ||
    record.provider_response ||
    reservation.providerResponse ||
    reservation.provider_response;

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      return obj(JSON.parse(value));
    } catch {
      return {};
    }
  }

  return {};
}

export function buildVoiceToolSinkRuntimeConfig(runtimeConfig = {}) {
  const baseConfig = obj(runtimeConfig);
  const businessActionSinks = obj(baseConfig.businessActionSinks);
  const inboxConfig = obj(businessActionSinks.inbox);
  return {
    ...baseConfig,
    businessActionSinks: {
      ...businessActionSinks,
      inbox: {
        ...inboxConfig,
        enabled: inboxConfig.enabled !== false,
      },
    },
  };
}

export function findVoiceToolInboxSinkDelivery(deliveries = []) {
  return Array.isArray(deliveries)
    ? deliveries.find((delivery) => delivery?.sink === "inbox") || null
    : null;
}

export function buildVoiceToolCallPatchWithSinkDelivery({
  result = {},
  call = {},
  sinkDelivery = null,
  inboxSinkDelivery = null,
  buildCallPatch = buildVoiceActionCallPatch,
  applyInboxSinkDeliveryToCallPatch = applyVoiceInboxSinkDeliveryToCallPatch,
} = {}) {
  let callPatch = buildCallPatch({ result, call });
  callPatch = applyInboxSinkDeliveryToCallPatch({
    callPatch,
    sinkDelivery,
    inboxSinkDelivery,
  });
  return callPatch;
}

export async function dispatchVoiceToolBusinessActionSinks({
  result = {},
  runtimeConfig = {},
  sinkRegistry = null,
  createSinkRegistry = createBusinessActionSinkRegistry,
  dispatchSinks = dispatchBusinessActionSinks,
  buildSinkDeliverySnapshot = buildBusinessActionSinkDeliverySnapshot,
  recordBusinessAction = shouldRecordBusinessActionVoiceEvent,
  skipRecordBusinessActionCheck = false,
} = {}) {
  const sinkRuntimeConfig = buildVoiceToolSinkRuntimeConfig(runtimeConfig);
  if (skipRecordBusinessActionCheck !== true && !recordBusinessAction(result)) {
    return {
      attempted: false,
      ok: true,
      reasonCode: "business_action_result_not_recordable",
      sinkRuntimeConfig,
      sinkDispatch: null,
      sinkDelivery: null,
      inboxSinkDelivery: null,
    };
  }

  const registry =
    sinkRegistry ||
    (typeof createSinkRegistry === "function" ? createSinkRegistry() : null);
  const sinkDispatch = await dispatchSinks({
    requestRecord: result.requestRecord,
    result,
    runtimeConfig: sinkRuntimeConfig,
    registry,
  });
  const sinkDelivery = buildSinkDeliverySnapshot({
    deliveries: sinkDispatch?.deliveries,
  });
  const inboxSinkDelivery = findVoiceToolInboxSinkDelivery(
    sinkDispatch?.deliveries,
  );

  return {
    attempted: true,
    ok: true,
    reasonCode: "",
    sinkRuntimeConfig,
    sinkDispatch,
    sinkDelivery,
    inboxSinkDelivery,
  };
}

export async function redriveStoredVoiceToolBusinessActionResult({
  storedProviderResponse = {},
  runtimeConfig = {},
  call = {},
  sinkRegistry = null,
  createSinkRegistry = createBusinessActionSinkRegistry,
  dispatchSinks = dispatchBusinessActionSinks,
  buildSinkDeliverySnapshot = buildBusinessActionSinkDeliverySnapshot,
  recordBusinessAction = shouldRecordBusinessActionVoiceEvent,
  applyInboxSinkDeliveryToCallPatch = applyVoiceInboxSinkDeliveryToCallPatch,
} = {}) {
  const storedResponse = obj(storedProviderResponse);
  const storedResult = obj(storedResponse.result);
  const sinkRuntimeConfig = buildVoiceToolSinkRuntimeConfig(
    storedResponse.sinkRuntimeConfig ||
      storedResponse.runtimeConfig ||
      runtimeConfig,
  );

  if (!recordBusinessAction(storedResult)) {
    return {
      attempted: false,
      ok: true,
      reasonCode: "stored_business_action_result_not_recordable",
      result: storedResult,
      callPatch: {},
      sinkRuntimeConfig,
      sinkDispatch: null,
      sinkDelivery: null,
      inboxSinkDelivery: null,
    };
  }

  const sinkResult = await dispatchVoiceToolBusinessActionSinks({
    result: storedResult,
    runtimeConfig: sinkRuntimeConfig,
    sinkRegistry,
    createSinkRegistry,
    dispatchSinks,
    buildSinkDeliverySnapshot,
    recordBusinessAction,
    skipRecordBusinessActionCheck: true,
  });
  const callPatch = buildVoiceToolCallPatchWithSinkDelivery({
    result: storedResult,
    call,
    sinkDelivery: sinkResult.sinkDelivery,
    inboxSinkDelivery: sinkResult.inboxSinkDelivery,
    applyInboxSinkDeliveryToCallPatch,
  });

  return {
    attempted: true,
    ok: true,
    reasonCode: "",
    result: storedResult,
    callPatch,
    sinkRuntimeConfig: sinkResult.sinkRuntimeConfig,
    sinkDispatch: sinkResult.sinkDispatch,
    sinkDelivery: sinkResult.sinkDelivery,
    inboxSinkDelivery: sinkResult.inboxSinkDelivery,
  };
}

export async function redriveBrowserVoiceBusinessActionSink({
  db,
  wsHub = null,
  call = {},
  scope = {},
  voiceCallId = "",
  storedProviderResponse = {},
  idempotency = {},
  fallbackToolCallId = "",
  fallbackToolName = "",
  fallbackProviderRealtimeCallId = "",
  createInboxSinkExecutor,
  createSinkRegistry = createBusinessActionSinkRegistry,
  updateVoiceCallForTenant,
  appendVoiceCallEvent,
  buildBrowserVoiceEventInput,
  buildBusinessActionRecordedVoiceEventPayload,
} = {}) {
  const redrive = await redriveStoredVoiceToolBusinessActionResult({
    storedProviderResponse,
    call,
    createSinkRegistry: () =>
      createSinkRegistry({
        inbox: createInboxSinkExecutor({ db, wsHub }),
      }),
  });
  const storedResult = redrive.result || obj(storedProviderResponse.result);

  if (redrive.attempted !== true) {
    return {
      attempted: false,
      ok: true,
      reasonCode: s(
        redrive.reasonCode || "stored_business_action_result_not_recordable"
      ),
    };
  }

  if (Object.keys(redrive.callPatch || {}).length > 0) {
    await updateVoiceCallForTenant(db, {
      id: voiceCallId,
      tenantId: scope.tenantId,
      patch: redrive.callPatch,
    });
  }

  await appendVoiceCallEvent(db, buildBrowserVoiceEventInput({
    callId: voiceCallId,
    scope,
    eventType: "business_request_recorded",
    actor: "voice_action_executor",
    payload: buildBusinessActionRecordedVoiceEventPayload({
      result: storedResult,
      toolCallId: s(storedProviderResponse.toolCallId || fallbackToolCallId),
      toolName: s(storedProviderResponse.toolName || fallbackToolName),
      providerRealtimeCallId: s(
        storedProviderResponse.providerRealtimeCallId ||
          fallbackProviderRealtimeCallId
      ),
      runtimeConfig: redrive.sinkRuntimeConfig,
      idempotency,
      source: "browser_voice_tool_route_duplicate_redrive",
      sinkDispatch: redrive.sinkDispatch,
      sinkDelivery: redrive.sinkDelivery,
    }),
  }));

  return {
    attempted: true,
    ok: true,
    reasonCode: "",
    sinkDelivery: redrive.sinkDelivery,
    sinkDispatch: {
      ok: redrive.sinkDispatch?.ok !== false,
      requestId: s(redrive.sinkDispatch?.requestId),
    },
    inboxThreadId: s(
      redrive.inboxSinkDelivery?.inboxThreadId ||
        redrive.inboxSinkDelivery?.inbox_thread_id
    ),
  };
}
