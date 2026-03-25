import { buildRealtimeEnvelope } from "@aihq/shared-contracts/realtime";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function inferTenantScope(source = {}) {
  if (!isObj(source)) {
    return {
      tenantKey: "",
      tenantId: "",
    };
  }

  return {
    tenantKey: lower(
      source.tenantKey ||
        source.tenant_key ||
        source.thread?.tenantKey ||
        source.thread?.tenant_key ||
        source.message?.tenantKey ||
        source.message?.tenant_key ||
        source.attempt?.tenantKey ||
        source.attempt?.tenant_key ||
        source.lead?.tenantKey ||
        source.lead?.tenant_key ||
        source.event?.tenantKey ||
        source.event?.tenant_key ||
        source.comment?.tenantKey ||
        source.comment?.tenant_key
    ),
    tenantId: s(
      source.tenantId ||
        source.tenant_id ||
        source.thread?.tenantId ||
        source.thread?.tenant_id ||
        source.message?.tenantId ||
        source.message?.tenant_id ||
        source.attempt?.tenantId ||
        source.attempt?.tenant_id ||
        source.lead?.tenantId ||
        source.lead?.tenant_id ||
        source.event?.tenantId ||
        source.event?.tenant_id ||
        source.comment?.tenantId ||
        source.comment?.tenant_id
    ),
  };
}

export function emitRealtimeEvent(wsHub, event, { logger = null } = {}) {
  const scope = inferTenantScope(event);
  const checked = buildRealtimeEnvelope({
    ...event,
    tenantKey: lower(event?.tenantKey || scope.tenantKey),
    tenantId: s(event?.tenantId || scope.tenantId),
  });

  if (!checked.ok) {
    logger?.warn?.("realtime.emit.rejected", {
      type: s(event?.type || event?.event || "unknown"),
      reason: checked.error,
    });
    return false;
  }

  return Boolean(wsHub?.broadcast?.(checked.value));
}
