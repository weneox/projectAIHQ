import express from "express";
import {
  isAdminAuthConfigured,
  isUserAuthConfigured,
  clearUserCookie,
  loadUserSessionFromRequest,
} from "../../../utils/adminAuth.js";
import { cfg } from "../../../config.js";
import { requireSafeDiagnostics } from "../../../utils/securitySurface.js";
import { issueRealtimeTicket } from "../../../realtime/auth.js";
import {
  setNoStore,
  checkDb,
  buildRuntimeInfo,
  buildAuthRuntimeInfo,
  getDebugSessionPayload,
  readCurrentSessions,
} from "./utils.js";

export function adminSessionRoutes({ db, wsHub } = {}) {
  const r = express.Router();

  function buildRealtimeWsUrl(req) {
    const publicBase = String(cfg.urls.publicBaseUrl || "").trim().replace(/\/+$/, "");
    if (publicBase) {
      return `${publicBase.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:")}/ws`;
    }

    const forwardedProto = String(req.headers?.["x-forwarded-proto"] || req.protocol || "https")
      .split(",")[0]
      .trim();
    const protocol = forwardedProto.toLowerCase() === "http" ? "ws" : "wss";
    const host = String(req.headers?.["x-forwarded-host"] || req.get?.("host") || "")
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

    return res.status(200).json({
      ok: true,
      authenticated: true,
      user: {
        id: userSession.payload?.userId || null,
        tenantId: userSession.payload?.tenantId || null,
        tenantKey: userSession.payload?.tenantKey || null,
        email: userSession.payload?.email || null,
        fullName: userSession.payload?.fullName || "",
        role: userSession.payload?.role || "member",
        exp: userSession.payload?.exp || null,
        iat: userSession.payload?.iat || null,
      },
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
          ["owner", "admin", "operator"].includes(String(payload.role || "").toLowerCase())
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
  });

  return r;
}
