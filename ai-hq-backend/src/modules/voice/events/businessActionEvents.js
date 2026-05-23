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

export const VOICE_BUSINESS_ACTION_EVENT_VERSION =
  "voice_business_action_event.v1";

export const VOICE_BUSINESS_ACTION_EVENT_TYPES = Object.freeze({
  BUSINESS_REQUEST_RECORDED: "business_request_recorded",
});

export function shouldRecordBusinessActionVoiceEvent(result = {}) {
  const item = obj(result);
  const record = obj(item.requestRecord);

  return (
    item.ok === true &&
    s(item.status) === "request_recorded" &&
    !!s(record.id || item.requestId) &&
    !!s(item.action)
  );
}

export function buildBusinessActionRecordedVoiceEventPayload({
  result = {},
  toolCallId = "",
  toolName = "",
  providerRealtimeCallId = "",
  runtimeConfig = {},
  idempotency = {},
  source = "voice_action_executor",
  sinkDispatch = {},
  sinkDelivery = {},
} = {}) {
  const item = obj(result);
  const record = obj(item.requestRecord);
  const adapter = obj(item.businessActionAdapter || record.adapter);
  const payload = obj(record.payload || item.payload);
  const customer = obj(record.customer);
  const dispatch = obj(sinkDispatch);
  const delivery = obj(sinkDelivery || dispatch.sinkDelivery);
  const deliveries = arr(dispatch.deliveries);

  return {
    version: VOICE_BUSINESS_ACTION_EVENT_VERSION,
    type: VOICE_BUSINESS_ACTION_EVENT_TYPES.BUSINESS_REQUEST_RECORDED,
    source: s(source || "voice_action_executor"),
    action: s(item.action || record.actionName || toolName),
    status: s(item.status),
    requestId: s(record.id || item.requestId),
    idempotencyKey: s(item.idempotencyKey || record.idempotencyKey),
    tenantId: s(record.tenantId || item.tenantId),
    tenantKey: s(record.tenantKey || item.tenantKey || runtimeConfig.tenantKey),
    callId: s(record.callId || item.callId),
    sessionId: s(record.sessionId || item.sessionId),
    requestRecord: record,
    requestSummary: s(record.summary || item.summary || item.message),
    requestType: s(record.requestType),
    businessFamily: s(record.businessFamily || adapter.businessFamily),
    priority: s(record.priority || "normal"),
    customer: {
      name: s(customer.name || payload.customerName || payload.customer_name || payload.name),
      phone: s(customer.phone || payload.phone || payload.customerPhone || payload.customer_phone),
      email: s(customer.email || payload.email || payload.customerEmail || payload.customer_email),
    },
    adapter: {
      version: s(adapter.version),
      provider: s(adapter.provider || item.provider),
      mode: s(adapter.mode),
      ready: adapter.ready === true,
      productionReady: adapter.productionReady === true,
      confirmsLiveTransaction: adapter.confirmsLiveTransaction === true,
      recordsRequest: adapter.recordsRequest === true,
      reasonCode: s(adapter.reasonCode || item.reasonCode),
    },
    tool: {
      toolCallId: s(toolCallId),
      toolName: s(toolName || item.action),
      providerRealtimeCallId: s(providerRealtimeCallId),
    },
    idempotency: obj(idempotency),
    downstreamSinks: arr(record.downstreamSinks),
    sinkDispatch: {
      ok: dispatch.ok !== false,
      requestId: s(dispatch.requestId || record.id || item.requestId),
      deliveries,
    },
    sinkDelivery: {
      voiceCore: s(delivery.voiceCore || delivery.voice_core || "recorded"),
      inbox: s(delivery.inbox || "not_attempted"),
      calendar: s(delivery.calendar || "not_attempted"),
      crm: s(delivery.crm || "not_attempted"),
      webhook: s(delivery.webhook || "not_attempted"),
    },
    audit: {
      ...(obj(record.audit)),
      eventCreatedBy: "voice_business_action_event_builder",
    },
  };
}
