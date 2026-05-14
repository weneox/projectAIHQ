import { s } from "./shared.js";

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

export const STORED_INBOX_MESSAGE_TYPES = new Set([
  "text",
  "image",
  "video",
  "audio",
  "file",
  "document",
  "voice",
  "sticker",
  "gif",
  "location",
  "contact",
  "story_reply",
  "reaction",
  "button",
  "interactive",
  "system",
  "other",
]);

export const NOISE_MESSAGE_TYPES = [
  "system",
  "typing",
  "typing_on",
  "typing_off",
  "typing-on",
  "typing-off",
  "typingon",
  "typingoff",
  "typing_start",
  "typing_stop",
  "typing-start",
  "typing-stop",
  "mark_seen",
  "mark-seen",
  "markseen",
  "seen",
  "read",
  "delivery",
  "reaction",
  "echo",
];

export const NOISE_SENDER_TYPES = ["system", "decision"];
export const NOISE_SOURCES = [
  "decision",
  "decision_engine",
  "decision-event",
  "system",
];

export function isControlMessageType(value) {
  const x = lower(value);
  return ["typing_on", "typing_off", "mark_seen"].includes(x);
}

export function normalizeInboxMessageType(value, fallback = "text") {
  const x = lower(value || fallback);
  const fb = lower(fallback || "text") || "text";

  if (!x) return STORED_INBOX_MESSAGE_TYPES.has(fb) ? fb : "text";
  if (STORED_INBOX_MESSAGE_TYPES.has(x)) return x;

  if (["attachment", "attachments", "doc"].includes(x)) return "file";
  if (["voice_note", "voice-message", "voice_message"].includes(x)) {
    return "voice";
  }
  if (["story-reply", "storyreply"].includes(x)) return "story_reply";

  if (
    [
      "template",
      "template_message",
      "template-message",
      "quick_reply",
      "quick-reply",
      "carousel",
      "list",
    ].includes(x)
  ) {
    return "interactive";
  }

  if (isControlMessageType(x)) return "system";
  if (
    ["typing", "typing_start", "typing-start", "typingon", "typing-on"].includes(
      x
    )
  ) {
    return "system";
  }
  if (
    ["typing_stop", "typing-stop", "typingoff", "typing-off"].includes(x)
  ) {
    return "system";
  }
  if (["seen", "read", "markseen", "mark-seen"].includes(x)) {
    return "system";
  }

  if (["unknown", "unsupported"].includes(x)) {
    return STORED_INBOX_MESSAGE_TYPES.has(fb) ? fb : "other";
  }

  return STORED_INBOX_MESSAGE_TYPES.has(fb) ? fb : "text";
}

export function normalizeThreadStatus(value, fallback = "open") {
  const next = lower(value || fallback || "open");
  if (["open", "resolved", "closed"].includes(next)) return next;
  return lower(fallback || "open") || "open";
}

export function buildHandoffMeta(active, reason = "", priority = "normal", by = "") {
  return JSON.stringify({
    active: Boolean(active),
    reason: active ? s(reason) : "",
    priority: active ? s(priority || "normal") : "normal",
    at: active ? new Date().toISOString() : null,
    by: active ? s(by) : null,
  });
}

export function sqlQuoteLiteral(value = "") {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

export function buildSqlNotInList(values = []) {
  const normalized = [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => lower(value))
        .filter(Boolean)
    ),
  ];

  if (!normalized.length) {
    return "('')";
  }

  return `(${normalized.map((value) => sqlQuoteLiteral(value)).join(", ")})`;
}

export const NOISE_MESSAGE_TYPE_SQL = buildSqlNotInList(NOISE_MESSAGE_TYPES);
export const NOISE_SENDER_TYPE_SQL = buildSqlNotInList(NOISE_SENDER_TYPES);
export const NOISE_SOURCE_SQL = buildSqlNotInList(NOISE_SOURCES);

export function buildRenderablePreviewLateralSql() {
  return `
    left join lateral (
      select m.text
      from inbox_messages m
      where m.thread_id = t.id
        and m.tenant_key = t.tenant_key
        and nullif(btrim(coalesce(m.text, '')), '') is not null
        and lower(coalesce(m.message_type, '')) not in ${NOISE_MESSAGE_TYPE_SQL}
        and lower(coalesce(m.sender_type, '')) not in ${NOISE_SENDER_TYPE_SQL}
        and lower(coalesce(m.meta->>'source', '')) not in ${NOISE_SOURCE_SQL}
        and lower(
          coalesce(
            m.meta->>'originalMessageType',
            m.meta->>'original_message_type',
            ''
          )
        ) not in ${NOISE_MESSAGE_TYPE_SQL}
      order by m.sent_at desc, m.created_at desc
      limit 1
    ) last_message on true
  `;
}

export const THREAD_LIST_IDENTITY_LATERAL = `
  left join lateral (
    select
      nullif(btrim(coalesce(
        m.meta->'identity'->>'externalUsername',
        m.meta->'customerContext'->>'username',
        m.meta->'customerContext'->'profile'->>'username',
        m.meta->'customerContext'->'instagram'->>'username',
        m.meta->'customerContext'->'telegram'->>'username',
        m.meta->'customerContext'->'meta'->>'username',
        m.meta->'raw'->>'username',
        m.meta->'raw'->'from'->>'username',
        m.meta->'raw'->'sender'->>'username',
        m.meta->'raw'->'profile'->>'username',
        ''
      )), '') as fallback_external_username,

      nullif(btrim(coalesce(
        m.meta->'identity'->>'customerName',
        m.meta->'customerContext'->>'fullName',
        m.meta->'customerContext'->>'displayName',
        m.meta->'customerContext'->>'name',
        m.meta->'customerContext'->'profile'->>'fullName',
        m.meta->'customerContext'->'profile'->>'displayName',
        m.meta->'customerContext'->'profile'->>'name',
        m.meta->'customerContext'->'instagram'->>'fullName',
        m.meta->'customerContext'->'instagram'->>'displayName',
        m.meta->'customerContext'->'instagram'->>'name',
        m.meta->'customerContext'->'telegram'->>'fullName',
        m.meta->'customerContext'->'telegram'->>'displayName',
        m.meta->'customerContext'->'telegram'->>'name',
        m.meta->'customerContext'->'meta'->>'fullName',
        m.meta->'customerContext'->'meta'->>'displayName',
        m.meta->'customerContext'->'meta'->>'name',
        m.meta->'raw'->>'customerName',
        m.meta->'raw'->>'customer_name',
        m.meta->'raw'->>'name',
        m.meta->'raw'->>'full_name',
        m.meta->'raw'->'from'->>'name',
        m.meta->'raw'->'from'->>'fullName',
        m.meta->'raw'->'from'->>'full_name',
        m.meta->'raw'->'sender'->>'name',
        m.meta->'raw'->'sender'->>'fullName',
        m.meta->'raw'->'sender'->>'full_name',
        m.meta->'raw'->'profile'->>'name',
        m.meta->'raw'->'profile'->>'fullName',
        m.meta->'raw'->'profile'->>'full_name',
        ''
      )), '') as fallback_customer_name,

      nullif(btrim(coalesce(
        m.meta->>'avatar_url',
        m.meta->>'avatarUrl',
        m.meta->>'profile_picture_url',
        m.meta->>'profilePictureUrl',
        m.meta->'customerContext'->>'avatar_url',
        m.meta->'customerContext'->>'avatarUrl',
        m.meta->'customerContext'->>'profile_picture_url',
        m.meta->'customerContext'->>'profilePictureUrl',
        m.meta->'customerContext'->'profile'->>'avatar_url',
        m.meta->'customerContext'->'profile'->>'avatarUrl',
        m.meta->'customerContext'->'profile'->>'profile_picture_url',
        m.meta->'customerContext'->'profile'->>'profilePictureUrl',
        m.meta->'customerContext'->'instagram'->>'avatar_url',
        m.meta->'customerContext'->'instagram'->>'avatarUrl',
        m.meta->'customerContext'->'instagram'->>'profile_picture_url',
        m.meta->'customerContext'->'instagram'->>'profilePictureUrl',
        m.meta->'customerContext'->'telegram'->>'avatar_url',
        m.meta->'customerContext'->'telegram'->>'avatarUrl',
        m.meta->'customerContext'->'telegram'->>'profile_picture_url',
        m.meta->'customerContext'->'telegram'->>'profilePictureUrl',
        m.meta->'raw'->>'avatar_url',
        m.meta->'raw'->>'avatarUrl',
        m.meta->'raw'->>'profile_picture_url',
        m.meta->'raw'->>'profilePictureUrl',
        m.meta->'raw'->'from'->>'avatar_url',
        m.meta->'raw'->'from'->>'avatarUrl',
        m.meta->'raw'->'from'->>'profile_picture_url',
        m.meta->'raw'->'from'->>'profilePictureUrl',
        m.meta->'raw'->'sender'->>'avatar_url',
        m.meta->'raw'->'sender'->>'avatarUrl',
        m.meta->'raw'->'sender'->>'profile_picture_url',
        m.meta->'raw'->'sender'->>'profilePictureUrl',
        m.meta->'raw'->'profile'->>'avatar_url',
        m.meta->'raw'->'profile'->>'avatarUrl',
        m.meta->'raw'->'profile'->>'profile_picture_url',
        m.meta->'raw'->'profile'->>'profilePictureUrl',
        ''
      )), '') as fallback_avatar_url
    from inbox_messages m
    where m.thread_id = t.id
      and m.tenant_key = t.tenant_key
      and lower(coalesce(m.direction, '')) = 'inbound'
      and lower(coalesce(m.sender_type, '')) = 'customer'
    order by m.sent_at desc, m.created_at desc
    limit 1
  ) latest_identity on true
`;
