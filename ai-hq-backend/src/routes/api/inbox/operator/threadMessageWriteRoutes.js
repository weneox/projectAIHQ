import express from "express";

import { okJson, isDbReady, isUuid } from "../../../../utils/http.js";
import { requireInboxManualReplyRateLimit } from "../../../../utils/rateLimit.js";
import { fixText } from "../../../../utils/textFix.js";
import {
  buildHandoffMeta,
  clamp,
  getThreadById,
  isControlMessageType,
  normalizeInboxMessageType,
  normalizeMessage,
  normalizeThread,
  normalizeThreadStatus,
  refreshThread,
  s,
  toInt,
  truthy,
  withMessageOutboundAttemptCorrelation,
} from "../../../../modules/inbox/index.js";
import { persistOutboundMessage } from "../../../../modules/inbox/internal/index.js";
import {
  auditSafe,
  emitOperatorThreadEvent,
  getScopedTenantId,
  getScopedTenantKey,
  lower,
} from "./routeHelpers.js";

function normalizeObj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

export function registerInboxThreadMessageWriteOperatorRoutes(
  r,
  { db, wsHub }
) {
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

  r.post("/inbox/threads/:id/messages", requireInboxManualReplyRateLimit, async (req, res) => {
    const threadId = s(req.params.id);
    const tenantKey = getScopedTenantKey(req);
    const tenantId = getScopedTenantId(req);
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
            channel: existingThread?.channel || "",
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
            provider: s(mergedMeta?.provider),
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
            tenant_id,
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
            $2::uuid,
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
            tenantId,
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
            and tenant_id = $6::uuid
          `,
          [threadId, direction, releaseHandoff, tenantKey, buildHandoffMeta(false), tenantId]
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

  return r;
}

export function inboxThreadMessageWriteOperatorRoutes({ db, wsHub }) {
  const r = express.Router();
  return registerInboxThreadMessageWriteOperatorRoutes(r, { db, wsHub });
}
