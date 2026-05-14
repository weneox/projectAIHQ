import express from "express";

import { okJson, isDbReady, isUuid } from "../../../../utils/http.js";
import { fixText } from "../../../../utils/textFix.js";
import {
  clamp,
  getOutboundAttemptById,
  getOutboundAttemptsSummary,
  listFailedOutboundAttempts,
  markOutboundAttemptDead,
  s,
  scheduleOutboundRetry,
  toInt,
} from "../../../../modules/inbox/index.js";
import {
  auditSafe,
  emitOperatorThreadEvent,
  getScopedTenantKey,
} from "./routeHelpers.js";

export function inboxOutboundOperatorRoutes({ db, wsHub }) {
  const r = express.Router();

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

  return r;
}
