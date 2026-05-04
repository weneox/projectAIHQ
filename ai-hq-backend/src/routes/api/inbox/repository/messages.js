import { isDbReady, isUuid } from "../../../../utils/http.js";
import { resolveTenantKey } from "../../../../tenancy/index.js";
import { getTenantContext } from "../../../../db/tenantContext.js";
import { normalizeMessage } from "../shared.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function contextTenantKey() {
  return resolveTenantKey(getTenantContext()?.tenantKey || "");
}

function isGuardedDb(db) {
  return db?.__tenantGuardedDb === true;
}

export async function findExistingInboundMessage({
  db,
  tenantKey,
  threadId,
  externalMessageId,
}) {
  if (!isDbReady(db)) return null;
  if (!threadId || !isUuid(threadId)) return null;
  if (!externalMessageId) return null;

  const resolvedTenantKey = resolveTenantKey(tenantKey);
  const result = await db.query(
    `
    select
      id, thread_id, tenant_key, direction, sender_type,
      external_message_id, message_type, text, attachments, meta, sent_at, created_at
    from inbox_messages
    where tenant_key = $1::text
      and thread_id = $2::uuid
      and direction = 'inbound'
      and external_message_id = $3::text
    order by created_at desc
    limit 1
    `,
    [resolvedTenantKey, threadId, externalMessageId]
  );

  return normalizeMessage(result.rows?.[0] || null);
}

export async function findExistingOutboundMessage({
  db,
  tenantKey,
  threadId,
  externalMessageId,
}) {
  if (!isDbReady(db)) return null;
  if (!threadId || !isUuid(threadId)) return null;
  if (!externalMessageId) return null;

  const resolvedTenantKey = resolveTenantKey(tenantKey);
  const result = await db.query(
    `
    select
      id, thread_id, tenant_key, direction, sender_type,
      external_message_id, message_type, text, attachments, meta, sent_at, created_at
    from inbox_messages
    where tenant_key = $1::text
      and thread_id = $2::uuid
      and direction = 'outbound'
      and external_message_id = $3::text
    order by created_at desc
    limit 1
    `,
    [resolvedTenantKey, threadId, externalMessageId]
  );

  return normalizeMessage(result.rows?.[0] || null);
}

function assertScopeMatchesContext(scope = {}) {
  const context = getTenantContext() || {};
  if (context.system === true) return;

  const contextTenantId = s(context.tenantId || "");
  const contextTenantKey = contextTenantKey();
  const explicitTenantId = s(scope?.tenantId || scope?.tenant_id || "");
  const explicitTenantKey = resolveTenantKey(scope?.tenantKey || scope?.tenant_key || "");

  if (contextTenantId && explicitTenantId && contextTenantId !== explicitTenantId) {
    const err = new Error("inbox message tenant scope mismatch");
    err.code = "TENANT_SCOPE_MISMATCH";
    throw err;
  }

  if (contextTenantKey && explicitTenantKey && contextTenantKey !== explicitTenantKey) {
    const err = new Error("inbox message tenant scope mismatch");
    err.code = "TENANT_SCOPE_MISMATCH";
    throw err;
  }
}
function normalizeMessageScope(scope = "") {
  if (typeof scope !== "string") {
    assertScopeMatchesContext(scope || {});
  }

  if (typeof scope === "string") {
    return {
      tenantKey: resolveTenantKey(scope) || contextTenantKey(),
      tenantId: s(getTenantContext()?.tenantId || ""),
    };
  }

  return {
    tenantKey:
      resolveTenantKey(scope?.tenantKey || scope?.tenant_key || "") ||
      contextTenantKey(),
    tenantId: s(scope?.tenantId || scope?.tenant_id || getTenantContext()?.tenantId || ""),
  };
}

export async function getMessageById(db, messageId, tenantKey = "") {
  if (!isDbReady(db)) return null;
  if (!messageId || !isUuid(messageId)) return null;

  const scope = normalizeMessageScope(tenantKey);
  if (!scope.tenantKey && !scope.tenantId && isGuardedDb(db)) return null;

  const values = [messageId];
  let tenantWhere = "";
  if (scope.tenantId) {
    values.push(scope.tenantId);
    tenantWhere += ` and tenant_id = $${values.length}::uuid`;
  }
  if (scope.tenantKey) {
    values.push(scope.tenantKey);
    tenantWhere += ` and tenant_key = $${values.length}::text`;
  }

  const result = await db.query(
    `
    select
      id, thread_id, tenant_id, tenant_key, direction, sender_type,
      external_message_id, message_type, text, attachments, meta, sent_at, created_at
    from inbox_messages
    where id = $1::uuid
      ${tenantWhere}
    limit 1
    `,
    values
  );

  return normalizeMessage(result.rows?.[0] || null);
}

export async function updateOutboundMessageProviderId({
  db,
  messageId,
  providerMessageId,
  providerResponse = {},
  tenantKey = "",
}) {
  if (!isDbReady(db)) return null;
  if (!messageId || !isUuid(messageId)) return null;
  const resolvedTenantKey = resolveTenantKey(tenantKey) || contextTenantKey();
  if (!resolvedTenantKey && isGuardedDb(db)) return null;

  const result = await db.query(
    `
    update inbox_messages
    set
      external_message_id = coalesce($2::text, external_message_id),
      sent_at = coalesce(sent_at, now()),
      meta = coalesce(meta, '{}'::jsonb) || $3::jsonb
    where id = $1::uuid
      ${resolvedTenantKey ? "and tenant_key = $4::text" : ""}
    returning
      id, thread_id, tenant_key, direction, sender_type,
      external_message_id, message_type, text, attachments, meta, sent_at, created_at
    `,
    [
      messageId,
      providerMessageId || null,
      JSON.stringify({
        providerResponse: providerResponse || null,
        delivery: {
          status: "sent",
          pending: false,
          failed: false,
          providerMessageId: providerMessageId || null,
          updatedAt: new Date().toISOString(),
        },
      }),
      ...(resolvedTenantKey ? [resolvedTenantKey] : []),
    ]
  );

  return normalizeMessage(result.rows?.[0] || null);
}

export async function updateOutboundMessageDeliveryFailure({
  db,
  messageId,
  status = "failed",
  error = "send failed",
  errorCode = "",
  providerResponse = {},
  tenantKey = "",
}) {
  if (!isDbReady(db)) return null;
  if (!messageId || !isUuid(messageId)) return null;
  const resolvedTenantKey = resolveTenantKey(tenantKey) || contextTenantKey();
  if (!resolvedTenantKey && isGuardedDb(db)) return null;

  const normalizedStatus = String(status || "").trim().toLowerCase() === "dead"
    ? "dead"
    : "failed";

  const result = await db.query(
    `
    update inbox_messages
    set
      meta = coalesce(meta, '{}'::jsonb) || $2::jsonb
    where id = $1::uuid
      ${resolvedTenantKey ? "and tenant_key = $3::text" : ""}
    returning
      id, thread_id, tenant_key, direction, sender_type,
      external_message_id, message_type, text, attachments, meta, sent_at, created_at
    `,
    [
      messageId,
      JSON.stringify({
        providerResponse: providerResponse || null,
        delivery: {
          status: normalizedStatus,
          pending: false,
          failed: true,
          error: String(error || "send failed"),
          errorCode: String(errorCode || ""),
          updatedAt: new Date().toISOString(),
        },
      }),
      ...(resolvedTenantKey ? [resolvedTenantKey] : []),
    ]
  );

  return normalizeMessage(result.rows?.[0] || null);
}
