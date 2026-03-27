import { isDbReady } from "../../../../utils/http.js";
import { resolveTenantKey } from "../../../../tenancy/index.js";
import {
  deepFix,
  normalizeLead,
  normalizeLeadScore,
  normalizeLeadStage,
  normalizeLeadStatus,
  normalizePriority,
  obj,
  s,
} from "./shared.js";
import { resolveTenantScopeForLead } from "./authority.js";

export async function findExistingLeadByComment(db, tenantKey, externalCommentId) {
  if (!isDbReady(db)) return null;

  const resolvedTenantKey = resolveTenantKey(tenantKey);
  const result = await db.query(
    `
    select
      id, tenant_id, tenant_key, source, source_ref, inbox_thread_id, proposal_id,
      full_name, username, company, phone, email, interest, notes, stage, score, status,
      owner, priority, value_azn, follow_up_at, next_action, won_reason, lost_reason,
      extra, created_at, updated_at
    from leads
    where tenant_key = $1::text
      and source = 'comment'
      and source_ref = $2::text
    order by created_at desc
    limit 1
    `,
    [resolvedTenantKey, externalCommentId]
  );

  return normalizeLead(result.rows?.[0] || null);
}

export async function insertLeadFromComment(
  db,
  { tenantKey, leadPayload },
  { resolveTenantScope = resolveTenantScopeForLead } = {}
) {
  if (!isDbReady(db)) return null;

  const tenantScope = await resolveTenantScope(db, tenantKey);
  const resolvedTenantKey = s(tenantScope.tenantKey || resolveTenantKey(tenantKey));
  const tenantId = s(tenantScope.tenantId || "");

  const fullName =
    s(leadPayload?.fullName || "") ||
    s(leadPayload?.username || "") ||
    "Comment Lead";

  const username = s(leadPayload?.username || "") || null;
  const company =
    s(leadPayload?.company || "") ||
    s(tenantScope.companyName || "") ||
    null;
  const phone = s(leadPayload?.phone || "") || null;
  const email = s(leadPayload?.email || "") || null;
  const interest = s(leadPayload?.interest || "sales") || "sales";
  const notes = s(leadPayload?.notes || "");
  const stage = normalizeLeadStage(leadPayload?.stage || "new");
  const score = normalizeLeadScore(leadPayload?.score);
  const status = normalizeLeadStatus(leadPayload?.status || "open");
  const priority = normalizePriority(leadPayload?.priority || "normal");

  const extra = deepFix({
    ...(obj(leadPayload?.extra)),
    externalUserId: s(leadPayload?.externalUserId || ""),
    channel: s(leadPayload?.channel || ""),
  });

  const result = await db.query(
    `
    insert into leads (
      tenant_id, tenant_key, source, source_ref, inbox_thread_id, proposal_id,
      full_name, username, company, phone, email, interest, notes, stage, score, status, priority, extra
    )
    values (
      nullif($1::text, '')::uuid, $2::text, $3::text, $4::text, null, null,
      $5::text, $6::text, $7::text, $8::text, $9::text, $10::text, $11::text, $12::text,
      $13::int, $14::text, $15::text, $16::jsonb
    )
    returning
      id, tenant_id, tenant_key, source, source_ref, inbox_thread_id, proposal_id,
      full_name, username, company, phone, email, interest, notes, stage, score, status,
      owner, priority, value_azn, follow_up_at, next_action, won_reason, lost_reason,
      extra, created_at, updated_at
    `,
    [
      tenantId || null,
      resolvedTenantKey,
      "comment",
      s(leadPayload?.sourceRef || ""),
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

  return normalizeLead(result.rows?.[0] || null);
}
