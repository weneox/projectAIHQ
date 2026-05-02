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
import {
  getRequestedTenantId,
  getRequestedTenantKey,
} from "../../utils/auth.js";
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
import { launchInternalRoutes, launchRoutes } from "./launch/index.js";
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

function collectClientTenantOverrides(req) {
  const tenantIds = [
    getRequestedTenantId(req),
    s(req?.body?.tenantId),
    s(req?.body?.tenant_id),
    s(req?.query?.tenantId),
    s(req?.query?.tenant_id),
    s(req?.headers?.["x-tenant-id"]),
  ]
    .map((item) => s(item))
    .filter(Boolean);

  const tenantKeys = [
    getRequestedTenantKey(req),
    s(req?.body?.tenantKey),
    s(req?.body?.tenant_key),
    s(req?.query?.tenantKey),
    s(req?.query?.tenant_key),
    s(req?.headers?.["x-tenant-key"]),
  ]
    .map((item) => s(item).toLowerCase())
    .filter(Boolean);

  return {
    tenantIds: [...new Set(tenantIds)],
    tenantKeys: [...new Set(tenantKeys)],
  };
}

function enforceAuthenticatedTenantContextMiddleware(req, res, next) {
  const tenantId = s(req?.auth?.tenantId);
  const tenantKey = s(req?.auth?.tenantKey).toLowerCase();

  if (!tenantId || !tenantKey) {
    clearUserCookie(res);
    return res.status(401).json({
      ok: false,
      error: "Unauthorized",
      code: "missing_authenticated_tenant_context",
      requestId: req.requestId || null,
    });
  }

  const { tenantIds, tenantKeys } = collectClientTenantOverrides(req);
  const mismatchedTenantId = tenantIds.find((item) => item !== tenantId);
  const mismatchedTenantKey = tenantKeys.find((item) => item !== tenantKey);

  if (mismatchedTenantId || mismatchedTenantKey) {
    req.log?.warn?.("auth.tenant_override_blocked", {
      tenantId,
      tenantKey,
      requestedTenantId: mismatchedTenantId || "",
      requestedTenantKey: mismatchedTenantKey || "",
      endpoint: req.originalUrl || req.url || "",
    });

    return res.status(403).json({
      ok: false,
      error: "Forbidden",
      code: "tenant_context_mismatch",
      requestId: req.requestId || null,
    });
  }

  req.tenantId = tenantId;
  req.tenantKey = tenantKey;
  req.tenant = {
    id: tenantId,
    tenant_id: tenantId,
    tenant_key: tenantKey,
  };

  return next();
}

async function requireUserSessionMiddleware(req, res, next) {
  if (isInternalBypassPath(req)) {
    return next();
  }

  const session = await loadUserSessionFromRequest(req, {
    db: req.app?.locals?.db || null,
  });
  const payload = session?.payload || null;

  if (!session?.ok || !payload || !payload.tenantId || !payload.tenantKey) {
    clearUserCookie(res);
    return res.status(401).json({
      ok: false,
      error: "Unauthorized",
      reason: session?.error || "invalid session",
      code: !payload?.tenantId || !payload?.tenantKey
        ? "missing_authenticated_tenant_context"
        : "invalid_session",
      requestId: req.requestId || null,
    });
  }

  req.adminSession = null;
  req.auth = mapSessionPayloadToAuth(payload);
  req.user = mapSessionPayloadToUser(payload);
  req.tenantId = req.auth.tenantId;
  req.tenantKey = req.auth.tenantKey;
  req.tenant = {
    id: req.auth.tenantId,
    tenant_id: req.auth.tenantId,
    tenant_key: req.auth.tenantKey,
  };

  if (req.log?.child) {
    req.log = req.log.child({
      tenantId: req.auth.tenantId,
      tenantKey: req.auth.tenantKey,
      userId: req.auth.userId,
      role: req.auth.role,
    });
  }

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
  r.use("/", launchInternalRoutes({ db }));
  r.use("/", channelConnectPublicRoutes({ db, wsHub }));
  r.use("/", websiteWidgetRoutes({ db, wsHub }));

  // Browser cookie-authenticated writes must prove a trusted same-site/origin request.
  r.use(requireTrustedBrowserOriginForCookieAuth);
  r.use("/", tenantsRoutes({ db }));

  // authenticated app routes
  r.use(requireUserSessionMiddleware);
  r.use(enforceAuthenticatedTenantContextMiddleware);
  r.use(createRequireOperationalDbMiddleware({ db }));

  r.use("/", workspaceRoutes({ db, wsHub, audit, dbDisabled }));
  r.use("/", launchRoutes({ db }));

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
  enforceAuthenticatedTenantContextMiddleware,
  requireUserSessionMiddleware,
};
