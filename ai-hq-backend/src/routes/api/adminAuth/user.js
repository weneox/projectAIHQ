import express from "express";
import {
  isUserAuthConfigured,
  verifyUserPassword,
  createUserSessionRecord,
  userCookieOptions,
  clearUserCookie,
  getUserCookieName,
  parseCookies,
  revokeUserSessionByToken,
  checkLoginRateLimit,
  registerFailedLoginAttempt,
  clearLoginAttempts,
} from "../../../utils/adminAuth.js";
import { cfg } from "../../../config.js";
import { s, lower, getIp, setNoStore, isDbTimeoutError } from "./utils.js";
import { findTenantUserForLogin, markUserLogin } from "./repository.js";

export function userLoginRoutes({ db } = {}) {
  const r = express.Router();

  r.post("/auth/login", async (req, res) => {
    setNoStore(res);

    if (!db) {
      return res.status(503).json({
        ok: false,
        error: "Database is not available",
      });
    }

    if (!isUserAuthConfigured()) {
      return res.status(500).json({
        ok: false,
        error: "User auth is not configured",
      });
    }

    const email = lower(req.body?.email);
    const password = s(req.body?.password);
    const tenantKey = s(
      req.body?.tenantKey ||
        req.body?.tenant_key ||
        req.body?.workspace ||
        req.body?.tenantId ||
        req.body?.tenant_id ||
        ""
    );

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "email is required",
      });
    }

    if (!password) {
      return res.status(400).json({
        ok: false,
        error: "password is required",
      });
    }

    const rateLimitScope = `user:${tenantKey || "any"}:${email}`;
    let rl = null;
    try {
      rl = await checkLoginRateLimit(db, {
        actorType: "user",
        scopeKey: rateLimitScope,
        ip: getIp(req),
        windowMs: Number(cfg.auth.userRateLimitWindowMs || 15 * 60 * 1000),
        maxAttempts: Number(cfg.auth.userRateLimitMaxAttempts || 8),
      });
    } catch {}

    if (rl && !rl.ok) {
      return res.status(429).json({
        ok: false,
        error: "Too many failed attempts. Try again later.",
        retryAfterMs: Math.max(0, Number(rl.resetAt || 0) - Date.now()),
      });
    }

    let user;
    try {
      user = await findTenantUserForLogin(db, { email, tenantKey });
    } catch (e) {
      const timeout = isDbTimeoutError(e);
      return res.status(timeout ? 503 : 500).json({
        ok: false,
        error: timeout ? "Authentication database timeout" : "Login query failed",
        reason: timeout ? "auth_db_timeout" : s(e?.message || e || "Login query failed"),
      });
    }

    if (!user) {
      await registerFailedLoginAttempt(db, {
        actorType: "user",
        scopeKey: rateLimitScope,
        ip: getIp(req),
        windowMs: Number(cfg.auth.userRateLimitWindowMs || 15 * 60 * 1000),
        maxAttempts: Number(cfg.auth.userRateLimitMaxAttempts || 8),
        blockMs: Number(cfg.auth.userRateLimitBlockMs || 15 * 60 * 1000),
      });
      return res.status(401).json({
        ok: false,
        error: "Invalid credentials",
      });
    }

    if (s(user.status) !== "active") {
      return res.status(403).json({
        ok: false,
        error: "User is not active",
      });
    }

    if (s(user.auth_provider, "local") !== "local") {
      return res.status(400).json({
        ok: false,
        error: `This account uses ${s(user.auth_provider)} login`,
      });
    }

    if (!s(user.password_hash)) {
      return res.status(403).json({
        ok: false,
        error: "Password is not set for this account",
      });
    }

    const valid = verifyUserPassword(password, user.password_hash);
    if (!valid) {
      await registerFailedLoginAttempt(db, {
        actorType: "user",
        scopeKey: rateLimitScope,
        ip: getIp(req),
        windowMs: Number(cfg.auth.userRateLimitWindowMs || 15 * 60 * 1000),
        maxAttempts: Number(cfg.auth.userRateLimitMaxAttempts || 8),
        blockMs: Number(cfg.auth.userRateLimitBlockMs || 15 * 60 * 1000),
      });
      return res.status(401).json({
        ok: false,
        error: "Invalid credentials",
      });
    }

    const { token, expiresAt } = await createUserSessionRecord(
      db,
      {
        id: user.id,
        tenant_id: user.tenant_id,
        tenant_key: user.tenant_key,
        user_email: user.user_email,
        full_name: user.full_name,
        role: user.role,
        session_version: user.session_version,
      },
      {
        ip: getIp(req),
        ua: s(req.headers["user-agent"]),
      }
    );

    await clearLoginAttempts(db, {
      actorType: "user",
      scopeKey: rateLimitScope,
      ip: getIp(req),
    });

    clearUserCookie(res);
    res.cookie(getUserCookieName(), token, userCookieOptions());

    await markUserLogin(db, user.id);

    return res.status(200).json({
      ok: true,
      authenticated: true,
      authType: "tenant_user",
      user: {
        id: user.id,
        email: user.user_email,
        fullName: user.full_name || "",
        role: user.role,
        tenantId: user.tenant_id,
        tenantKey: user.tenant_key,
        companyName: user.company_name || "",
        sessionExpiresAt: expiresAt,
      },
    });
  });

  r.post("/auth/logout", async (req, res) => {
    setNoStore(res);
    try {
      const rawToken = s(parseCookies(req)?.[getUserCookieName()]);
      if (rawToken) {
        await revokeUserSessionByToken(db, rawToken);
      }
    } catch {}
    clearUserCookie(res);

    return res.status(200).json({
      ok: true,
      loggedOut: true,
      authenticated: false,
    });
  });

  return r;
}
