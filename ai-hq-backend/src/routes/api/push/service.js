import { cfg } from "../../../config.js";
import { assertDbReady } from "../../../utils/http.js";
import { dbUpsertPushSub } from "../../../db/helpers/push.js";
import { pushBroadcastToCeo } from "../../../services/pushBroadcast.js";
import { dbCreateNotification } from "../../../db/helpers/notifications.js";
import { dbAudit } from "../../../db/helpers/audit.js";

export function getVapidPublicKey() {
  if (!cfg.push.enabled) {
    return { ok: false, error: "push disabled" };
  }

  const publicKey = String(cfg.push.vapidPublicKey || "").trim();
  if (!publicKey) {
    return { ok: false, error: "VAPID_PUBLIC_KEY not set" };
  }

  return {
    ok: true,
    publicKey,
  };
}

export async function subscribePush({
  db,
  recipient,
  endpoint,
  p256dh,
  auth,
  userAgent,
}) {
  if (!endpoint || !p256dh || !auth) {
    return {
      ok: false,
      error: "subscription {endpoint, keys.p256dh, keys.auth} required",
    };
  }

  assertDbReady(db);

  await dbUpsertPushSub(db, {
    recipient,
    endpoint,
    p256dh,
    auth,
    userAgent,
  });

  return {
    ok: true,
  };
}

export async function sendPushTest({ db, wsHub, title, body, data }) {
  if (!cfg.push.enabled) {
    return { ok: false, error: "push disabled" };
  }

  await pushBroadcastToCeo({ db, title, body, data });
  assertDbReady(db);

  const notif = await dbCreateNotification(db, {
    recipient: "ceo",
    type: "info",
    title: "Push Test Sent",
    body,
    payload: { title, body, data },
  });

  wsHub?.broadcast?.({ type: "notification.created", notification: notif });
  await dbAudit(db, "system", "push.test", "push", null, { title });

  return {
    ok: true,
    sent: true,
    notification: notif,
  };
}
