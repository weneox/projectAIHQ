function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function compact(values = []) {
  return arr(values).map((item) => s(item).toLowerCase()).filter(Boolean);
}

function normalizeActionMode(value = "") {
  const raw = s(value).toLowerCase();

  if (["live", "request_only", "disabled"].includes(raw)) return raw;

  return "";
}

function normalizeActionModeOrDisabled(value = "") {
  return normalizeActionMode(value) || "disabled";
}

function includesAny(values = [], needles = []) {
  const haystack = compact(values).join(" ");
  return needles.some((needle) => haystack.includes(s(needle).toLowerCase()));
}

function inferBusinessFamily(runtimeConfig = {}, actions = {}) {
  const raw = [
    runtimeConfig.businessType,
    runtimeConfig.business_type,
    runtimeConfig.industry,
    runtimeConfig.business?.type,
    runtimeConfig.business?.category,
    runtimeConfig.voiceProfile?.businessType,
    runtimeConfig.voiceProfile?.business_type,
    runtimeConfig.voiceProfile?.industry,
    actions.businessType,
  ]
    .map((item) => s(item).toLowerCase())
    .filter(Boolean)
    .join(" ");

  if (/(restaurant|cafe|caf[eé]|food|pizza|burger|qida|restoran|kafe)/.test(raw)) {
    return "restaurant";
  }

  if (/(hotel|hostel|guesthouse|apartment|room|otel|mehmanxana)/.test(raw)) {
    return "hotel";
  }

  if (/(clinic|doctor|dentist|medical|hospital|klinika|həkim|hekim|stomatolog)/.test(raw)) {
    return "clinic";
  }

  if (/(salon|barber|beauty|spa|hair|nail|bərbər|berber|gözəllik|gozellik)/.test(raw)) {
    return "salon";
  }

  if (/(shop|store|ecommerce|e-commerce|retail|delivery|online store|mağaza|magaza)/.test(raw)) {
    return "ecommerce";
  }

  return "";
}

function readSupportedIntents(runtimeConfig = {}, actions = {}) {
  return compact([
    ...arr(runtimeConfig.supportedIntents),
    ...arr(runtimeConfig.supported_intents),
    ...arr(runtimeConfig.voiceProfile?.supportedIntents),
    ...arr(runtimeConfig.voiceBehavior?.supportedIntents),
    ...arr(runtimeConfig.operatorRouting?.supportedIntents),
    ...arr(actions.supportedIntents),
  ]);
}

function inferRequestMode({ explicitMode = "", supportedIntents = [], businessFamily = "", intentNeedles = [], businessFamilies = [] } = {}) {
  const mode = normalizeActionMode(explicitMode);
  if (mode) return mode;

  if (includesAny(supportedIntents, intentNeedles)) return "request_only";
  if (businessFamilies.includes(businessFamily)) return "request_only";

  return "disabled";
}

export const VOICE_ACTIONS = Object.freeze({
  CHECK_AVAILABILITY: "check_availability",
  CREATE_RESERVATION_REQUEST: "create_reservation_request",
  CREATE_ORDER_REQUEST: "create_order_request",
  CREATE_APPOINTMENT_REQUEST: "create_appointment_request",
  CREATE_HANDOFF_REQUEST: "create_handoff_request",
  END_CALL: "end_call",
});

export const VOICE_ACTION_MODES = Object.freeze({
  LIVE: "live",
  REQUEST_ONLY: "request_only",
  DISABLED: "disabled",
});

export function normalizeVoiceActionRuntime(runtimeConfig = {}) {
  const actions = runtimeConfig?.actions || runtimeConfig?.voiceActions || {};
  const businessFamily = inferBusinessFamily(runtimeConfig, actions);
  const supportedIntents = readSupportedIntents(runtimeConfig, actions);

  return {
    businessFamily,
    supportedIntents,
    availabilityMode: normalizeActionModeOrDisabled(
      runtimeConfig.availabilityMode ||
        actions.availabilityMode ||
        actions.availability?.mode
    ),
    orderingMode: inferRequestMode({
      explicitMode:
        runtimeConfig.orderingMode ||
        actions.orderingMode ||
        actions.ordering?.mode,
      supportedIntents,
      businessFamily,
      intentNeedles: ["order", "food_order", "delivery", "pickup", "takeaway", "sifariş", "sifaris"],
      businessFamilies: ["restaurant", "ecommerce"],
    }),
    reservationMode: inferRequestMode({
      explicitMode:
        runtimeConfig.reservationMode ||
        actions.reservationMode ||
        actions.reservation?.mode,
      supportedIntents,
      businessFamily,
      intentNeedles: ["reservation", "booking", "table", "room", "rezerv", "bron"],
      businessFamilies: ["restaurant", "hotel"],
    }),
    appointmentMode: inferRequestMode({
      explicitMode:
        runtimeConfig.appointmentMode ||
        actions.appointmentMode ||
        actions.appointment?.mode,
      supportedIntents,
      businessFamily,
      intentNeedles: ["appointment", "consultation", "visit", "slot", "qəbul", "qebul", "görüş", "gorus"],
      businessFamilies: ["clinic", "salon"],
    }),
    handoffMode: normalizeActionModeOrDisabled(
      runtimeConfig.handoffMode ||
        actions.handoffMode ||
        actions.handoff?.mode ||
        "request_only"
    ),
    enabledTools: arr(runtimeConfig.enabledTools || actions.enabledTools).map((item) =>
      s(item)
    ).filter(Boolean),
  };
}

export function buildVoiceActionPolicy(actionRuntime = {}) {
  const runtime = normalizeVoiceActionRuntime(actionRuntime);

  return [
    "Voice action policy:",
    "- You are not only a talker; you must use tools for real operational claims.",
    "- Never say availability, stock, booking, order, appointment, or reservation is confirmed unless a tool confirms it.",
    "- A caller name or phone number never proves availability.",
    "- Collect operational criteria before customer identity.",
    "- Customer identity is collected only when creating a request, booking, order, appointment, or handoff.",
    runtime.availabilityMode === "live"
      ? "- Availability can be checked with a live tool."
      : "- Live availability is not configured. You may collect request details but must not claim live availability.",
    runtime.orderingMode === "live"
      ? "- Orders can be created with a live tool."
      : "- Live ordering is not configured. You may create an order request only if request mode is enabled.",
    runtime.reservationMode === "live"
      ? "- Reservations can be created with a live tool."
      : "- Live reservation confirmation is not configured. You may create a reservation request only if request mode is enabled.",
    runtime.appointmentMode === "live"
      ? "- Appointments can be created with a live tool."
      : "- Live appointment confirmation is not configured. You may create an appointment request only if request mode is enabled.",
  ];
}

export function buildVoiceActionToolDefinitions(actionRuntime = {}) {
  const runtime = normalizeVoiceActionRuntime(actionRuntime);
  const tools = [];

  if (runtime.availabilityMode === "live") {
    tools.push({
      type: "function",
      name: VOICE_ACTIONS.CHECK_AVAILABILITY,
      description:
        "Check real availability for the current business context after collecting the required criteria.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          intent: { type: "string" },
          date: { type: "string" },
          time: { type: "string" },
          partySize: { type: "number" },
          service: { type: "string" },
          product: { type: "string" },
          roomType: { type: "string" },
          notes: { type: "string" },
        },
        required: ["intent"],
      },
    });
  }

  if (["live", "request_only"].includes(runtime.reservationMode)) {
    tools.push({
      type: "function",
      name: VOICE_ACTIONS.CREATE_RESERVATION_REQUEST,
      description:
        "Create a reservation request or confirmed reservation only after required reservation details are collected.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: { type: "string" },
          time: { type: "string" },
          partySize: { type: "number" },
          customerName: { type: "string" },
          phone: { type: "string" },
          service: { type: "string" },
          notes: { type: "string" },
        },
        required: ["date", "customerName", "phone"],
      },
    });
  }

  if (["live", "request_only"].includes(runtime.orderingMode)) {
    tools.push({
      type: "function",
      name: VOICE_ACTIONS.CREATE_ORDER_REQUEST,
      description:
        "Create a food/product order request after items, fulfillment, and customer contact details are collected.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          items: { type: "array", items: { type: "object" } },
          fulfillment: { type: "string", enum: ["delivery", "pickup", "unknown"] },
          address: { type: "string" },
          customerName: { type: "string" },
          phone: { type: "string" },
          paymentMethod: { type: "string" },
          notes: { type: "string" },
        },
        required: ["items", "fulfillment", "phone"],
      },
    });
  }

  if (["live", "request_only"].includes(runtime.appointmentMode)) {
    tools.push({
      type: "function",
      name: VOICE_ACTIONS.CREATE_APPOINTMENT_REQUEST,
      description:
        "Create an appointment request after service, time preference, name, and phone are collected.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          service: { type: "string" },
          date: { type: "string" },
          time: { type: "string" },
          customerName: { type: "string" },
          phone: { type: "string" },
          notes: { type: "string" },
        },
        required: ["service", "customerName", "phone"],
      },
    });
  }

  if (runtime.handoffMode !== "disabled") {
    tools.push({
      type: "function",
      name: VOICE_ACTIONS.CREATE_HANDOFF_REQUEST,
      description:
        "Create a human follow-up request when the caller needs help beyond configured live tools.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          reason: { type: "string" },
          customerName: { type: "string" },
          phone: { type: "string" },
          summary: { type: "string" },
        },
        required: ["reason", "phone", "summary"],
      },
    });
  }

  tools.push({
    type: "function",
    name: VOICE_ACTIONS.END_CALL,
    description:
      "End the current voice call after the caller semantically closes the conversation and the assistant has said one short plain closing sentence in the caller's latest language.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        reason: {
          type: "string",
          enum: ["caller_done", "request_resolved", "unsupported_scope", "handoff_not_needed", "other"],
        },
        summary: { type: "string" },
      },
      required: ["reason"],
    },
  });

  return tools;
}
