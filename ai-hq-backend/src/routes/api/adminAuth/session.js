import express from "express";
import {
  isAdminAuthConfigured,
  isUserAuthConfigured,
  clearUserCookie,
  loadUserSessionFromRequest,
  createUserWorkspaceSwitchToken,
  resolveTenantKeyFromRequestHost,
} from "../../../utils/adminAuth.js";
import { cfg } from "../../../config.js";
import { requireSafeDiagnostics } from "../../../utils/securitySurface.js";
import { issueRealtimeTicket } from "../../../realtime/auth.js";
import { listIdentityMembershipChoicesForLogin, findLegacyTenantUserForIdentityLogin } from "./repository.js";
import { loadPostAuthWorkspaceState } from "../../../services/workspace/postAuth.js";
import {
  setNoStore,
  checkDb,
  buildRuntimeInfo,
  buildAuthRuntimeInfo,
  getDebugSessionPayload,
  readCurrentSessions,
} from "./utils.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function trimTrailingSlash(value = "") {
  return s(value).replace(/\/+$/, "");
}

function normalizeOrigin(value = "") {
  const raw = s(value);
  if (!raw) return "";

  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

function isLocalDevOrigin(origin = "") {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
  } catch {
    return false;
  }
}

function toWsOrigin(origin = "") {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return "";

  return normalized
    .replace(/^https:/i, "wss:")
    .replace(/^http:/i, "ws:");
}

function buildCanonicalWorkspaceChoice(choice = {}) {
  const membershipId = s(choice.membership_id || choice.id);

  return {
    membershipId,
    tenantId: s(choice.tenant_id),
    tenantKey: s(choice.tenant_key).toLowerCase(),
    companyName: s(choice.company_name),
    role: s(choice.role || "member").toLowerCase(),
    setupRequired: !!choice.workspace?.setupRequired,
    workspaceReady: !!choice.workspace?.workspaceReady,
    routeHint: s(choice.workspace?.routeHint),
    destination: choice.workspace?.destination || null,
    active: !!choice.active,
    switchToken: createUserWorkspaceSwitchToken({
      identityId: choice.identity_id,
      membershipId,
      tenantId: choice.tenant_id,
      tenantKey: choice.tenant_key,
    }),
  };
}

async function loadSessionWorkspaceChoices(db, sessionPayload, req, resolveWorkspaceState) {
  const hostTenantKey = resolveTenantKeyFromRequestHost(req);
  const memberships = await listIdentityMembershipChoicesForLogin(db, {
    identityId: sessionPayload.identityId,
    tenantKey: hostTenantKey || "",
  });

  const compatible = [];
  for (const membership of memberships) {
    const legacyUser = await findLegacyTenantUserForIdentityLogin(db, {
      tenantId: membership.tenant_id,
      email: sessionPayload.email,
    });

    if (!legacyUser?.id || (s(legacyUser.status) && s(legacyUser.status).toLowerCase() !== "active")) {
      continue;
    }

    const workspace = await resolveWorkspaceState({
      db,
      tenantId: membership.tenant_id,
      tenantKey: membership.tenant_key,
      membershipId: membership.id,
      role: membership.role,
      tenant: {
        id: membership.tenant_id,
        tenant_key: membership.tenant_key,
        company_name: membership.company_name,
      },
    });

    compatible.push({
      ...membership,
      identity_id: sessionPayload.identityId,
      workspace,
      active:
        s(sessionPayload.membershipId) === s(membership.id) &&
        s(sessionPayload.tenantId) === s(membership.tenant_id),
    });
  }

  return compatible.map(buildCanonicalWorkspaceChoice);
}

export function adminSessionRoutes({
  db,
  wsHub,
  resolveWorkspaceState = loadPostAuthWorkspaceState,
} = {}) {
  const r = express.Router();

  function buildRealtimeWsUrl(req) {
    const requestOrigin = normalizeOrigin(
      req.headers?.origin || req.headers?.referer || ""
    );

    if (requestOrigin && isLocalDevOrigin(requestOrigin)) {
      return `${toWsOrigin(requestOrigin)}/ws`;
    }

    const publicBase = trimTrailingSlash(cfg.urls.publicBaseUrl || "");
    if (publicBase) {
      return `${publicBase
        .replace(/^https:/i, "wss:")
        .replace(/^http:/i, "ws:")}/ws`;
    }

    if (requestOrigin) {
      return `${toWsOrigin(requestOrigin)}/ws`;
    }

    const forwardedProto = s(
      req.headers?.["x-forwarded-proto"] || req.protocol || "https"
    )
      .split(",")[0]
      .trim();

    const protocol = forwardedProto.toLowerCase() === "http" ? "ws" : "wss";

    const host = s(
      req.headers?.["x-forwarded-host"] || req.get?.("host") || ""
    )
      .split(",")[0]
      .trim();

    return host ? `${protocol}://${host}/ws` : "/ws";
  }

  r.get("/admin-auth/me", async (req, res) => {
    setNoStore(res);

    const { adminSession, userSession } = await readCurrentSessions(req, db);
    const dbOk = await checkDb(db);

    return res.status(200).json({
      ok: true,
      enabled: !!cfg.auth.adminPanelEnabled,
      configured: {
        admin: isAdminAuthConfigured(),
        user: isUserAuthConfigured(),
      },
      authenticated: {
        admin: !!adminSession?.ok,
        user: !!userSession?.ok,
      },
      session: {
        admin: adminSession?.ok
          ? {
              exp: adminSession.payload?.exp || null,
              iat: adminSession.payload?.iat || null,
            }
          : null,
        user: userSession?.ok
          ? {
              userId: userSession.payload?.userId || null,
              tenantId: userSession.payload?.tenantId || null,
              tenantKey: userSession.payload?.tenantKey || null,
              email: userSession.payload?.email || null,
              fullName: userSession.payload?.fullName || "",
              role: userSession.payload?.role || null,
              exp: userSession.payload?.exp || null,
              iat: userSession.payload?.iat || null,
            }
          : {
              ok: false,
              error: userSession?.error || null,
            },
      },
      runtime: buildRuntimeInfo(db, wsHub, dbOk),
    });
  });

  r.get("/auth/me", async (req, res) => {
    setNoStore(res);

    const { userSession } = await readCurrentSessions(req, db);
    const runtime = buildAuthRuntimeInfo(db, null);

    if (!userSession?.ok) {
      clearUserCookie(res);

      return res.status(200).json({
        ok: true,
        authenticated: false,
        error: null,
        reason: userSession?.error || "invalid_session",
        user: null,
        runtime,
        marker: "AUTH_ME_DEBUG_V4",
      });
    }

    const workspaces = await loadSessionWorkspaceChoices(
      db,
      userSession.payload,
      req,
      resolveWorkspaceState
    ).catch(
      () => []
    );
    const activeWorkspace =
      workspaces.find((workspace) => workspace.active) ||
      {
        membershipId: userSession.payload?.membershipId || null,
        tenantId: userSession.payload?.tenantId || null,
        tenantKey: userSession.payload?.tenantKey || null,
        companyName: userSession.payload?.companyName || "",
        role: userSession.payload?.role || "member",
        setupRequired: false,
        workspaceReady: true,
        routeHint: "/workspace",
        destination: { kind: "workspace", path: "/workspace" },
        active: true,
      };

    return res.status(200).json({
      ok: true,
      authenticated: true,
      user: {
        id: userSession.payload?.userId || null,
        identityId: userSession.payload?.identityId || null,
        membershipId: userSession.payload?.membershipId || null,
        tenantId: userSession.payload?.tenantId || null,
        tenantKey: userSession.payload?.tenantKey || null,
        email: userSession.payload?.email || null,
        fullName: userSession.payload?.fullName || "",
        role: userSession.payload?.role || "member",
        companyName: userSession.payload?.companyName || "",
        exp: userSession.payload?.exp || null,
        iat: userSession.payload?.iat || null,
      },
      identity: {
        id: userSession.payload?.identityId || null,
        email: userSession.payload?.email || null,
      },
      membership: {
        id: userSession.payload?.membershipId || null,
        role: userSession.payload?.role || "member",
      },
      workspace: activeWorkspace,
      workspaces,
      destination: activeWorkspace?.destination || null,
      runtime,
      marker: "AUTH_ME_DEBUG_V4",
    });
  });

  r.get("/auth/realtime-session", async (req, res) => {
    setNoStore(res);

    const userSession = await loadUserSessionFromRequest(req, { db });
    if (!userSession?.ok || !userSession?.payload) {
      clearUserCookie(res);
      return res.status(401).json({
        ok: false,
        error: "Unauthorized",
        reason: userSession?.error || "invalid_session",
      });
    }

    const payload = userSession.payload;
    const ticket = issueRealtimeTicket({
      userId: payload.userId,
      tenantId: payload.tenantId,
      tenantKey: payload.tenantKey,
      role: payload.role,
    });

    return res.status(200).json({
      ok: true,
      realtime: {
        ticket,
        wsUrl: buildRealtimeWsUrl(req),
        tenantKey: payload.tenantKey || null,
        tenantId: payload.tenantId || null,
        role: payload.role || "member",
        audience:
          ["owner", "admin", "operator"].includes(
            String(payload.role || "").toLowerCase()
          )
            ? "operator"
            : "tenant",
      },
    });
  });

  r.get(
    "/auth/debug-session",
    (req, res, next) => requireSafeDiagnostics(req, res, next, { env: cfg.app.env }),
    async (req, res) => {
      setNoStore(res);

      const dbOk = await checkDb(db);
      const debug = await getDebugSessionPayload(req, db);

      return res.status(200).json({
        ok: true,
        marker: "AUTH_DEBUG_SESSION_V4",
        ...debug,
        runtime: buildAuthRuntimeInfo(db, dbOk),
      });
    }
  );

  return r;
}
