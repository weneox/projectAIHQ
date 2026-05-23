import {
  VOICE_BUSINESS_FAMILIES,
  VOICE_OPERATION_TYPES,
  VOICE_REQUEST_TYPES,
  normalizeVoiceBusinessFamily,
  normalizeVoiceOperationType,
  normalizeVoiceRequestType,
} from "./voiceOperationTaxonomy.js";
import {
  VOICE_SLOT_DEFINITIONS,
  buildVoiceMissingSlots,
  cleanVoiceSlotPayload,
  collectVoiceSlots,
  hasAnyVoiceSlot,
  readVoicePhoneFromSources,
} from "../slots/voiceSlotContracts.js";

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

function unique(values = []) {
  return [...new Set(arr(values).map((value) => s(value)).filter(Boolean))];
}

export const UNIVERSAL_VOICE_SLOTS = VOICE_SLOT_DEFINITIONS;

const DEFAULT_REQUIRED_BY_REQUEST_TYPE = Object.freeze({
  [VOICE_REQUEST_TYPES.BOOKING_REQUEST]: Object.freeze([
    "requestType",
    "description",
    "phone",
  ]),
  [VOICE_REQUEST_TYPES.RESERVATION_REQUEST]: Object.freeze([
    "requestType",
    "date",
    "time",
    "partySize",
    "phone",
  ]),
  [VOICE_REQUEST_TYPES.APPOINTMENT_REQUEST]: Object.freeze([
    "requestType",
    "service",
    "preferredDateOrTime",
    "phone",
  ]),
  [VOICE_REQUEST_TYPES.ORDER_REQUEST]: Object.freeze([
    "requestType",
    "description",
    "phone",
  ]),
  [VOICE_REQUEST_TYPES.QUOTE_REQUEST]: Object.freeze([
    "requestType",
    "description",
    "phone",
  ]),
  [VOICE_REQUEST_TYPES.CONSULTATION_REQUEST]: Object.freeze([
    "requestType",
    "service",
    "preferredDateOrTime",
    "phone",
  ]),
  [VOICE_REQUEST_TYPES.REPAIR_REQUEST]: Object.freeze([
    "requestType",
    "issue",
    "phone",
  ]),
  [VOICE_REQUEST_TYPES.SERVICE_REQUEST]: Object.freeze([
    "requestType",
    "service",
    "phone",
  ]),
  [VOICE_REQUEST_TYPES.SUPPORT_TICKET]: Object.freeze([
    "requestType",
    "description",
    "phone",
  ]),
  [VOICE_REQUEST_TYPES.CALLBACK_REQUEST]: Object.freeze([
    "requestType",
    "description",
    "phone",
  ]),
  [VOICE_REQUEST_TYPES.COMPLAINT]: Object.freeze([
    "requestType",
    "description",
    "phone",
  ]),
  [VOICE_REQUEST_TYPES.STATUS_LOOKUP]: Object.freeze([
    "requestType",
    "description",
    "phone",
  ]),
  [VOICE_REQUEST_TYPES.CANCELLATION_REQUEST]: Object.freeze([
    "requestType",
    "description",
    "phone",
  ]),
  [VOICE_REQUEST_TYPES.MODIFICATION_REQUEST]: Object.freeze([
    "requestType",
    "description",
    "phone",
  ]),
  [VOICE_REQUEST_TYPES.RENTAL_REQUEST]: Object.freeze([
    "requestType",
    "description",
    "preferredDateOrTime",
    "phone",
  ]),
  [VOICE_REQUEST_TYPES.DELIVERY_REQUEST]: Object.freeze([
    "requestType",
    "address",
    "description",
    "phone",
  ]),
  [VOICE_REQUEST_TYPES.LEAD_INTAKE]: Object.freeze([
    "requestType",
    "description",
    "phone",
  ]),
  [VOICE_REQUEST_TYPES.CUSTOM_REQUEST]: Object.freeze([
    "requestType",
    "description",
    "phone",
  ]),
});

function requiresPhone(requestType = "", operationType = "") {
  if (operationType === VOICE_OPERATION_TYPES.HANDOFF) return true;

  return [
    VOICE_REQUEST_TYPES.BOOKING_REQUEST,
    VOICE_REQUEST_TYPES.RESERVATION_REQUEST,
    VOICE_REQUEST_TYPES.APPOINTMENT_REQUEST,
    VOICE_REQUEST_TYPES.ORDER_REQUEST,
    VOICE_REQUEST_TYPES.QUOTE_REQUEST,
    VOICE_REQUEST_TYPES.CONSULTATION_REQUEST,
    VOICE_REQUEST_TYPES.REPAIR_REQUEST,
    VOICE_REQUEST_TYPES.SERVICE_REQUEST,
    VOICE_REQUEST_TYPES.SUPPORT_TICKET,
    VOICE_REQUEST_TYPES.CALLBACK_REQUEST,
    VOICE_REQUEST_TYPES.COMPLAINT,
    VOICE_REQUEST_TYPES.STATUS_LOOKUP,
    VOICE_REQUEST_TYPES.CANCELLATION_REQUEST,
    VOICE_REQUEST_TYPES.MODIFICATION_REQUEST,
    VOICE_REQUEST_TYPES.RENTAL_REQUEST,
    VOICE_REQUEST_TYPES.DELIVERY_REQUEST,
    VOICE_REQUEST_TYPES.LEAD_INTAKE,
    VOICE_REQUEST_TYPES.CUSTOM_REQUEST,
  ].includes(requestType);
}

function readBusinessFamily(runtimeConfig = {}) {
  return normalizeVoiceBusinessFamily(
    runtimeConfig.businessFamily ||
      runtimeConfig.businessType ||
      runtimeConfig.business_type ||
      runtimeConfig.actions?.businessFamily ||
      runtimeConfig.actions?.businessType ||
      runtimeConfig.actions?.business_type ||
      runtimeConfig.voiceActions?.businessFamily ||
      runtimeConfig.voiceActions?.businessType ||
      runtimeConfig.voiceActions?.business_type ||
      runtimeConfig.voiceProfile?.businessFamily ||
      runtimeConfig.voiceProfile?.businessType ||
      runtimeConfig.voiceProfile?.business_type
  );
}

function readCustomRequiredSlots({ runtimeConfig = {}, type = "" } = {}) {
  return arr(
    runtimeConfig.universalRequiredSlots?.[type] ||
      runtimeConfig.actions?.universalRequiredSlots?.[type] ||
      runtimeConfig.voiceActions?.universalRequiredSlots?.[type]
  );
}

function familyRequiredSlots({ family = "", type = "" } = {}) {
  if (
    family === VOICE_BUSINESS_FAMILIES.AUTO_SERVICE &&
    [VOICE_REQUEST_TYPES.REPAIR_REQUEST, VOICE_REQUEST_TYPES.SERVICE_REQUEST].includes(type)
  ) {
    return ["vehicleMake", "vehicleModel", "issue", "preferredDateOrTime"];
  }

  if (
    family === VOICE_BUSINESS_FAMILIES.REPAIR_SERVICE &&
    [VOICE_REQUEST_TYPES.REPAIR_REQUEST, VOICE_REQUEST_TYPES.SERVICE_REQUEST].includes(type)
  ) {
    return ["issue", "preferredDateOrTime"];
  }

  if (
    family === VOICE_BUSINESS_FAMILIES.HOTEL &&
    type === VOICE_REQUEST_TYPES.BOOKING_REQUEST
  ) {
    return ["startDate", "endDate", "guestCount"];
  }

  if (
    family === VOICE_BUSINESS_FAMILIES.RESTAURANT &&
    type === VOICE_REQUEST_TYPES.RESERVATION_REQUEST
  ) {
    return ["date", "time", "partySize"];
  }

  if (
    family === VOICE_BUSINESS_FAMILIES.RESTAURANT &&
    type === VOICE_REQUEST_TYPES.ORDER_REQUEST
  ) {
    return ["description", "phone"];
  }

  if (
    [VOICE_BUSINESS_FAMILIES.CLINIC, VOICE_BUSINESS_FAMILIES.DENTAL].includes(family) &&
    [VOICE_REQUEST_TYPES.APPOINTMENT_REQUEST, VOICE_REQUEST_TYPES.CONSULTATION_REQUEST].includes(type)
  ) {
    return ["service", "preferredDateOrTime"];
  }

  if (
    family === VOICE_BUSINESS_FAMILIES.SALON &&
    [VOICE_REQUEST_TYPES.APPOINTMENT_REQUEST, VOICE_REQUEST_TYPES.SERVICE_REQUEST].includes(type)
  ) {
    return ["service", "preferredDateOrTime"];
  }

  if (
    family === VOICE_BUSINESS_FAMILIES.DELIVERY_REQUEST &&
    type === VOICE_REQUEST_TYPES.DELIVERY_REQUEST
  ) {
    return ["address", "phone"];
  }

  return [];
}

export function getRequiredSlotsForUniversalRequest({
  operationType = VOICE_OPERATION_TYPES.CREATE_REQUEST,
  requestType = VOICE_REQUEST_TYPES.CUSTOM_REQUEST,
  businessFamily = "",
} = {}) {
  const operation = normalizeVoiceOperationType(operationType);
  const type = normalizeVoiceRequestType(requestType);
  const family = normalizeVoiceBusinessFamily(businessFamily);

  if (operation !== VOICE_OPERATION_TYPES.CREATE_REQUEST) {
    return ["issue", "phone"];
  }

  if (type === VOICE_REQUEST_TYPES.DELIVERY_REQUEST) {
    return ["address", "phone"];
  }

  if (type === VOICE_REQUEST_TYPES.APPOINTMENT_REQUEST) {
    return ["service", "preferredDateOrTime", "phone"];
  }

  if (type === VOICE_REQUEST_TYPES.RESERVATION_REQUEST) {
    return ["preferredDateOrTime", "phone"];
  }

  if (type === VOICE_REQUEST_TYPES.ORDER_REQUEST) {
    return ["issue", "phone"];
  }

  const genericRequestTypes = new Set([
    "repair_request",
    "quote_request",
    "rental_request",
    "support_ticket",
    "consultation_request",
    "custom_request",
  ]);

  if (genericRequestTypes.has(type)) {
    return ["issue", "phone"];
  }

  if (family === VOICE_BUSINESS_FAMILIES.CLINIC) {
    return ["issue", "phone"];
  }

  if (family === VOICE_BUSINESS_FAMILIES.RESTAURANT) {
    return ["issue", "phone"];
  }

  return ["issue", "phone"];
}

export function analyzeUniversalVoiceSlots({
  operationType = VOICE_OPERATION_TYPES.CREATE_REQUEST,
  requestType = "",
  businessFamily = "",
  payload = {},
  call = {},
  runtimeConfig = {},
} = {}) {
  const data = cleanVoiceSlotPayload(payload);
  const operation = normalizeVoiceOperationType(operationType);
  const type = normalizeVoiceRequestType(data.requestType || data.request_type || requestType);
  const family = normalizeVoiceBusinessFamily(businessFamily || readBusinessFamily(runtimeConfig));
  const phone = readVoicePhoneFromSources({ payload: data, call });

  const collectedSlots = collectVoiceSlots(data);
  if (phone) collectedSlots.phone = phone;

  const required = getRequiredSlotsForUniversalRequest({
    businessFamily: family,
    requestType: type,
    operationType: operation,
    runtimeConfig,
  });

  const missingRequired = buildVoiceMissingSlots({
    required,
    payload: data,
    phone,
  });

  const nextMissing = missingRequired[0] || null;

  return {
    ok: missingRequired.length === 0,
    complete: missingRequired.length === 0,
    operationType: operation,
    requestType: type,
    businessFamily: family,
    payload: data,
    collectedSlots,
    present: {
      hasDescriptionOrIntent: hasAnyVoiceSlot(data, ["description", "intent", "issue", "service", "product"]),
      hasPreferredDateOrTime: hasAnyVoiceSlot(data, ["date", "time", "startDate", "endDate"]),
      hasPhone: !!phone,
    },
    required,
    missingRequired,
    nextMissing,
    nextPromptHint: nextMissing?.promptHint || null,
  };
}
