import express from "express";

import { requireUserSession } from "../../../utils/adminAuth.js";
import {
  ok,
  bad,
  unauth,
  serverErr,
  buildRedirectUrl,
  s,
} from "./utils.js";
import {
  buildMetaOAuthUrl,
  handleMetaCallback,
  completeMetaSelection,
  getMetaStatus,
  disconnectMeta,
} from "./meta.js";
import {
  connectTelegram,
  disconnectTelegram,
  getTelegramStatus,
} from "./telegram.js";
import {
  checkWebsiteDomainVerification,
  createWebsiteDomainVerificationChallenge,
  createWebsiteWidgetInstallHandoff,
  getWebsiteDomainVerificationStatus,
  getWebsiteWidgetStatus,
  saveWebsiteWidgetConfig,
} from "./website.js";

function respondRouteError(res, err, fallbackMessage, extra = {}) {
  const status = Number(err?.status || 500);

  if (status === 401) {
    return unauth(res, err?.message || "Unauthorized", extra);
  }

  if (status === 400) {
    return bad(res, err?.message || "Bad request", extra);
  }

  if (status === 403) {
    return res.status(403).json({
      ok: false,
      error: err?.message || "Forbidden",
      ...extra,
    });
  }

  if (status === 409) {
    return res.status(409).json({
      ok: false,
      error: err?.message || "Conflict",
      ...extra,
    });
  }

  return serverErr(res, err?.message || fallbackMessage, extra);
}

export function channelConnectRoutes({ db }) {
  const r = express.Router();

  r.get("/channels/meta/connect-url", requireUserSession, async (req, res) => {
    try {
      const url = await buildMetaOAuthUrl({ db, req });
      return ok(res, { url });
    } catch (err) {
      return respondRouteError(
        res,
        err,
        "Failed to build Meta connect URL"
      );
    }
  });

  r.get("/channels/meta/connect", requireUserSession, async (req, res) => {
    try {
      const url = await buildMetaOAuthUrl({ db, req });
      return res.redirect(url);
    } catch (err) {
      return respondRouteError(res, err, "Failed to start Meta connect");
    }
  });

  r.get("/channels/meta/callback", async (req, res) => {
    try {
      const result = await handleMetaCallback({ db, req });

      if (result?.type === "redirect_or_error") {
        if (result.redirectUrl) return res.redirect(result.redirectUrl);
        return bad(res, result.error || "Meta connect failed");
      }

      if (result?.redirectUrl) return res.redirect(result.redirectUrl);
      return ok(res, result?.payload || {});
    } catch (err) {
      const redirectUrl = buildRedirectUrl({
        section: "channels",
        meta_error: s(err?.message || "Meta callback failed"),
        meta_reason: s(err?.reasonCode || ""),
      });

      if (redirectUrl) return res.redirect(redirectUrl);

      return respondRouteError(
        res,
        err,
        "Failed to complete Meta connect",
        {
          reasonCode: err?.reasonCode || null,
        }
      );
    }
  });

  r.post("/channels/meta/select", requireUserSession, async (req, res) => {
    try {
      const payload = await completeMetaSelection({ db, req });
      return ok(res, payload);
    } catch (err) {
      return respondRouteError(
        res,
        err,
        "Failed to complete Meta selection"
      );
    }
  });

  r.get("/channels/meta/status", requireUserSession, async (req, res) => {
    try {
      const payload = await getMetaStatus({ db, req });
      return ok(res, payload);
    } catch (err) {
      return respondRouteError(res, err, "Failed to load Meta status");
    }
  });

  r.post("/channels/meta/disconnect", requireUserSession, async (req, res) => {
    try {
      const payload = await disconnectMeta({ db, req });
      return ok(res, payload);
    } catch (err) {
      return respondRouteError(res, err, "Failed to disconnect Meta");
    }
  });

  r.post("/channels/telegram/connect", requireUserSession, async (req, res) => {
    try {
      const payload = await connectTelegram({ db, req });
      return ok(res, payload);
    } catch (err) {
      return respondRouteError(res, err, "Failed to connect Telegram", {
        reasonCode: err?.reasonCode || null,
      });
    }
  });

  r.get("/channels/telegram/status", requireUserSession, async (req, res) => {
    try {
      const payload = await getTelegramStatus({ db, req });
      return ok(res, payload);
    } catch (err) {
      return respondRouteError(res, err, "Failed to load Telegram status", {
        reasonCode: err?.reasonCode || null,
      });
    }
  });

  r.post(
    "/channels/telegram/disconnect",
    requireUserSession,
    async (req, res) => {
      try {
        const payload = await disconnectTelegram({ db, req });
        return ok(res, payload);
      } catch (err) {
        return respondRouteError(
          res,
          err,
          "Failed to disconnect Telegram",
          {
            reasonCode: err?.reasonCode || null,
          }
        );
      }
    }
  );

  r.get("/channels/webchat/status", requireUserSession, async (req, res) => {
    try {
      const payload = await getWebsiteWidgetStatus({ db, req });
      return ok(res, payload);
    } catch (err) {
      return respondRouteError(
        res,
        err,
        "Failed to load website widget status"
      );
    }
  });

  r.post("/channels/webchat/config", requireUserSession, async (req, res) => {
    try {
      const payload = await saveWebsiteWidgetConfig({ db, req });
      return ok(res, payload);
    } catch (err) {
      return respondRouteError(
        res,
        err,
        "Failed to save website widget config"
      );
    }
  });

  r.get(
    "/channels/webchat/domain-verification",
    requireUserSession,
    async (req, res) => {
      try {
        const payload = await getWebsiteDomainVerificationStatus({ db, req });
        return ok(res, payload);
      } catch (err) {
        return respondRouteError(
          res,
          err,
          "Failed to load website domain verification status",
          {
            reasonCode: err?.reasonCode || null,
          }
        );
      }
    }
  );

  r.post(
    "/channels/webchat/domain-verification/challenge",
    requireUserSession,
    async (req, res) => {
      try {
        const payload = await createWebsiteDomainVerificationChallenge({
          db,
          req,
        });
        return ok(res, payload);
      } catch (err) {
        return respondRouteError(
          res,
          err,
          "Failed to create website domain verification challenge",
          {
            reasonCode: err?.reasonCode || null,
          }
        );
      }
    }
  );

  r.post(
    "/channels/webchat/domain-verification/check",
    requireUserSession,
    async (req, res) => {
      try {
        const payload = await checkWebsiteDomainVerification({ db, req });
        return ok(res, payload);
      } catch (err) {
        return respondRouteError(
          res,
          err,
          "Failed to check website domain verification",
          {
            reasonCode: err?.reasonCode || null,
          }
        );
      }
    }
  );

  r.post(
    "/channels/webchat/install-handoff",
    requireUserSession,
    async (req, res) => {
      try {
        const payload = await createWebsiteWidgetInstallHandoff({ db, req });
        return ok(res, payload);
      } catch (err) {
        return respondRouteError(
          res,
          err,
          "Failed to prepare website developer install handoff",
          {
            reasonCode: err?.reasonCode || null,
          }
        );
      }
    }
  );

  return r;
}

export { channelConnectPublicRoutes } from "./public.js";
