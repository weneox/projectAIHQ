import { normalizeMessage, normalizeThread, sortMessagesChronologically } from "../shared.js";
import { INBOX_THREAD_SELECT_COLUMNS, safeJson } from "./shared.js";

export async function findOrCreateThreadForIngest({
  client,
  tenantId,
  tenantKey,
  channel,
  externalThreadId,
  externalUserId,
  externalUsername,
  customerName,
  meta,
}) {
  let thread = null;
  let threadWasCreated = false;

  if (externalThreadId) {
    const existing = await client.query(
      `
      select ${INBOX_THREAD_SELECT_COLUMNS}
      from inbox_threads
      where tenant_key = $1::text
        and channel = $2::text
        and external_thread_id = $3::text
      limit 1
      `,
      [tenantKey, channel, externalThreadId]
    );

    thread = existing.rows?.[0] || null;
  }

  if (!thread) {
    try {
      const created = await client.query(
        `
        insert into inbox_threads (
          tenant_id, tenant_key, channel, external_thread_id, external_user_id,
          external_username, customer_name, status, assigned_to, labels, meta,
          last_message_at, last_inbound_at, unread_count
        )
        values (
          $1::uuid, $2::text, $3::text, $4::text, $5::text,
          $6::text, $7::text, 'open', null, '[]'::jsonb, $8::jsonb,
          now(), now(), 1
        )
        returning ${INBOX_THREAD_SELECT_COLUMNS}
        `,
        [
          tenantId,
          tenantKey,
          channel,
          externalThreadId,
          externalUserId,
          externalUsername,
          customerName,
          safeJson(meta),
        ]
      );

      thread = created.rows?.[0] || null;
      threadWasCreated = true;
    } catch (error) {
      if (String(error?.code || "") !== "23505") throw error;

      const retry = await client.query(
        `
        select ${INBOX_THREAD_SELECT_COLUMNS}
        from inbox_threads
        where tenant_key = $1::text
          and channel = $2::text
          and external_thread_id = $3::text
        limit 1
        `,
        [tenantKey, channel, externalThreadId]
      );

      thread = retry.rows?.[0] || null;
    }
  } else {
    const updated = await client.query(
      `
      update inbox_threads
      set
        tenant_id = coalesce(tenant_id, $2::uuid),
        external_user_id = coalesce($3::text, external_user_id),
        external_username = coalesce($4::text, external_username),
        customer_name = coalesce($5::text, customer_name),
        last_message_at = now(),
        last_inbound_at = now(),
        unread_count = coalesce(unread_count, 0) + 1,
        meta = coalesce(meta, '{}'::jsonb) || $6::jsonb,
        updated_at = now()
      where id = $1::uuid
      returning ${INBOX_THREAD_SELECT_COLUMNS}
      `,
      [thread.id, tenantId, externalUserId, externalUsername, customerName, safeJson(meta)]
    );

    thread = updated.rows?.[0] || thread;
  }

  return {
    thread: normalizeThread(thread),
    threadWasCreated,
  };
}

export async function insertInboundMessage({
  client,
  threadId,
  tenantKey,
  externalMessageId,
  text,
  meta,
  timestamp,
}) {
  const insertedMessage = await client.query(
    `
    insert into inbox_messages (
      thread_id, tenant_key, direction, sender_type, external_message_id,
      message_type, text, attachments, meta, sent_at
    )
    values (
      $1::uuid, $2::text, 'inbound', 'customer', $3::text,
      'text', $4::text, '[]'::jsonb, $5::jsonb,
      coalesce(to_timestamp($6::double precision / 1000.0), now())
    )
    returning
      id, thread_id, tenant_key, direction, sender_type,
      external_message_id, message_type, text, attachments, meta, sent_at, created_at
    `,
    [threadId, tenantKey, externalMessageId, text, safeJson(meta), Number(timestamp || Date.now())]
  );

  return normalizeMessage(insertedMessage.rows?.[0] || null);
}

export async function loadRecentMessages(client, threadId, limit = 8) {
  const recentMessagesQuery = await client.query(
    `
    select
      id, thread_id, tenant_key, direction, sender_type,
      external_message_id, message_type, text, attachments, meta, sent_at, created_at
    from inbox_messages
    where thread_id = $1::uuid
    order by sent_at desc, created_at desc
    limit ${Number(limit) || 8}
    `,
    [threadId]
  );

  return sortMessagesChronologically((recentMessagesQuery.rows || []).map(normalizeMessage));
}
