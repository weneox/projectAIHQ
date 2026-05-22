import {
  VOICE_BUSINESS_FAMILIES,
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

function normalizeLanguage(value = "") {
  const raw = s(value).toLowerCase().replace("_", "-");
  if (raw.startsWith("az")) return "az";
  if (raw.startsWith("ru")) return "ru";
  if (raw.startsWith("en")) return "en";
  return "en";
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

const QUESTIONS = Object.freeze({
  intent: {
    en: "What would you like help with?",
    az: "Sizə nə ilə kömək edə bilərəm?",
    ru: "С чем вам помочь?",
  },
  requestType: {
    en: "What type of request should I record?",
    az: "Hansı növ müraciəti qeyd edim?",
    ru: "Какой тип заявки записать?",
  },
  description: {
    en: "Could you briefly describe what you need?",
    az: "Nəyə ehtiyacınız olduğunu qısaca deyə bilərsiniz?",
    ru: "Можете кратко описать, что вам нужно?",
  },
  phone: {
    en: "May I take your phone number for follow-up?",
    az: "Əlaqə üçün telefon nömrənizi qeyd edə bilərəm?",
    ru: "Можно ваш номер телефона для обратной связи?",
  },
  service: {
    en: "Which service do you need?",
    az: "Hansı xidmət lazımdır?",
    ru: "Какая услуга вам нужна?",
  },
  date: {
    en: "Which date would you prefer?",
    az: "Hansı tarixi istəyirsiniz?",
    ru: "Какая дата вам удобна?",
  },
  time: {
    en: "What time would you prefer?",
    az: "Saat neçəyə istəyirsiniz?",
    ru: "Какое время вам удобно?",
  },
  customerName: {
    en: "What name should I note?",
    az: "Adınızı necə qeyd edim?",
    ru: "Как вас записать?",
  },
});

function q(key = "", label = "") {
  const base = QUESTIONS[key] || QUESTIONS.description;
  return {
    en: base.en || `Could you share ${label || key}?`,
    az: base.az || `${label || key} barədə məlumat verə bilərsiniz?`,
    ru: base.ru || `Можете сообщить ${label || key}?`,
  };
}

export const UNIVERSAL_VOICE_SLOTS = Object.freeze({
  intent: { key: "intent", label: "intent", aliases: ["need", "goal"], pii: false, questions: q("intent") },
  requestType: { key: "requestType", label: "request type", aliases: ["type"], pii: false, questions: q("requestType") },
  service: { key: "service", label: "service", aliases: ["serviceType"], pii: false, questions: q("service") },
  product: { key: "product", label: "product", aliases: ["item"], pii: false, questions: q("product", "product") },
  category: { key: "category", label: "category", aliases: ["kind"], pii: false, questions: q("category", "category") },
  issue: { key: "issue", label: "issue", aliases: ["problem"], pii: false, questions: q("issue", "issue") },
  description: { key: "description", label: "description", aliases: ["summary", "details"], pii: false, questions: q("description") },
  date: { key: "date", label: "date", aliases: ["preferredDate"], pii: false, questions: q("date") },
  time: { key: "time", label: "time", aliases: ["preferredTime"], pii: false, questions: q("time") },
  startDate: { key: "startDate", label: "start date", aliases: ["checkIn"], pii: false, questions: q("startDate", "start date") },
  endDate: { key: "endDate", label: "end date", aliases: ["checkOut"], pii: false, questions: q("endDate", "end date") },
  duration: { key: "duration", label: "duration", aliases: ["length"], pii: false, questions: q("duration", "duration") },
  quantity: { key: "quantity", label: "quantity", aliases: ["count"], pii: false, questions: q("quantity", "quantity") },
  partySize: { key: "partySize", label: "party size", aliases: ["people"], pii: false, questions: q("partySize", "party size") },
  guestCount: { key: "guestCount", label: "guest count", aliases: ["guests"], pii: false, questions: q("guestCount", "guest count") },
  roomType: { key: "roomType", label: "room type", aliases: ["room"], pii: false, questions: q("roomType", "room type") },
  vehicleMake: { key: "vehicleMake", label: "vehicle make", aliases: ["carMake"], pii: false, questions: q("vehicleMake", "vehicle make") },
  vehicleModel: { key: "vehicleModel", label: "vehicle model", aliases: ["carModel"], pii: false, questions: q("vehicleModel", "vehicle model") },
  vehicleYear: { key: "vehicleYear", label: "vehicle year", aliases: ["carYear"], pii: false, questions: q("vehicleYear", "vehicle year") },
  licensePlate: { key: "licensePlate", label: "license plate", aliases: ["plate"], pii: true, questions: q("licensePlate", "license plate") },
  location: { key: "location", label: "location", aliases: ["area"], pii: false, questions: q("location", "location") },
  address: { key: "address", label: "address", aliases: ["deliveryAddress"], pii: true, questions: q("address", "address") },
  deliveryArea: { key: "deliveryArea", label: "delivery area", aliases: ["deliveryZone"], pii: false, questions: q("deliveryArea", "delivery area") },
  budget: { key: "budget", label: "budget", aliases: ["priceRange"], pii: false, questions: q("budget", "budget") },
  urgency: { key: "urgency", label: "urgency", aliases: ["priority"], pii: false, questions: q("urgency", "urgency") },
  preferredStaff: { key: "preferredStaff", label: "preferred staff", aliases: ["staff"], pii: false, questions: q("preferredStaff", "preferred staff") },
  department: { key: "department", label: "department", aliases: ["team"], pii: false, questions: q("department", "department") },
  customerName: { key: "customerName", label: "customer name", aliases: ["name"], pii: true, questions: q("customerName") },
  phone: { key: "phone", label: "phone", aliases: ["customerPhone"], pii: true, questions: q("phone") },
  email: { key: "email", label: "email", aliases: ["customerEmail"], pii: true, questions: q("email", "email") },
  companyName: { key: "companyName", label: "company name", aliases: ["company"], pii: false, questions: q("companyName", "company name") },
  orderId: { key: "orderId", label: "order id", aliases: ["orderNumber"], pii: false, questions: q("orderId", "order id") },
  bookingId: { key: "bookingId", label: "booking id", aliases: ["reservationId"], pii: false, questions: q("bookingId", "booking id") },
  ticketId: { key: "ticketId", label: "ticket id", aliases: ["caseId"], pii: false, questions: q("ticketId", "ticket id") },
  notes: { key: "notes", label: "notes", aliases: ["additionalNotes"], pii: false, questions: q("notes", "notes") },
  language: { key: "language", label: "language", aliases: ["locale"], pii: false, questions: q("language", "language") },
});

const DEFAULT_REQUIRED_BY_REQUEST_TYPE = Object.freeze({
  [VOICE_REQUEST_TYPES.CALLBACK_REQUEST]: Object.freeze(["requestType", "description", "phone"]),
  [VOICE_REQUEST_TYPES.COMPLAINT]: Object.freeze(["requestType", "description", "phone"]),
  [VOICE_REQUEST_TYPES.SUPPORT_TICKET]: Object.freeze(["requestType", "description", "phone"]),
});

function valueForSlot(payload = {}, slotKey = "") {
  const slot = UNIVERSAL_VOICE_SLOTS[slotKey];
  const keys = [slotKey, ...(slot?.aliases || [])];
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      if (value.length) return value;
    } else if (s(value)) {
      return value;
    }
  }
  return "";
}

function hasDescriptionOrIntent(payload = {}) {
  return !!(s(valueForSlot(payload, "description")) || s(valueForSlot(payload, "intent")));
}

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
    VOICE_REQUEST_TYPES.CANCELLATION_REQUEST,
    VOICE_REQUEST_TYPES.MODIFICATION_REQUEST,
    VOICE_REQUEST_TYPES.RENTAL_REQUEST,
    VOICE_REQUEST_TYPES.DELIVERY_REQUEST,
    VOICE_REQUEST_TYPES.LEAD_INTAKE,
    VOICE_REQUEST_TYPES.CUSTOM_REQUEST,
  ].includes(requestType);
}

export function getUniversalSlotQuestion(slotKey, language = "en") {
  const slot = UNIVERSAL_VOICE_SLOTS[s(slotKey)];
  const lang = normalizeLanguage(language);
  return slot?.questions?.[lang] || slot?.questions?.en || QUESTIONS.description.en;
}

export function getRequiredSlotsForUniversalRequest({
  businessFamily = "",
  requestType = "",
  operationType = "",
  runtimeConfig = {},
} = {}) {
  const family = normalizeVoiceBusinessFamily(businessFamily || runtimeConfig.businessFamily);
  const type = normalizeVoiceRequestType(requestType);
  const operation = normalizeVoiceOperationType(operationType || VOICE_OPERATION_TYPES.CREATE_REQUEST);
  const custom = runtimeConfig.universalRequiredSlots?.[type] || runtimeConfig.actions?.universalRequiredSlots?.[type];
  const required = new Set(custom || DEFAULT_REQUIRED_BY_REQUEST_TYPE[type] || ["requestType", "description"]);

  if (requiresPhone(type, operation)) required.add("phone");
  if (family === VOICE_BUSINESS_FAMILIES.AUTO_SERVICE && type === VOICE_REQUEST_TYPES.REPAIR_REQUEST) {
    required.add("vehicleMake");
  }

  return [...required];
}

export function analyzeUniversalVoiceSlots({
  operationType = VOICE_OPERATION_TYPES.CREATE_REQUEST,
  requestType = "",
  payload = {},
  call = {},
  runtimeConfig = {},
  language = "",
} = {}) {
  const data = cleanPayload(payload);
  const lang = normalizeLanguage(language || runtimeConfig.defaultLanguage || call.language || "en");
  const operation = normalizeVoiceOperationType(operationType);
  const type = normalizeVoiceRequestType(data.requestType || requestType);
  const businessFamily = normalizeVoiceBusinessFamily(
    runtimeConfig.businessFamily || runtimeConfig.businessType || runtimeConfig.actions?.businessFamily
  );

  const collectedSlots = {};
  for (const key of Object.keys(UNIVERSAL_VOICE_SLOTS)) {
    const value = valueForSlot(data, key);
    if (value !== "") collectedSlots[key] = value;
  }

  const phone = firstUsablePhone(
    data.phone,
    data.customerPhone,
    data.customer_phone,
    call.fromNumber,
    call.from,
    call.phone,
    call.customerNumber
  );
  if (phone) collectedSlots.phone = phone;

  const required = getRequiredSlotsForUniversalRequest({
    businessFamily,
    requestType: type,
    operationType: operation,
    runtimeConfig,
  });
  const missingRequired = [];

  for (const field of required) {
    if (field === "description") {
      if (!hasDescriptionOrIntent(data)) missingRequired.push(field);
      continue;
    }
    if (field === "phone") {
      if (!phone) missingRequired.push(field);
      continue;
    }
    if (field === "requestType") {
      if (!s(data.requestType || requestType)) missingRequired.push(field);
      continue;
    }
    if (!s(valueForSlot(data, field))) missingRequired.push(field);
  }

  const nextMissing = missingRequired[0] || "";
  const nextQuestion = nextMissing ? getUniversalSlotQuestion(nextMissing, lang) : "";

  return {
    ok: missingRequired.length === 0,
    operationType: operation,
    requestType: type,
    businessFamily,
    language: lang,
    payload: data,
    collectedSlots,
    required,
    missingRequired: missingRequired.map((field) => ({
      field,
      label: UNIVERSAL_VOICE_SLOTS[field]?.label || field,
      nextQuestion: getUniversalSlotQuestion(field, lang),
    })),
    nextMissing: nextMissing
      ? {
          field: nextMissing,
          label: UNIVERSAL_VOICE_SLOTS[nextMissing]?.label || nextMissing,
        }
      : null,
    nextQuestion,
    complete: missingRequired.length === 0,
  };
}
