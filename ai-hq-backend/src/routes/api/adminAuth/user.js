import express from "express";
import {
  isUserAuthConfigured,
  verifyUserPassword,
  createUserSessionRecord,
  createUserLoginSelectionToken,
  userCookieOptions,
  clearUserCookie,
  getUserCookieName,
  parseCookies,
  revokeUserSessionByToken,
  checkLoginRateLimit,
  registerFailedLoginAttempt,
  clearLoginAttempts,
  resolveTenantKeyFromRequestHost,
  verifyUserLoginSelectionToken,
} from "../../../utils/adminAuth.js";
import { cfg } from "../../../config.js";
import { s, lower, getIp, setNoStore, isDbTimeoutError } from "./utils.js";
import { listTenantUsersForLogin, markUserLogin } from "./repository.js";

function normalizeTenantKeyInput(body = {}) {
  return s(
    body?.tenantKey ||
      body?.tenant_key ||
      body?.workspace ||
      body?.tenantId ||
      body?.tenant_id ||
      ""
  ).toLowerCase();
}

function buildRateLimitScope(email, tenantKey = "") {
  return `user:${s(tenantKey).toLowerCase() || "any"}:${lower(email)}`;
}

function buildAccountChoice(user = {}) {
  return {
    selectionToken: createUserLoginSelectionToken(user),
    tenantKey: s(user.tenant_key).toLowerCase(),
    tenantId: s(user.tenant_id),
    companyName: s(user.company_name),
    email: lower(user.user_email),
    fullName: s(user.full_name),
    role: s(user.role || "member").toLowerCase(),
    status: s(user.status || "").toLowerCase(),
    authProvider: s(user.auth_provider || "local").toLowerCase(),
    passwordReady: Boolean(s(user.password_hash)),
  };
}

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
    const explicitTenantKey = normalizeTenantKeyInput(req.body);
    const hostTenantKey = resolveTenantKeyFromRequestHost(req);
    const tenantKey = hostTenantKey || explicitTenantKey;
    const accountSelectionToken = s(
      req.body?.accountSelectionToken || req.body?.account_selection_token
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

    const rateLimitScope = buildRateLimitScope(email, tenantKey);
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

    let candidates = [];
    try {
      candidates = await listTenantUsersForLogin(db, { email, tenantKey });
    } catch (e) {
      const timeout = isDbTimeoutError(e);
      return res.status(timeout ? 503 : 500).json({
        ok: false,
        error: timeout ? "Authentication database timeout" : "Login query failed",
        reason: timeout ? "auth_db_timeout" : s(e?.message || e || "Login query failed"),
      });
    }

    const activeCandidates = candidates.filter(
      (candidate) => s(candidate.status).toLowerCase() === "active"
    );

    let user = null;

    if (accountSelectionToken) {
      const checked = verifyUserLoginSelectionToken(accountSelectionToken);
      if (!checked?.ok || lower(checked.payload?.email) !== email) {
        return res.status(400).json({
          ok: false,
          error: "Account selection is no longer valid",
          code: "invalid_account_selection",
        });
      }

      user =
        candidates.find(
          (candidate) =>
            s(candidate.id) === s(checked.payload?.userId) &&
            s(candidate.tenant_id) === s(checked.payload?.tenantId) &&
            lower(candidate.user_email) === lower(checked.payload?.email) &&
            lower(candidate.tenant_key) === lower(checked.payload?.tenantKey)
        ) || null;

      if (!user) {
        return res.status(400).json({
          ok: false,
          error: "Account selection is no longer valid",
          code: "invalid_account_selection",
        });
      }
    } else if (activeCandidates.length === 1) {
      user = activeCandidates[0];
    } else if (activeCandidates.length > 1) {
      return res.status(409).json({
        ok: false,
        error: "Multiple accounts found for this email",
        code: "multiple_accounts",
        message: "Select the correct workspace to continue.",
        accounts: activeCandidates.map(buildAccountChoice),
        tenantResolvedFromHost: Boolean(hostTenantKey),
      });
    } else if (candidates.length === 1) {
      user = candidates[0];
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

    const resolvedRateLimitScope = buildRateLimitScope(email, user.tenant_key || tenantKey);

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
        scopeKey: resolvedRateLimitScope,
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
      scopeKey: resolvedRateLimitScope,
      ip: getIp(req),
    });
    if (resolvedRateLimitScope !== rateLimitScope) {
      await clearLoginAttempts(db, {
        actorType: "user",
        scopeKey: rateLimitScope,
        ip: getIp(req),
      });
    }

    clearUserCookie(res);
    res.cookie(getUserCookieName(), token, userCookieOptions(req));

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
