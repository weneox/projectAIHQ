import { clamp, isDbReady, isUuid, okJson } from "../../../utils/http.js";
import { fixText } from "../../../utils/textFix.js";
import { getAuthTenantKey, getInternalTokenAuthResult } from "../../../utils/auth.js";

import {
  cleanLeadPayload,
  getResolvedTenantKey,
  normalizePriority,
  normalizeStage,
  normalizeStatus,
  num,
  s,
} from "./utils.js";

import {
  appendLeadNote,
  fetchLeadById,
  fetchLeadEvents,
  findActiveLeadByInboxThreadId,
  insertLead,
  listLeads,
  updateLeadById,
  updateLeadFollowup,
  updateLeadFromIngest,
  updateLeadOwner,
  updateLeadStage,
  updateLeadStatus,
} from "./repository.js";

import { broadcastLead, broadcastLeadEvent, createLeadEvent, emitLeadChange, emitLeadCreated } from "./events.js";

function isMissingSchemaError(error) {
  const code = s(error?.code).toUpperCase();
  const message = s(error?.message).toLowerCase();

  if (code === "42P01" || code === "42703") {
    return true;
  }

  return (
    message.includes("does not exist") ||
    message.includes("undefined column") ||
    message.includes("undefined table")
  );
}

export function createLeadHandlers({ db, wsHub }) {
  async function ingestLead(req, res) {
    const internalAuth = getInternalTokenAuthResult(req);
    if (!internalAuth.ok) {
      return res.status(
        internalAuth.code === "internal_token_not_configured" ? 500 : 401
      ).json({
        ok: false,
        error:
          internalAuth.code === "internal_token_not_configured"
            ? "internal_auth_misconfigured"
            : "unauthorized",
      });
    }

    const data = cleanLeadPayload({
      ...req.body,
      source: req.body?.source || "meta",
    });

    try {
      if (!isDbReady(db)) {
        return okJson(res, { ok: false, error: "db disabled", dbDisabled: true });
      }

      if (
        !data.fullName &&
        !data.phone &&
        !data.email &&
        !data.username &&
        !data.inboxThreadId
      ) {
        return okJson(res, {
          ok: false,
          error: "fullName, phone, email, username or inboxThreadId required",
        });
      }

      if (data.inboxThreadId && !isUuid(data.inboxThreadId)) {
        return okJson(res, { ok: false, error: "inboxThreadId must be uuid" });
      }

      if (data.proposalId && !isUuid(data.proposalId)) {
        return okJson(res, { ok: false, error: "proposalId must be uuid" });
      }

      let existing = null;

      if (data.inboxThreadId) {
        existing = await findActiveLeadByInboxThreadId(db, data.tenantKey, data.inboxThreadId);
      }

      if (existing) {
        const before = existing;
        const lead = await updateLeadFromIngest(db, existing.id, data);

        const event = await createLeadEvent(db, {
          leadId: lead?.id,
          tenantKey: data.tenantKey,
          type: "lead.updated",
          actor: "ai_hq",
          payload: {
            mode: "ingest",
            before,
            after: lead,
          },
        });

        await broadcastLead(wsHub, "lead.updated", lead);
        await broadcastLeadEvent(wsHub, event);

        return okJson(res, {
          ok: true,
          mode: "updated",
          lead,
        });
      }

      const lead = await insertLead(db, data);

      await emitLeadCreated({
        db,
        wsHub,
        actor: "ai_hq",
        tenantKey: data.tenantKey,
        lead,
        eventPayload: {
          mode: "ingest",
          lead,
        },
        auditMeta: {
          tenantKey: data.tenantKey,
          inboxThreadId: data.inboxThreadId,
          stage: data.stage,
          status: data.status,
          score: data.score,
          mode: "ingest",
        },
      });

      return okJson(res, { ok: true, mode: "created", lead });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  async function getLeads(req, res) {
    const tenantKey = getResolvedTenantKey(getAuthTenantKey(req));
    const stage = fixText(String(req.query?.stage || "").trim()).toLowerCase();
    const status = fixText(String(req.query?.status || "").trim()).toLowerCase();
    const owner = fixText(String(req.query?.owner || "").trim());
    const priority = fixText(String(req.query?.priority || "").trim()).toLowerCase();
    const q = fixText(String(req.query?.q || "").trim());
    const limit = clamp(Number(req.query?.limit ?? 50), 1, 200);

    try {
      if (!isDbReady(db)) {
        return okJson(res, { ok: true, tenantKey, leads: [], dbDisabled: true });
      }

      const leads = await listLeads(db, {
        tenantKey,
        stage,
        status,
        owner,
        priority,
        q,
        limit,
      });

      return okJson(res, { ok: true, tenantKey, leads });
    } catch (e) {
      if (isMissingSchemaError(e)) {
        return okJson(res, {
          ok: true,
          tenantKey,
          leads: [],
          degraded: true,
          reasonCode: "leads_schema_unavailable",
        });
      }

      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  async function getLeadById(req, res) {
    const id = String(req.params.id || "").trim();
    const tenantKey = getResolvedTenantKey(getAuthTenantKey(req));
    if (!id) return okJson(res, { ok: false, error: "lead id required" });

    try {
      if (!isDbReady(db)) {
        return okJson(res, { ok: true, lead: null, dbDisabled: true });
      }

      if (!isUuid(id)) {
        return okJson(res, { ok: false, error: "lead id must be uuid" });
      }

      const lead = await fetchLeadById(db, id);
      if (lead && tenantKey && getResolvedTenantKey(lead.tenant_key) !== tenantKey) {
        return okJson(res, { ok: false, error: "not found" });
      }
      return okJson(res, { ok: true, lead });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  async function getLeadByInboxThreadId(req, res) {
    const inboxThreadId = String(req.params.threadId || "").trim();
    const tenantKey = getResolvedTenantKey(getAuthTenantKey(req));
    if (!inboxThreadId) {
      return okJson(res, { ok: false, error: "thread id required" });
    }

    try {
      if (!isDbReady(db)) {
        return okJson(res, { ok: true, lead: null, dbDisabled: true });
      }

      if (!isUuid(inboxThreadId)) {
        return okJson(res, { ok: false, error: "thread id must be uuid" });
      }

      const lead = await findActiveLeadByInboxThreadId(db, tenantKey, inboxThreadId);
      return okJson(res, { ok: true, lead });
    } catch (e) {
      if (isMissingSchemaError(e)) {
        return okJson(res, {
          ok: true,
          tenantKey,
          leads: [],
          degraded: true,
          reasonCode: "leads_schema_unavailable",
        });
      }

      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  async function getLeadEvents(req, res) {
    const id = String(req.params.id || "").trim();
    const tenantKey = getResolvedTenantKey(getAuthTenantKey(req));
    const limit = clamp(Number(req.query?.limit ?? 100), 1, 500);

    if (!id) return okJson(res, { ok: false, error: "lead id required" });

    try {
      if (!isDbReady(db)) {
        return okJson(res, { ok: true, events: [], dbDisabled: true });
      }

      if (!isUuid(id)) {
        return okJson(res, { ok: false, error: "lead id must be uuid" });
      }

      const lead = await fetchLeadById(db, id);
      if (!lead || (tenantKey && getResolvedTenantKey(lead.tenant_key) !== tenantKey)) {
        return okJson(res, { ok: false, error: "not found" });
      }

      const events = await fetchLeadEvents(db, id, limit);
      return okJson(res, { ok: true, leadId: id, events });
    } catch (e) {
      if (isMissingSchemaError(e)) {
        return okJson(res, {
          ok: true,
          leadId: id,
          events: [],
          degraded: true,
          reasonCode: "lead_events_schema_unavailable",
        });
      }

      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  async function createLead(req, res) {
    const data = cleanLeadPayload(req.body);

    try {
      if (!isDbReady(db)) {
        return okJson(res, { ok: false, error: "db disabled", dbDisabled: true });
      }

      if (!data.fullName && !data.phone && !data.email && !data.username) {
        return okJson(res, {
          ok: false,
          error: "fullName, phone, email or username required",
        });
      }

      if (data.inboxThreadId && !isUuid(data.inboxThreadId)) {
        return okJson(res, { ok: false, error: "inboxThreadId must be uuid" });
      }

      if (data.proposalId && !isUuid(data.proposalId)) {
        return okJson(res, { ok: false, error: "proposalId must be uuid" });
      }

      const lead = await insertLead(db, data);

      await emitLeadCreated({
        db,
        wsHub,
        actor: "ai_hq",
        tenantKey: data.tenantKey,
        lead,
        eventPayload: {
          mode: "manual_create",
          lead,
        },
        auditMeta: {
          tenantKey: data.tenantKey,
          stage: data.stage,
          status: data.status,
          score: data.score,
          mode: "manual_create",
        },
      });

      return okJson(res, { ok: true, lead });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  async function updateLead(req, res) {
    const id = String(req.params.id || "").trim();
    if (!id) return okJson(res, { ok: false, error: "lead id required" });

    try {
      if (!isDbReady(db)) {
        return okJson(res, { ok: false, error: "db disabled", dbDisabled: true });
      }

      if (!isUuid(id)) {
        return okJson(res, { ok: false, error: "lead id must be uuid" });
      }

      const before = await fetchLeadById(db, id);
      if (!before) return okJson(res, { ok: false, error: "not found" });

      const fields = [];
      const values = [];
      let n = 1;

      if (req.body?.fullName !== undefined) {
        fields.push(`full_name = $${n++}::text`);
        values.push(fixText(String(req.body.fullName || "").trim()));
      }

      if (req.body?.username !== undefined) {
        fields.push(`username = $${n++}::text`);
        values.push(fixText(String(req.body.username || "").trim()) || null);
      }

      if (req.body?.company !== undefined) {
        fields.push(`company = $${n++}::text`);
        values.push(fixText(String(req.body.company || "").trim()) || null);
      }

      if (req.body?.phone !== undefined) {
        fields.push(`phone = $${n++}::text`);
        values.push(fixText(String(req.body.phone || "").trim()) || null);
      }

      if (req.body?.email !== undefined) {
        fields.push(`email = $${n++}::text`);
        values.push(fixText(String(req.body.email || "").trim()) || null);
      }

      if (req.body?.interest !== undefined) {
        fields.push(`interest = $${n++}::text`);
        values.push(fixText(String(req.body.interest || "").trim()) || null);
      }

      if (req.body?.notes !== undefined) {
        fields.push(`notes = $${n++}::text`);
        values.push(fixText(String(req.body.notes || "").trim()));
      }

      if (req.body?.stage !== undefined) {
        fields.push(`stage = $${n++}::text`);
        values.push(normalizeStage(req.body.stage || "new"));
      }

      if (req.body?.score !== undefined) {
        fields.push(`score = $${n++}::int`);
        values.push(num(req.body.score, 0));
      }

      if (req.body?.status !== undefined) {
        fields.push(`status = $${n++}::text`);
        values.push(normalizeStatus(req.body.status || "open"));
      }

      if (req.body?.owner !== undefined) {
        fields.push(`owner = $${n++}::text`);
        values.push(fixText(String(req.body.owner || "").trim()) || null);
      }

      if (req.body?.priority !== undefined) {
        fields.push(`priority = $${n++}::text`);
        values.push(normalizePriority(req.body.priority || "normal"));
      }

      if (req.body?.valueAzn !== undefined || req.body?.value_azn !== undefined) {
        fields.push(`value_azn = $${n++}::numeric(12,2)`);
        values.push(num(req.body.valueAzn ?? req.body.value_azn, 0));
      }

      if (req.body?.followUpAt !== undefined || req.body?.follow_up_at !== undefined) {
        fields.push(`follow_up_at = $${n++}::timestamptz`);
        values.push(s(req.body.followUpAt || req.body.follow_up_at || "") || null);
      }

      if (req.body?.nextAction !== undefined || req.body?.next_action !== undefined) {
        fields.push(`next_action = $${n++}::text`);
        values.push(
          fixText(String(req.body.nextAction || req.body.next_action || "").trim()) || null
        );
      }

      if (req.body?.wonReason !== undefined || req.body?.won_reason !== undefined) {
        fields.push(`won_reason = $${n++}::text`);
        values.push(
          fixText(String(req.body.wonReason || req.body.won_reason || "").trim()) || null
        );
      }

      if (req.body?.lostReason !== undefined || req.body?.lost_reason !== undefined) {
        fields.push(`lost_reason = $${n++}::text`);
        values.push(
          fixText(String(req.body.lostReason || req.body.lost_reason || "").trim()) || null
        );
      }

      if (req.body?.extra !== undefined) {
        fields.push(`extra = $${n++}::jsonb`);
        values.push(
          JSON.stringify(
            req.body.extra && typeof req.body.extra === "object" ? req.body.extra : {}
          )
        );
      }

      if (!fields.length) {
        return okJson(res, { ok: false, error: "no fields to update" });
      }

      values.push(id);

      const lead = await updateLeadById(db, id, fields, values, n);
      if (!lead) return okJson(res, { ok: false, error: "not found" });

      const event = await emitLeadChange({
        db,
        wsHub,
        eventType: "lead.updated",
        auditAction: "lead.updated",
        actor: "ai_hq",
        tenantKey: lead?.tenant_key,
        lead,
        eventPayload: {
          mode: "manual_update",
          before,
          after: lead,
        },
        auditMeta: {
          tenantKey: lead?.tenant_key,
          stage: lead?.stage,
          status: lead?.status,
          score: lead?.score,
          priority: lead?.priority,
          owner: lead?.owner,
          mode: "manual_update",
        },
      });

      return okJson(res, { ok: true, lead, event });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  async function updateLeadStageHandler(req, res) {
    const id = String(req.params.id || "").trim();
    const actor = fixText(s(req.body?.actor || "operator")) || "operator";
    const stage = normalizeStage(req.body?.stage || "new");
    const reason = fixText(s(req.body?.reason || "")) || null;

    if (!id) return okJson(res, { ok: false, error: "lead id required" });

    try {
      if (!isDbReady(db)) return okJson(res, { ok: false, error: "db disabled", dbDisabled: true });
      if (!isUuid(id)) return okJson(res, { ok: false, error: "lead id must be uuid" });

      const before = await fetchLeadById(db, id);
      if (!before) return okJson(res, { ok: false, error: "not found" });

      const lead = await updateLeadStage(db, id, stage);

      const event = await emitLeadChange({
        db,
        wsHub,
        eventType: "lead.stage_changed",
        auditAction: "lead.stage_changed",
        actor,
        tenantKey: lead?.tenant_key || before?.tenant_key,
        lead,
        eventPayload: {
          from: before?.stage || null,
          to: lead?.stage || stage,
          reason,
        },
        auditMeta: {
          tenantKey: lead?.tenant_key || before?.tenant_key,
          from: before?.stage || null,
          to: lead?.stage || stage,
          reason,
        },
      });

      return okJson(res, { ok: true, lead, event });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  async function updateLeadStatusHandler(req, res) {
    const id = String(req.params.id || "").trim();
    const actor = fixText(s(req.body?.actor || "operator")) || "operator";
    const status = normalizeStatus(req.body?.status || "open");
    const reason = fixText(s(req.body?.reason || "")) || null;

    if (!id) return okJson(res, { ok: false, error: "lead id required" });

    try {
      if (!isDbReady(db)) return okJson(res, { ok: false, error: "db disabled", dbDisabled: true });
      if (!isUuid(id)) return okJson(res, { ok: false, error: "lead id must be uuid" });

      const before = await fetchLeadById(db, id);
      if (!before) return okJson(res, { ok: false, error: "not found" });

      const lead = await updateLeadStatus(db, id, status);

      const event = await emitLeadChange({
        db,
        wsHub,
        eventType: "lead.status_changed",
        auditAction: "lead.status_changed",
        actor,
        tenantKey: lead?.tenant_key || before?.tenant_key,
        lead,
        eventPayload: {
          from: before?.status || null,
          to: lead?.status || status,
          reason,
        },
        auditMeta: {
          tenantKey: lead?.tenant_key || before?.tenant_key,
          from: before?.status || null,
          to: lead?.status || status,
          reason,
        },
      });

      return okJson(res, { ok: true, lead, event });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  async function updateLeadOwnerHandler(req, res) {
    const id = String(req.params.id || "").trim();
    const actor = fixText(s(req.body?.actor || "operator")) || "operator";
    const owner = fixText(s(req.body?.owner || "")) || null;

    if (!id) return okJson(res, { ok: false, error: "lead id required" });

    try {
      if (!isDbReady(db)) return okJson(res, { ok: false, error: "db disabled", dbDisabled: true });
      if (!isUuid(id)) return okJson(res, { ok: false, error: "lead id must be uuid" });

      const before = await fetchLeadById(db, id);
      if (!before) return okJson(res, { ok: false, error: "not found" });

      const lead = await updateLeadOwner(db, id, owner);

      const event = await emitLeadChange({
        db,
        wsHub,
        eventType: "lead.owner_changed",
        auditAction: "lead.owner_changed",
        actor,
        tenantKey: lead?.tenant_key || before?.tenant_key,
        lead,
        eventPayload: {
          from: before?.owner || null,
          to: lead?.owner || null,
        },
        auditMeta: {
          tenantKey: lead?.tenant_key || before?.tenant_key,
          from: before?.owner || null,
          to: lead?.owner || null,
        },
      });

      return okJson(res, { ok: true, lead, event });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  async function updateLeadFollowupHandler(req, res) {
    const id = String(req.params.id || "").trim();
    const actor = fixText(s(req.body?.actor || "operator")) || "operator";
    const followUpAt = s(req.body?.followUpAt || req.body?.follow_up_at || "") || null;
    const nextAction = fixText(s(req.body?.nextAction || req.body?.next_action || "")) || null;

    if (!id) return okJson(res, { ok: false, error: "lead id required" });

    try {
      if (!isDbReady(db)) return okJson(res, { ok: false, error: "db disabled", dbDisabled: true });
      if (!isUuid(id)) return okJson(res, { ok: false, error: "lead id must be uuid" });

      const before = await fetchLeadById(db, id);
      if (!before) return okJson(res, { ok: false, error: "not found" });

      const lead = await updateLeadFollowup(db, id, followUpAt, nextAction);

      const event = await emitLeadChange({
        db,
        wsHub,
        eventType: "lead.followup_set",
        auditAction: "lead.followup_set",
        actor,
        tenantKey: lead?.tenant_key || before?.tenant_key,
        lead,
        eventPayload: {
          fromFollowUpAt: before?.follow_up_at || null,
          toFollowUpAt: lead?.follow_up_at || null,
          fromNextAction: before?.next_action || null,
          toNextAction: lead?.next_action || null,
        },
        auditMeta: {
          tenantKey: lead?.tenant_key || before?.tenant_key,
          followUpAt: lead?.follow_up_at || null,
          nextAction: lead?.next_action || null,
        },
      });

      return okJson(res, { ok: true, lead, event });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  async function appendLeadNoteHandler(req, res) {
    const id = String(req.params.id || "").trim();
    const actor = fixText(s(req.body?.actor || "operator")) || "operator";
    const note = fixText(s(req.body?.note || req.body?.notes || ""));

    if (!id) return okJson(res, { ok: false, error: "lead id required" });
    if (!note) return okJson(res, { ok: false, error: "note required" });

    try {
      if (!isDbReady(db)) return okJson(res, { ok: false, error: "db disabled", dbDisabled: true });
      if (!isUuid(id)) return okJson(res, { ok: false, error: "lead id must be uuid" });

      const before = await fetchLeadById(db, id);
      if (!before) return okJson(res, { ok: false, error: "not found" });

      const lead = await appendLeadNote(db, id, note);

      const event = await emitLeadChange({
        db,
        wsHub,
        eventType: "lead.note_added",
        auditAction: "lead.note_added",
        actor,
        tenantKey: lead?.tenant_key || before?.tenant_key,
        lead,
        eventPayload: {
          note,
        },
        auditMeta: {
          tenantKey: lead?.tenant_key || before?.tenant_key,
          notePreview: note.slice(0, 200),
        },
      });

      return okJson(res, { ok: true, lead, event });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  return {
    ingestLead,
    getLeads,
    getLeadById,
    getLeadByInboxThreadId,
    getLeadEvents,
    createLead,
    updateLead,
    updateLeadStageHandler,
    updateLeadStatusHandler,
    updateLeadOwnerHandler,
    updateLeadFollowupHandler,
    appendLeadNoteHandler,
  };
}
