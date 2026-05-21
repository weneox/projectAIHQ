import {
  getVoiceActionToolRequiredFields,
} from "../callState.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function compact(values = []) {
  return arr(values).map((item) => s(item)).filter(Boolean);
}

function normalizeActionMode(value = "") {
  const raw = s(value).toLowerCase();
  return ["live", "request_only", "disabled"].includes(raw) ? raw : "disabled";
}

function normalizeOptionalActionMode(value = "") {
  const raw = s(value).toLowerCase();
  return ["live", "request_only", "disabled"].includes(raw) ? raw : "";
}

function readActionMode(runtimeConfig = {}, actions = {}, key = "") {
  return normalizeActionMode(
    runtimeConfig[`${key}Mode`] ||
      runtimeConfig[`${key}_mode`] ||
      actions[`${key}Mode`] ||
      actions[`${key}_mode`] ||
      obj(actions[key]).mode
  );
}

function readBusinessFamily(runtimeConfig = {}, actions = {}) {
  return s(
    actions.businessFamily ||
      actions.businessType ||
      actions.business_type ||
      runtimeConfig.businessFamily ||
      runtimeConfig.businessType ||
      runtimeConfig.business_type ||
      runtimeConfig.voiceProfile?.businessType ||
      runtimeConfig.voiceProfile?.business_type ||
      "generic_business"
  ).toLowerCase();
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
  const actions = obj(runtimeConfig.actions || runtimeConfig.voiceActions);

  return {
    businessFamily: readBusinessFamily(runtimeConfig, actions),
    supportedIntents: readSupportedIntents(runtimeConfig, actions),
    availabilityMode: readActionMode(runtimeConfig, actions, "availability"),
    orderingMode: readActionMode(runtimeConfig, actions, "ordering"),
    reservationMode: readActionMode(runtimeConfig, actions, "reservation"),
    appointmentMode: readActionMode(runtimeConfig, actions, "appointment"),
    handoffMode:
      normalizeOptionalActionMode(
        runtimeConfig.handoffMode ||
          runtimeConfig.handoff_mode ||
          actions.handoffMode ||
          actions.handoff_mode ||
          obj(actions.handoff).mode
      ) || "request_only",
    enabledTools: compact(runtimeConfig.enabledTools || actions.enabledTools),
  };
}

function buildVoiceActionSlotDiscipline(runtime = {}) {
  const family = s(runtime.businessFamily);

  if (family === "restaurant") {
    return [
      "- For table availability, collect date, time, and party size before any customer identity.",
      "- For food orders, collect items, quantities/options, fulfillment type, and delivery address when delivery is requested.",
      "- Ask for name or phone only when creating an order, reservation request, or handoff.",
      "- Do not ask for name or phone to check table availability.",
    ];
  }

  if (family === "hotel") {
    return [
      "- For room availability, collect check-in date, check-out date or nights, guest count, and room preference before customer identity.",
      "- Ask for name or phone only when creating a booking request or handoff.",
      "- Do not ask for name or phone to check room availability.",
    ];
  }

  if (family === "clinic") {
    return [
      "- For appointment availability, collect service/department, preferred date, preferred time, and urgency before customer identity.",
      "- Ask for name or phone only when creating an appointment request or handoff.",
      "- Do not ask for name or phone to check appointment availability.",
    ];
  }

  if (family === "salon") {
    return [
      "- For service availability, collect service, preferred date, preferred time, and preferred staff only if relevant.",
      "- Ask for name or phone only when creating an appointment request or handoff.",
      "- Do not ask for name or phone to check service availability.",
    ];
  }

  if (family === "ecommerce") {
    return [
      "- For product questions, collect product name, variant, quantity, and fulfillment preference.",
      "- Ask for name or phone only when creating an order request or handoff.",
      "- Do not claim stock or delivery time unless a tool or approved runtime confirms it.",
    ];
  }

  return [
    "- First collect the operational criteria needed for the caller's task.",
    "- Ask for customer identity only after the caller wants to create a request, booking, order, appointment, or handoff.",
    "- Do not ask for name or phone to check availability.",
  ];
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
    ...buildVoiceActionSlotDiscipline(runtime),
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

export function buildVoiceOperationalActionPolicy() {
  return [
    "Operational logic:",
    "- Do not pretend to check availability, inventory, schedules, menus, rooms, tables, appointments, or order status unless an approved runtime source or tool provides that data.",
    "- A caller's name or phone number does not determine availability. Never ask for name or phone as if it is required to check availability.",
    "- For availability questions, first collect the relevant criteria for that business type, such as date, time, party size, service, product, room preference, delivery area, or appointment type.",
    "- If live availability is not integrated, say that the team must confirm it. Only then ask for name and phone if follow-up is needed.",
    "- Do not say a booking, reservation, order, appointment, or callback is confirmed unless the system confirms it.",
    "",
    "- Use only approved business truth and runtime context.",
    "- Do not invent prices, availability, addresses, menus, people, delivery times, order status, bookings, or confirmations.",
    "- Do not claim an action was completed unless the system confirms it.",
    "- If a fact is missing, say it must be confirmed by the team.",
    "- Do not make empty callback promises.",
    "- Never say you will check and get back unless you first collect the caller's name and phone number.",
    "- If follow-up is needed, ask for name and phone number, then say the team can contact them after confirmation.",
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
        required: getVoiceActionToolRequiredFields(VOICE_ACTIONS.CHECK_AVAILABILITY),
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
        required: getVoiceActionToolRequiredFields(VOICE_ACTIONS.CREATE_RESERVATION_REQUEST),
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
        required: getVoiceActionToolRequiredFields(VOICE_ACTIONS.CREATE_ORDER_REQUEST),
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
        required: getVoiceActionToolRequiredFields(VOICE_ACTIONS.CREATE_APPOINTMENT_REQUEST),
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
        required: getVoiceActionToolRequiredFields(VOICE_ACTIONS.CREATE_HANDOFF_REQUEST),
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
      required: getVoiceActionToolRequiredFields(VOICE_ACTIONS.END_CALL),
    },
  });

  return tools;
}
