import { isDbReady } from "../../utils/http.js";
import { deepFix, fixText } from "../../utils/textFix.js";
import { resolveTenantKey } from "../../tenancy/index.js";
import { getTenantContext } from "../../db/tenantContext.js";
import {
  getTenantBrainRuntime,
  isRuntimeAuthorityError,
} from "../../services/businessBrain/getTenantBrainRuntime.js";

function s(v) {
  return String(v ?? "").trim();
}

function safeJson(v, fallback = {}) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return fallback;
  return v;
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function normalizeCommentReplyDelivery({ classification, raw }) {
  const classificationReply = safeJson(classification?.reply, {});
  const rawReply = safeJson(raw?.reply, {});
  const classificationDelivery = safeJson(classificationReply.delivery, {});
  const rawDelivery = safeJson(rawReply.delivery, {});

  const status = fixText(
    rawDelivery.status || classificationDelivery.status || ""
  );
  const executionId = fixText(
    rawDelivery.executionId || classificationDelivery.executionId || ""
  );
  const providerMessageId = fixText(
    rawDelivery.providerMessageId || classificationDelivery.providerMessageId || ""
  );
  const sentAt = fixText(
    rawDelivery.sentAt || classificationDelivery.sentAt || ""
  );
  const updatedAt = fixText(
    rawDelivery.updatedAt ||
      classificationDelivery.updatedAt ||
      rawReply.updatedAt ||
      classificationReply.updatedAt ||
      ""
  );
  const error = fixText(rawReply.error || classificationReply.error || "");
  const errorCode = fixText(
    rawReply.errorCode || classificationReply.errorCode || ""
  );
  const provider = safeJson(rawReply.provider || classificationReply.provider, null);
  const deadLetter =
    rawDelivery.deadLetter === true || classificationDelivery.deadLetter === true;

  const hasDeliveryTruth = Boolean(
    status ||
      executionId ||
      providerMessageId ||
      sentAt ||
      updatedAt ||
      error ||
      errorCode ||
      provider ||
      deadLetter
  );

  if (!hasDeliveryTruth) return null;

  return {
    status,
    executionId,
    providerMessageId,
    sentAt,
    error,
    errorCode,
    updatedAt,
    provider: provider ? deepFix(provider) : null,
    deadLetter,
  };
}

function normalizeComment(row) {
  if (!row) return null;

  const classification = deepFix(row.classification || {});
  const raw = deepFix(row.raw || {});

  return {
    ...row,
    tenant_id: fixText(row.tenant_id || ""),
    tenant_key: fixText(row.tenant_key || ""),
    channel: fixText(row.channel || ""),
    source: fixText(row.source || ""),
    external_comment_id: fixText(row.external_comment_id || ""),
    external_parent_comment_id: fixText(row.external_parent_comment_id || ""),
    external_post_id: fixText(row.external_post_id || ""),
    external_user_id: fixText(row.external_user_id || ""),
    external_username: fixText(row.external_username || ""),
    customer_name: fixText(row.customer_name || ""),
    text: fixText(row.text || ""),
    classification,
    raw,
    reply_delivery: normalizeCommentReplyDelivery({
      classification,
      raw,
    }),
  };
}

function normalizeLead(row) {
  if (!row) return null;

  return {
    ...row,
    tenant_key: fixText(row.tenant_key || ""),
    source: fixText(row.source || ""),
    source_ref: fixText(row.source_ref || ""),
    inbox_thread_id: fixText(row.inbox_thread_id || ""),
    proposal_id: fixText(row.proposal_id || ""),
    full_name: fixText(row.full_name || ""),
    username: fixText(row.username || ""),
    company: fixText(row.company || ""),
    phone: fixText(row.phone || ""),
    email: fixText(row.email || ""),
    interest: fixText(row.interest || ""),
    notes: fixText(row.notes || ""),
    stage: fixText(row.stage || ""),
    status: fixText(row.status || ""),
    extra: deepFix(row.extra || {}),
  };
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

function contextTenantKey() {
  return resolveTenantKey(getTenantContext()?.tenantKey || "");
}

function isGuardedDb(db) {
  return db?.__tenantGuardedDb === true;
}

function resolveScopedTenantKey(inputTenantKey = "") {
  const contextKey = contextTenantKey();
  const explicitKey = resolveTenantKey(inputTenantKey);

  if (contextKey && explicitKey && contextKey !== explicitKey) {
    const err = new Error("comment access tenant scope mismatch");
    err.code = "TENANT_SCOPE_MISMATCH";
    throw err;
  }

  return explicitKey || contextKey;
}

async function getTenantByKey(
  db,
  tenantKey,
  { runtimeLoader = getTenantBrainRuntime } = {}
) {
  if (!isDbReady(db)) return null;

  const resolvedTenantKey = resolveTenantKey(tenantKey);

  try {
    const runtime = await runtimeLoader({
      db,
      tenantKey: resolvedTenantKey,
      authorityMode: "strict",
    });

    if (runtime?.tenant?.id || runtime?.tenant?.tenant_key) {
      return runtime.tenant;
    }
  } catch (error) {
    if (isRuntimeAuthorityError(error)) {
      return null;
    }
    throw error;
  }

  return null;
}

async function resolveTenantScopeForLead(
  db,
  tenantKey,
  { tenantLoader = getTenantByKey } = {}
) {
  const resolvedTenantKey = resolveTenantKey(tenantKey);

  const tenant = await tenantLoader(db, resolvedTenantKey);
  if (tenant?.id || tenant?.tenant_key) {
    return {
      tenantId: s(tenant?.id || ""),
      tenantKey: s(tenant?.tenant_key || resolvedTenantKey),
      companyName: s(tenant?.company_name || "") || s(tenant?.profile?.brand_name || ""),
    };
  }

  return {
    tenantId: "",
    tenantKey: resolvedTenantKey,
    companyName: "",
  };
}

export async function getCommentById(db, id, tenantKey = "") {
  if (!isDbReady(db)) return null;
  const resolvedTenantKey = resolveScopedTenantKey(tenantKey);
  if (!resolvedTenantKey && isGuardedDb(db)) return null;

  const result = await db.query(
    `
    select
      id, tenant_id, tenant_key, channel, source, external_comment_id, external_parent_comment_id,
      external_post_id, external_user_id, external_username, customer_name, text,
      classification, raw, created_at, updated_at
    from comments
    where id = $1::uuid
      ${resolvedTenantKey ? "and tenant_key = $2::text" : ""}
    limit 1
    `,
    resolvedTenantKey ? [id, resolvedTenantKey] : [id]
  );

  return normalizeComment(result.rows?.[0] || null);
}

export async function updateCommentState(db, id, nextClassification, nextRaw, tenantKey = "") {
  if (!isDbReady(db)) return null;
  const resolvedTenantKey = resolveScopedTenantKey(tenantKey);
  if (!resolvedTenantKey && isGuardedDb(db)) return null;

  const result = await db.query(
    `
    update comments
    set
      classification = $2::jsonb,
      raw = $3::jsonb,
      updated_at = now()
    where id = $1::uuid
      ${resolvedTenantKey ? "and tenant_key = $4::text" : ""}
    returning
      id, tenant_key, channel, source, external_comment_id, external_parent_comment_id,
      tenant_id, external_post_id, external_user_id, external_username, customer_name, text,
      classification, raw, created_at, updated_at
    `,
    [
      id,
      JSON.stringify(nextClassification || {}),
      JSON.stringify(nextRaw || {}),
      ...(resolvedTenantKey ? [resolvedTenantKey] : []),
    ]
  );

  return normalizeComment(result.rows?.[0] || null);
}

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
