import express from "express";
import {
  isUserAuthConfigured,
  verifyUserPassword,
  createUserSessionRecord,
  switchUserSessionWorkspaceByToken,
  createUserLoginSelectionToken,
  userCookieOptions,
  clearUserCookie,
  getUserCookieName,
  parseCookies,
  revokeUserSessionByToken,
  loadUserSessionFromRequest,
  checkLoginRateLimit,
  registerFailedLoginAttempt,
  clearLoginAttempts,
  resolveTenantKeyFromRequestHost,
  verifyUserLoginSelectionToken,
  verifyUserWorkspaceSwitchToken,
} from "../../../utils/adminAuth.js";
import { cfg } from "../../../config.js";
import { s, lower, getIp, setNoStore, isDbTimeoutError } from "./utils.js";
import {
  buildWorkspaceAccessSummary,
  loadActiveWorkspaceContract,
} from "../../../services/workspace/activeWorkspace.js";
import {
  findAuthIdentityForLogin,
  listIdentityMembershipChoicesForLogin,
  findLegacyTenantUserForIdentityLogin,
  markIdentityLogin,
  markUserLogin,
} from "./repository.js";
import {
  ensureCanonicalAndLegacyAccessForEmail,
  ensureLegacyBridgeForMemberships,
  repairCanonicalAccessFromLegacyUsers,
} from "../../../services/auth/canonicalUserAccess.js";

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

async function enrichMembershipChoices(
  resolveWorkspaceState,
  choices = []
) {
  const resolved = await Promise.all(
    choices.map(async (choice) => {
      const workspace = await resolveWorkspaceState({
        tenantId: choice.tenant_id,
        tenantKey: choice.tenant_key,
        membershipId: choice.membership_id,
        role: choice.role,
        tenant: {
          id: choice.tenant_id,
          tenant_key: choice.tenant_key,
          company_name: choice.company_name,
        },
      });

      return {
        ...choice,
        workspace,
      };
    })
  );

  return resolved;
}

function buildMembershipChoice(choice = {}) {
  return {
    ...buildWorkspaceAccessSummary({
      workspace: choice.workspace,
      membershipId: choice.membership_id,
      tenantId: choice.tenant_id,
      tenantKey: choice.tenant_key,
      companyName: choice.company_name,
      role: choice.role,
      selectionToken: createUserLoginSelectionToken({
        identity_id: choice.identity_id,
        membership_id: choice.membership_id,
        userId: choice.legacy_user_id,
        tenant_id: choice.tenant_id,
        tenant_key: choice.tenant_key,
        user_email: choice.identity_email,
      }),
    }),
    email: choice.identity_email,
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

async function finalizeWorkspaceLogin({
  db,
  req,
  res,
  identity,
  selectedChoice,
  resolvedRateLimitScope,
  rateLimitScope,
}) {
  if (!selectedChoice?.legacy_user?.id) {
    return res.status(403).json({
      ok: false,
      error: "No compatible workspace session profile was found",
      code: "legacy_membership_bridge_missing",
    });
  }

  const legacyUser = selectedChoice.legacy_user;
  const workspace = selectedChoice.workspace || {};

  const { token, expiresAt } = await createUserSessionRecord(
    db,
    {
      identityId: identity.id,
      membershipId: selectedChoice.membership_id,
      tenant_id: legacyUser.tenant_id,
      tenant_key: legacyUser.tenant_key,
      session_version: 1,
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
    workspace,
    destination: workspace?.destination || {
      kind: "workspace",
      path: "/workspace",
    },
  });
}

export function userLoginRoutes({ db, resolveWorkspaceState = loadActiveWorkspaceContract } = {}) {
  const r = express.Router();

  async function authenticateIdentityRequest(req, res) {
    const email = lower(req.body?.email);
    const password = s(req.body?.password);
    const explicitTenantKey = normalizeTenantKeyInput(req.body);
    const hostTenantKey = resolveTenantKeyFromRequestHost(req);
    const requestedTenantKey = hostTenantKey || explicitTenantKey || "";
    const tenantKey = requestedTenantKey;
    const accountSelectionToken = s(
      req.body?.accountSelectionToken || req.body?.account_selection_token
    );

    if (!email) {
      res.status(400).json({
        ok: false,
        error: "email is required",
      });
      return null;
    }

    if (!password) {
      res.status(400).json({
        ok: false,
        error: "password is required",
      });
      return null;
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
      res.status(429).json({
        ok: false,
        error: "Too many failed attempts. Try again later.",
        retryAfterMs: Math.max(0, Number(rl.resetAt || 0) - Date.now()),
      });
      return null;
    }

    let identity = null;
    try {
      const bootstrap = await ensureCanonicalAndLegacyAccessForEmail(db, {
        email,
        tenantKey: requestedTenantKey,
      });
      identity = bootstrap?.identity || (await findAuthIdentityForLogin(db, { email }));
    } catch (e) {
      const timeout = isDbTimeoutError(e);
      res.status(timeout ? 503 : 500).json({
        ok: false,
        error: timeout ? "Authentication database timeout" : "Login query failed",
        reason: timeout ? "auth_db_timeout" : s(e?.message || e || "Login query failed"),
      });
      return null;
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
      res.status(401).json({
        ok: false,
        error: "Invalid credentials",
      });
      return null;
    }

    if (!["active", "invited"].includes(s(identity.status).toLowerCase())) {
      res.status(403).json({
        ok: false,
        error: "Identity is not active",
      });
      return null;
    }

    if (s(identity.auth_provider, "local") !== "local") {
      res.status(400).json({
        ok: false,
        error: `This account uses ${s(identity.auth_provider)} login`,
      });
      return null;
    }

    if (!s(identity.password_hash)) {
      res.status(403).json({
        ok: false,
        error: "Password is not set for this account",
      });
      return null;
    }

    let valid = verifyUserPassword(password, identity.password_hash);
    if (!valid) {
      try {
        const repaired = await repairCanonicalAccessFromLegacyUsers(db, {
          email,
          tenantKey: requestedTenantKey,
          forcePasswordHashFromLegacy: true,
        });
        if (repaired?.identity?.id) {
          identity = repaired.identity;
          valid = verifyUserPassword(password, identity.password_hash);
        }
      } catch {}
    }

    if (!valid) {
      await registerFailedLoginAttempt(db, {
        actorType: "user",
        scopeKey: rateLimitScope,
        ip: getIp(req),
        windowMs: Number(cfg.auth.userRateLimitWindowMs || 15 * 60 * 1000),
        maxAttempts: Number(cfg.auth.userRateLimitMaxAttempts || 8),
        blockMs: Number(cfg.auth.userRateLimitBlockMs || 15 * 60 * 1000),
      });
      res.status(401).json({
        ok: false,
        error: "Invalid credentials",
      });
      return null;
    }

    return {
      email,
      identity,
      requestedTenantKey,
      rateLimitScope,
      accountSelectionToken,
    };
  }

  async function resolveLoginChoices({
    identity,
    requestedTenantKey = "",
    email = "",
    res,
  }) {
    let memberships = [];
    try {
      memberships = await listIdentityMembershipChoicesForLogin(db, {
        identityId: identity.id,
        tenantKey: requestedTenantKey,
      });
    } catch (e) {
      const timeout = isDbTimeoutError(e);
      res.status(timeout ? 503 : 500).json({
        ok: false,
        error: timeout ? "Authentication database timeout" : "Membership query failed",
        reason: timeout ? "auth_db_timeout" : s(e?.message || e || "Membership query failed"),
      });
      return null;
    }

    if (!memberships.length) {
      try {
        await repairCanonicalAccessFromLegacyUsers(db, {
          email: email || identity?.primary_email || identity?.normalized_email,
          tenantKey: requestedTenantKey,
        });
        memberships = await listIdentityMembershipChoicesForLogin(db, {
          identityId: identity.id,
          tenantKey: requestedTenantKey,
        });
      } catch {}
    }

    let compatibleChoices = await resolveCompatibleMemberships(db, identity, memberships);
    if (!compatibleChoices.length && memberships.length) {
      try {
        await ensureLegacyBridgeForMemberships(db, identity, memberships);
        compatibleChoices = await resolveCompatibleMemberships(db, identity, memberships);
      } catch {}
    }

    const enrichedChoices = await enrichMembershipChoices(
      resolveWorkspaceState,
      compatibleChoices
    );

    if (!memberships.length && requestedTenantKey) {
      res.status(403).json({
        ok: false,
        error: "This identity does not have access to the requested workspace",
        code: "membership_not_found",
      });
      return null;
    }

    if (!memberships.length) {
      res.status(403).json({
        ok: false,
        error: "This identity is not linked to any workspace",
        code: "identity_membership_missing",
      });
      return null;
    }

    if (requestedTenantKey) {
      const requestedChoice =
        enrichedChoices.find(
          (choice) => s(choice.tenant_key).toLowerCase() === requestedTenantKey
        ) || null;

      if (!requestedChoice) {
        res.status(403).json({
          ok: false,
          error: "This identity does not have access to the requested workspace",
          code: "membership_not_found",
        });
        return null;
      }

      return {
        compatibleChoices: enrichedChoices,
        narrowedChoices: [requestedChoice],
      };
    }

    return {
      compatibleChoices: enrichedChoices,
      narrowedChoices: enrichedChoices,
    };
  }

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

    const authAttempt = await authenticateIdentityRequest(req, res);
    if (!authAttempt) return;

    const {
      email,
      identity,
      requestedTenantKey,
      rateLimitScope,
      accountSelectionToken,
    } = authAttempt;

    const resolvedChoices = await resolveLoginChoices({
      identity,
      requestedTenantKey,
      email,
      res,
    });
    if (!resolvedChoices) return;

    const { compatibleChoices, narrowedChoices } = resolvedChoices;

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
    } else if (requestedTenantKey) {
      selectedChoice = narrowedChoices[0] || null;
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
        selectionRequired: true,
      });
    }

    if (!selectedChoice) {
      return res.status(403).json({
        ok: false,
        error: "No compatible workspace session profile was found",
        code: "legacy_membership_bridge_missing",
      });
    }

    const resolvedRateLimitScope = buildRateLimitScope(email, selectedChoice.tenant_key);
    return finalizeWorkspaceLogin({
      db,
      req,
      res,
      identity,
      selectedChoice,
      resolvedRateLimitScope,
      rateLimitScope,
    });
  });

  r.post("/auth/select-workspace", async (req, res) => {
    setNoStore(res);

    if (!db) {
      return res.status(503).json({
        ok: false,
        error: "Database is not available",
      });
    }

    const accountSelectionToken = s(
      req.body?.accountSelectionToken || req.body?.account_selection_token
    );

    if (!accountSelectionToken) {
      return res.status(400).json({
        ok: false,
        error: "accountSelectionToken is required",
      });
    }

    const authAttempt = await authenticateIdentityRequest(req, res);
    if (!authAttempt) return;

    const {
      email,
      identity,
      requestedTenantKey,
      rateLimitScope,
    } = authAttempt;

    const resolvedChoices = await resolveLoginChoices({
      identity,
      requestedTenantKey,
      email,
      res,
    });
    if (!resolvedChoices) return;

    const { compatibleChoices } = resolvedChoices;
    const checked = verifyUserLoginSelectionToken(accountSelectionToken);
    if (!checked?.ok || lower(checked.payload?.email) !== email) {
      return res.status(400).json({
        ok: false,
        error: "Workspace selection is no longer valid",
        code: "invalid_membership_selection",
      });
    }

    const selectedChoice = findSelectedMembership(
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

    const resolvedRateLimitScope = buildRateLimitScope(email, selectedChoice.tenant_key);
    return finalizeWorkspaceLogin({
      db,
      req,
      res,
      identity,
      selectedChoice,
      resolvedRateLimitScope,
      rateLimitScope,
    });
  });

  r.post("/auth/switch-workspace", async (req, res) => {
    setNoStore(res);

    if (!db) {
      return res.status(503).json({
        ok: false,
        error: "Database is not available",
      });
    }

    const session = await loadUserSessionFromRequest(req, { db, touch: false });
    if (!session?.ok || !session?.payload) {
      clearUserCookie(res);
      return res.status(401).json({
        ok: false,
        error: "Unauthorized",
        reason: session?.error || "invalid_session",
      });
    }

    const hostTenantKey = resolveTenantKeyFromRequestHost(req);
    const switchToken = s(req.body?.switchToken || req.body?.switch_token);
    if (!switchToken) {
      return res.status(400).json({
        ok: false,
        error: "switchToken is required",
      });
    }

    const checked = verifyUserWorkspaceSwitchToken(switchToken);
    if (!checked?.ok) {
      return res.status(400).json({
        ok: false,
        error: "Workspace selection is no longer valid",
        code: "invalid_workspace_switch",
      });
    }

    if (s(checked.payload?.identityId) !== s(session.payload.identityId)) {
      return res.status(403).json({
        ok: false,
        error: "This session cannot access the requested workspace",
        code: "workspace_not_allowed",
      });
    }

    if (
      hostTenantKey &&
      s(checked.payload?.tenantKey).toLowerCase() !== s(hostTenantKey).toLowerCase()
    ) {
      return res.status(403).json({
        ok: false,
        error: "This session cannot access the requested workspace",
        code: "workspace_not_allowed",
      });
    }

    const memberships = await listIdentityMembershipChoicesForLogin(db, {
      identityId: session.payload.identityId,
      tenantKey: hostTenantKey || "",
    });
    const membership =
      memberships.find(
        (item) =>
          s(item.id) === s(checked.payload.membershipId) &&
          s(item.tenant_id) === s(checked.payload.tenantId) &&
          s(item.tenant_key).toLowerCase() === s(checked.payload.tenantKey).toLowerCase()
      ) || null;

    if (!membership) {
      return res.status(403).json({
        ok: false,
        error: "This session cannot access the requested workspace",
        code: "workspace_not_allowed",
      });
    }

    const identity = await findAuthIdentityForLogin(db, { email: session.payload.email });
    if (!identity?.id || s(identity.id) !== s(session.payload.identityId)) {
      return res.status(403).json({
        ok: false,
        error: "This session cannot access the requested workspace",
        code: "workspace_not_allowed",
      });
    }

    const compatibleChoices = await enrichMembershipChoices(
      resolveWorkspaceState,
      await resolveCompatibleMemberships(db, identity, [membership])
    );
    const selectedChoice = compatibleChoices[0] || null;

    if (!selectedChoice?.legacy_user?.id) {
      return res.status(403).json({
        ok: false,
        error: "No compatible workspace session profile was found",
        code: "legacy_membership_bridge_missing",
      });
    }

    const sessionToken = s(parseCookies(req)?.[getUserCookieName()]);
    const switched = await switchUserSessionWorkspaceByToken(db, sessionToken, {
      tenantId: selectedChoice.tenant_id,
      membershipId: selectedChoice.membership_id,
    });

    if (!switched) {
      return res.status(400).json({
        ok: false,
        error: "Workspace switch could not be saved",
        code: "workspace_switch_failed",
      });
    }

    return res.status(200).json({
      ok: true,
      authenticated: true,
      workspace: selectedChoice.workspace || null,
      destination: selectedChoice.workspace?.destination || {
        kind: "workspace",
        path: "/workspace",
      },
      user: {
        id: selectedChoice.legacy_user.id,
        identityId: identity.id,
        membershipId: selectedChoice.membership_id,
        tenantId: selectedChoice.tenant_id,
        tenantKey: selectedChoice.tenant_key,
        email: session.payload.email,
        fullName: selectedChoice.legacy_user.full_name || session.payload.fullName || "",
        companyName: selectedChoice.company_name || "",
        role: selectedChoice.role,
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
