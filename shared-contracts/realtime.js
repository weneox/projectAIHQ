function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export const REALTIME_AUDIENCES = ["tenant", "operator"];

export function inferRealtimeAudience(type = "") {
  const value = lower(type);
  if (
    value.startsWith("inbox.") ||
    value.startsWith("lead.") ||
    value.startsWith("comment.") ||
    value.startsWith("notification.") ||
    value.startsWith("proposal.") ||
    value.startsWith("execution.") ||
    value.startsWith("voice.")
  ) {
    return "operator";
  }

  return "tenant";
}

export function validateRealtimeEnvelope(input = {}) {
  if (!isObj(input)) {
    return { ok: false, error: "realtime_event_required" };
  }

  const type = s(input.type || input.event);
  if (!type) {
    return { ok: false, error: "realtime_event_type_required" };
  }

  const tenantKey = lower(input.tenantKey || input.tenant_key);
  const tenantId = s(input.tenantId || input.tenant_id);
  if (!tenantKey && !tenantId) {
    return { ok: false, error: "realtime_tenant_scope_required" };
  }

  const audience = lower(input.audience || inferRealtimeAudience(type));
  if (!REALTIME_AUDIENCES.includes(audience)) {
    return { ok: false, error: "realtime_audience_invalid" };
  }

  return {
    ok: true,
    value: {
      ...input,
      type,
      tenantKey,
      tenantId,
      audience,
    },
  };
}

export function buildRealtimeEnvelope(input = {}) {
  return validateRealtimeEnvelope(input);
}
