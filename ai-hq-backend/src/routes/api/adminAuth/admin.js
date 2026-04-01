import express from "express";
import {
  isAdminAuthConfigured,
  verifyAdminPasscode,
  createAdminSessionRecord,
  adminCookieOptions,
  clearAdminCookie,
  getAdminCookieName,
  getSessionCookieTokens,
  revokeAdminSessionByToken,
  checkLoginRateLimit,
  registerFailedLoginAttempt,
  clearLoginAttempts,
} from "../../../utils/adminAuth.js";
import { cfg } from "../../../config.js";
import { s, getIp, setNoStore } from "./utils.js";

export function adminLoginRoutes({ db } = {}) {
  const r = express.Router();

  r.post("/admin-auth/login", async (req, res) => {
    setNoStore(res);

    if (!db) {
      return res.status(503).json({
        ok: false,
        error: "Database is not available",
      });
    }

    if (!cfg.auth.adminPanelEnabled) {
      return res.status(403).json({
        ok: false,
        error: "Admin panel disabled",
      });
    }

    if (!isAdminAuthConfigured()) {
      return res.status(500).json({
        ok: false,
        error: "Admin auth is not configured",
      });
    }

    const rl = await checkLoginRateLimit(db, {
      actorType: "admin",
      scopeKey: "admin:passcode",
      ip: getIp(req),
      windowMs: Number(cfg.auth.adminRateLimitWindowMs || 15 * 60 * 1000),
      maxAttempts: Number(cfg.auth.adminRateLimitMaxAttempts || 5),
    });
    if (!rl.ok) {
      return res.status(429).json({
        ok: false,
        error: "Too many failed attempts. Try again later.",
        retryAfterMs: Math.max(0, Number(rl.resetAt || 0) - Date.now()),
      });
    }

    const passcode = s(req.body?.passcode || req.body?.code || "");
    if (!passcode) {
      return res.status(400).json({
        ok: false,
        error: "passcode is required",
      });
    }

    const valid = verifyAdminPasscode(passcode);
    if (!valid) {
      await registerFailedLoginAttempt(db, {
        actorType: "admin",
        scopeKey: "admin:passcode",
        ip: getIp(req),
        windowMs: Number(cfg.auth.adminRateLimitWindowMs || 15 * 60 * 1000),
        maxAttempts: Number(cfg.auth.adminRateLimitMaxAttempts || 5),
        blockMs: Number(cfg.auth.adminRateLimitBlockMs || 15 * 60 * 1000),
      });
      return res.status(401).json({
        ok: false,
        error: "Invalid passcode",
      });
    }

    await clearLoginAttempts(db, {
      actorType: "admin",
      scopeKey: "admin:passcode",
      ip: getIp(req),
    });

    const { token } = await createAdminSessionRecord(db, {
      ip: getIp(req),
      ua: s(req.headers["user-agent"]),
    });

    clearAdminCookie(res);
    res.cookie(getAdminCookieName(), token, adminCookieOptions(req));

    return res.status(200).json({
      ok: true,
      authenticated: true,
      authType: "admin_passcode",
    });
  });

  r.post("/admin-auth/logout", async (req, res) => {
    setNoStore(res);
    try {
      const rawTokens = getSessionCookieTokens(req, getAdminCookieName());
      for (const rawToken of rawTokens) {
        await revokeAdminSessionByToken(db, rawToken);
      }
    } catch {}
    clearAdminCookie(res);

    return res.status(200).json({
      ok: true,
      loggedOut: true,
      authenticated: false,
    });
  });

  return r;
}
