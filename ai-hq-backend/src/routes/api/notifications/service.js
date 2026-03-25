import { assertDbReady } from "../../../utils/http.js";
import {
  dbListNotifications,
  dbMarkNotificationRead,
} from "../../../db/helpers/notifications.js";
import { dbAudit } from "../../../db/helpers/audit.js";

export async function listNotifications({ db, recipient, unreadOnly, limit }) {
  assertDbReady(db);

  const rows = await dbListNotifications(db, { recipient, unreadOnly, limit });
  return {
    notifications: rows,
  };
}

export async function markNotificationRead({ db, wsHub, id }) {
  assertDbReady(db);

  const row = await dbMarkNotificationRead(db, id);
  if (!row) {
    return {
      ok: false,
      error: "not found",
    };
  }

  wsHub?.broadcast?.({ type: "notification.read", notification: row });
  await dbAudit(db, "ceo", "notification.read", "notification", String(row.id), {});

  return {
    ok: true,
    notification: row,
  };
}
