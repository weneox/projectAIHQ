import {
  analyzeUniversalVoiceSlots,
} from "./actions/voiceUniversalSlots.js";
import {
  buildVoiceMissingSlots,
  cleanVoiceSlotPayload,
  firstUsableVoicePhone,
  hasAnyVoiceSlot,
  hasVoiceSlot,
  readVoicePhoneFromSources,
  readVoiceSlotValue,
} from "./slots/voiceSlotContracts.js";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
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

const VOICE_ACTION_STATE_REQUIRED_FIELDS = Object.freeze({
  check_availability: Object.freeze(["intent"]),
  create_reservation_request: Object.freeze([
    "date",
    "time",
    "partySize",
    "customerName",
    "phone",
  ]),
  create_order_request: Object.freeze(["items", "fulfillment", "phone"]),
  create_appointment_request: Object.freeze([
    "service",
    "preferredDateOrTime",
    "customerName",
    "phone",
  ]),
  create_handoff_request: Object.freeze(["reason", "phone", "summary"]),
  end_call: Object.freeze(["reason"]),
});

export function getVoiceActionToolRequiredFields(actionName = "") {
  return [...(VOICE_ACTION_TOOL_REQUIRED_FIELDS[s(actionName)] || [])];
}

function actionIntent(actionName = "") {
  const action = s(actionName);

  if (action === "create_appointment_request") return "appointment_request";
  if (action === "create_reservation_request") return "reservation_request";
  if (action === "create_order_request") return "order_request";
  if (action === "create_handoff_request") return "handoff_request";
  if (action === "create_business_request") return "business_request";
  if (action === "check_availability") return "availability_check";
  if (action === "end_call") return "end_call";

  return "unknown";
}

function readActionPhone(payload = {}, call = {}) {
  return firstUsableVoicePhone(
    readVoicePhoneFromSources({ payload, call }),
    payload.phone,
    payload.customerPhone,
    payload.customer_phone,
    payload.callbackPhone,
    payload.callback_phone,
    call.fromNumber,
    call.from_number,
    call.from,
    call.phone,
    call.customerNumber,
    call.customer_number
  );
}

function readFulfillment(payload = {}) {
  return s(
    payload.fulfillment ||
      payload.deliveryMode ||
      payload.delivery_mode ||
      payload.pickupOrDelivery ||
      payload.pickup_or_delivery
  ).toLowerCase();
}

function hasUsefulItems(payload = {}) {
  const items = payload.items || payload.orderItems || payload.order_items;
  if (Array.isArray(items)) return items.length > 0;
  return !!s(items);
}

function hasAddress(payload = {}) {
  return hasVoiceSlot(payload, "address");
}

function actionPayloadPresence({ action = "", payload = {}, call = {} } = {}) {
  const phone = readActionPhone(payload, call);
  const fulfillment = readFulfillment(payload);

  return {
    intent: hasAnyVoiceSlot(payload, ["intent", "service", "product", "roomType", "description"]),
    service: hasAnyVoiceSlot(payload, ["service", "department"]),
    date: hasVoiceSlot(payload, "date"),
    time: hasVoiceSlot(payload, "time"),
    preferredDateOrTime: hasAnyVoiceSlot(payload, ["date", "time", "startDate", "endDate"]),
    customerName: hasVoiceSlot(payload, "customerName"),
    phone: !!phone,
    items: hasUsefulItems(payload),
    fulfillment: !!fulfillment,
    address: hasAddress(payload),
    reason: !!s(readVoiceSlotValue(payload, "reason") || payload.reason),
    summary: !!s(readVoiceSlotValue(payload, "summary") || payload.summary),
    partySize: hasVoiceSlot(payload, "partySize"),
    action,
    fulfillmentValue: fulfillment,
    phoneValue: phone,
  };
}

function actionRequirementSatisfied({ field = "", payload = {}, call = {}, present = {} } = {}) {
  const key = s(field);

  if (!key) return true;
  if (key === "intent") return present.intent === true;
  if (key === "items") return present.items === true;
  if (key === "fulfillment") return present.fulfillment === true;
  if (key === "phone") return present.phone === true;
  if (key === "preferredDateOrTime") return present.preferredDateOrTime === true;

  return hasVoiceSlot(payload, key);
}

function requiredFieldsForAction({ action = "", payload = {}, present = {} } = {}) {
  const required = [
    ...(VOICE_ACTION_STATE_REQUIRED_FIELDS[action] || []),
  ];

  if (action === "create_order_request" && present.fulfillmentValue === "delivery") {
    required.push("address");
  }

  return [...new Set(required)];
}

function buildActionState({
  action = "",
  payload = {},
  call = {},
  runtimeConfig = {},
} = {}) {
  const present = actionPayloadPresence({ action, payload, call });
  const required = requiredFieldsForAction({ action, payload, present });
  const phone = present.phoneValue || readActionPhone(payload, call);

  const missingRequired = buildVoiceMissingSlots({
    required,
    payload,
    phone,
  }).filter((item) =>
    !actionRequirementSatisfied({
      field: item.field,
      payload,
      call,
      present,
    })
  );

  const nextMissing = missingRequired[0] || null;

  return {
    ok: missingRequired.length === 0,
    complete: missingRequired.length === 0,
    action,
    intent: actionIntent(action),
    payload,
    present,
    required,
    missingRequired,
    nextMissing,
    nextPromptHint: nextMissing?.promptHint || null,
    runtime: {
      hasRuntimeConfig: Object.keys(obj(runtimeConfig)).length > 0,
    },
  };
}

export function analyzeVoiceActionState({
  actionName = "",
  args = {},
  payload = {},
  call = {},
  runtimeConfig = {},
} = {}) {
  const action = s(actionName);
  const data = cleanVoiceSlotPayload(Object.keys(obj(payload)).length ? payload : args);

  if (action === "create_business_request") {
    return analyzeUniversalVoiceSlots({
      operationType: "create_request",
      requestType: data.requestType,
      payload: data,
      call,
      runtimeConfig,
    });
  }

  return buildActionState({
    action,
    payload: data,
    call,
    runtimeConfig,
  });
}

export function buildVoiceStateInstruction(state = {}) {
  if (!state || state.complete) {
    return "All required structured fields for this action have been collected.";
  }

  const missingLabels = Array.isArray(state.missingRequired)
    ? state.missingRequired.map((item) => s(item.label || item.field)).filter(Boolean)
    : [];
  const next = state.nextMissing || state.missingRequired?.[0] || null;
  const nextLabel = s(next?.label || next?.field);

  return [
    "Structured action state:",
    missingLabels.length ? `- Missing fields: ${missingLabels.join(", ")}.` : "",
    nextLabel ? `- Next missing field: ${nextLabel}.` : "",
    "- Generate natural caller-facing wording from the voice brain and response composer policy.",
    "- Do not expose field names, policy names, JSON, tools, database, or internal state to the caller.",
    "- Ask for only the next missing detail in the caller's language.",
    "- Do not create the request until required structured fields are complete.",
  ].filter(Boolean).join("\n");
}
