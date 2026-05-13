import { emitRealtimeEvent } from "../../../realtime/events.js";
import { s, withMessageOutboundAttemptCorrelation } from "../shared.js";

export function buildInboxTenantSummary(tenant) {
  if (!tenant) return null;

  return {
    id: tenant.id || null,
    tenant_key: tenant.tenant_key,
    name:
      tenant.company_name ||
      tenant?.profile?.brand_name ||
      tenant?.brand?.displayName ||
      tenant.tenant_key,
    timezone: tenant.timezone,
    inbox_policy: tenant.inbox_policy || {},
  };
}

export function buildDuplicateIngestResponse({ thread, message, threadState }) {
  return {
    ok: true,
    duplicate: true,
    deduped: true,
    thread,
    message,
    actions: [],
    leadResults: [],
    handoffResults: [],
    executionResults: [],
    threadState,
  };
}

export function buildIngestSuccessResponse({
  thread,
  threadState,
  message,
  tenant,
  brain,
  executionPolicy,
  actions,
  leadResults,
  handoffResults,
  executionResults,
}) {
  const normalizedExecutionResults = (executionResults || []).map((item) => ({
    ...item,
    message: withMessageOutboundAttemptCorrelation(item?.message, {
      message_id: item?.message?.id,
      attempt_ids: item?.attempt?.id ? [item.attempt.id] : [],
    }),
  }));

  return {
    ok: true,
    duplicate: false,
    deduped: false,
    thread,
    threadState,
    message,
    tenant: buildInboxTenantSummary(tenant),
    intent: brain?.intent || "general",
    leadScore: Number(brain?.leadScore || 0),
    policy: brain?.policy || null,
    executionPolicy: executionPolicy || brain?.executionPolicy || null,
    actions,
    leadResults,
    handoffResults,
    executionResults: normalizedExecutionResults,
  };
}

export function buildDuplicateOutboundResponse({
  thread,
  message,
  attempt,
  threadState,
}) {
  return {
    ok: true,
    duplicate: true,
    deduped: true,
    thread,
    message,
    attempt,
    threadState,
  };
}

export function buildOutboundSuccessResponse({
  thread,
  threadState,
  message,
  attempt,
}) {
  return {
    ok: true,
    duplicate: false,
    deduped: false,
    thread,
    threadState,
    message,
    attempt,
  };
}

export function emitTypingRealtime({
  wsHub,
  tenantKey = "",
  tenantId = "",
  threadId = "",
  actor = "business",
  active = false,
  reason = "",
  ttlMs = 9000,
} = {}) {
  const safeThreadId = s(threadId);
  if (!safeThreadId) return;

  const safeActor = s(actor || "business").toLowerCase() || "business";
  const now = Date.now();

  try {
    emitRealtimeEvent(wsHub, {
      type: "inbox.typing.updated",
      audience: "operator",
      tenantKey,
      tenantId,
      threadId: safeThreadId,
      typing: {
        actor: safeActor,
        active: active === true,
        reason: s(reason),
        updatedAt: new Date(now).toISOString(),
        expiresAt:
          active === true
            ? new Date(now + Math.max(1500, Number(ttlMs || 9000))).toISOString()
            : null,
      },
    });
  } catch {}
}

export function emitInboundAcceptedRealtime({
  wsHub,
  threadWasCreated = false,
  thread,
  message,
  tenantKey = "",
  tenantId = "",
} = {}) {
  if (!thread?.id || !message?.id) return;

  try {
    emitRealtimeEvent(wsHub, {
      type: threadWasCreated ? "inbox.thread.created" : "inbox.thread.updated",
      audience: "operator",
      tenantKey: thread?.tenant_key || tenantKey,
      tenantId: thread?.tenant_id || tenantId,
      thread,
      reason: "inbound_accepted",
    });
  } catch {}

  try {
    emitRealtimeEvent(wsHub, {
      type: "inbox.message.created",
      audience: "operator",
      tenantKey: message?.tenant_key || thread?.tenant_key || tenantKey,
      tenantId: thread?.tenant_id || tenantId,
      threadId: thread?.id,
      message: {
        ...message,
        meta: {
          ...(message?.meta && typeof message.meta === "object" ? message.meta : {}),
          realtimePhase: "inbound_accepted",
        },
      },
      reason: "inbound_accepted",
    });
  } catch {}
}

export function emitIngestRealtime({
  wsHub,
  threadWasCreated,
  thread,
  message,
  executionResults,
  tenantKey,
  tenantId,
}) {
  try {
    emitRealtimeEvent(wsHub, {
      type: threadWasCreated ? "inbox.thread.created" : "inbox.thread.updated",
      audience: "operator",
      tenantKey: thread?.tenant_key || tenantKey,
      tenantId: thread?.tenant_id || tenantId,
      thread,
    });
  } catch {}

  try {
    emitRealtimeEvent(wsHub, {
      type: "inbox.message.created",
      audience: "operator",
      tenantKey: message?.tenant_key || thread?.tenant_key || tenantKey,
      tenantId: thread?.tenant_id || tenantId,
      threadId: thread?.id,
      message,
    });
  } catch {}

  for (const item of executionResults || []) {
    try {
      if (item?.message) {
        const correlatedMessage = withMessageOutboundAttemptCorrelation(item.message, {
          message_id: item?.message?.id,
          attempt_ids: item?.attempt?.id ? [item.attempt.id] : [],
        });
        emitRealtimeEvent(wsHub, {
          type: "inbox.message.created",
          audience: "operator",
          tenantKey:
            correlatedMessage?.tenant_key || thread?.tenant_key || tenantKey,
          tenantId: thread?.tenant_id || tenantId,
          threadId: thread?.id,
          message: correlatedMessage,
        });
      }
    } catch {}

    try {
      if (item?.attempt) {
        emitRealtimeEvent(wsHub, {
          type: "inbox.outbound.attempt.created",
          audience: "operator",
          tenantKey: item.attempt?.tenant_key || tenantKey,
          tenantId,
          attempt: item.attempt,
        });
      }
    } catch {}
  }
}

export function emitOutboundRealtime({
  wsHub,
  thread,
  message,
  attempt,
  tenantKey,
  tenantId,
}) {
  try {
    const correlatedMessage = withMessageOutboundAttemptCorrelation(message, {
      message_id: message?.id,
      attempt_ids: attempt?.id ? [attempt.id] : [],
    });

    emitRealtimeEvent(wsHub, {
      type: "inbox.message.created",
      audience: "operator",
      tenantKey: correlatedMessage?.tenant_key || tenantKey,
      tenantId,
      threadId: s(thread?.id || ""),
      message: correlatedMessage,
    });
  } catch {}

  try {
    emitRealtimeEvent(wsHub, {
      type: "inbox.thread.updated",
      audience: "operator",
      tenantKey: thread?.tenant_key || tenantKey,
      tenantId: thread?.tenant_id || tenantId,
      thread,
    });
  } catch {}

  try {
    emitRealtimeEvent(wsHub, {
      type: "inbox.outbound.attempt.created",
      audience: "operator",
      tenantKey: attempt?.tenant_key || tenantKey,
      tenantId,
      attempt,
    });
  } catch {}
}
