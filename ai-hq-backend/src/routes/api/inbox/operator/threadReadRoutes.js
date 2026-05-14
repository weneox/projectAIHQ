import express from "express";

import { okJson, isDbReady, isUuid } from "../../../../utils/http.js";
import { fixText } from "../../../../utils/textFix.js";
import {
  THREAD_LIST_IDENTITY_LATERAL,
  buildRenderablePreviewLateralSql,
  clamp,
  getThreadById,
  isRenderableConversationMessage,
  listOutboundAttemptCorrelationsByMessageIds,
  listOutboundAttemptsByThread,
  normalizeMessage,
  normalizeThread,
  pickConversationPreviewText,
  s,
  toInt,
  truthy,
  withMessageOutboundAttemptCorrelation,
} from "../../../../modules/inbox/index.js";
import {
  getScopedTenantId,
  getScopedTenantKey,
  lower,
} from "./routeHelpers.js";

export function registerInboxThreadReadOperatorRoutes(r, { db, wsHub }) {
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
    const tenantId = getScopedTenantId(req);

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
        { threadId, tenantKey }
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

  return r;
}

export function inboxThreadReadOperatorRoutes({ db, wsHub }) {
  const r = express.Router();
  return registerInboxThreadReadOperatorRoutes(r, { db, wsHub });
}
