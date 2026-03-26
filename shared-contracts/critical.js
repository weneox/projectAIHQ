import { validateReadinessSurface } from "./operations.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function ok(value) {
  return { ok: true, value };
}

function fail(error, details = {}) {
  return {
    ok: false,
    error: s(error || "invalid_payload"),
    details: isObj(details) ? details : {},
  };
}

function pickProviderCallSid(input = {}) {
  return s(input.providerCallSid || input.callSid);
}

export function validateResolveChannelQuery(input = {}) {
  const value = {
    channel: lower(input.channel),
    recipientId: s(input.recipientId),
    pageId: s(input.pageId),
    igUserId: s(input.igUserId),
  };

  if (!value.channel) {
    return fail("channel_required");
  }

  if (!value.recipientId && !value.pageId && !value.igUserId) {
    return fail("channel_identifier_required");
  }

  return ok(value);
}

export function validateResolveChannelResponse(input = {}) {
  if (!isObj(input)) return fail("resolve_channel_response_required");

  const tenantKey = lower(input.tenantKey || input?.tenant?.tenant_key);
  const tenantId = s(input.tenantId || input?.tenant?.id);

  if (!tenantKey || !tenantId) {
    return fail("resolve_channel_response_invalid");
  }

  const readiness = isObj(input.readiness)
    ? validateReadinessSurface(input.readiness)
    : { ok: true, value: null };
  if (!readiness.ok) return readiness;

  return ok({
    tenantKey,
    tenantId,
    tenant: isObj(input.tenant) ? input.tenant : {},
    channelConfig: isObj(input.channelConfig) ? input.channelConfig : {},
    providerSecrets: isObj(input.providerSecrets) ? input.providerSecrets : {},
    resolvedChannel: lower(input.resolvedChannel || input?.channelConfig?.channelType),
    readiness: readiness.value,
  });
}

export function validateVoiceTenantConfigRequest(input = {}) {
  const value = {
    tenantKey: lower(input.tenantKey),
    toNumber: s(input.toNumber),
  };

  if (!value.tenantKey && !value.toNumber) {
    return fail("tenant_key_or_to_number_required");
  }

  return ok(value);
}

export function validateVoiceSessionUpsertRequest(input = {}) {
  const value = {
    tenantKey: lower(input.tenantKey),
    providerCallSid: pickProviderCallSid(input),
    body: isObj(input) ? input : {},
  };

  if (!value.tenantKey) return fail("tenant_key_required");
  if (!value.providerCallSid) return fail("provider_call_sid_required");
  return ok(value);
}

export function validateVoiceTranscriptRequest(input = {}) {
  const value = {
    providerCallSid: pickProviderCallSid(input),
    text: s(input.text),
    role: lower(input.role || "customer"),
  };

  if (!value.providerCallSid) return fail("provider_call_sid_required");
  if (!value.text) return fail("transcript_text_required");
  return ok(value);
}

export function validateVoiceSessionStateRequest(input = {}) {
  const providerCallSid = pickProviderCallSid(input);
  if (!providerCallSid) return fail("provider_call_sid_required");
  return ok({
    providerCallSid,
    body: isObj(input) ? input : {},
  });
}

export function validateVoiceOperatorJoinRequest(input = {}) {
  const providerCallSid = pickProviderCallSid(input);
  if (!providerCallSid) return fail("provider_call_sid_required");
  return ok({
    providerCallSid,
    body: isObj(input) ? input : {},
  });
}

export function validateMetaInternalOutboundRequest(input = {}) {
  const body = isObj(input) ? input : {};
  const attachments = arr(body.attachments);
  const value = {
    tenantKey: lower(
      body.tenantKey || body.tenant_key || body?.meta?.tenantKey || body?.meta?.tenant_key
    ),
    tenantId: s(body.tenantId || body.tenant_id || body?.meta?.tenantId || body?.meta?.tenant_id),
    channel: lower(body.channel || "instagram"),
    threadId: s(body.threadId || body.thread_id),
    recipientId: s(body.recipientId || body.recipient_id),
    text: s(body.text),
    senderType: lower(body.senderType || body.sender_type || "ai"),
    messageType: lower(body.messageType || body.message_type || "text"),
    attachments,
    meta: isObj(body.meta) ? body.meta : {},
  };

  if (!value.recipientId) {
    return fail("recipient_id_required");
  }

  if (!value.text && attachments.length === 0) {
    return fail("text_or_attachments_required");
  }

  return ok(value);
}

export function validateMetaCommentActionRequest(input = {}) {
  const body = isObj(input) ? input : {};
  const actions = arr(body.actions).filter(isObj);

  if (!actions.length) {
    return fail("actions_required");
  }

  return ok({
    actions,
    tenantKey: lower(
      body.tenantKey || body.tenant_key || body?.meta?.tenantKey || body?.meta?.tenant_key
    ),
    tenantId: s(body.tenantId || body.tenant_id || body?.meta?.tenantId || body?.meta?.tenant_id),
    body,
  });
}

export function validateAihqOutboundAckRequest(input = {}) {
  const body = isObj(input) ? input : {};
  const threadId = s(body.threadId || body.thread_id);
  const channel = lower(body.channel || "instagram");
  const recipientId = s(body.recipientId || body.recipient_id);

  if (!threadId) return fail("thread_id_required");
  if (!recipientId) return fail("recipient_id_required");

  return ok({
    threadId,
    tenantKey: lower(body.tenantKey || body.tenant_key),
    tenantId: s(body.tenantId || body.tenant_id),
    channel,
    recipientId,
    text: s(body.text),
    provider: lower(body.provider || "meta"),
    providerMessageId: s(body.providerMessageId || body.externalMessageId),
    meta: isObj(body.meta) ? body.meta : {},
  });
}

export function validateAihqOutboundAckResponse(input = {}) {
  if (!isObj(input)) return fail("aihq_outbound_response_required");
  if (typeof input.ok !== "boolean") return fail("aihq_outbound_response_invalid");
  return ok(input);
}

export function validateMetaGatewayOutboundResponse(input = {}) {
  if (!isObj(input)) return fail("meta_gateway_response_required");
  if (typeof input.ok !== "boolean") return fail("meta_gateway_response_invalid");
  return ok(input);
}

export function validateMetaCommentActionResponse(input = {}) {
  if (!isObj(input)) return fail("meta_comment_action_response_required");
  if (typeof input.ok !== "boolean") return fail("meta_comment_action_response_invalid");
  if (!Array.isArray(input.results)) return fail("meta_comment_action_results_required");
  return ok(input);
}

export function validateVoiceInternalResponse(input = {}) {
  if (!isObj(input)) return fail("voice_internal_response_required");
  if (typeof input.ok !== "boolean") return fail("voice_internal_response_invalid");
  return ok(input);
}

export function validateDurableVoiceSyncRequest(input = {}) {
  const body = isObj(input) ? input : {};
  const actionType = lower(body.actionType || body.action_type);
  const payload = isObj(body.payload) ? body.payload : {};
  const providerCallSid = pickProviderCallSid(payload);

  if (!actionType) return fail("action_type_required");
  if (!actionType.startsWith("voice.sync.")) return fail("voice_sync_action_type_invalid");
  if (!providerCallSid) return fail("provider_call_sid_required");

  return ok({
    actionType,
    tenantKey: lower(body.tenantKey || body.tenant_key || payload.tenantKey),
    tenantId: s(body.tenantId || body.tenant_id || payload.tenantId),
    idempotencyKey: s(body.idempotencyKey || body.idempotency_key),
    correlationIds: isObj(body.correlationIds || body.correlation_ids)
      ? body.correlationIds || body.correlation_ids
      : {},
    payload,
  });
}

export function validateDurableExecutionResponse(input = {}) {
  if (!isObj(input)) return fail("durable_execution_response_required");
  if (typeof input.ok !== "boolean") return fail("durable_execution_response_invalid");
  if (!isObj(input.execution)) return fail("durable_execution_payload_required");
  if (!s(input.execution.id)) return fail("durable_execution_id_required");
  if (!s(input.execution.status)) return fail("durable_execution_status_required");
  return ok(input);
}

export function validateRuntimeIncidentRequest(input = {}) {
  const body = isObj(input) ? input : {};
  const severity = lower(body.severity || body.level || "info");
  const value = {
    service: s(body.service),
    area: s(body.area || body.category),
    severity:
      severity === "error" ? "error" : severity === "warn" || severity === "warning" ? "warn" : "info",
    code: s(body.code),
    reasonCode: s(body.reasonCode),
    requestId: s(body.requestId),
    correlationId: s(body.correlationId),
    tenantId: s(body.tenantId),
    tenantKey: lower(body.tenantKey),
    detailSummary: s(body.detailSummary || body.message || body.error),
    context: isObj(body.context) ? body.context : {},
    occurredAt: s(body.occurredAt),
  };

  if (!value.service) return fail("runtime_incident_service_required");
  if (!value.area) return fail("runtime_incident_area_required");
  if (!value.code) return fail("runtime_incident_code_required");

  return ok(value);
}

export function validateRuntimeIncidentResponse(input = {}) {
  if (!isObj(input)) return fail("runtime_incident_response_required");
  if (typeof input.ok !== "boolean") return fail("runtime_incident_response_invalid");
  if (!isObj(input.incident)) return fail("runtime_incident_payload_required");
  if (!s(input.incident.id)) return fail("runtime_incident_id_required");
  return ok(input);
}
