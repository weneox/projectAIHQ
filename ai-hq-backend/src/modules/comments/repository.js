import { isDbReady } from "../../utils/http.js";
import { deepFix, fixText } from "../../utils/textFix.js";
import { resolveTenantKey } from "../../tenancy/index.js";
import { getTenantContext } from "../../db/tenantContext.js";

function safeJson(v, fallback = {}) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return fallback;
  return v;
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
