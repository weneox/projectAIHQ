export const VOICE_OPERATION_TYPES = Object.freeze({
  ANSWER_QUESTION: "answer_question",
  QUALIFY_REQUEST: "qualify_request",
  CHECK_AVAILABILITY: "check_availability",
  CREATE_REQUEST: "create_request",
  CREATE_LIVE_TRANSACTION: "create_live_transaction",
  CHECK_STATUS: "check_status",
  MODIFY_OR_CANCEL: "modify_or_cancel",
  HANDOFF: "handoff",
  END_CALL: "end_call",
});

export const VOICE_BUSINESS_FAMILIES = Object.freeze({
  GENERIC_BUSINESS: "generic_business",
  HOSPITALITY: "hospitality",
  RESTAURANT: "restaurant",
  HOTEL: "hotel",
  CLINIC: "clinic",
  DENTAL: "dental",
  SALON: "salon",
  AUTO_SERVICE: "auto_service",
  REPAIR_SERVICE: "repair_service",
  EDUCATION: "education",
  FITNESS: "fitness",
  REAL_ESTATE: "real_estate",
  LEGAL: "legal",
  ACCOUNTING: "accounting",
  LOGISTICS: "logistics",
  ECOMMERCE: "ecommerce",
  RETAIL: "retail",
  RENTAL: "rental",
  EVENT_VENUE: "event_venue",
  AGENCY: "agency",
  B2B_SERVICE: "b2b_service",
  NONPROFIT: "nonprofit",
  GOVERNMENT_SERVICE: "government_service",
  OTHER: "other",
});

export const VOICE_REQUEST_TYPES = Object.freeze({
  BOOKING_REQUEST: "booking_request",
  RESERVATION_REQUEST: "reservation_request",
  APPOINTMENT_REQUEST: "appointment_request",
  ORDER_REQUEST: "order_request",
  QUOTE_REQUEST: "quote_request",
  CONSULTATION_REQUEST: "consultation_request",
  REPAIR_REQUEST: "repair_request",
  SERVICE_REQUEST: "service_request",
  SUPPORT_TICKET: "support_ticket",
  CALLBACK_REQUEST: "callback_request",
  COMPLAINT: "complaint",
  STATUS_LOOKUP: "status_lookup",
  CANCELLATION_REQUEST: "cancellation_request",
  MODIFICATION_REQUEST: "modification_request",
  RENTAL_REQUEST: "rental_request",
  DELIVERY_REQUEST: "delivery_request",
  LEAD_INTAKE: "lead_intake",
  CUSTOM_REQUEST: "custom_request",
});

const OPERATION_VALUES = new Set(Object.values(VOICE_OPERATION_TYPES));
const BUSINESS_FAMILY_VALUES = new Set(Object.values(VOICE_BUSINESS_FAMILIES));
const REQUEST_TYPE_VALUES = new Set(Object.values(VOICE_REQUEST_TYPES));

const ACTION_OUTCOMES = new Set([
  "unknown",
  "lead_captured",
  "handoff_completed",
  "callback_requested",
  "faq_resolved",
  "missed",
  "spam",
  "failed",
]);

export const VOICE_LEGACY_ACTION_OPERATION_MAP = Object.freeze({
  check_availability: Object.freeze({
    operationType: VOICE_OPERATION_TYPES.CHECK_AVAILABILITY,
  }),
  create_reservation_request: Object.freeze({
    operationType: VOICE_OPERATION_TYPES.CREATE_REQUEST,
    requestType: VOICE_REQUEST_TYPES.RESERVATION_REQUEST,
  }),
  create_order_request: Object.freeze({
    operationType: VOICE_OPERATION_TYPES.CREATE_REQUEST,
    requestType: VOICE_REQUEST_TYPES.ORDER_REQUEST,
  }),
  create_appointment_request: Object.freeze({
    operationType: VOICE_OPERATION_TYPES.CREATE_REQUEST,
    requestType: VOICE_REQUEST_TYPES.APPOINTMENT_REQUEST,
  }),
  create_handoff_request: Object.freeze({
    operationType: VOICE_OPERATION_TYPES.HANDOFF,
    requestType: VOICE_REQUEST_TYPES.CALLBACK_REQUEST,
  }),
  end_call: Object.freeze({
    operationType: VOICE_OPERATION_TYPES.END_CALL,
  }),
});

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function snake(value = "") {
  return s(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeVoiceBusinessFamily(value) {
  const raw = snake(value);
  if (raw === "generic") return VOICE_BUSINESS_FAMILIES.GENERIC_BUSINESS;
  if (raw === "dentist" || raw === "dental_clinic") return VOICE_BUSINESS_FAMILIES.DENTAL;
  if (raw === "car_service") return VOICE_BUSINESS_FAMILIES.AUTO_SERVICE;
  if (raw === "ngo") return VOICE_BUSINESS_FAMILIES.NONPROFIT;
  return BUSINESS_FAMILY_VALUES.has(raw) ? raw : VOICE_BUSINESS_FAMILIES.GENERIC_BUSINESS;
}

export function normalizeVoiceOperationType(value) {
  const raw = snake(value);
  if (raw === "create_business_request") return VOICE_OPERATION_TYPES.CREATE_REQUEST;
  if (raw === "create_handoff_request") return VOICE_OPERATION_TYPES.HANDOFF;
  return OPERATION_VALUES.has(raw) ? raw : VOICE_OPERATION_TYPES.QUALIFY_REQUEST;
}

export function normalizeVoiceRequestType(value) {
  const raw = snake(value);
  if (raw === "reservation") return VOICE_REQUEST_TYPES.RESERVATION_REQUEST;
  if (raw === "appointment") return VOICE_REQUEST_TYPES.APPOINTMENT_REQUEST;
  if (raw === "order") return VOICE_REQUEST_TYPES.ORDER_REQUEST;
  if (raw === "quote") return VOICE_REQUEST_TYPES.QUOTE_REQUEST;
  if (raw === "callback") return VOICE_REQUEST_TYPES.CALLBACK_REQUEST;
  return REQUEST_TYPE_VALUES.has(raw) ? raw : VOICE_REQUEST_TYPES.CUSTOM_REQUEST;
}

export function normalizeVoiceActionOutcome(value) {
  const raw = snake(value);
  return ACTION_OUTCOMES.has(raw) ? raw : "unknown";
}
