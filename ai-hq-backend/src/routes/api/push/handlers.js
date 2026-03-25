import { okJson } from "../../../utils/http.js";
import { getDebugTokenAuthResult } from "../../../utils/auth.js";
import {
  normalizeRecipient,
  normalizePushSubscription,
  normalizePushTestPayload,
  s,
} from "./utils.js";
import {
  getVapidPublicKey,
  subscribePush,
  sendPushTest,
} from "./service.js";

export function createPushHandlers({ db, wsHub }) {
  function getPushVapid(_req, res) {
    const out = getVapidPublicKey();

    if (!out.ok) {
      return okJson(res, {
        ok: false,
        error: out.error,
      });
    }

    return okJson(res, {
      ok: true,
      publicKey: out.publicKey,
    });
  }

  function getPushSubscribe(_req, res) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(405).json({
      ok: false,
      error: "Method Not Allowed. Use POST /api/push/subscribe",
    });
  }

  async function postPushSubscribe(req, res) {
    const recipient = normalizeRecipient(req.body?.recipient);
    const { endpoint, p256dh, auth } = normalizePushSubscription(req.body || {});
    const userAgent = s(req.headers["user-agent"]);

    try {
      const out = await subscribePush({
        db,
        recipient,
        endpoint,
        p256dh,
        auth,
        userAgent,
      });

      if (!out.ok) {
        return okJson(res, {
          ok: false,
          error: out.error,
        });
      }

      return okJson(res, {
        ok: true,
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

  async function postPushTest(req, res) {
    const debugAuth = getDebugTokenAuthResult(req);
    if (!debugAuth.ok) {
      const status =
        debugAuth.code === "debug_token_not_configured" ? 500 : 401;

      return res.status(status).json({
        ok: false,
        error:
          debugAuth.code === "debug_token_not_configured"
            ? "DebugAuthMisconfigured"
            : "Unauthorized",
        reason: debugAuth.reason || "invalid debug token",
      });
    }

    const payload = normalizePushTestPayload(req.body || {});

    try {
      const out = await sendPushTest({
        db,
        wsHub,
        title: payload.title,
        body: payload.body,
        data: payload.data,
      });

      if (!out.ok) {
        return okJson(res, {
          ok: false,
          error: out.error,
        });
      }

      return okJson(res, {
        ok: true,
        sent: true,
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
    getPushVapid,
    getPushSubscribe,
    postPushSubscribe,
    postPushTest,
  };
}
