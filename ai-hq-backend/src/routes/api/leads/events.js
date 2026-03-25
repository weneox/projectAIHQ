import { isUuid } from "../../../utils/http.js";
import { fixText } from "../../../utils/textFix.js";
import { writeAudit } from "../../../utils/auditLog.js";
import { emitRealtimeEvent } from "../../../realtime/events.js";
import { getResolvedTenantKey, s } from "./utils.js";
import { insertLeadEvent } from "./repository.js";

export async function createLeadEvent(db, { leadId, tenantKey, type, actor = "ai_hq", payload = {} }) {
  if (!leadId || !isUuid(leadId) || !type) return null;

  return insertLeadEvent(db, {
    leadId,
    tenantKey: getResolvedTenantKey(tenantKey),
    type: fixText(s(type)),
    actor: fixText(s(actor || "ai_hq")) || "ai_hq",
    payload,
  });
}

export async function broadcastLead(wsHub, type, lead) {
  try {
    emitRealtimeEvent(wsHub, {
      type,
      audience: "operator",
      tenantKey: lead?.tenant_key || lead?.tenantKey,
      tenantId: lead?.tenant_id || lead?.tenantId,
      lead,
    });
  } catch {}
}

export async function broadcastLeadEvent(wsHub, event) {
  try {
    emitRealtimeEvent(wsHub, {
      type: "lead.event.created",
      audience: "operator",
      tenantKey: event?.tenant_key || event?.tenantKey,
      event,
    });
  } catch {}
}

export async function emitLeadChange({
  db,
  wsHub,
  eventType,
  auditAction,
  actor = "ai_hq",
  tenantKey,
  lead,
  eventPayload = {},
  auditMeta = {},
}) {
  const event = await createLeadEvent(db, {
    leadId: lead?.id,
    tenantKey: tenantKey || lead?.tenant_key,
    type: eventType,
    actor,
    payload: eventPayload,
  });

  await broadcastLead(wsHub, "lead.updated", lead);
  await broadcastLeadEvent(wsHub, event);

  try {
    await writeAudit(db, {
      actor,
      action: auditAction,
      objectType: "lead",
      objectId: String(lead?.id || ""),
      meta: auditMeta,
    });
  } catch {}

  return event;
}

export async function emitLeadCreated({
  db,
  wsHub,
  actor = "ai_hq",
  tenantKey,
  lead,
  eventPayload = {},
  auditMeta = {},
}) {
  const event = await createLeadEvent(db, {
    leadId: lead?.id,
    tenantKey: tenantKey || lead?.tenant_key,
    type: "lead.created",
    actor,
    payload: eventPayload,
  });

  await broadcastLead(wsHub, "lead.created", lead);
  await broadcastLeadEvent(wsHub, event);

  try {
    await writeAudit(db, {
      actor,
      action: "lead.created",
      objectType: "lead",
      objectId: String(lead?.id || ""),
      meta: auditMeta,
    });
  } catch {}

  return event;
}
