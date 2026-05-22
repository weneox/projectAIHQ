import {
  VOICE_LEGACY_ACTION_OPERATION_MAP,
  VOICE_OPERATION_TYPES,
  VOICE_REQUEST_TYPES,
  normalizeVoiceBusinessFamily,
  normalizeVoiceOperationType,
  normalizeVoiceRequestType,
} from "./voiceOperationTaxonomy.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cleanPayload(value = {}) {
  return Object.fromEntries(
    Object.entries(obj(value)).filter(([, item]) => item !== undefined && item !== null && item !== "")
  );
}

function looksLikePhone(value = "") {
  const raw = s(value);
  const lowered = raw.toLowerCase();
  if (!raw) return false;
  if (["browser", "browser_lab", "browserlab", "test", "unknown", "anonymous"].includes(lowered)) {
    return false;
  }
  if (lowered.includes("browser")) return false;
  const digits = raw.replace(/\D+/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function firstUsablePhone(...values) {
  for (const value of values) {
    const phone = s(value);
    if (looksLikePhone(phone)) return phone;
  }
  return "";
}

function readAction(result = {}) {
  return s(result.action || result.name);
}

function requestTypeForAction(action = "", result = {}) {
  if (action === "create_business_request") {
    return normalizeVoiceRequestType(result.universal?.requestType || result.payload?.requestType);
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
    payload.description ||
      payload.summary ||
      payload.intent ||
      payload.issue ||
      payload.service ||
      payload.product ||
      payload.category
  );
  return [requestType, subject].filter(Boolean).join(" - ").slice(0, 180);
}

function readDescription(payload = {}, result = {}) {
  return s(
    payload.description ||
      payload.summary ||
      payload.intent ||
      payload.issue ||
      payload.service ||
      payload.product ||
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
  const collectedSlots = obj(result.universal?.collectedSlots);
  const slots = Object.keys(collectedSlots).length ? collectedSlots : payload;
  const requestType = requestTypeForAction(action, result);
  const operationType = operationTypeForAction(action, result);
  const businessFamily = normalizeVoiceBusinessFamily(
    result.universal?.businessFamily || call.businessFamily || call.business_family
  );
  const customerPhone = firstUsablePhone(
    payload.phone,
    payload.customerPhone,
    payload.customer_phone,
    call.fromNumber,
    call.from,
    call.phone,
    call.customerNumber
  );
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
    priority: s(payload.urgency).toLowerCase() === "urgent" ? "urgent" : "normal",
    title: titleForRequest({ requestType, payload }),
    description: readDescription(payload, result),
    customerName: s(payload.customerName || payload.customer_name || payload.name),
    customerPhone,
    customerEmail: s(payload.email || payload.customerEmail || payload.customer_email),
    companyName: s(payload.companyName || payload.company_name),
    requestedDate: s(payload.date || payload.requestedDate || payload.startDate),
    requestedTime: s(payload.time || payload.requestedTime),
    location: s(payload.location || payload.deliveryArea),
    address: s(payload.address),
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
