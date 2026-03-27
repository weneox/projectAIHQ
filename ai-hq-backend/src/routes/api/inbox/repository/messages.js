import { isDbReady, isUuid } from "../../../../utils/http.js";
import { resolveTenantKey } from "../../../../tenancy/index.js";
import { normalizeMessage } from "../shared.js";

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

export async function getMessageById(db, messageId) {
  if (!isDbReady(db)) return null;
  if (!messageId || !isUuid(messageId)) return null;

  const result = await db.query(
    `
    select
      id, thread_id, tenant_key, direction, sender_type,
      external_message_id, message_type, text, attachments, meta, sent_at, created_at
    from inbox_messages
    where id = $1::uuid
    limit 1
    `,
    [messageId]
  );

  return normalizeMessage(result.rows?.[0] || null);
}

export async function updateOutboundMessageProviderId({
  db,
  messageId,
  providerMessageId,
  providerResponse = {},
}) {
  if (!isDbReady(db)) return null;
  if (!messageId || !isUuid(messageId)) return null;

  const result = await db.query(
    `
    update inbox_messages
    set
      external_message_id = coalesce($2::text, external_message_id),
      meta = coalesce(meta, '{}'::jsonb) || $3::jsonb
    where id = $1::uuid
    returning
      id, thread_id, tenant_key, direction, sender_type,
      external_message_id, message_type, text, attachments, meta, sent_at, created_at
    `,
    [
      messageId,
      providerMessageId || null,
      JSON.stringify({ providerResponse: providerResponse || null }),
    ]
  );

  return normalizeMessage(result.rows?.[0] || null);
}
