import {
  normalizeMessage,
  normalizeThread,
  sortMessagesChronologically,
} from "../shared.js";
import { INBOX_THREAD_SELECT_COLUMNS, safeJson } from "./shared.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v || d).toLowerCase();
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function cleanText(value) {
  return s(value);
}

function cleanNullableText(value) {
  const next = cleanText(value);
  return next || null;
}

function cleanUsername(value) {
  const next = cleanText(value).replace(/^@+/, "");
  return next || null;
}

function looksLikeNumericIdentity(value = "") {
  const safe = cleanText(value);
  if (!safe) return false;
  return /^\d{5,}$/.test(safe);
}

function isPlaceholderDisplayName(value = "") {
  const safe = lower(value);
  if (!safe) return true;

  return [
    "customer",
    "conversation",
    "instagram user",
    "telegram user",
    "facebook user",
    "whatsapp user",
    "website user",
    "web user",
    "user",
    "unknown",
  ].includes(safe);
}

function isStrongCustomerName(value = "") {
  const safe = cleanText(value);
  if (!safe) return false;
  if (looksLikeNumericIdentity(safe)) return false;
  if (isPlaceholderDisplayName(safe)) return false;
  return true;
}

function normalizeIncomingIdentity({
  externalUserId = "",
  externalUsername = "",
  customerName = "",
} = {}) {
  const nextExternalUserId = cleanNullableText(externalUserId);
  const nextExternalUsername = cleanUsername(externalUsername);
  const nextCustomerName = isStrongCustomerName(customerName)
    ? cleanText(customerName)
    : null;

  return {
    externalUserId: nextExternalUserId,
    externalUsername: nextExternalUsername,
    customerName: nextCustomerName,
  };
}

function mergeThreadMeta(currentMeta = {}, incomingMeta = {}) {
  return {
    ...obj(currentMeta),
    ...obj(incomingMeta),
  };
}

function choosePreferredExternalUserId(currentValue = "", incomingValue = "") {
  return cleanNullableText(currentValue) || cleanNullableText(incomingValue) || null;
}

function choosePreferredExternalUsername(currentValue = "", incomingValue = "") {
  const current = cleanUsername(currentValue);
  const incoming = cleanUsername(incomingValue);

  if (current && incoming) return current;
  return current || incoming || null;
}

function choosePreferredCustomerName({
  currentCustomerName = "",
  incomingCustomerName = "",
} = {}) {
  const current = cleanText(currentCustomerName);
  const incoming = cleanText(incomingCustomerName);

  const currentStrong = isStrongCustomerName(current);
  const incomingStrong = isStrongCustomerName(incoming);

  if (currentStrong) return current;
  if (incomingStrong) return incoming;
  if (current) return current;
  if (incoming) return incoming;
  return null;
}

async function getExistingInboundMessageForInsert({
  client,
  threadId,
  tenantKey,
  externalMessageId,
}) {
  if (!threadId || !tenantKey || !externalMessageId) return null;

  const existing = await client.query(
    `
    select
      id, thread_id, tenant_id, tenant_key, direction, sender_type,
      external_message_id, message_type, text, attachments, meta, sent_at, created_at
    from inbox_messages
    where tenant_key = $1::text
      and thread_id = $2::uuid
      and direction = 'inbound'
      and external_message_id = $3::text
    order by created_at desc
    limit 1
    `,
    [tenantKey, threadId, externalMessageId]
  );

  return normalizeMessage(existing.rows?.[0] || null);
}

async function patchExistingThreadIdentity({
  client,
  thread,
  tenantId,
  externalUserId,
  externalUsername,
  customerName,
  meta,
  bumpInboundCounters = true,
}) {
  if (!thread?.id) {
    return normalizeThread(thread);
  }

  const nextExternalUserId = choosePreferredExternalUserId(
    thread?.external_user_id,
    externalUserId
  );

  const nextExternalUsername = choosePreferredExternalUsername(
    thread?.external_username,
    externalUsername
  );

  const nextCustomerName = choosePreferredCustomerName({
    currentCustomerName: thread?.customer_name,
    incomingCustomerName: customerName,
  });

  const nextMeta = mergeThreadMeta(thread?.meta, meta);

  const updated = await client.query(
    `
    update inbox_threads
    set
      tenant_id = coalesce(tenant_id, $2::uuid),
      external_user_id = coalesce($3::text, external_user_id),
      external_username = coalesce($4::text, external_username),
      customer_name = coalesce($5::text, customer_name),
      last_message_at = case when $7::boolean = true then now() else last_message_at end,
      last_inbound_at = case when $7::boolean = true then now() else last_inbound_at end,
      unread_count = case
        when $7::boolean = true then coalesce(unread_count, 0) + 1
        else unread_count
      end,
      meta = coalesce(meta, '{}'::jsonb) || $6::jsonb,
      updated_at = now()
    where id = $1::uuid
    returning ${INBOX_THREAD_SELECT_COLUMNS}
    `,
    [
      thread.id,
      tenantId || null,
      nextExternalUserId,
      nextExternalUsername,
      nextCustomerName,
      safeJson(nextMeta),
      Boolean(bumpInboundCounters),
    ]
  );

  return normalizeThread(updated.rows?.[0] || thread);
}

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

  const incomingIdentity = normalizeIncomingIdentity({
    externalUserId,
    externalUsername,
    customerName,
  });

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
          incomingIdentity.externalUserId,
          incomingIdentity.externalUsername,
          incomingIdentity.customerName,
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

      if (thread) {
        thread = await patchExistingThreadIdentity({
          client,
          thread,
          tenantId,
          externalUserId: incomingIdentity.externalUserId,
          externalUsername: incomingIdentity.externalUsername,
          customerName: incomingIdentity.customerName,
          meta,
          bumpInboundCounters: false,
        });
      }
    }
  } else {
    thread = await patchExistingThreadIdentity({
      client,
      thread,
      tenantId,
      externalUserId: incomingIdentity.externalUserId,
      externalUsername: incomingIdentity.externalUsername,
      customerName: incomingIdentity.customerName,
      meta,
      bumpInboundCounters: true,
    });
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
  let insertedMessage;
  try {
    insertedMessage = await client.query(
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
        id, thread_id, tenant_id, tenant_key, direction, sender_type,
        external_message_id, message_type, text, attachments, meta, sent_at, created_at
      `,
      [
        threadId,
        tenantKey,
        externalMessageId,
        text,
        safeJson(meta),
        Number(timestamp || Date.now()),
      ]
    );
  } catch (error) {
    if (String(error?.code || "") !== "23505") throw error;

    const existing = await getExistingInboundMessageForInsert({
      client,
      threadId,
      tenantKey,
      externalMessageId,
    });

    if (!existing) throw error;

    return {
      ...existing,
      duplicate: true,
      deduped: true,
    };
  }

  return normalizeMessage(insertedMessage.rows?.[0] || null);
}

export async function loadRecentMessages(client, threadId, limit = 8) {
  const recentMessagesQuery = await client.query(
    `
    select
      id, thread_id, tenant_id, tenant_key, direction, sender_type,
      external_message_id, message_type, text, attachments, meta, sent_at, created_at
    from inbox_messages
    where thread_id = $1::uuid
    order by sent_at desc, created_at desc
    limit ${Number(limit) || 8}
    `,
    [threadId]
  );

  return sortMessagesChronologically(
    (recentMessagesQuery.rows || []).map(normalizeMessage)
  );
}