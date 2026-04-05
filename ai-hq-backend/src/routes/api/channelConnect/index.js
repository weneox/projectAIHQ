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

export function channelConnectRoutes({ db }) {
  const r = express.Router();

  r.get("/channels/meta/connect-url", requireUserSession, async (req, res) => {
    try {
      const url = await buildMetaOAuthUrl({ db, req });
      return ok(res, { url });
    } catch (err) {
      const status = Number(err?.status || 500);
      if (status === 401) return unauth(res, err?.message || "Unauthorized");
      if (status === 403) {
        return res.status(403).json({ ok: false, error: err?.message || "Forbidden" });
      }
      if (status === 400) return bad(res, err?.message || "Bad request");
      return serverErr(
        res,
        err?.message || "Failed to build Meta connect URL"
      );
    }
  });

  r.get("/channels/meta/connect", requireUserSession, async (req, res) => {
    try {
      const url = await buildMetaOAuthUrl({ db, req });
      return res.redirect(url);
    } catch (err) {
      const status = Number(err?.status || 500);
      if (status === 401) return unauth(res, err?.message || "Unauthorized");
      if (status === 403) {
        return res.status(403).json({ ok: false, error: err?.message || "Forbidden" });
      }
      if (status === 400) return bad(res, err?.message || "Bad request");
      return serverErr(res, err?.message || "Failed to start Meta connect");
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
      });

      if (redirectUrl) return res.redirect(redirectUrl);
      return serverErr(res, err?.message || "Failed to complete Meta connect");
    }
  });

  r.post("/channels/meta/select", requireUserSession, async (req, res) => {
    try {
      const payload = await completeMetaSelection({ db, req });
      return ok(res, payload);
    } catch (err) {
      const status = Number(err?.status || 500);
      if (status === 401) return unauth(res, err?.message || "Unauthorized");
      if (status === 400) return bad(res, err?.message || "Bad request");
      if (status === 409) {
        return res.status(409).json({ ok: false, error: err?.message || "Conflict" });
      }
      return serverErr(res, err?.message || "Failed to complete Meta selection");
    }
  });

  r.get("/channels/meta/status", requireUserSession, async (req, res) => {
    try {
      const payload = await getMetaStatus({ db, req });
      return ok(res, payload);
    } catch (err) {
      const status = Number(err?.status || 500);
      if (status === 401) return unauth(res, err?.message || "Unauthorized");
      if (status === 400) return bad(res, err?.message || "Bad request");
      return serverErr(res, err?.message || "Failed to load Meta status");
    }
  });

  r.post("/channels/meta/disconnect", requireUserSession, async (req, res) => {
    try {
      const payload = await disconnectMeta({ db, req });
      return ok(res, payload);
    } catch (err) {
      const status = Number(err?.status || 500);
      if (status === 401) return unauth(res, err?.message || "Unauthorized");
      if (status === 400) return bad(res, err?.message || "Bad request");
      return serverErr(res, err?.message || "Failed to disconnect Meta");
    }
  });

  return r;
}
