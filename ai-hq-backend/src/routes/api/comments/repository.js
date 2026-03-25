// src/routes/api/comments/repository.js
// FINAL v1.2 — comments repository layer
// canonical tenant loading + comment DB helpers + lead-from-comment DB helpers

import { isDbReady } from "../../../utils/http.js";
import { resolveTenantKey } from "../../../tenancy/index.js";
import { deepFix } from "../../../utils/textFix.js";
import { getTenantBrainRuntime } from "../../../services/businessBrain/getTenantBrainRuntime.js";
import { normalizeComment, normalizeLead, s } from "./utils.js";

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function normalizeTenantRow(row) {
  if (!row) return null;

  return {
    id: s(row.id),
    tenant_key: s(row.tenant_key),
    company_name: s(row.company_name),
    legal_name: s(row.legal_name),
    industry_key: s(row.industry_key),
    timezone: s(row.timezone || "Asia/Baku"),
    default_language: s(row.default_language || "az"),
    supported_languages: arr(row.supported_languages),
    enabled_languages: arr(row.enabled_languages),

    profile: {
      brand_name: s(row.brand_name),
      website_url: s(row.website_url),
      public_email: s(row.public_email),
      public_phone: s(row.public_phone),
      audience_summary: s(row.audience_summary),
      services_summary: s(row.services_summary),
      value_proposition: s(row.value_proposition),
      brand_summary: s(row.brand_summary),
      tone_of_voice: s(row.tone_of_voice),
      preferred_cta: s(row.preferred_cta),
      banned_phrases: arr(row.banned_phrases),
      communication_rules: obj(row.communication_rules),
      visual_style: obj(row.visual_style),
      extra_context: obj(row.extra_context),
    },

    ai_policy: {
      auto_reply_enabled: Boolean(row.auto_reply_enabled),
      suppress_ai_during_handoff: Boolean(row.suppress_ai_during_handoff),
      mark_seen_enabled: Boolean(row.mark_seen_enabled),
      typing_indicator_enabled: Boolean(row.typing_indicator_enabled),
      create_lead_enabled: Boolean(row.create_lead_enabled),
      approval_required_content: Boolean(row.approval_required_content),
      approval_required_publish: Boolean(row.approval_required_publish),
      quiet_hours_enabled: Boolean(row.quiet_hours_enabled),
      quiet_hours: obj(row.quiet_hours),
      inbox_policy: obj(row.inbox_policy),
      comment_policy: obj(row.comment_policy),
      content_policy: obj(row.content_policy),
      escalation_rules: obj(row.escalation_rules),
      risk_rules: obj(row.risk_rules),
      lead_scoring_rules: obj(row.lead_scoring_rules),
      publish_policy: obj(row.publish_policy),
    },

    inbox_policy: obj(row.inbox_policy),
    comment_policy: obj(row.comment_policy),
  };
}

async function queryOne(db, text, params = []) {
  try {
    const result = await db.query(text, params);
    return result.rows?.[0] || null;
  } catch {
    return null;
  }
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
  if (["low", "normal", "medium", "high", "urgent"].includes(x)) {
    return x === "medium" ? "normal" : x;
  }
  return "normal";
}

function normalizeLeadScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function getTenantByKey(db, tenantKey) {
  if (!isDbReady(db)) return null;

  const resolvedTenantKey = resolveTenantKey(tenantKey);

  try {
    const runtime = await getTenantBrainRuntime({
      db,
      tenantKey: resolvedTenantKey,
    });

    if (runtime?.tenant?.id) {
      return runtime.tenant;
    }
  } catch {
    // fallback to legacy tenant query below
  }

  try {
    const result = await db.query(
      `
      select
        t.id,
        t.tenant_key,
        t.company_name,
        t.legal_name,
        t.industry_key,
        t.timezone,
        t.default_language,
        t.supported_languages,
        t.enabled_languages,

        tp.brand_name,
        tp.website_url,
        tp.public_email,
        tp.public_phone,
        tp.audience_summary,
        tp.services_summary,
        tp.value_proposition,
        tp.brand_summary,
        tp.tone_of_voice,
        tp.preferred_cta,
        tp.banned_phrases,
        tp.communication_rules,
        tp.visual_style,
        tp.extra_context,

        ap.auto_reply_enabled,
        ap.suppress_ai_during_handoff,
        ap.mark_seen_enabled,
        ap.typing_indicator_enabled,
        ap.create_lead_enabled,
        ap.approval_required_content,
        ap.approval_required_publish,
        ap.quiet_hours_enabled,
        ap.quiet_hours,
        ap.inbox_policy,
        ap.comment_policy,
        ap.content_policy,
        ap.escalation_rules,
        ap.risk_rules,
        ap.lead_scoring_rules,
        ap.publish_policy

      from tenants t
      left join tenant_profiles tp
        on tp.tenant_id = t.id
      left join tenant_ai_policies ap
        on ap.tenant_id = t.id
      where t.tenant_key = $1::text
      limit 1
      `,
      [resolvedTenantKey]
    );

    return normalizeTenantRow(result.rows?.[0] || null);
  } catch {
    return null;
  }
}

async function resolveTenantScopeForLead(db, tenantKey) {
  const resolvedTenantKey = resolveTenantKey(tenantKey);

  const tenant = await getTenantByKey(db, resolvedTenantKey);
  if (tenant?.id || tenant?.tenant_key) {
    return {
      tenantId: s(tenant?.id || ""),
      tenantKey: s(tenant?.tenant_key || resolvedTenantKey),
      companyName:
        s(tenant?.company_name || "") ||
        s(tenant?.profile?.brand_name || ""),
    };
  }

  const row = await queryOne(
    db,
    `
    select id, tenant_key, company_name
    from tenants
    where tenant_key = $1::text
    limit 1
    `,
    [resolvedTenantKey]
  );

  return {
    tenantId: s(row?.id || ""),
    tenantKey: s(row?.tenant_key || resolvedTenantKey),
    companyName: s(row?.company_name || ""),
  };
}

export async function getCommentById(db, id) {
  if (!isDbReady(db)) return null;

  const result = await db.query(
    `
    select
      id,
      tenant_key,
      channel,
      source,
      external_comment_id,
      external_parent_comment_id,
      external_post_id,
      external_user_id,
      external_username,
      customer_name,
      text,
      classification,
      raw,
      created_at,
      updated_at
    from comments
    where id = $1::uuid
    limit 1
    `,
    [id]
  );

  return normalizeComment(result.rows?.[0] || null);
}

export async function getExistingCommentByExternalId(
  db,
  tenantKey,
  channel,
  externalCommentId
) {
  if (!isDbReady(db)) return null;

  const resolvedTenantKey = resolveTenantKey(tenantKey);

  const result = await db.query(
    `
    select
      id,
      tenant_key,
      channel,
      source,
      external_comment_id,
      external_parent_comment_id,
      external_post_id,
      external_user_id,
      external_username,
      customer_name,
      text,
      classification,
      raw,
      created_at,
      updated_at
    from comments
    where tenant_key = $1::text
      and channel = $2::text
      and external_comment_id = $3::text
    limit 1
    `,
    [resolvedTenantKey, channel, externalCommentId]
  );

  return normalizeComment(result.rows?.[0] || null);
}

export async function insertComment(db, payload) {
  if (!isDbReady(db)) return null;

  const resolvedTenantKey = resolveTenantKey(payload.tenantKey);

  const result = await db.query(
    `
    insert into comments (
      tenant_key,
      channel,
      source,
      external_comment_id,
      external_parent_comment_id,
      external_post_id,
      external_user_id,
      external_username,
      customer_name,
      text,
      classification,
      raw,
      created_at,
      updated_at
    )
    values (
      $1::text,
      $2::text,
      $3::text,
      $4::text,
      $5::text,
      $6::text,
      $7::text,
      $8::text,
      $9::text,
      $10::text,
      $11::jsonb,
      $12::jsonb,
      to_timestamp($13::double precision / 1000.0),
      now()
    )
    returning
      id,
      tenant_key,
      channel,
      source,
      external_comment_id,
      external_parent_comment_id,
      external_post_id,
      external_user_id,
      external_username,
      customer_name,
      text,
      classification,
      raw,
      created_at,
      updated_at
    `,
    [
      resolvedTenantKey,
      payload.channel,
      payload.source,
      payload.externalCommentId,
      payload.externalParentCommentId,
      payload.externalPostId,
      payload.externalUserId,
      payload.externalUsername,
      payload.customerName,
      payload.text,
      JSON.stringify(payload.classification || {}),
      JSON.stringify(payload.raw || {}),
      payload.timestampMs,
    ]
  );

  return normalizeComment(result.rows?.[0] || null);
}

export async function updateCommentState(db, id, nextClassification, nextRaw) {
  if (!isDbReady(db)) return null;

  const result = await db.query(
    `
    update comments
    set
      classification = $2::jsonb,
      raw = $3::jsonb,
      updated_at = now()
    where id = $1::uuid
    returning
      id,
      tenant_key,
      channel,
      source,
      external_comment_id,
      external_parent_comment_id,
      external_post_id,
      external_user_id,
      external_username,
      customer_name,
      text,
      classification,
      raw,
      created_at,
      updated_at
    `,
    [id, JSON.stringify(nextClassification || {}), JSON.stringify(nextRaw || {})]
  );

  return normalizeComment(result.rows?.[0] || null);
}

export async function listComments(db, { tenantKey, channel, category, q, limit }) {
  if (!isDbReady(db)) return [];

  const resolvedTenantKey = resolveTenantKey(tenantKey);

  const values = [resolvedTenantKey];
  const where = [`tenant_key = $1::text`];

  if (channel) {
    values.push(channel);
    where.push(`channel = $${values.length}::text`);
  }

  if (category) {
    values.push(category);
    where.push(`coalesce(classification->>'category', '') = $${values.length}::text`);
  }

  if (q) {
    values.push(`%${q}%`);
    const i = values.length;
    where.push(`
      (
        coalesce(text, '') ilike $${i}
        or coalesce(external_username, '') ilike $${i}
        or coalesce(customer_name, '') ilike $${i}
        or coalesce(external_post_id, '') ilike $${i}
        or coalesce(external_comment_id, '') ilike $${i}
      )
    `);
  }

  values.push(Number(limit || 50));

  const result = await db.query(
    `
    select
      id,
      tenant_key,
      channel,
      source,
      external_comment_id,
      external_parent_comment_id,
      external_post_id,
      external_user_id,
      external_username,
      customer_name,
      text,
      classification,
      raw,
      created_at,
      updated_at
    from comments
    where ${where.join(" and ")}
    order by created_at desc, updated_at desc
    limit $${values.length}::int
    `,
    values
  );

  return (result.rows || []).map(normalizeComment);
}

export async function findExistingLeadByComment(db, tenantKey, externalCommentId) {
  if (!isDbReady(db)) return null;

  const resolvedTenantKey = resolveTenantKey(tenantKey);

  const result = await db.query(
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
      and source = 'comment'
      and source_ref = $2::text
    order by created_at desc
    limit 1
    `,
    [resolvedTenantKey, externalCommentId]
  );

  return normalizeLead(result.rows?.[0] || null);
}

export async function insertLeadFromComment(db, { tenantKey, leadPayload }) {
  if (!isDbReady(db)) return null;

  const tenantScope = await resolveTenantScopeForLead(db, tenantKey);
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
      null,
      null,
      $5::text,
      $6::text,
      $7::text,
      $8::text,
      $9::text,
      $10::text,
      $11::text,
      $12::text,
      $13::int,
      $14::text,
      $15::text,
      $16::jsonb
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