import { deepFix, fixText } from "../../../utils/textFix.js";

import { dbGetProposalById } from "../../../db/helpers/proposals.js";
import { dbCreateJob } from "../../../db/helpers/jobs.js";
import { dbCreateNotification } from "../../../db/helpers/notifications.js";
import { dbAudit } from "../../../db/helpers/audit.js";
import {
  dbGetLatestDraftLikeByProposal,
  dbGetLatestApprovedDraftByProposal,
} from "../../../db/helpers/content.js";

export async function listDbProposalRows(
  db,
  { tenantId = null, tenantKey = "", limit = 50, includePack = false } = {}
) {
  const filters = [];
  const params = [];

  if (tenantId) {
    params.push(tenantId);
    filters.push(`p.tenant_id = $${params.length}::uuid`);
  } else if (String(tenantKey || "").trim()) {
    params.push(String(tenantKey || "").trim());
    filters.push(`lower(p.tenant_key) = lower($${params.length}::text)`);
  }

  const whereSql = filters.length ? `where ${filters.join(" and ")}` : "";
  const q = await db.query(
    `
    select
      p.tenant_id,
      p.tenant_key,
      p.id,
      p.thread_id,
      p.agent,
      p.type,
      p.status,
      p.title,
      p.payload,
      p.created_at,
      p.decided_at,
      p.decision_by,
      c.id as content_id,
      c.status as content_status,
      c.updated_at as content_updated_at,
      c.last_feedback as content_last_feedback,
      c.publish as content_publish,
      ${includePack ? "c.content_pack as content_pack," : ""}
      1 as _dummy
    from proposals p
    left join lateral (
      select
        id,
        status,
        content_pack,
        publish,
        last_feedback,
        updated_at,
        created_at
      from content_items
      where proposal_id = p.id
      order by updated_at desc nulls last, created_at desc
      limit 1
    ) c on true
    ${whereSql}
    order by p.created_at desc
    limit ${Number(Math.max(limit * 6, 200))}
    `,
    params
  );

  return q.rows || [];
}

export async function getDbProposalById(db, id) {
  return dbGetProposalById(db, id);
}

export async function updateDbProposalDecision(db, id, { decision, by, reason, automationMode }) {
  const nextStatus = decision === "rejected" ? "rejected" : "in_progress";

  const updated = await db.query(
    `update proposals
     set status = $4::text,
         decided_at = now(),
         decision_by = $2::text,
         payload = (coalesce(payload,'{}'::jsonb) || $3::jsonb)
     where id::text = $1::text
     returning id, thread_id, agent, type, status, title, payload, created_at, decided_at, decision_by`,
    [
      id,
      by,
      deepFix({ decision, reason, automationMode }),
      nextStatus,
    ]
  );

  const p2 = updated.rows?.[0] || null;
  if (!p2) return null;

  p2.title = fixText(p2.title);
  p2.payload = deepFix(p2.payload);

  return p2;
}

export async function createDbNotification(db, input) {
  return dbCreateNotification(db, input);
}

export async function createDbJob(db, input) {
  return dbCreateJob(db, input);
}

export async function auditDb(db, by, action, entityType, entityId, meta) {
  return dbAudit(db, by, action, entityType, entityId, meta);
}

export async function getLatestDraftLikeByProposal(db, proposalId) {
  return dbGetLatestDraftLikeByProposal(db, proposalId);
}

export async function getLatestApprovedDraftByProposal(db, proposalId) {
  return dbGetLatestApprovedDraftByProposal(db, proposalId);
}
