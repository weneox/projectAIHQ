import express from "express";

import { okJson, isDbReady, isUuid } from "../../../../utils/http.js";
import { fixText } from "../../../../utils/textFix.js";
import {
  buildHandoffMeta,
  getThreadById,
  normalizeThreadStatus,
  refreshThread,
  s,
} from "../../../../modules/inbox/index.js";
import {
  auditSafe,
  emitOperatorThreadEvent,
  getScopedTenantKey,
} from "./routeHelpers.js";

export function registerInboxThreadStateOperatorRoutes(r, { db, wsHub }) {
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
        [
          threadId,
          tenantKey,
          status,
          shouldClearHandoff,
          buildHandoffMeta(false),
        ]
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

export function inboxThreadStateOperatorRoutes({ db, wsHub }) {
  const r = express.Router();
  return registerInboxThreadStateOperatorRoutes(r, { db, wsHub });
}
