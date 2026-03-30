// src/routes/api/inbox/handlers.js
// FINAL v1.1 — inbox public/operator handlers
// migrated from inbox.js (excluding internal ingest/outbound routes)

import express from "express";
import { okJson, isDbReady, isUuid } from "../../../utils/http.js";
import { fixText } from "../../../utils/textFix.js";
import { writeAudit } from "../../../utils/auditLog.js";
import { resolveTenantKeyFromReq } from "../../../tenancy/index.js";
import { emitRealtimeEvent } from "../../../realtime/events.js";

import {
  clamp,
  normalizeMessage,
  normalizeThread,
  s,
  toInt,
  truthy,
  withMessageOutboundAttemptCorrelation,
} from "./shared.js";

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

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

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
  if (["voice_note", "voice-message", "voice_message"].includes(x)) return "voice";
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
  if (["typing", "typing_start", "typing-start", "typingon", "typing-on"].includes(x)) {
    return "system";
  }
  if (["typing_stop", "typing-stop", "typingoff", "typing-off"].includes(x)) {
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

export function inboxHandlers({ db, wsHub }) {
  const r = express.Router();

  r.get("/inbox/threads", async (req, res) => {
    const tenantKey = resolveTenantKeyFromReq(req);
    const status = String(req.query?.status || "").trim().toLowerCase();
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
            coalesce(t.customer_name, '') ilike $${i}
            or coalesce(t.external_username, '') ilike $${i}
            or coalesce(t.external_user_id, '') ilike $${i}
            or coalesce(t.external_thread_id, '') ilike $${i}
          )
        `;
      }

      values.push(limit);

      const sql = `
        select
          t.id,
          t.tenant_key,
          t.channel,
          t.external_thread_id,
          t.external_user_id,
          t.external_username,
          t.customer_name,
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
          (
            select m.text
            from inbox_messages m
            where m.thread_id = t.id
            order by m.sent_at desc, m.created_at desc
            limit 1
          ) as last_message_text
        from inbox_threads t
        ${where}
        order by coalesce(t.last_message_at, t.updated_at, t.created_at) desc
        limit $${values.length}::int
      `;

      const result = await db.query(sql, values);
      const threads = (result.rows || []).map((row) => ({
        ...normalizeThread(row),
        last_message_text: fixText(row.last_message_text || ""),
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
    const threadId = String(req.params.id || "").trim();
    if (!threadId) return okJson(res, { ok: false, error: "threadId required" });

    try {
      if (!isDbReady(db)) {
        return okJson(res, { ok: true, thread: null, dbDisabled: true });
      }

      if (!isUuid(threadId)) {
        return okJson(res, { ok: false, error: "threadId must be uuid" });
      }

      const row = await getThreadById(db, threadId);
      return okJson(res, { ok: true, thread: row });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  });

  r.get("/inbox/threads/:id/messages", async (req, res) => {
    const threadId = String(req.params.id || "").trim();
    const limit = clamp(toInt(req.query?.limit, 200), 1, 1000);

    if (!threadId) return okJson(res, { ok: false, error: "threadId required" });

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

      const result = await db.query(
        `
        select
          id,
          thread_id,
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
        order by sent_at asc, created_at asc
        limit $2::int
        `,
        [threadId, limit]
      );

      const messages = (result.rows || []).map(normalizeMessage);
      const correlations = await listOutboundAttemptCorrelationsByMessageIds(
        db,
        messages
          .filter((message) => s(message?.direction).toLowerCase() === "outbound")
          .map((message) => message.id),
        { threadId }
      );
      const hydratedMessages = messages.map((message) =>
        withMessageOutboundAttemptCorrelation(message, correlations.get(message.id) || null)
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
    const limit = clamp(toInt(req.query?.limit, 100), 1, 500);

    if (!threadId) return okJson(res, { ok: false, error: "threadId required" });

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

      const thread = await getThreadById(db, threadId);
      if (!thread) return okJson(res, { ok: false, error: "thread not found" });

      const attempts = await listOutboundAttemptsByThread(db, threadId, limit);

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

  r.post("/inbox/outbound/:attemptId/resend", async (req, res) => {
    const attemptId = s(req.params.attemptId);
    const actor = fixText(s(req.body?.actor || "operator")) || "operator";
    const retryDelaySeconds = clamp(toInt(req.body?.retryDelaySeconds, 0), 0, 86400);

    if (!attemptId) return okJson(res, { ok: false, error: "attemptId required" });

    try {
      if (!isDbReady(db)) {
        return okJson(res, { ok: false, error: "db disabled", dbDisabled: true });
      }

      if (!isUuid(attemptId)) {
        return okJson(res, { ok: false, error: "attemptId must be uuid" });
      }

      const attempt = await getOutboundAttemptById(db, attemptId);
      if (!attempt) return okJson(res, { ok: false, error: "attempt not found" });

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
        retryDelaySeconds,
      });

      try {
        await writeAudit(db, {
          actor,
          action: "inbox.outbound.retry_scheduled",
          objectType: "inbox_outbound_attempt",
          objectId: attemptId,
          meta: {
            threadId: String(updated?.thread_id || ""),
            messageId: String(updated?.message_id || ""),
            retryDelaySeconds,
            previousStatus: String(attempt?.status || ""),
            newStatus: String(updated?.status || ""),
          },
        });
      } catch {}

      try {
        emitRealtimeEvent(wsHub, {
          type: "inbox.outbound.attempt.updated",
          audience: "operator",
          tenantKey: updated?.tenant_key || req.auth?.tenantKey,
          tenantId: updated?.tenant_id || req.auth?.tenantId,
          attempt: updated,
        });
      } catch {}

      return okJson(res, {
        ok: true,
        attempt: updated,
      });
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
    const actor = fixText(s(req.body?.actor || "operator")) || "operator";

    if (!attemptId) return okJson(res, { ok: false, error: "attemptId required" });

    try {
      if (!isDbReady(db)) {
        return okJson(res, { ok: false, error: "db disabled", dbDisabled: true });
      }

      if (!isUuid(attemptId)) {
        return okJson(res, { ok: false, error: "attemptId must be uuid" });
      }

      const attempt = await getOutboundAttemptById(db, attemptId);
      if (!attempt) return okJson(res, { ok: false, error: "attempt not found" });

      const updated = await markOutboundAttemptDead(db, attemptId);

      try {
        await writeAudit(db, {
          actor,
          action: "inbox.outbound.marked_dead",
          objectType: "inbox_outbound_attempt",
          objectId: attemptId,
          meta: {
            threadId: String(updated?.thread_id || ""),
            messageId: String(updated?.message_id || ""),
            previousStatus: String(attempt?.status || ""),
            newStatus: String(updated?.status || ""),
          },
        });
      } catch {}

      try {
        emitRealtimeEvent(wsHub, {
          type: "inbox.outbound.attempt.updated",
          audience: "operator",
          tenantKey: updated?.tenant_key || req.auth?.tenantKey,
          tenantId: updated?.tenant_id || req.auth?.tenantId,
          attempt: updated,
        });
      } catch {}

      return okJson(res, {
        ok: true,
        attempt: updated,
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  });

  r.post("/inbox/threads", async (req, res) => {
    const tenantKey = resolveTenantKeyFromReq(req);
    const channel = String(req.body?.channel || "instagram").trim().toLowerCase() || "instagram";
    const externalThreadId = fixText(String(req.body?.externalThreadId || "").trim()) || null;
    const externalUserId = fixText(String(req.body?.externalUserId || "").trim()) || null;
    const externalUsername = fixText(String(req.body?.externalUsername || "").trim()) || null;
    const customerName = fixText(String(req.body?.customerName || "").trim());
    const status = String(req.body?.status || "open").trim().toLowerCase() || "open";
    const assignedTo = fixText(String(req.body?.assignedTo || "").trim()) || null;
    const labels = Array.isArray(req.body?.labels) ? req.body.labels : [];
    const meta = normalizeObj(req.body?.meta);

    try {
      if (!isDbReady(db)) {
        return okJson(res, { ok: false, error: "db disabled", dbDisabled: true });
      }

      const result = await db.query(
        `
        insert into inbox_threads (
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
          $1::text,
          $2::text,
          $3::text,
          $4::text,
          $5::text,
          $6::text,
          $7::text,
          $8::text,
          $9::jsonb,
          $10::jsonb,
          now()
        )
        returning
          id,
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

      try {
        emitRealtimeEvent(wsHub, {
          type: "inbox.thread.created",
          audience: "operator",
          tenantKey: thread?.tenant_key || req.auth?.tenantKey,
          tenantId: thread?.tenant_id || req.auth?.tenantId,
          thread,
        });
      } catch {}

      try {
        await writeAudit(db, {
          actor: "ai_hq",
          action: "inbox.thread.manual_created",
          objectType: "inbox_thread",
          objectId: String(thread?.id || ""),
          meta: {
            tenantKey,
            channel,
            externalThreadId: String(externalThreadId || ""),
          },
        });
      } catch {}

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
    const threadId = String(req.params.id || "").trim();
    const tenantKey = resolveTenantKeyFromReq(req);
    const direction = String(req.body?.direction || "inbound").trim().toLowerCase() || "inbound";
    const senderType =
      String(req.body?.senderType || "customer").trim().toLowerCase() || "customer";
    const externalMessageId = fixText(String(req.body?.externalMessageId || "").trim()) || null;
    const requestedMessageType =
      String(req.body?.messageType || "text").trim().toLowerCase() || "text";
    const messageType = normalizeInboxMessageType(requestedMessageType, "text");
    const text = fixText(String(req.body?.text || "").trim());
    const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
    const meta = normalizeObj(req.body?.meta);
    const releaseHandoff = truthy(req.body?.releaseHandoff);

    if (!threadId) return okJson(res, { ok: false, error: "threadId required" });

    const isControlMessage = isControlMessageType(requestedMessageType);
    if (!isControlMessage && !text && attachments.length === 0) {
      return okJson(res, { ok: false, error: "text or attachments required" });
    }

    try {
      if (!isDbReady(db)) {
        return okJson(res, { ok: false, error: "db disabled", dbDisabled: true });
      }

      if (!isUuid(threadId)) {
        return okJson(res, { ok: false, error: "threadId must be uuid" });
      }

      const existingThread = await getThreadById(db, threadId);
      if (!existingThread) {
        return okJson(res, { ok: false, error: "thread not found" });
      }

      const mergedMeta = {
        ...meta,
        originalMessageType: requestedMessageType,
        storageMessageType: messageType,
      };

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

      const message = normalizeMessage(insert.rows?.[0] || null);

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
          handoff_active = case
            when $3::boolean = true then false
            else handoff_active
          end,
          handoff_reason = case
            when $3::boolean = true then ''
            else handoff_reason
          end,
          handoff_priority = case
            when $3::boolean = true then 'normal'
            else handoff_priority
          end,
          handoff_at = case
            when $3::boolean = true then null
            else handoff_at
          end,
          handoff_by = case
            when $3::boolean = true then null
            else handoff_by
          end,
          meta = case
            when $3::boolean = true then
              jsonb_set(
                coalesce(meta, '{}'::jsonb),
                '{handoff}',
                '{"active":false,"reason":"","priority":"normal","at":null,"by":null}'::jsonb,
                true
              )
            else coalesce(meta, '{}'::jsonb)
          end,
          updated_at = now()
        where id = $1::uuid
        `,
        [threadId, direction, releaseHandoff]
      );

      const thread = await refreshThread(db, threadId, null);

      const correlatedMessage = withMessageOutboundAttemptCorrelation(
        message,
        direction === "outbound" ? { message_id: message?.id, attempt_ids: [] } : null
      );

      try {
        emitRealtimeEvent(wsHub, {
          type: "inbox.message.created",
          audience: "operator",
          tenantKey:
            correlatedMessage?.tenant_key || thread?.tenant_key || req.auth?.tenantKey,
          tenantId:
            correlatedMessage?.tenant_id || thread?.tenant_id || req.auth?.tenantId,
          threadId,
          message: correlatedMessage,
        });
      } catch {}

      try {
        emitRealtimeEvent(wsHub, {
          type: "inbox.thread.updated",
          audience: "operator",
          tenantKey: thread?.tenant_key || req.auth?.tenantKey,
          tenantId: thread?.tenant_id || req.auth?.tenantId,
          thread,
        });
      } catch {}

      try {
        await writeAudit(db, {
          actor: senderType === "agent" ? s(req.body?.operatorName || "operator") : "ai_hq",
          action: "inbox.message.manual_created",
          objectType: "inbox_message",
          objectId: String(message?.id || ""),
          meta: {
            tenantKey,
            threadId,
            direction,
            senderType,
            requestedMessageType,
            storedMessageType: messageType,
            externalMessageId: String(externalMessageId || ""),
            releaseHandoff,
          },
        });
      } catch {}

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
    const threadId = String(req.params.id || "").trim();
    if (!threadId) return okJson(res, { ok: false, error: "threadId required" });

    try {
      if (!isDbReady(db)) {
        return okJson(res, { ok: false, error: "db disabled", dbDisabled: true });
      }

      if (!isUuid(threadId)) {
        return okJson(res, { ok: false, error: "threadId must be uuid" });
      }

      await db.query(
        `
        update inbox_threads
        set unread_count = 0, updated_at = now()
        where id = $1::uuid
        `,
        [threadId]
      );

      const thread = await refreshThread(db, threadId, null);

      try {
        emitRealtimeEvent(wsHub, {
          type: "inbox.thread.read",
          audience: "operator",
          tenantKey: thread?.tenant_key || req.auth?.tenantKey,
          tenantId: thread?.tenant_id || req.auth?.tenantId,
          threadId,
        });
      } catch {}

      try {
        emitRealtimeEvent(wsHub, {
          type: "inbox.thread.updated",
          audience: "operator",
          tenantKey: thread?.tenant_key || req.auth?.tenantKey,
          tenantId: thread?.tenant_id || req.auth?.tenantId,
          thread,
        });
      } catch {}

      try {
        await writeAudit(db, {
          actor: "ai_hq",
          action: "inbox.thread.read",
          objectType: "inbox_thread",
          objectId: threadId,
          meta: {},
        });
      } catch {}

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
    const assignedTo = fixText(s(req.body?.assignedTo));
    const actor = fixText(s(req.body?.actor || assignedTo || "operator")) || "operator";

    if (!threadId) return okJson(res, { ok: false, error: "threadId required" });
    if (!assignedTo) return okJson(res, { ok: false, error: "assignedTo required" });

    try {
      if (!isDbReady(db)) {
        return okJson(res, { ok: false, error: "db disabled", dbDisabled: true });
      }
      if (!isUuid(threadId)) {
        return okJson(res, { ok: false, error: "threadId must be uuid" });
      }

      const updated = await db.query(
        `
        update inbox_threads
        set
          assigned_to = $2::text,
          updated_at = now()
        where id = $1::uuid
        returning
          id,
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
        [threadId, assignedTo]
      );

      const thread = normalizeThread(updated.rows?.[0] || null);
      if (!thread) return okJson(res, { ok: false, error: "thread not found" });

      try {
        emitRealtimeEvent(wsHub, {
          type: "inbox.thread.updated",
          audience: "operator",
          tenantKey: thread?.tenant_key || req.auth?.tenantKey,
          tenantId: thread?.tenant_id || req.auth?.tenantId,
          thread,
        });
      } catch {}

      try {
        await writeAudit(db, {
          actor,
          action: "inbox.thread.assigned",
          objectType: "inbox_thread",
          objectId: threadId,
          meta: { assignedTo },
        });
      } catch {}

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
    const actor = fixText(s(req.body?.actor || "operator")) || "operator";
    const assignedTo = fixText(s(req.body?.assignedTo || "")) || "human_handoff";
    const reason = fixText(s(req.body?.reason || "manual_review")) || "manual_review";
    const priority = fixText(s(req.body?.priority || "high")).toLowerCase() || "high";

    if (!threadId) return okJson(res, { ok: false, error: "threadId required" });

    try {
      if (!isDbReady(db)) {
        return okJson(res, { ok: false, error: "db disabled", dbDisabled: true });
      }
      if (!isUuid(threadId)) {
        return okJson(res, { ok: false, error: "threadId must be uuid" });
      }

      const updated = await db.query(
        `
        update inbox_threads
        set
          assigned_to = coalesce(nullif($2::text, ''), assigned_to),
          status = 'open',
          labels = (
            select coalesce(jsonb_agg(distinct v), '[]'::jsonb)
            from jsonb_array_elements_text(
              coalesce(labels, '[]'::jsonb) || to_jsonb(array['handoff', $3::text]::text[])
            ) as t(v)
          ),
          handoff_active = true,
          handoff_reason = $4::text,
          handoff_priority = $3::text,
          handoff_at = now(),
          handoff_by = $5::text,
          meta = coalesce(meta, '{}'::jsonb) || $6::jsonb,
          updated_at = now()
        where id = $1::uuid
        returning
          id,
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
          threadId,
          assignedTo,
          priority,
          reason,
          actor,
          JSON.stringify({
            handoff: {
              active: true,
              reason,
              priority,
              at: new Date().toISOString(),
              by: actor,
            },
          }),
        ]
      );

      const thread = normalizeThread(updated.rows?.[0] || null);
      if (!thread) return okJson(res, { ok: false, error: "thread not found" });

      try {
        emitRealtimeEvent(wsHub, {
          type: "inbox.thread.updated",
          audience: "operator",
          tenantKey: thread?.tenant_key || req.auth?.tenantKey,
          tenantId: thread?.tenant_id || req.auth?.tenantId,
          thread,
        });
      } catch {}

      try {
        await writeAudit(db, {
          actor,
          action: "inbox.handoff.activated",
          objectType: "inbox_thread",
          objectId: threadId,
          meta: { assignedTo, reason, priority },
        });
      } catch {}

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
    const actor = fixText(s(req.body?.actor || "operator")) || "operator";

    if (!threadId) return okJson(res, { ok: false, error: "threadId required" });

    try {
      if (!isDbReady(db)) {
        return okJson(res, { ok: false, error: "db disabled", dbDisabled: true });
      }
      if (!isUuid(threadId)) {
        return okJson(res, { ok: false, error: "threadId must be uuid" });
      }

      const updated = await db.query(
        `
        update inbox_threads
        set
          handoff_active = false,
          handoff_reason = '',
          handoff_priority = 'normal',
          handoff_at = null,
          handoff_by = null,
          meta = coalesce(meta, '{}'::jsonb) || '{"handoff":{"active":false,"reason":"","priority":"normal","at":null,"by":null}}'::jsonb,
          updated_at = now()
        where id = $1::uuid
        returning
          id,
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
        [threadId]
      );

      const thread = normalizeThread(updated.rows?.[0] || null);
      if (!thread) return okJson(res, { ok: false, error: "thread not found" });

      try {
        emitRealtimeEvent(wsHub, {
          type: "inbox.thread.updated",
          audience: "operator",
          tenantKey: thread?.tenant_key || req.auth?.tenantKey,
          tenantId: thread?.tenant_id || req.auth?.tenantId,
          thread,
        });
      } catch {}

      try {
        await writeAudit(db, {
          actor,
          action: "inbox.handoff.released",
          objectType: "inbox_thread",
          objectId: threadId,
          meta: {},
        });
      } catch {}

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
    const actor = fixText(s(req.body?.actor || "operator")) || "operator";
    const status = fixText(s(req.body?.status || "")).toLowerCase();

    if (!threadId) return okJson(res, { ok: false, error: "threadId required" });
    if (!status) return okJson(res, { ok: false, error: "status required" });

    const allowed = new Set(["open", "pending", "resolved", "closed", "spam"]);
    if (!allowed.has(status)) {
      return okJson(res, { ok: false, error: "invalid status" });
    }

    try {
      if (!isDbReady(db)) {
        return okJson(res, { ok: false, error: "db disabled", dbDisabled: true });
      }
      if (!isUuid(threadId)) {
        return okJson(res, { ok: false, error: "threadId must be uuid" });
      }

      const updated = await db.query(
        `
        update inbox_threads
        set
          status = $2::text,
          updated_at = now()
        where id = $1::uuid
        returning
          id,
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
        [threadId, status]
      );

      const thread = normalizeThread(updated.rows?.[0] || null);
      if (!thread) return okJson(res, { ok: false, error: "thread not found" });

      try {
        emitRealtimeEvent(wsHub, {
          type: "inbox.thread.updated",
          audience: "operator",
          tenantKey: thread?.tenant_key || req.auth?.tenantKey,
          tenantId: thread?.tenant_id || req.auth?.tenantId,
          thread,
        });
      } catch {}

      try {
        await writeAudit(db, {
          actor,
          action: "inbox.thread.status_changed",
          objectType: "inbox_thread",
          objectId: threadId,
          meta: { status },
        });
      } catch {}

      return okJson(res, { ok: true, thread });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  });

  r.get("/inbox/outbound/summary", async (req, res) => {
    const tenantKey = resolveTenantKeyFromReq(req);

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
    const tenantKey = resolveTenantKeyFromReq(req);
    const status = s(req.query?.status || "");
    const limit = clamp(toInt(req.query?.limit, 50), 1, 500);

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: true,
          tenantKey,
          attempts: [],
          dbDisabled: true,
        });
      }

      const attempts = await listFailedOutboundAttempts(db, {
        tenantKey,
        limit,
        status,
      });

      return okJson(res, {
        ok: true,
        tenantKey,
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

  return r;
}
