import { isDbReady, isUuid } from "../../../../utils/http.js";
import { resolveTenantKey } from "../../../../tenancy/index.js";
import { getTenantContext } from "../../../../db/tenantContext.js";
import { normalizeMessage } from "../shared.js";

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

export async function getMessageById(db, messageId, tenantKey = "") {
  if (!isDbReady(db)) return null;
  if (!messageId || !isUuid(messageId)) return null;

  const resolvedTenantKey = resolveTenantKey(tenantKey) || contextTenantKey();
  if (!resolvedTenantKey && isGuardedDb(db)) return null;

  const result = await db.query(
    `
    select
      id, thread_id, tenant_key, direction, sender_type,
      external_message_id, message_type, text, attachments, meta, sent_at, created_at
    from inbox_messages
    where id = $1::uuid
      ${resolvedTenantKey ? "and tenant_key = $2::text" : ""}
    limit 1
    `,
    resolvedTenantKey ? [messageId, resolvedTenantKey] : [messageId]
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
