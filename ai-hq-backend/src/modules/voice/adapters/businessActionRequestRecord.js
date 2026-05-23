import {
  normalizeBusinessActionName,
  normalizeBusinessActionProvider,
} from "./businessActionAdapterContracts.js";
import {
  normalizeVoiceBusinessFamily,
  normalizeVoiceRequestType,
} from "../actions/voiceOperationTaxonomy.js";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cleanPayload(value = {}) {
  const input = obj(value);

  return Object.fromEntries(
    Object.entries(input).filter(([, item]) => {
      if (item === undefined || item === null || item === "") return false;
      if (Array.isArray(item)) return item.length > 0;
      if (typeof item === "object") return Object.keys(item).length > 0;
      return true;
    })
  );
}

function stableStringify(value = {}) {
  const input = obj(value);
  const sorted = Object.keys(input)
    .sort()
    .reduce((acc, key) => {
      const item = input[key];
      acc[key] = item && typeof item === "object" && !Array.isArray(item)
        ? JSON.parse(stableStringify(item))
        : item;
      return acc;
    }, {});

  return JSON.stringify(sorted);
}

function hashText(value = "") {
  let hash = 2166136261;

  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
}

export const VOICE_BUSINESS_ACTION_REQUEST_RECORD_VERSION =
  "voice_business_action_request_record.v1";

export function buildBusinessActionRequestId({
  tenantKey = "",
  callId = "",
  actionName = "",
  payload = {},
} = {}) {
  const base = [
    s(tenantKey, "unknown_tenant"),
    s(callId, "unknown_call"),
    normalizeBusinessActionName(actionName),
    hashText(stableStringify(cleanPayload(payload))),
  ].join(":");

  return `voice_request:${base}`;
}

export function buildBusinessActionRequestSummary({
  actionName = "",
  payload = {},
} = {}) {
  const action = normalizeBusinessActionName(actionName);
  const data = cleanPayload(payload);
  const phone = s(data.phone || data.customerPhone || data.customer_phone);
  const name = s(data.customerName || data.customer_name || data.name);
  const service = s(data.service || data.serviceType || data.intent || data.issue || data.reason);
  const date = s(data.date || data.preferredDate || data.preferred_date);
  const time = s(data.time || data.preferredTime || data.preferred_time);

  if (s(data.summary)) return s(data.summary);

  if (action === "create_reservation_request") {
    return [date, time, data.partySize ? `${data.partySize} people` : "", name, phone]
      .filter(Boolean)
      .join(" | ") || "Reservation request captured.";
  }

  if (action === "create_appointment_request") {
    return [service, date, time, name, phone].filter(Boolean).join(" | ") ||
      "Appointment request captured.";
  }

  if (action === "create_order_request") {
    return [
      Array.isArray(data.items) ? `${data.items.length} item` : "",
      s(data.fulfillment),
      phone,
    ].filter(Boolean).join(" | ") || "Order request captured.";
  }

  if (action === "create_handoff_request") {
    return [name, phone, service].filter(Boolean).join(" | ") ||
      "Human handoff requested.";
  }

  return [s(data.requestType), s(data.issue || data.description || data.intent), phone]
    .filter(Boolean)
    .join(" | ") || "Business request captured.";
}

export function buildBusinessActionRequestRecord({
  actionName = "",
  args = {},
  call = {},
  scope = {},
  runtimeConfig = {},
  businessActionAdapter = {},
  now = new Date().toISOString(),
} = {}) {
  const payload = cleanPayload(args);
  const normalizedAction = normalizeBusinessActionName(actionName);
  const adapter = obj(businessActionAdapter);
  const tenantKey = s(scope.tenantKey || call.tenantKey || call.tenant_key);
  const tenantId = s(scope.tenantId || call.tenantId || call.tenant_id);
  const callId = s(call.id || call.callId || call.call_id);
  const provider = normalizeBusinessActionProvider(adapter.provider || "internal_request");

  const requestType = normalizeVoiceRequestType(
    payload.requestType ||
      adapter.requestType ||
      runtimeConfig.requestType ||
      "custom_request"
  );

  const businessFamily = normalizeVoiceBusinessFamily(
    adapter.businessFamily ||
      runtimeConfig.businessFamily ||
      runtimeConfig.businessType ||
      "generic_business"
  );

  const id = buildBusinessActionRequestId({
    tenantKey,
    callId,
    actionName: normalizedAction,
    payload,
  });

  return {
    version: VOICE_BUSINESS_ACTION_REQUEST_RECORD_VERSION,
    id,
    idempotencyKey: id,
    status: "open",
    source: "voice",
    priority: normalizedAction === "create_handoff_request" ? "high" : "normal",
    actionName: normalizedAction,
    requestType,
    businessFamily,
    provider,
    tenantId,
    tenantKey,
    callId,
    sessionId: s(call.sessionId || call.session_id),
    customer: {
      name: s(payload.customerName || payload.customer_name || payload.name),
      phone: s(payload.phone || payload.customerPhone || payload.customer_phone),
      email: s(payload.email || payload.customerEmail || payload.customer_email),
    },
    summary: buildBusinessActionRequestSummary({
      actionName: normalizedAction,
      payload,
    }),
    payload,
    adapter: {
      version: s(adapter.version),
      provider,
      mode: s(adapter.mode),
      ready: adapter.ready === true,
      productionReady: adapter.productionReady === true,
      confirmsLiveTransaction: adapter.confirmsLiveTransaction === true,
      recordsRequest: adapter.recordsRequest === true,
      reasonCode: s(adapter.reasonCode),
    },
    audit: {
      createdAt: now,
      createdBy: "voice_action_executor",
      source: "voice_business_action_executor_registry",
      runtimeVersion: s(runtimeConfig.version || runtimeConfig.runtimeVersion),
    },
  };
}
