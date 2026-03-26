import { cfg } from "../../../config.js";
import { DEBATE_ENGINE_VERSION } from "../../../kernel/debateEngine.js";
import {
  getOperationalReadinessSummary,
  withOperationalReadinessContext,
} from "../../../services/operationalReadiness.js";
import { isDbReady } from "../../../utils/http.js";
import { shouldEnableDebugRoutes } from "../../../utils/securitySurface.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

export async function resolveOperationalReadinessForHealth({
  db,
  startupOperationalReadiness = null,
} = {}) {
  const dbEnabled = isDbReady(db);

  if (!dbEnabled) {
    return withOperationalReadinessContext({
      ok: false,
      enabled: false,
    });
  }

  const enforced = startupOperationalReadiness?.enforced === true;
  return getOperationalReadinessSummary(db, {
    enforced,
  });
}

export async function buildHealthCore({
  db,
  startupOperationalReadiness = null,
} = {}) {
  const dbEnabled = isDbReady(db);
  const operationalReadiness = await resolveOperationalReadinessForHealth({
    db,
    startupOperationalReadiness,
  });

  return {
    ok: operationalReadiness.status !== "blocked",
    service: "ai-hq-backend",
    env: cfg.app.env,
    db: {
      enabled: dbEnabled,
    },
    operationalReadiness,
  };
}

export async function buildApiHealthResponse({
  db,
  startupOperationalReadiness = null,
} = {}) {
  const core = await buildHealthCore({
    db,
    startupOperationalReadiness,
  });

  const endpoints = [
    "GET /api",
    "GET /api/mode?tenantId=",
    "POST /api/mode {tenantId, mode}",
    "GET /api/agents",
    "POST /api/chat",
    "POST /api/debate",
    "GET /api/threads/:id/messages",
    "GET /api/proposals?status=pending|in_progress|approved|published|rejected",
    "POST /api/proposals/:id/decision",
    "POST /api/proposals/:id/request-changes",
    "POST /api/proposals/:id/publish",
    "GET /api/notifications?recipient=ceo&unread=1",
    "POST /api/notifications/:id/read",
    "GET /api/push/vapid",
    "POST /api/push/subscribe",
    "POST /api/push/test",
    "GET /api/executions?status=&limit=&executionId=",
    "GET /api/executions/:id",
    "POST /api/executions/callback",
    "GET /api/content?proposalId=",
    "POST /api/content/:id/feedback",
    "POST /api/content/:id/approve",
    "POST /api/content/:id/publish",
    "POST /api/render/slides",
    "POST /api/media/image",
  ];

  if (shouldEnableDebugRoutes()) {
    endpoints.push("POST /api/debug/openai");
  }

  return {
    ...core,
    debateEngine: DEBATE_ENGINE_VERSION,
    endpoints,
    defaults: {
      tenant: cfg.tenant.defaultTenantKey,
      mode: cfg.app.defaultMode,
    },
  };
}

export async function buildRootHealthResponse({
  db,
  startupOperationalReadiness = null,
  providers = {},
  workers = {},
  operational = {},
} = {}) {
  const core = await buildHealthCore({
    db,
    startupOperationalReadiness,
  });

  return {
    ...core,
    marker: "HEALTH_BUILD_V4_FEATURES",
    providers,
    workers,
    operational,
    startupOperationalReadiness:
      startupOperationalReadiness && typeof startupOperationalReadiness === "object"
        ? {
            status: s(startupOperationalReadiness.status),
            enforced: startupOperationalReadiness.enforced === true,
            error: s(startupOperationalReadiness.error),
            blockersTotal: Number(startupOperationalReadiness?.blockers?.total || 0),
            blockerReasonCodes: arr(
              startupOperationalReadiness.blockerReasonCodes ||
                startupOperationalReadiness.blocker_reason_codes
            )
              .map((item) => s(item))
              .filter(Boolean)
              .slice(0, 10),
          }
        : null,
  };
}
