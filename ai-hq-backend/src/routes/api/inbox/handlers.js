// src/routes/api/inbox/handlers.js
// operator inbox handlers — cleaned message visibility + safe thread previews

import express from "express";
import { okJson, isDbReady, isUuid } from "../../../utils/http.js";
import { fixText } from "../../../utils/textFix.js";
import { writeAudit } from "../../../utils/auditLog.js";
import { resolveTenantKeyFromReq } from "../../../tenancy/index.js";
import { emitRealtimeEvent } from "../../../realtime/events.js";

import {
  clamp,
  isRenderableConversationMessage,
  normalizeMessage,
  normalizeThread,
  pickConversationPreviewText,
  s,
  toInt,
  truthy,
  withMessageOutboundAttemptCorrelation,
} from "./shared.js";
import { persistOutboundMessage } from "./internal/execution.js";

import {
  getOutboundAttemptById,
  getOutboundAttemptsSummary,
  getThreadById,
  listFailedOutboundAttempts,
  listOutboundAttemptCorrelationsByMessageIds,
  listOutboundAttemptsByThread,
  markOutboundAttemptDead,
  refreshThread,
  scheduleOutboundRetry,
} from "./repository.js";

function normalizeObj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function getScopedTenantKey(req) {
  return (
    fixText(s(req.auth?.tenantKey || req.user?.tenantKey || "")) ||
    resolveTenantKeyFromReq(req)
  );
}

function getScopedTenantId(req) {
  const tenantId = s(req.auth?.tenantId || req.user?.tenantId || "");
  return isUuid(tenantId) ? tenantId : "";
}

const STORED_INBOX_MESSAGE_TYPES = new Set([
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

const NOISE_MESSAGE_TYPES = [
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

const NOISE_SENDER_TYPES = ["system", "decision"];
const NOISE_SOURCES = [
  "decision",
  "decision_engine",
  "decision-event",
  "system",
];

function isControlMessageType(value) {
  const x = lower(value);
  return ["typing_on", "typing_off", "mark_seen"].includes(x);
}

function normalizeInboxMessageType(value, fallback = "text") {
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

function normalizeThreadStatus(value, fallback = "open") {
  const next = lower(value || fallback || "open");
  if (["open", "resolved", "closed"].includes(next)) return next;
  return lower(fallback || "open") || "open";
}

function buildHandoffMeta(active, reason = "", priority = "normal", by = "") {
  return JSON.stringify({
    active: Boolean(active),
    reason: active ? s(reason) : "",
    priority: active ? s(priority || "normal") : "normal",
    at: active ? new Date().toISOString() : null,
    by: active ? s(by) : null,
  });
}

function emitOperatorThreadEvent(wsHub, req, type, payload = {}) {
  try {
    emitRealtimeEvent(wsHub, {
      type,
      audience: "operator",
      tenantKey:
        payload?.thread?.tenant_key ||
        payload?.attempt?.tenant_key ||
        req.auth?.tenantKey,
      tenantId:
        payload?.thread?.tenant_id ||
        payload?.attempt?.tenant_id ||
        req.auth?.tenantId,
      ...payload,
    });
  } catch {}
}

async function auditSafe(db, entry = {}) {
  try {
    await writeAudit(db, entry);
  } catch {}
}

function sqlQuoteLiteral(value = "") {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function buildSqlNotInList(values = []) {
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

const NOISE_MESSAGE_TYPE_SQL = buildSqlNotInList(NOISE_MESSAGE_TYPES);
const NOISE_SENDER_TYPE_SQL = buildSqlNotInList(NOISE_SENDER_TYPES);
const NOISE_SOURCE_SQL = buildSqlNotInList(NOISE_SOURCES);

function buildRenderablePreviewLateralSql() {
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

const THREAD_LIST_IDENTITY_LATERAL = `
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

export function inboxHandlers({ db, wsHub }) {
  const r = express.Router();

  r.get("/inbox/threads", async (req, res) => {
    const tenantKey = getScopedTenantKey(req);
    const status = lower(req.query?.status);
    const q = fixText(String(req.query?.q || "").trim());
    const handoffOnly = truthy(req.query?.handoffOnly);
    const limit = clamp(toInt(req.query?.limit, 30), 1, 200);

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: true,
          tenantKey,
          threads: [],
          dbDisabled: true,
        });
      }

      const values = [tenantKey];
      let where = `where t.tenant_key = $1::text`;

      if (status) {
        values.push(status);
        where += ` and t.status = $${values.length}::text`;
      }

      if (handoffOnly) {
        where += ` and coalesce(t.handoff_active, false) = true`;
      }

      if (q) {
        values.push(`%${q}%`);
        const i = values.length;
        where += `
          and (
            coalesce(t.customer_name, latest_identity.fallback_customer_name, '') ilike $${i}
            or coalesce(t.external_username, latest_identity.fallback_external_username, '') ilike $${i}
            or coalesce(t.external_user_id, '') ilike $${i}
            or coalesce(t.external_thread_id, '') ilike $${i}
          )
        `;
      }

      values.push(limit);

      const sql = `
        select
          t.id,
          t.tenant_id,
          t.tenant_key,
          t.channel,
          t.external_thread_id,
          t.external_user_id,
          coalesce(
            nullif(btrim(t.external_username), ''),
            nullif(btrim(latest_identity.fallback_external_username), '')
          ) as external_username,
          coalesce(
            case
              when nullif(btrim(t.customer_name), '') is not null
                and coalesce(t.customer_name, '') !~ '^\\d{5,}$'
              then t.customer_name
              else null
            end,
            nullif(btrim(latest_identity.fallback_customer_name), '')
          ) as customer_name,
          t.status,
          t.last_message_at,
          t.last_inbound_at,
          t.last_outbound_at,
          t.unread_count,
          t.assigned_to,
          t.labels,
          t.meta,
          t.handoff_active,
          t.handoff_reason,
          t.handoff_priority,
          t.handoff_at,
          t.handoff_by,
          t.created_at,
          t.updated_at,
          coalesce(
            nullif(btrim(latest_identity.fallback_avatar_url), ''),
            ''
          ) as avatar_url,
          coalesce(last_message.text, '') as last_message_text
        from inbox_threads t
        ${THREAD_LIST_IDENTITY_LATERAL}
        ${buildRenderablePreviewLateralSql()}
        ${where}
        order by coalesce(t.last_message_at, t.updated_at, t.created_at) desc
        limit $${values.length}::int
      `;

      const result = await db.query(sql, values);
      const threads = (result.rows || []).map((row) => ({
        ...normalizeThread(row),
        last_message_text: pickConversationPreviewText(row.last_message_text),
      }));

      return okJson(res, { ok: true, tenantKey, threads });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  });

  r.get("/inbox/threads/:id", async (req, res) => {
    const threadId = s(req.params.id);
    const tenantKey = getScopedTenantKey(req);

    if (!threadId) {
      return okJson(res, { ok: false, error: "threadId required" });
    }

    try {
      if (!isDbReady(db)) {
        return okJson(res, { ok: true, thread: null, dbDisabled: true });
      }

      if (!isUuid(threadId)) {
        return okJson(res, { ok: false, error: "threadId must be uuid" });
      }

      const thread = await getThreadById(db, threadId, tenantKey);
      if (!thread) {
        return okJson(res, { ok: false, error: "thread not found" });
      }

      return okJson(res, { ok: true, thread });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  });

  r.get("/inbox/threads/:id/messages", async (req, res) => {
    const threadId = s(req.params.id);
    const tenantKey = getScopedTenantKey(req);
    const limit = clamp(toInt(req.query?.limit, 200), 1, 1000);

    if (!threadId) {
      return okJson(res, { ok: false, error: "threadId required" });
    }

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: true,
          threadId,
          messages: [],
          dbDisabled: true,
        });
      }

      if (!isUuid(threadId)) {
        return okJson(res, { ok: false, error: "threadId must be uuid" });
      }

      const thread = await getThreadById(db, threadId, tenantKey);
      if (!thread) {
        return okJson(res, { ok: false, error: "thread not found" });
      }

      const result = await db.query(
        `
        select
          id,
          thread_id,
          tenant_id,
          tenant_key,
          direction,
          sender_type,
          external_message_id,
          message_type,
          text,
          attachments,
          meta,
          sent_at,
          created_at
        from (
          select
            id,
            thread_id,
            tenant_id,
            tenant_key,
            direction,
            sender_type,
            external_message_id,
            message_type,
            text,
            attachments,
            meta,
            sent_at,
            created_at
          from inbox_messages
          where thread_id = $1::uuid
            and tenant_key = $2::text
          order by
            coalesce(sent_at, created_at) desc,
            created_at desc,
            id desc
          limit $3::int
        ) latest_messages
        order by
          coalesce(sent_at, created_at) asc,
          created_at asc,
          id asc
        `,
        [threadId, tenantKey, limit]
      );

      const allMessages = (result.rows || []).map(normalizeMessage);
      const messages = allMessages.filter(
        (message) =>
          message?.is_renderable === true &&
          isRenderableConversationMessage(message)
      );

      const correlations = await listOutboundAttemptCorrelationsByMessageIds(
        db,
        messages
          .filter((message) => lower(message?.direction) === "outbound")
          .map((message) => message.id),
        { threadId }
      );

      const hydratedMessages = messages.map((message) =>
        withMessageOutboundAttemptCorrelation(
          message,
          correlations.get(message.id) || null
        )
      );

      return okJson(res, { ok: true, threadId, messages: hydratedMessages });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  });

  r.get("/inbox/threads/:id/outbound-attempts", async (req, res) => {
    const threadId = s(req.params.id);
    const tenantKey = getScopedTenantKey(req);
    const limit = clamp(toInt(req.query?.limit, 100), 1, 500);

    if (!threadId) {
      return okJson(res, { ok: false, error: "threadId required" });
    }

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: true,
          threadId,
          attempts: [],
          dbDisabled: true,
        });
      }

      if (!isUuid(threadId)) {
        return okJson(res, { ok: false, error: "threadId must be uuid" });
      }

      const thread = await getThreadById(db, threadId, tenantKey);
      if (!thread) {
        return okJson(res, { ok: false, error: "thread not found" });
      }

      const attempts = await listOutboundAttemptsByThread(
        db,
        threadId,
        limit,
        tenantKey
      );

      return okJson(res, {
        ok: true,
        threadId,
        thread,
        attempts,
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  });

  r.get("/inbox/outbound/summary", async (req, res) => {
    const tenantKey = getScopedTenantKey(req);

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: true,
          summary: {
            tenantKey,
            queued: 0,
            sending: 0,
            sent: 0,
            failed: 0,
            retrying: 0,
            dead: 0,
            total: 0,
          },
          dbDisabled: true,
        });
      }

      const summary = await getOutboundAttemptsSummary(db, tenantKey);
      return okJson(res, { ok: true, summary });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  });

  r.get("/inbox/outbound/failed", async (req, res) => {
    const tenantKey = getScopedTenantKey(req);
    const limit = clamp(toInt(req.query?.limit, 50), 1, 500);
    const status = s(req.query?.status);

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: true,
          attempts: [],
          dbDisabled: true,
        });
      }

      const attempts = await listFailedOutboundAttempts(db, {
        tenantKey,
        limit,
        status,
      });

      return okJson(res, { ok: true, attempts });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  });

  r.post("/inbox/outbound/:attemptId/resend", async (req, res) => {
    const attemptId = s(req.params.attemptId);
    const tenantKey = getScopedTenantKey(req);
    const actor = fixText(s(req.body?.actor || "operator")) || "operator";
    const retryDelaySeconds = clamp(
      toInt(req.body?.retryDelaySeconds, 0),
      0,
      86400
    );

    if (!attemptId) {
      return okJson(res, { ok: false, error: "attemptId required" });
    }

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        });
      }

      if (!isUuid(attemptId)) {
        return okJson(res, { ok: false, error: "attemptId must be uuid" });
      }

      const attempt = await getOutboundAttemptById(db, attemptId, tenantKey);
      if (!attempt) {
        return okJson(res, { ok: false, error: "attempt not found" });
      }

      if (attempt.status === "sent") {
        return okJson(res, {
          ok: false,
          error: "attempt already sent",
          attempt,
        });
      }

      if (attempt.status === "dead") {
        return okJson(res, {
          ok: false,
          error: "attempt is dead",
          attempt,
        });
      }

      const updated = await scheduleOutboundRetry({
        db,
        attemptId,
        tenantKey,
        retryDelaySeconds,
      });

      await auditSafe(db, {
        actor,
        action: "inbox.outbound.retry_scheduled",
        objectType: "inbox_outbound_attempt",
        objectId: attemptId,
        meta: {
          threadId: s(updated?.thread_id),
          messageId: s(updated?.message_id),
          retryDelaySeconds,
          previousStatus: s(attempt?.status),
          newStatus: s(updated?.status),
        },
      });

      emitOperatorThreadEvent(wsHub, req, "inbox.outbound.attempt.updated", {
        attempt: updated,
      });

      return okJson(res, { ok: true, attempt: updated });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  });

  r.post("/inbox/outbound/:attemptId/mark-dead", async (req, res) => {
    const attemptId = s(req.params.attemptId);
    const tenantKey = getScopedTenantKey(req);
    const actor = fixText(s(req.body?.actor || "operator")) || "operator";

    if (!attemptId) {
      return okJson(res, { ok: false, error: "attemptId required" });
    }

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        });
      }

      if (!isUuid(attemptId)) {
        return okJson(res, { ok: false, error: "attemptId must be uuid" });
      }

      const attempt = await getOutboundAttemptById(db, attemptId, tenantKey);
      if (!attempt) {
        return okJson(res, { ok: false, error: "attempt not found" });
      }

      const updated = await markOutboundAttemptDead(db, attemptId, tenantKey);

      await auditSafe(db, {
        actor,
        action: "inbox.outbound.marked_dead",
        objectType: "inbox_outbound_attempt",
        objectId: attemptId,
        meta: {
          threadId: s(updated?.thread_id),
          messageId: s(updated?.message_id),
          previousStatus: s(attempt?.status),
          newStatus: s(updated?.status),
        },
      });

      emitOperatorThreadEvent(wsHub, req, "inbox.outbound.attempt.updated", {
        attempt: updated,
      });

      return okJson(res, { ok: true, attempt: updated });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  });

  r.post("/inbox/threads", async (req, res) => {
    const tenantId = getScopedTenantId(req);
    const tenantKey = getScopedTenantKey(req);
    const channel = lower(req.body?.channel || "instagram") || "instagram";
    const externalThreadId =
      fixText(String(req.body?.externalThreadId || "").trim()) || null;
    const externalUserId =
      fixText(String(req.body?.externalUserId || "").trim()) || null;
    const externalUsername =
      fixText(String(req.body?.externalUsername || "").trim()) || null;
    const customerName = fixText(String(req.body?.customerName || "").trim());
    const status = normalizeThreadStatus(req.body?.status, "open");
    const assignedTo =
      fixText(String(req.body?.assignedTo || "").trim()) || null;
    const labels = Array.isArray(req.body?.labels) ? req.body.labels : [];
    const meta = normalizeObj(req.body?.meta);

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        });
      }

      const result = await db.query(
        `
        insert into inbox_threads (
          tenant_id,
          tenant_key,
          channel,
          external_thread_id,
          external_user_id,
          external_username,
          customer_name,
          status,
          assigned_to,
          labels,
          meta,
          last_message_at
        )
        values (
          nullif($1::text, '')::uuid,
          $2::text,
          $3::text,
          $4::text,
          $5::text,
          $6::text,
          $7::text,
          $8::text,
          $9::text,
          $10::jsonb,
          $11::jsonb,
          now()
        )
        returning
          id,
          tenant_id,
          tenant_key,
          channel,
          external_thread_id,
          external_user_id,
          external_username,
          customer_name,
          status,
          last_message_at,
          last_inbound_at,
          last_outbound_at,
          unread_count,
          assigned_to,
          labels,
          meta,
          handoff_active,
          handoff_reason,
          handoff_priority,
          handoff_at,
          handoff_by,
          created_at,
          updated_at
        `,
        [
          tenantId,
          tenantKey,
          channel,
          externalThreadId,
          externalUserId,
          externalUsername,
          customerName,
          status,
          assignedTo,
          JSON.stringify(labels),
          JSON.stringify(meta),
        ]
      );

      const thread = normalizeThread(result.rows?.[0] || null);

      emitOperatorThreadEvent(wsHub, req, "inbox.thread.created", { thread });

      await auditSafe(db, {
        actor: "ai_hq",
        action: "inbox.thread.manual_created",
        objectType: "inbox_thread",
        objectId: s(thread?.id),
        meta: {
          tenantKey,
          channel,
          externalThreadId: s(externalThreadId),
        },
      });

      return okJson(res, { ok: true, thread });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  });

  r.post("/inbox/threads/:id/messages", async (req, res) => {
    const threadId = s(req.params.id);
    const tenantKey = getScopedTenantKey(req);
    const direction = lower(req.body?.direction || "inbound") || "inbound";
    const senderType = lower(req.body?.senderType || "customer") || "customer";
    const externalMessageId =
      fixText(String(req.body?.externalMessageId || "").trim()) || null;
    const requestedMessageType =
      lower(req.body?.messageType || "text") || "text";
    const messageType = normalizeInboxMessageType(requestedMessageType, "text");
    const text = fixText(String(req.body?.text || "").trim());
    const attachments = Array.isArray(req.body?.attachments)
      ? req.body.attachments
      : [];
    const meta = normalizeObj(req.body?.meta);
    const releaseHandoff = truthy(req.body?.releaseHandoff);

    if (!threadId) {
      return okJson(res, { ok: false, error: "threadId required" });
    }

    const isControlMessage = isControlMessageType(requestedMessageType);
    if (!isControlMessage && !text && attachments.length === 0) {
      return okJson(res, { ok: false, error: "text or attachments required" });
    }

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        });
      }

      if (!isUuid(threadId)) {
        return okJson(res, { ok: false, error: "threadId must be uuid" });
      }

      const existingThread = await getThreadById(db, threadId, tenantKey);
      if (!existingThread) {
        return okJson(res, { ok: false, error: "thread not found" });
      }

      const mergedMeta = {
        ...meta,
        originalMessageType: requestedMessageType,
        storageMessageType: messageType,
      };

      let message = null;
      let correlatedMessage = null;

      if (direction === "outbound") {
        const client = await db.connect();
        try {
          await client.query("BEGIN");

          const delivery = await persistOutboundMessage({
            client,
            thread: existingThread,
            tenantId: existingThread?.tenant_id || "",
            tenantKey,
            channel: existingThread?.channel || "instagram",
            recipientId:
              s(mergedMeta?.recipientId) ||
              s(existingThread?.external_user_id) ||
              null,
            senderType,
            externalMessageId,
            requestedMessageType,
            storageMessageType: messageType,
            text,
            attachments,
            meta: mergedMeta,
            provider: s(mergedMeta?.provider || "meta") || "meta",
            maxAttempts: clamp(toInt(req.body?.maxAttempts, 5), 1, 20),
            enqueueExecution: !externalMessageId,
          });

          if (releaseHandoff && !["agent", "operator"].includes(senderType)) {
            await client.query(
              `
              update inbox_threads
              set
                handoff_active = false,
                handoff_reason = '',
                handoff_priority = 'normal',
                handoff_at = null,
                handoff_by = null,
                meta = jsonb_set(
                  coalesce(meta, '{}'::jsonb),
                  '{handoff}',
                  $3::jsonb,
                  true
                ),
                updated_at = now()
              where id = $1::uuid
                and tenant_key = $2::text
              `,
              [threadId, tenantKey, buildHandoffMeta(false)]
            );
          }

          await client.query("COMMIT");
          message = delivery.message;
          correlatedMessage = withMessageOutboundAttemptCorrelation(message, {
            message_id: message?.id,
            attempt_ids: delivery?.attempt?.id ? [delivery.attempt.id] : [],
          });
        } catch (error) {
          try {
            await client.query("ROLLBACK");
          } catch {}
          throw error;
        } finally {
          try {
            client.release();
          } catch {}
        }
      } else {
        const insert = await db.query(
          `
          insert into inbox_messages (
            thread_id,
            tenant_key,
            direction,
            sender_type,
            external_message_id,
            message_type,
            text,
            attachments,
            meta,
            sent_at
          )
          values (
            $1::uuid,
            $2::text,
            $3::text,
            $4::text,
            $5::text,
            $6::text,
            $7::text,
            $8::jsonb,
            $9::jsonb,
            now()
          )
          returning
            id,
            thread_id,
            tenant_id,
            tenant_key,
            direction,
            sender_type,
            external_message_id,
            message_type,
            text,
            attachments,
            meta,
            sent_at,
            created_at
          `,
          [
            threadId,
            tenantKey,
            direction,
            senderType,
            externalMessageId,
            messageType,
            text,
            JSON.stringify(attachments),
            JSON.stringify(mergedMeta),
          ]
        );

        message = normalizeMessage(insert.rows?.[0] || null);

        await db.query(
          `
          update inbox_threads
          set
            last_message_at = now(),
            last_inbound_at = case when $2::text = 'inbound' then now() else last_inbound_at end,
            last_outbound_at = case when $2::text = 'outbound' then now() else last_outbound_at end,
            unread_count = case
              when $2::text = 'inbound' then coalesce(unread_count, 0) + 1
              else unread_count
            end,
            handoff_active = case when $3::boolean = true then false else handoff_active end,
            handoff_reason = case when $3::boolean = true then '' else handoff_reason end,
            handoff_priority = case when $3::boolean = true then 'normal' else handoff_priority end,
            handoff_at = case when $3::boolean = true then null else handoff_at end,
            handoff_by = case when $3::boolean = true then null else handoff_by end,
            meta = case
              when $3::boolean = true then
                jsonb_set(coalesce(meta, '{}'::jsonb), '{handoff}', $5::jsonb, true)
              else coalesce(meta, '{}'::jsonb)
            end,
            updated_at = now()
          where id = $1::uuid
            and tenant_key = $4::text
          `,
          [threadId, direction, releaseHandoff, tenantKey, buildHandoffMeta(false)]
        );

        correlatedMessage = withMessageOutboundAttemptCorrelation(message, null);
      }

      const thread = await refreshThread(db, threadId, null, tenantKey);

      emitOperatorThreadEvent(wsHub, req, "inbox.message.created", {
        threadId,
        message: correlatedMessage,
        thread,
      });

      emitOperatorThreadEvent(wsHub, req, "inbox.thread.updated", { thread });

      await auditSafe(db, {
        actor:
          senderType === "agent"
            ? s(req.body?.operatorName || "operator")
            : "ai_hq",
        action: "inbox.message.manual_created",
        objectType: "inbox_message",
        objectId: s(message?.id),
        meta: {
          tenantKey,
          threadId,
          direction,
          senderType,
          requestedMessageType,
          storedMessageType: messageType,
          externalMessageId: s(externalMessageId),
          releaseHandoff,
        },
      });

      return okJson(res, { ok: true, message: correlatedMessage, thread });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  });

  r.post("/inbox/threads/:id/read", async (req, res) => {
    const threadId = s(req.params.id);
    const tenantKey = getScopedTenantKey(req);

    if (!threadId) {
      return okJson(res, { ok: false, error: "threadId required" });
    }

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        });
      }

      if (!isUuid(threadId)) {
        return okJson(res, { ok: false, error: "threadId must be uuid" });
      }

      const existingThread = await getThreadById(db, threadId, tenantKey);
      if (!existingThread) {
        return okJson(res, { ok: false, error: "thread not found" });
      }

      await db.query(
        `
        update inbox_threads
        set unread_count = 0, updated_at = now()
        where id = $1::uuid
          and tenant_key = $2::text
        `,
        [threadId, tenantKey]
      );

      const thread = await refreshThread(db, threadId, null, tenantKey);

      emitOperatorThreadEvent(wsHub, req, "inbox.thread.read", { threadId });
      emitOperatorThreadEvent(wsHub, req, "inbox.thread.updated", { thread });

      await auditSafe(db, {
        actor: "ai_hq",
        action: "inbox.thread.read",
        objectType: "inbox_thread",
        objectId: threadId,
        meta: {},
      });

      return okJson(res, { ok: true, threadId, thread });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  });

  r.post("/inbox/threads/:id/assign", async (req, res) => {
    const threadId = s(req.params.id);
    const tenantKey = getScopedTenantKey(req);
    const assignedTo = fixText(s(req.body?.assignedTo));
    const actor =
      fixText(s(req.body?.actor || assignedTo || "operator")) || "operator";

    if (!threadId) {
      return okJson(res, { ok: false, error: "threadId required" });
    }
    if (!assignedTo) {
      return okJson(res, { ok: false, error: "assignedTo required" });
    }

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        });
      }

      if (!isUuid(threadId)) {
        return okJson(res, { ok: false, error: "threadId must be uuid" });
      }

      const existingThread = await getThreadById(db, threadId, tenantKey);
      if (!existingThread) {
        return okJson(res, { ok: false, error: "thread not found" });
      }

      await db.query(
        `
        update inbox_threads
        set
          assigned_to = $3::text,
          updated_at = now()
        where id = $1::uuid
          and tenant_key = $2::text
        `,
        [threadId, tenantKey, assignedTo]
      );

      const thread = await refreshThread(db, threadId, null, tenantKey);

      emitOperatorThreadEvent(wsHub, req, "inbox.thread.updated", { thread });

      await auditSafe(db, {
        actor,
        action: "inbox.thread.assigned",
        objectType: "inbox_thread",
        objectId: threadId,
        meta: {
          assignedTo,
        },
      });

      return okJson(res, { ok: true, thread });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  });

  r.post("/inbox/threads/:id/handoff/activate", async (req, res) => {
    const threadId = s(req.params.id);
    const tenantKey = getScopedTenantKey(req);
    const actor = fixText(s(req.body?.actor || "operator")) || "operator";
    const assignedTo = fixText(s(req.body?.assignedTo || actor)) || actor;
    const reason =
      fixText(s(req.body?.reason || "manual_review")) || "manual_review";
    const priority = fixText(s(req.body?.priority || "high")) || "high";

    if (!threadId) {
      return okJson(res, { ok: false, error: "threadId required" });
    }

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        });
      }

      if (!isUuid(threadId)) {
        return okJson(res, { ok: false, error: "threadId must be uuid" });
      }

      const existingThread = await getThreadById(db, threadId, tenantKey);
      if (!existingThread) {
        return okJson(res, { ok: false, error: "thread not found" });
      }

      await db.query(
        `
        update inbox_threads
        set
          handoff_active = true,
          handoff_reason = $3::text,
          handoff_priority = $4::text,
          handoff_at = now(),
          handoff_by = $5::text,
          assigned_to = $6::text,
          meta = jsonb_set(
            coalesce(meta, '{}'::jsonb),
            '{handoff}',
            $7::jsonb,
            true
          ),
          updated_at = now()
        where id = $1::uuid
          and tenant_key = $2::text
        `,
        [
          threadId,
          tenantKey,
          reason,
          priority,
          actor,
          assignedTo,
          buildHandoffMeta(true, reason, priority, actor),
        ]
      );

      const thread = await refreshThread(db, threadId, null, tenantKey);

      emitOperatorThreadEvent(wsHub, req, "inbox.thread.updated", { thread });

      await auditSafe(db, {
        actor,
        action: "inbox.thread.handoff_activated",
        objectType: "inbox_thread",
        objectId: threadId,
        meta: {
          reason,
          priority,
          assignedTo,
        },
      });

      return okJson(res, { ok: true, thread });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  });

  r.post("/inbox/threads/:id/handoff/release", async (req, res) => {
    const threadId = s(req.params.id);
    const tenantKey = getScopedTenantKey(req);
    const actor = fixText(s(req.body?.actor || "operator")) || "operator";

    if (!threadId) {
      return okJson(res, { ok: false, error: "threadId required" });
    }

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        });
      }

      if (!isUuid(threadId)) {
        return okJson(res, { ok: false, error: "threadId must be uuid" });
      }

      const existingThread = await getThreadById(db, threadId, tenantKey);
      if (!existingThread) {
        return okJson(res, { ok: false, error: "thread not found" });
      }

      await db.query(
        `
        update inbox_threads
        set
          handoff_active = false,
          handoff_reason = '',
          handoff_priority = 'normal',
          handoff_at = null,
          handoff_by = null,
          meta = jsonb_set(
            coalesce(meta, '{}'::jsonb),
            '{handoff}',
            $3::jsonb,
            true
          ),
          updated_at = now()
        where id = $1::uuid
          and tenant_key = $2::text
        `,
        [threadId, tenantKey, buildHandoffMeta(false)]
      );

      const thread = await refreshThread(db, threadId, null, tenantKey);

      emitOperatorThreadEvent(wsHub, req, "inbox.thread.updated", { thread });

      await auditSafe(db, {
        actor,
        action: "inbox.thread.handoff_released",
        objectType: "inbox_thread",
        objectId: threadId,
        meta: {},
      });

      return okJson(res, { ok: true, thread });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  });

  r.post("/inbox/threads/:id/status", async (req, res) => {
    const threadId = s(req.params.id);
    const tenantKey = getScopedTenantKey(req);
    const actor = fixText(s(req.body?.actor || "operator")) || "operator";
    const status = normalizeThreadStatus(req.body?.status, "open");

    if (!threadId) {
      return okJson(res, { ok: false, error: "threadId required" });
    }
    if (!status) {
      return okJson(res, { ok: false, error: "status required" });
    }

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        });
      }

      if (!isUuid(threadId)) {
        return okJson(res, { ok: false, error: "threadId must be uuid" });
      }

      const existingThread = await getThreadById(db, threadId, tenantKey);
      if (!existingThread) {
        return okJson(res, { ok: false, error: "thread not found" });
      }

      const shouldClearHandoff = ["resolved", "closed"].includes(status);

      await db.query(
        `
        update inbox_threads
        set
          status = $3::text,
          handoff_active = case when $4::boolean = true then false else handoff_active end,
          handoff_reason = case when $4::boolean = true then '' else handoff_reason end,
          handoff_priority = case when $4::boolean = true then 'normal' else handoff_priority end,
          handoff_at = case when $4::boolean = true then null else handoff_at end,
          handoff_by = case when $4::boolean = true then null else handoff_by end,
          meta = case
            when $4::boolean = true then
              jsonb_set(coalesce(meta, '{}'::jsonb), '{handoff}', $5::jsonb, true)
            else coalesce(meta, '{}'::jsonb)
          end,
          updated_at = now()
        where id = $1::uuid
          and tenant_key = $2::text
        `,
        [threadId, tenantKey, status, shouldClearHandoff, buildHandoffMeta(false)]
      );

      const thread = await refreshThread(db, threadId, null, tenantKey);

      emitOperatorThreadEvent(wsHub, req, "inbox.thread.updated", { thread });

      await auditSafe(db, {
        actor,
        action: "inbox.thread.status_changed",
        objectType: "inbox_thread",
        objectId: threadId,
        meta: {
          status,
        },
      });

      return okJson(res, { ok: true, thread });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  });

  return r;
}