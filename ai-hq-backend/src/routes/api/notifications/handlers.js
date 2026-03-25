import { okJson } from "../../../utils/http.js";
import {
  normalizeRecipient,
  normalizeUnreadOnly,
  normalizeLimit,
  normalizeNotificationId,
} from "./utils.js";
import {
  listNotifications,
  markNotificationRead,
} from "./service.js";

export function createNotificationHandlers({ db, wsHub }) {
  async function getNotifications(req, res) {
    const recipient = normalizeRecipient(req.query.recipient);
    const unreadOnly = normalizeUnreadOnly(req.query.unread);
    const limit = normalizeLimit(req.query.limit);

    try {
      const out = await listNotifications({
        db,
        recipient,
        unreadOnly,
        limit,
      });

      return okJson(res, {
        ok: true,
        recipient,
        unreadOnly,
        notifications: out.notifications,
        ...(out.dbDisabled ? { dbDisabled: true } : {}),
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  async function postNotificationRead(req, res) {
    const id = normalizeNotificationId(req.params.id);

    if (!id) {
      return okJson(res, { ok: false, error: "notification id required" });
    }

    try {
      const out = await markNotificationRead({ db, wsHub, id });

      if (!out.ok) {
        return okJson(res, {
          ok: false,
          error: out.error,
          ...(out.dbDisabled ? { dbDisabled: true } : {}),
        });
      }

      return okJson(res, {
        ok: true,
        notification: out.notification,
        ...(out.dbDisabled ? { dbDisabled: true } : {}),
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  return {
    getNotifications,
    postNotificationRead,
  };
}