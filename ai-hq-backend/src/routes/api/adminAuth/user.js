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
import {
  findAuthIdentityForLogin,
  listIdentityMembershipChoicesForLogin,
  findLegacyTenantUserForIdentityLogin,
  markIdentityLogin,
  markUserLogin,
} from "./repository.js";

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

async function resolveCompatibleMemberships(db, identity, memberships = []) {
  const resolved = [];

  for (const membership of memberships) {
    const legacyUser = await findLegacyTenantUserForIdentityLogin(db, {
      tenantId: membership.tenant_id,
      email: identity?.primary_email || identity?.normalized_email,
    });

    if (!legacyUser?.id) continue;
    if (s(legacyUser.status).toLowerCase() !== "active") continue;

    resolved.push({
      identity_id: s(identity?.id),
      identity_email: lower(identity?.normalized_email || identity?.primary_email),
      membership_id: s(membership.id),
      tenant_id: s(membership.tenant_id),
      tenant_key: s(membership.tenant_key).toLowerCase(),
      company_name: s(membership.company_name),
      role: s(membership.role || legacyUser.role || "member").toLowerCase(),
      status: s(membership.status || "active").toLowerCase(),
      permissions: membership.permissions || {},
      meta: membership.meta || {},
      legacy_user_id: s(legacyUser.id),
      legacy_user: legacyUser,
    });
  }

  return resolved;
}

function buildMembershipChoice(choice = {}) {
  return {
    selectionToken: createUserLoginSelectionToken({
      identity_id: choice.identity_id,
      membership_id: choice.membership_id,
      userId: choice.legacy_user_id,
      tenant_id: choice.tenant_id,
      tenant_key: choice.tenant_key,
      user_email: choice.identity_email,
    }),
    membershipId: choice.membership_id,
    tenantId: choice.tenant_id,
    tenantKey: choice.tenant_key,
    companyName: choice.company_name,
    email: choice.identity_email,
    role: choice.role,
    status: choice.status,
  };
}

function findSelectedMembership(choices = [], tokenPayload = {}, email = "") {
  return (
    choices.find(
      (choice) =>
        s(choice.identity_id) === s(tokenPayload.identityId) &&
        s(choice.membership_id) === s(tokenPayload.membershipId) &&
        s(choice.tenant_id) === s(tokenPayload.tenantId) &&
        s(choice.tenant_key).toLowerCase() === s(tokenPayload.tenantKey).toLowerCase() &&
        s(choice.legacy_user_id) === s(tokenPayload.userId) &&
        lower(choice.identity_email) === lower(tokenPayload.email) &&
        lower(choice.identity_email) === lower(email)
    ) || null
  );
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

    let identity = null;
    try {
      identity = await findAuthIdentityForLogin(db, { email });
    } catch (e) {
      const timeout = isDbTimeoutError(e);
      return res.status(timeout ? 503 : 500).json({
        ok: false,
        error: timeout ? "Authentication database timeout" : "Login query failed",
        reason: timeout ? "auth_db_timeout" : s(e?.message || e || "Login query failed"),
      });
    }

    if (!identity) {
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

    if (!["active", "invited"].includes(s(identity.status).toLowerCase())) {
      return res.status(403).json({
        ok: false,
        error: "Identity is not active",
      });
    }

    if (s(identity.auth_provider, "local") !== "local") {
      return res.status(400).json({
        ok: false,
        error: `This account uses ${s(identity.auth_provider)} login`,
      });
    }

    if (!s(identity.password_hash)) {
      return res.status(403).json({
        ok: false,
        error: "Password is not set for this account",
      });
    }

    const valid = verifyUserPassword(password, identity.password_hash);
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

    let memberships = [];
    try {
      memberships = await listIdentityMembershipChoicesForLogin(db, {
        identityId: identity.id,
        tenantKey: hostTenantKey || "",
      });
    } catch (e) {
      const timeout = isDbTimeoutError(e);
      return res.status(timeout ? 503 : 500).json({
        ok: false,
        error: timeout ? "Authentication database timeout" : "Membership query failed",
        reason: timeout ? "auth_db_timeout" : s(e?.message || e || "Membership query failed"),
      });
    }

    const compatibleChoices = await resolveCompatibleMemberships(db, identity, memberships);

    if (hostTenantKey) {
      const hostChoice =
        compatibleChoices.find(
          (choice) => s(choice.tenant_key).toLowerCase() === hostTenantKey
        ) || null;

      if (!hostChoice) {
        return res.status(403).json({
          ok: false,
          error: "This identity does not have access to the requested workspace",
          code: "membership_not_found",
        });
      }

      memberships.length = 0;
      memberships.push(hostChoice);
    }

    let selectedChoice = null;

    if (accountSelectionToken) {
      const checked = verifyUserLoginSelectionToken(accountSelectionToken);
      if (!checked?.ok || lower(checked.payload?.email) !== email) {
        return res.status(400).json({
          ok: false,
          error: "Workspace selection is no longer valid",
          code: "invalid_membership_selection",
        });
      }

      selectedChoice = findSelectedMembership(
        compatibleChoices,
        checked.payload,
        email
      );

      if (!selectedChoice) {
        return res.status(400).json({
          ok: false,
          error: "Workspace selection is no longer valid",
          code: "invalid_membership_selection",
        });
      }
    } else if (hostTenantKey) {
      selectedChoice = memberships[0] || null;
    } else if (compatibleChoices.length === 1) {
      selectedChoice = compatibleChoices[0];
    } else if (compatibleChoices.length > 1) {
      return res.status(409).json({
        ok: false,
        error: "Multiple workspaces found for this identity",
        code: "multiple_memberships",
        message: "Select the correct workspace to continue.",
        memberships: compatibleChoices.map(buildMembershipChoice),
        accounts: compatibleChoices.map(buildMembershipChoice),
      });
    }

    if (!selectedChoice?.legacy_user?.id) {
      return res.status(403).json({
        ok: false,
        error: "No compatible workspace session profile was found",
        code: "legacy_membership_bridge_missing",
      });
    }

    const legacyUser = selectedChoice.legacy_user;
    const resolvedRateLimitScope = buildRateLimitScope(email, selectedChoice.tenant_key);

    const { token, expiresAt } = await createUserSessionRecord(
      db,
      {
        id: legacyUser.id,
        tenant_id: legacyUser.tenant_id,
        tenant_key: legacyUser.tenant_key,
        user_email: legacyUser.user_email,
        full_name: legacyUser.full_name,
        role: legacyUser.role,
        session_version: legacyUser.session_version,
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

    await Promise.allSettled([
      markIdentityLogin(db, identity.id),
      markUserLogin(db, legacyUser.id),
    ]);

    return res.status(200).json({
      ok: true,
      authenticated: true,
      authType: "tenant_user",
      user: {
        id: legacyUser.id,
        email: identity.primary_email || identity.normalized_email,
        fullName: legacyUser.full_name || "",
        role: legacyUser.role,
        tenantId: legacyUser.tenant_id,
        tenantKey: legacyUser.tenant_key,
        companyName: legacyUser.company_name || "",
        identityId: identity.id,
        membershipId: selectedChoice.membership_id,
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
