// src/routes/api/index.js
// FINAL v3.3.8

import express from "express";
import { cfg } from "../../config.js";
import { isDbRequiredAppEnv } from "../../config/validate.js";
import {
  clearUserCookie,
  loadUserSessionFromRequest,
  requireTrustedBrowserOriginForCookieAuth,
} from "../../utils/adminAuth.js";
import { isDbReady, serviceUnavailableJson } from "../../utils/http.js";
import { hasFeature } from "../../config/features.js";
import { shouldEnableDebugRoutes } from "../../utils/securitySurface.js";

import { healthRoutes } from "./health/index.js";
import { tenantsRoutes } from "./tenants/index.js";
import { inboxInternalRoutes, inboxRoutes } from "./inbox/index.js";
import { modeRoutes } from "./mode/index.js";
import { agentsRoutes } from "./agents/index.js";
import { renderRoutes } from "./render/index.js";
import { mediaRoutes } from "./media/index.js";
import { pushRoutes } from "./push/index.js";
import { notificationsRoutes } from "./notifications/index.js";
import { contentRoutes } from "./content/index.js";
import { proposalsRoutes } from "./proposals/index.js";
import { executionsRoutes } from "./executions/index.js";
import { threadsRoutes } from "./threads/index.js";
import { chatRoutes } from "./chat/index.js";
import { debateRoutes } from "./debate/index.js";
import { debugRoutes } from "./debug/index.js";
import { leadsRoutes } from "./leads/index.js";
import { commentsRoutes } from "./comments/index.js";
import { incidentsRoutes } from "./incidents/index.js";
import { settingsRoutes } from "./settings/index.js";
import { teamRoutes } from "./team/index.js";
import { voiceRoutes, voiceInternalRoutes } from "./voice/index.js";
import {
  channelConnectPublicRoutes,
  channelConnectRoutes,
} from "./channelConnect/index.js";
import { websiteWidgetRoutes } from "./websiteWidget/index.js";
import { workspaceRoutes } from "./workspace/index.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function normalizePath(req) {
  const raw = s(req?.originalUrl || req?.url || req?.path || "");
  const noQuery = raw.split("?")[0] || "";
  return noQuery.replace(/^\/api/, "") || "/";
}

function isInternalBypassPath(req) {
  const path = normalizePath(req);

  return (
    path === "/tenants/resolve-channel" ||
    path === "/inbox/ingest" ||
    path === "/inbox/outbound" ||
    path.startsWith("/internal/voice/") ||
    path.startsWith("/internal/runtime-signals/") ||
    path.startsWith("/internal/executions/")
  );
}

function mapSessionPayloadToAuth(payload = {}) {
  return {
    userId: payload.userId,
    tenantId: payload.tenantId,
    tenantKey: payload.tenantKey,
    email: payload.email,
    fullName: payload.fullName || "",
    role: payload.role || "member",
    sessionVersion: Number(payload.sessionVersion || 1),
  };
}

function mapSessionPayloadToUser(payload = {}) {
  return {
    id: payload.userId,
    tenantId: payload.tenantId,
    tenantKey: payload.tenantKey,
    tenant_id: payload.tenantId,
    tenant_key: payload.tenantKey,
    email: payload.email,
    fullName: payload.fullName || "",
    full_name: payload.fullName || "",
    role: payload.role || "member",
    sessionVersion: Number(payload.sessionVersion || 1),
    session_version: Number(payload.sessionVersion || 1),
  };
}

async function requireUserSessionMiddleware(req, res, next) {
  if (isInternalBypassPath(req)) {
    return next();
  }

  const session = await loadUserSessionFromRequest(req, {
    db: req.app?.locals?.db || null,
  });
  const payload = session?.payload || null;

  if (!session?.ok || !payload) {
    clearUserCookie(res);
    return res.status(401).json({
      ok: false,
      error: "Unauthorized",
      reason: session?.error || "invalid session",
    });
  }

  req.adminSession = null;
  req.auth = mapSessionPayloadToAuth(payload);
  req.user = mapSessionPayloadToUser(payload);

  return next();
}

export function createRequireOperationalDbMiddleware({ db, env = cfg.app.env }) {
  return function requireOperationalDb(req, res, next) {
    if (!isDbRequiredAppEnv(env) || isDbReady(db)) {
      return next();
    }

    return serviceUnavailableJson(
      res,
      "database unavailable; authenticated runtime is disabled until the database is restored"
    );
  };
}

export function apiRouter({ db, wsHub, audit, dbDisabled = false }) {
  const r = express.Router();

  // public + internal bypass routes
  // bunlar session guard-dan əvvəl qalmalıdır
  r.use("/", healthRoutes({ db }));
  r.use("/", inboxInternalRoutes({ db, wsHub }));
  r.use("/", voiceInternalRoutes({ db, wsHub }));
  r.use("/", channelConnectPublicRoutes({ db, wsHub }));
  r.use("/", websiteWidgetRoutes({ db, wsHub }));

  // Browser cookie-authenticated writes must prove a trusted same-site/origin request.
  r.use(requireTrustedBrowserOriginForCookieAuth);
  r.use("/", tenantsRoutes({ db }));

  // authenticated app routes
  r.use(requireUserSessionMiddleware);
  r.use(createRequireOperationalDbMiddleware({ db }));

  r.use("/", workspaceRoutes({ db, wsHub, audit, dbDisabled }));

  r.use("/", modeRoutes({ db, wsHub }));
  r.use("/", agentsRoutes());
  r.use("/", settingsRoutes({ db }));
  r.use("/", channelConnectRoutes({ db }));
  r.use("/", teamRoutes({ db }));
  if (shouldEnableDebugRoutes()) {
    r.use("/", debugRoutes());
  }
  r.use("/", mediaRoutes({ db }));

  if (hasFeature("media.render")) {
    r.use("/", renderRoutes());
  }

  if (hasFeature("channels.push")) {
    r.use("/", pushRoutes({ db, wsHub }));
  }

  r.use("/", notificationsRoutes({ db, wsHub }));
  r.use("/", contentRoutes({ db, wsHub }));
  r.use("/", proposalsRoutes({ db, wsHub }));
  r.use("/", executionsRoutes({ db, wsHub }));
  r.use("/", chatRoutes({ db, wsHub }));

  if (hasFeature("content.debate")) {
    r.use("/", debateRoutes({ db, wsHub }));
  }

  r.use("/", threadsRoutes({ db }));

  if (hasFeature("inbox.inbox")) {
    r.use("/", inboxRoutes({ db, wsHub }));
  }

  if (hasFeature("inbox.leads")) {
    r.use("/", leadsRoutes({ db, wsHub }));
  }

  if (hasFeature("inbox.comments")) {
    r.use("/", commentsRoutes({ db, wsHub }));
  }

  r.use("/", incidentsRoutes({ db }));

  r.use(
    "/",
    voiceRoutes({
      db,
      dbDisabled,
      audit,
      wsHub,
    })
  );

  return r;
}

export const __test__ = {
  createRequireOperationalDbMiddleware,
};
