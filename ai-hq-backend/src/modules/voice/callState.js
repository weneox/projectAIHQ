import {
  analyzeUniversalVoiceSlots,
} from "./actions/voiceUniversalSlots.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cleanPayload(value = {}) {
  const input = obj(value);
  return Object.fromEntries(
    Object.entries(input).filter(([, item]) => item !== undefined && item !== null && item !== "")
  );
}

const VOICE_ACTION_TOOL_REQUIRED_FIELDS = Object.freeze({
  check_availability: Object.freeze(["intent"]),
  create_business_request: Object.freeze(["requestType"]),
  create_reservation_request: Object.freeze(["date", "customerName", "phone"]),
  create_order_request: Object.freeze(["items", "fulfillment", "phone"]),
  create_appointment_request: Object.freeze(["service", "customerName", "phone"]),
  create_handoff_request: Object.freeze(["reason", "phone", "summary"]),
  end_call: Object.freeze(["reason"]),
});

export function getVoiceActionToolRequiredFields(actionName = "") {
  return [...(VOICE_ACTION_TOOL_REQUIRED_FIELDS[s(actionName)] || [])];
}

function normalizeLanguage(value = "") {
  const raw = s(value).toLowerCase().replace("_", "-");
  if (raw.startsWith("az")) return "az";
  if (raw.startsWith("ru")) return "ru";
  if (raw.startsWith("tr")) return "tr";
  if (raw.startsWith("en")) return "en";
  return raw || "az";
}

function looksLikePhone(value = "") {
  const raw = s(value);
  const lowered = raw.toLowerCase();

  if (!raw) return false;

  if (
    [
      "browser",
      "browser_lab",
      "browserlab",
      "test",
      "unknown",
      "anonymous",
      "hidden",
      "private",
      "caller",
      "customer",
    ].includes(lowered)
  ) {
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

function readPhone(payload = {}, call = {}) {
  return firstUsablePhone(
    payload.phone,
    payload.customerPhone,
    payload.customer_phone,
    payload.callbackPhone,
    payload.callback_phone,
    call.fromNumber,
    call.from,
    call.phone,
    call.customerNumber
  );
}

function readCustomerName(payload = {}) {
  return s(
    payload.customerName ||
      payload.customer_name ||
      payload.name ||
      payload.fullName ||
      payload.full_name
  );
}

function readService(payload = {}) {
  return s(
    payload.service ||
      payload.serviceType ||
      payload.service_type ||
      payload.intent ||
      payload.reason
  );
}

function readDate(payload = {}) {
  return s(payload.date || payload.preferredDate || payload.preferred_date);
}

function readTime(payload = {}) {
  return s(payload.time || payload.preferredTime || payload.preferred_time);
}

function hasUsefulItems(value) {
  if (Array.isArray(value)) return value.length > 0;
  return !!s(value);
}

function addMissing(list, field, label, question = {}) {
  list.push({
    field,
    label: s(label || field),
    question,
  });
}

function questionFor(field = "", language = "az") {
  const lang = normalizeLanguage(language);

  const az = {
    service: "Hansı xidmət üçün müraciət etmək istəyirsiniz?",
    preferredDateOrTime: "Sizə hansı gün və ya saat daha uyğundur?",
    customerName: "Adınızı necə qeyd edim?",
    phone: "Əlaqə nömrənizi qeyd edə bilərəm?",
    date: "Hansı tarix üçün istəyirsiniz?",
    time: "Saat neçəyə istəyirsiniz?",
    items: "Nə sifariş etmək istəyirsiniz?",
    fulfillment: "Çatdırılma olsun?",
    address: "Çatdırılma ünvanını deyə bilərsiniz?",
    reason: "Operatora hansı mövzu ilə bağlı yönləndirim?",
    summary: "Qısaca nə ilə bağlı müraciət etdiyinizi qeyd edim?",
  };

  const en = {
    service: "Which service would you like to request?",
    preferredDateOrTime: "Which day or time works best for you?",
    customerName: "What name should I note?",
    phone: "May I take your phone number?",
    date: "Which date would you like?",
    time: "What time would you prefer?",
    items: "What would you like to order?",
    fulfillment: "Would you like delivery or pickup?",
    address: "Could you share the delivery address?",
    reason: "What should I tell the operator this is about?",
    summary: "Could you briefly summarize what this is about?",
  };

  const ru = {
    service: "На какую услугу хотите записаться?",
    preferredDateOrTime: "Какой день или время вам удобны?",
    customerName: "Как вас записать?",
    phone: "Можно ваш номер телефона?",
    date: "На какую дату хотите?",
    time: "На какое время удобно?",
    items: "Что вы хотите заказать?",
    fulfillment: "Доставка или самовывоз?",
    address: "Можете сказать адрес доставки?",
    reason: "По какому вопросу соединить с оператором?",
    summary: "Кратко скажите, по какому вопросу обращаетесь?",
  };

  const dict = lang === "ru" ? ru : lang === "en" ? en : az;
  return dict[field] || dict.summary || az.summary;
}

function actionIntent(actionName = "") {
  const action = s(actionName);
  if (action === "create_appointment_request") return "appointment_request";
  if (action === "create_reservation_request") return "reservation_request";
  if (action === "create_order_request") return "order_request";
  if (action === "create_handoff_request") return "handoff_request";
  if (action === "check_availability") return "availability_check";
  if (action === "end_call") return "end_call";
  return "unknown";
}

export function analyzeVoiceActionState({
  actionName = "",
  args = {},
  payload = {},
  call = {},
  runtimeConfig = {},
  language = "",
} = {}) {
  const action = s(actionName);
  const data = cleanPayload(Object.keys(obj(payload)).length ? payload : args);

  if (action === "create_business_request") {
    return analyzeUniversalVoiceSlots({
      operationType: "create_request",
      requestType: data.requestType,
      payload: data,
      call,
      runtimeConfig,
      language,
    });
  }

  const lang = normalizeLanguage(
    language ||
      runtimeConfig.defaultLanguage ||
      runtimeConfig.voiceProfile?.defaultLanguage ||
      call.language ||
      call.lang ||
      "az"
  );

  const missingRequired = [];
  const phone = readPhone(data, call);
  const customerName = readCustomerName(data);
  const service = readService(data);
  const date = readDate(data);
  const time = readTime(data);
  const fulfillment = s(data.fulfillment).toLowerCase();

  if (action === "create_appointment_request") {
    if (!service) addMissing(missingRequired, "service", "service");
    if (!date && !time) addMissing(missingRequired, "preferredDateOrTime", "preferred date or time");
    if (!customerName) addMissing(missingRequired, "customerName", "customer name");
    if (!phone) addMissing(missingRequired, "phone", "phone");
  }

  if (action === "create_reservation_request") {
    if (!date) addMissing(missingRequired, "date", "date");
    if (!customerName) addMissing(missingRequired, "customerName", "customer name");
    if (!phone) addMissing(missingRequired, "phone", "phone");
  }

  if (action === "create_order_request") {
    if (!hasUsefulItems(data.items)) addMissing(missingRequired, "items", "items");
    if (!fulfillment) addMissing(missingRequired, "fulfillment", "delivery or pickup");
    if (fulfillment === "delivery" && !s(data.address)) {
      addMissing(missingRequired, "address", "delivery address");
    }
    if (!phone) addMissing(missingRequired, "phone", "phone");
  }

  if (action === "create_handoff_request") {
    if (!s(data.reason)) addMissing(missingRequired, "reason", "handoff reason");
    if (!phone) addMissing(missingRequired, "phone", "phone");
    if (!s(data.summary)) addMissing(missingRequired, "summary", "short summary");
  }

  const nextMissing = missingRequired[0] || null;
  const nextQuestion = nextMissing ? questionFor(nextMissing.field, lang) : "";

  return {
    ok: missingRequired.length === 0,
    action,
    intent: actionIntent(action),
    language: lang,
    payload: data,
    present: {
      service,
      date,
      time,
      customerName,
      phone,
      fulfillment,
      hasItems: hasUsefulItems(data.items),
      hasAddress: !!s(data.address),
    },
    missingRequired: missingRequired.map((item) => ({
      field: item.field,
      label: item.label,
      nextQuestion: questionFor(item.field, lang),
    })),
    nextMissing: nextMissing
      ? {
          field: nextMissing.field,
          label: nextMissing.label,
        }
      : null,
    nextQuestion,
    complete: missingRequired.length === 0,
  };
}

export function buildVoiceStateInstruction(state = {}) {
  if (!state || state.complete) {
    return "All required information for this action has been collected.";
  }

  return [
    "Missing required information:",
    state.missingRequired.map((item) => `- ${item.label}`).join("\n"),
    "",
    "Next step:",
    `- Ask exactly this one question next: "${state.nextQuestion}"`,
    "- Do not ask multiple missing fields in one turn.",
    "- Do not create the request until missing fields are collected.",
  ].filter(Boolean).join("\n");
}
