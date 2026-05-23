import {
  cleanVoiceSlotPayload,
  readVoicePhoneFromSources,
  readVoiceSlotValue,
} from "../slots/voiceSlotContracts.js";
import {
  VOICE_LEGACY_ACTION_OPERATION_MAP,
  VOICE_OPERATION_TYPES,
  VOICE_REQUEST_TYPES,
  normalizeVoiceBusinessFamily,
  normalizeVoiceOperationType,
  normalizeVoiceRequestType,
} from "./voiceOperationTaxonomy.js";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cleanPayload(value = {}) {
  return cleanVoiceSlotPayload(value);
}

function readAction(result = {}) {
  return s(result.action || result.name);
}

function requestTypeForAction(action = "", result = {}) {
  if (action === "create_business_request") {
    return normalizeVoiceRequestType(
      result.universal?.requestType ||
        result.payload?.requestType ||
        result.payload?.request_type
    );
  }

  return (
    VOICE_LEGACY_ACTION_OPERATION_MAP[action]?.requestType ||
    VOICE_REQUEST_TYPES.CUSTOM_REQUEST
  );
}

function operationTypeForAction(action = "", result = {}) {
  if (action === "create_business_request") {
    return normalizeVoiceOperationType(
      result.universal?.operationType || VOICE_OPERATION_TYPES.CREATE_REQUEST
    );
  }

  return (
    VOICE_LEGACY_ACTION_OPERATION_MAP[action]?.operationType ||
    VOICE_OPERATION_TYPES.CREATE_REQUEST
  );
}

function titleForRequest({ requestType = "", payload = {} } = {}) {
  const subject = s(
    readVoiceSlotValue(payload, "description") ||
      readVoiceSlotValue(payload, "summary") ||
      readVoiceSlotValue(payload, "intent") ||
      readVoiceSlotValue(payload, "issue") ||
      readVoiceSlotValue(payload, "service") ||
      readVoiceSlotValue(payload, "product") ||
      readVoiceSlotValue(payload, "category")
  );

  return [requestType, subject].filter(Boolean).join(" - ").slice(0, 180);
}

function readDescription(payload = {}, result = {}) {
  return s(
    readVoiceSlotValue(payload, "description") ||
      readVoiceSlotValue(payload, "summary") ||
      readVoiceSlotValue(payload, "intent") ||
      readVoiceSlotValue(payload, "issue") ||
      readVoiceSlotValue(payload, "service") ||
      readVoiceSlotValue(payload, "product") ||
      result.message
  );
}

function isRequestRecorded(result = {}) {
  return s(result.status) === "request_recorded";
}

export function shouldCreateOperationRequestFromVoiceResult(result = {}) {
  const action = readAction(result);

  return (
    isRequestRecorded(result) &&
    [
      "create_business_request",
      "create_reservation_request",
      "create_order_request",
      "create_appointment_request",
      "create_handoff_request",
    ].includes(action) &&
    result.duplicate !== true
  );
}

export function buildOperationRequestFromVoiceResult({
  result = {},
  call = {},
  scope = {},
  normalized = {},
  toolCall = {},
} = {}) {
  if (!shouldCreateOperationRequestFromVoiceResult(result)) return null;

  const action = readAction(result);
  const payload = cleanPayload(result.payload || result.criteria || {});
  const collectedSlots = cleanPayload(result.universal?.collectedSlots || {});
  const slots = Object.keys(collectedSlots).length ? collectedSlots : payload;

  const requestType = requestTypeForAction(action, result);
  const operationType = operationTypeForAction(action, result);

  const businessFamily = normalizeVoiceBusinessFamily(
    result.universal?.businessFamily ||
      call.businessFamily ||
      call.business_family
  );

  const customerPhone = readVoicePhoneFromSources({
    payload: {
      ...slots,
      ...payload,
    },
    call,
  });

  const toolCallId = s(toolCall.id || toolCall.call_id || toolCall.callId);

  return {
    tenantId: s(scope.tenantId || result.tenantId),
    tenantKey: s(scope.tenantKey || result.tenantKey),
    sourceChannel: "voice",
    sourceCallId: s(call.id || call.callId || call.call_id || result.callId),
    sourceToolCallId: toolCallId,
    operationType,
    requestType,
    businessFamily,
    status: "new",
    priority: s(readVoiceSlotValue(payload, "urgency")).toLowerCase() === "urgent"
      ? "urgent"
      : "normal",
    title: titleForRequest({ requestType, payload: slots }),
    description: readDescription(slots, result),
    customerName: s(readVoiceSlotValue(slots, "customerName")),
    customerPhone,
    customerEmail: s(readVoiceSlotValue(slots, "email")),
    companyName: s(readVoiceSlotValue(slots, "companyName")),
    requestedDate: s(
      readVoiceSlotValue(slots, "date") ||
        payload.requestedDate ||
        readVoiceSlotValue(slots, "startDate")
    ),
    requestedTime: s(
      readVoiceSlotValue(slots, "time") ||
        payload.requestedTime
    ),
    location: s(
      readVoiceSlotValue(slots, "location") ||
        readVoiceSlotValue(slots, "deliveryArea")
    ),
    address: s(readVoiceSlotValue(slots, "address")),
    slots,
    extraction: {
      voiceActionResult: result,
      voiceOutcome: obj(result.extraction?.voiceOutcome),
    },
    meta: {
      source: "voice_action_runtime",
      voiceCallId: s(call.id || call.callId || call.call_id || result.callId),
      tenantKey: s(scope.tenantKey || result.tenantKey),
      toolCallId,
      providerRealtimeCallId: s(
        normalized.providerRealtimeCallId ||
          normalized.payload?.providerRealtimeCallId ||
          result.providerRealtimeCallId
      ),
      action,
      requestId: s(result.requestId),
      confirmed: result.confirmed === true,
      requestOnly: result.requestOnly === true,
    },
  };
}
