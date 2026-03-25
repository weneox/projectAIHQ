// src/routes/api/inbox/mutations.js
// FINAL v1.1 — inbox mutation layer
// canonical tenant-aware lead + handoff persistence

import { isUuid } from "../../../utils/http.js";
import { fixText } from "../../../utils/textFix.js";
import { writeAudit } from "../../../utils/auditLog.js";
import { emitRealtimeEvent } from "../../../realtime/events.js";
import { normalizeLead, normalizeThread, s } from "./shared.js";

function pickDb(db, client) {
  return client || db;
}

function asObj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    const x = fixText(s(v || ""));
    if (x) return x;
  }
  return "";
}

function normalizeLeadStage(v) {
  const x = s(v).toLowerCase();
  if (["new", "contacted", "qualified", "proposal", "won", "lost"].includes(x)) {
    return x;
  }
  return "new";
}

function normalizeLeadStatus(v) {
  const x = s(v).toLowerCase();
  if (["open", "archived", "spam", "closed"].includes(x)) return x;
  return "open";
}

function normalizePriority(v) {
  const x = s(v).toLowerCase();
  if (["low", "normal", "high", "urgent"].includes(x)) return x;
  return "normal";
}

function normalizeChannel(v) {
  const x = s(v).toLowerCase();
  if (["instagram", "facebook", "whatsapp", "web", "email", "other"].includes(x)) {
    return x;
  }
  return x || "instagram";
}

async function queryOne(q, text, params = []) {
  try {
    const r = await q.query(text, params);
    return r.rows?.[0] || null;
  } catch {
    return null;
  }
}

async function getThreadLeadFallback(q, threadId) {
  if (!threadId || !isUuid(threadId)) {
    return {
      tenantId: "",
      tenantKey: "",
      customerName: "",
      externalUsername: "",
      externalUserId: "",
      channel: "",
    };
  }

  const row = await queryOne(
    q,
    `
    select
      tenant_id,
      tenant_key,
      customer_name,
      external_username,
      external_user_id,
      channel
    from inbox_threads
    where id = $1::uuid
    limit 1
    `,
    [threadId]
  );

  return {
    tenantId: s(row?.tenant_id || ""),
    tenantKey: fixText(s(row?.tenant_key || "")),
    customerName: fixText(s(row?.customer_name || "")),
    externalUsername: fixText(s(row?.external_username || "")),
    externalUserId: fixText(s(row?.external_user_id || "")),
    channel: normalizeChannel(row?.channel || ""),
  };
}

async function resolveTenantScope(q, { tenantId = "", tenantKey = "", threadId = "" } = {}) {
  const threadFallback = await getThreadLeadFallback(q, threadId);

  const requestedTenantId = s(tenantId || "");
  const requestedTenantKey =
    fixText(s(tenantKey || "")) || fixText(s(threadFallback.tenantKey || ""));

  if (requestedTenantId && isUuid(requestedTenantId)) {
    const byId = await queryOne(
      q,
      `
      select id, tenant_key, company_name, timezone
      from tenants
      where id = $1::uuid
      limit 1
      `,
      [requestedTenantId]
    );

    if (byId) {
      return {
        tenantId: s(byId.id),
        tenantKey: fixText(s(byId.tenant_key || requestedTenantKey)),
        companyName: fixText(s(byId.company_name || "")),
        timezone: fixText(s(byId.timezone || "")),
        threadFallback,
      };
    }
  }

  if (requestedTenantKey) {
    const byKey = await queryOne(
      q,
      `
      select id, tenant_key, company_name, timezone
      from tenants
      where tenant_key = $1::text
      limit 1
      `,
      [requestedTenantKey]
    );

    if (byKey) {
      return {
        tenantId: s(byKey.id),
        tenantKey: fixText(s(byKey.tenant_key || requestedTenantKey)),
        companyName: fixText(s(byKey.company_name || "")),
        timezone: fixText(s(byKey.timezone || "")),
        threadFallback,
      };
    }
  }

  return {
    tenantId: requestedTenantId || s(threadFallback.tenantId || ""),
    tenantKey: requestedTenantKey,
    companyName: "",
    timezone: "",
    threadFallback,
  };
}

async function createLeadEvent(
  q,
  {
    leadId,
    tenantId = null,
    tenantKey = "",
    type,
    actor = "ai_hq",
    payload = {},
  }
) {
  if (!leadId || !isUuid(leadId)) return;

  try {
    await q.query(
      `
      insert into lead_events (
        lead_id,
        tenant_id,
        tenant_key,
        type,
        actor,
        payload
      )
      values (
        $1::uuid,
        nullif($2::text, '')::uuid,
        $3::text,
        $4::text,
        $5::text,
        $6::jsonb
      )
      `,
      [
        leadId,
        s(tenantId || "") || null,
        fixText(s(tenantKey || "")),
        s(type || "updated") || "updated",
        fixText(s(actor || "ai_hq")) || "ai_hq",
        JSON.stringify(asObj(payload)),
      ]
    );
  } catch {}
}

export async function persistLeadActions({ db, client = null, wsHub, tenantKey, actions }) {
  const q = pickDb(db, client);
  const list = Array.isArray(actions) ? actions : [];
  const persisted = [];

  for (const action of list) {
    const type = s(action?.type).toLowerCase();
    if (type !== "create_lead") continue;

    const lead = asObj(action?.lead);
    const meta = asObj(action?.meta);

    const inboxThreadId = s(lead?.threadId || action?.threadId || meta?.threadId || "") || null;
    const proposalId = s(lead?.proposalId || meta?.proposalId || "") || null;

    if (!inboxThreadId || !isUuid(inboxThreadId)) continue;
    if (proposalId && !isUuid(proposalId)) continue;

    const tenantScope = await resolveTenantScope(q, {
      tenantId: s(meta?.tenantId || lead?.tenantId || ""),
      tenantKey:
        fixText(s(tenantKey || "")) ||
        fixText(s(meta?.tenantKey || "")) ||
        fixText(s(lead?.tenantKey || "")),
      threadId: inboxThreadId,
    });

    const threadFallback = tenantScope.threadFallback || {
      tenantId: "",
      tenantKey: "",
      customerName: "",
      externalUsername: "",
      externalUserId: "",
      channel: "",
    };

    const resolvedTenantKey = fixText(s(tenantScope.tenantKey || ""));
    const tenantId = s(tenantScope.tenantId || "");

    if (!resolvedTenantKey) continue;

    const source = fixText(s(lead?.source || "meta")) || "meta";
    const sourceRef =
      fixText(
        s(
          lead?.sourceRef ||
            lead?.externalUserId ||
            meta?.externalUserId ||
            threadFallback.externalUserId ||
            ""
        )
      ) || null;

    const username =
      firstNonEmpty(
        lead?.username,
        meta?.username,
        threadFallback.externalUsername
      ) || null;

    const externalUserId =
      firstNonEmpty(
        lead?.externalUserId,
        action?.externalUserId,
        meta?.externalUserId,
        threadFallback.externalUserId
      ) || null;

    const fullName =
      firstNonEmpty(
        lead?.fullName,
        lead?.name,
        meta?.customerName,
        meta?.fullName,
        threadFallback.customerName,
        username,
        externalUserId
      ) || "Inbox Lead";

    const company =
      fixText(s(lead?.company || meta?.company || tenantScope.companyName || "")) || null;

    const phone = fixText(s(lead?.phone || meta?.phone || "")) || null;
    const email = fixText(s(lead?.email || meta?.email || "")) || null;
    const interest = fixText(s(lead?.intent || meta?.intent || "")) || null;
    const notes = fixText(s(lead?.summary || lead?.notes || meta?.notes || "")) || "";

    const stage = normalizeLeadStage(lead?.stage || meta?.stage || "new");
    const score = Math.max(
      0,
      Math.round(
        Number.isFinite(Number(meta?.score))
          ? Number(meta.score)
          : Number.isFinite(Number(lead?.score))
            ? Number(lead.score)
            : 0
      )
    );
    const status = normalizeLeadStatus(lead?.status || meta?.status || "open");
    const priority = normalizePriority(lead?.priority || meta?.priority || "normal");
    const channel = normalizeChannel(
      action?.channel || lead?.channel || threadFallback.channel || ""
    );

    const extra = {
      ...(asObj(lead?.extra)),
      actionMeta: meta,
      channel,
      source,
      sourceRef: sourceRef || "",
      externalUserId: externalUserId || "",
      leadResolvedFullName: fullName,
      leadResolvedUsername: username || "",
      leadResolvedFromThread: Boolean(
        threadFallback.customerName || threadFallback.externalUsername
      ),
      tenantCompanyName: tenantScope.companyName || "",
      tenantTimezone: tenantScope.timezone || "",
      sourceActionType: type,
    };

    const found = await q.query(
      `
      select
        id,
        tenant_id,
        tenant_key,
        source,
        source_ref,
        inbox_thread_id,
        proposal_id,
        full_name,
        username,
        company,
        phone,
        email,
        interest,
        notes,
        stage,
        score,
        status,
        owner,
        priority,
        value_azn,
        follow_up_at,
        next_action,
        won_reason,
        lost_reason,
        extra,
        created_at,
        updated_at
      from leads
      where tenant_key = $1::text
        and inbox_thread_id = $2::uuid
        and status <> 'closed'
      order by updated_at desc, created_at desc
      limit 1
      `,
      [resolvedTenantKey, inboxThreadId]
    );

    const existing = found.rows?.[0] || null;

    if (existing) {
      const updated = await q.query(
        `
        update leads
        set
          tenant_id = coalesce(nullif($2::text, '')::uuid, tenant_id),
          source_ref = coalesce($3::text, source_ref),
          proposal_id = coalesce($4::uuid, proposal_id),
          full_name = coalesce(nullif($5::text, ''), full_name),
          username = coalesce(nullif($6::text, ''), username),
          company = coalesce(nullif($7::text, ''), company),
          phone = coalesce(nullif($8::text, ''), phone),
          email = coalesce(nullif($9::text, ''), email),
          interest = coalesce(nullif($10::text, ''), interest),
          notes = case
            when nullif($11::text, '') is null then notes
            when coalesce(notes, '') = '' then $11::text
            else concat(notes, E'\n\n', $11::text)
          end,
          stage = coalesce(nullif($12::text, ''), stage),
          score = greatest(coalesce(score, 0), $13::int),
          status = coalesce(nullif($14::text, ''), status),
          priority = coalesce(nullif($15::text, ''), priority),
          extra = coalesce(extra, '{}'::jsonb) || $16::jsonb,
          updated_at = now()
        where id = $1::uuid
        returning
          id,
          tenant_id,
          tenant_key,
          source,
          source_ref,
          inbox_thread_id,
          proposal_id,
          full_name,
          username,
          company,
          phone,
          email,
          interest,
          notes,
          stage,
          score,
          status,
          owner,
          priority,
          value_azn,
          follow_up_at,
          next_action,
          won_reason,
          lost_reason,
          extra,
          created_at,
          updated_at
        `,
        [
          existing.id,
          tenantId || null,
          sourceRef,
          proposalId || null,
          fullName || "",
          username || "",
          company || "",
          phone || "",
          email || "",
          interest || "",
          notes || "",
          stage,
          score,
          status,
          priority,
          JSON.stringify(extra),
        ]
      );

      const savedLead = normalizeLead(updated.rows?.[0] || null);

      await createLeadEvent(q, {
        leadId: savedLead?.id,
        tenantId: savedLead?.tenant_id || tenantId || null,
        tenantKey: savedLead?.tenant_key || resolvedTenantKey,
        type: "updated",
        actor: fixText(s(meta?.actor || "ai_hq")) || "ai_hq",
        payload: {
          source,
          sourceRef: sourceRef || "",
          score,
          status,
          stage,
          priority,
          inboxThreadId,
          proposalId: proposalId || "",
          channel,
        },
      });

      try {
        emitRealtimeEvent(wsHub, {
          type: "lead.updated",
          audience: "operator",
          tenantKey: savedLead?.tenant_key || savedLead?.tenantKey,
          tenantId: savedLead?.tenant_id || savedLead?.tenantId,
          lead: savedLead,
        });
      } catch {}

      try {
        await writeAudit(q, {
          actor: fixText(s(meta?.actor || "ai_hq")) || "ai_hq",
          action: "lead.updated",
          objectType: "lead",
          objectId: String(savedLead?.id || ""),
          meta: {
            tenantKey: resolvedTenantKey,
            inboxThreadId,
            source,
            score,
            status,
            stage,
            priority,
            channel,
          },
        });
      } catch {}

      persisted.push({
        mode: "updated",
        lead: savedLead,
      });

      continue;
    }

    const inserted = await q.query(
      `
      insert into leads (
        tenant_id,
        tenant_key,
        source,
        source_ref,
        inbox_thread_id,
        proposal_id,
        full_name,
        username,
        company,
        phone,
        email,
        interest,
        notes,
        stage,
        score,
        status,
        priority,
        extra
      )
      values (
        nullif($1::text, '')::uuid,
        $2::text,
        $3::text,
        $4::text,
        $5::uuid,
        $6::uuid,
        $7::text,
        $8::text,
        $9::text,
        $10::text,
        $11::text,
        $12::text,
        $13::text,
        $14::text,
        $15::int,
        $16::text,
        $17::text,
        $18::jsonb
      )
      returning
        id,
        tenant_id,
        tenant_key,
        source,
        source_ref,
        inbox_thread_id,
        proposal_id,
        full_name,
        username,
        company,
        phone,
        email,
        interest,
        notes,
        stage,
        score,
        status,
        owner,
        priority,
        value_azn,
        follow_up_at,
        next_action,
        won_reason,
        lost_reason,
        extra,
        created_at,
        updated_at
      `,
      [
        tenantId || null,
        resolvedTenantKey,
        source,
        sourceRef,
        inboxThreadId,
        proposalId || null,
        fullName,
        username,
        company,
        phone,
        email,
        interest,
        notes,
        stage,
        score,
        status,
        priority,
        JSON.stringify(extra),
      ]
    );

    const savedLead = normalizeLead(inserted.rows?.[0] || null);

    await createLeadEvent(q, {
      leadId: savedLead?.id,
      tenantId: savedLead?.tenant_id || tenantId || null,
      tenantKey: savedLead?.tenant_key || resolvedTenantKey,
      type: "created",
      actor: fixText(s(meta?.actor || "ai_hq")) || "ai_hq",
      payload: {
        source,
        sourceRef: sourceRef || "",
        score,
        status,
        stage,
        priority,
        inboxThreadId,
        proposalId: proposalId || "",
        channel,
      },
    });

    try {
      emitRealtimeEvent(wsHub, {
        type: "lead.created",
        audience: "operator",
        tenantKey: savedLead?.tenant_key || savedLead?.tenantKey,
        tenantId: savedLead?.tenant_id || savedLead?.tenantId,
        lead: savedLead,
      });
    } catch {}

    try {
      await writeAudit(q, {
        actor: fixText(s(meta?.actor || "ai_hq")) || "ai_hq",
        action: "lead.created",
        objectType: "lead",
        objectId: String(savedLead?.id || ""),
        meta: {
          tenantKey: resolvedTenantKey,
          inboxThreadId,
          source,
          score,
          status,
          stage,
          priority,
          channel,
        },
      });
    } catch {}

    persisted.push({
      mode: "created",
      lead: savedLead,
    });
  }

  return persisted;
}

export async function applyHandoffActions({ db, client = null, wsHub, threadId, actions }) {
  const q = pickDb(db, client);
  const list = Array.isArray(actions) ? actions : [];
  const handoffs = list.filter((x) => s(x?.type).toLowerCase() === "handoff");

  if (!handoffs.length || !threadId || !isUuid(threadId)) return [];

  const results = [];

  for (const action of handoffs) {
    const meta = asObj(action?.meta);
    const reason = fixText(s(action?.reason || "manual_review")) || "manual_review";
    const priority = normalizePriority(action?.priority || "normal");
    const actor = fixText(s(meta?.actor || meta?.handoffBy || "ai_hq")) || "ai_hq";

    const updated = await q.query(
      `
      update inbox_threads
      set
        status = 'open',
        assigned_to = case
          when assigned_to is null or assigned_to = '' then 'human_handoff'
          else assigned_to
        end,
        labels = (
          select coalesce(jsonb_agg(distinct v), '[]'::jsonb)
          from jsonb_array_elements_text(
            coalesce(labels, '[]'::jsonb) || to_jsonb(array['handoff', $2::text]::text[])
          ) as t(v)
        ),
        handoff_active = true,
        handoff_reason = $3::text,
        handoff_priority = $2::text,
        handoff_at = now(),
        handoff_by = $4::text,
        meta = coalesce(meta, '{}'::jsonb) || $5::jsonb,
        updated_at = now()
      where id = $1::uuid
      returning
        id,
        tenant_id,
        tenant_key,
        channel,
        external_thread_id,
        external_user_id,
        external_username,
        customer_name,
        status,
        last_message_at,
        last_inbound_at,
        last_outbound_at,
        unread_count,
        assigned_to,
        labels,
        meta,
        handoff_active,
        handoff_reason,
        handoff_priority,
        handoff_at,
        handoff_by,
        created_at,
        updated_at
      `,
      [
        threadId,
        priority,
        reason,
        actor,
        JSON.stringify({
          handoff: {
            active: true,
            reason,
            priority,
            at: new Date().toISOString(),
            by: actor,
            meta,
          },
        }),
      ]
    );

    const thread = normalizeThread(updated.rows?.[0] || null);

    if (thread) {
      try {
        emitRealtimeEvent(wsHub, {
          type: "inbox.thread.updated",
          audience: "operator",
          tenantKey: thread?.tenant_key || thread?.tenantKey,
          tenantId: thread?.tenant_id || thread?.tenantId,
          thread,
        });
      } catch {}

      try {
        await writeAudit(q, {
          actor,
          action: "inbox.handoff.applied",
          objectType: "inbox_thread",
          objectId: String(thread?.id || ""),
          meta: {
            tenantKey: s(thread?.tenant_key || ""),
            reason,
            priority,
          },
        });
      } catch {}
    }

    results.push({
      reason,
      priority,
      thread,
    });
  }

  return results;
}
