import { cfg } from "../../../config.js";
import { DEBATE_ENGINE_VERSION } from "../../../kernel/debateEngine.js";
import {
  getOperationalReadinessSummary,
  withOperationalReadinessContext,
} from "../../../services/operationalReadiness.js";
import { runWithSystemDbContext } from "../../../db/tenantContext.js";
import { isDbReady } from "../../../utils/http.js";
import { buildRateLimitControlStatus } from "../../../utils/rateLimit.js";
import { shouldEnableDebugRoutes } from "../../../utils/securitySurface.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function hasText(v) {
  return s(v).length > 0;
}

const V1_OBSERVABILITY_COVERAGE = [
  "backend_health_readiness",
  "meta_webhook_ingestion_failures",
  "website_widget_inbound_failures",
  "inbox_inbound_failures",
  "runtime_projection_readiness_failures",
  "outbound_manual_reply_failures",
  "database_connectivity_readiness",
  "launch_smoke_failures",
];

export function buildObservabilityHealthStatus() {
  const ownerConfigured = hasText(cfg.observability?.incidentOwner);
  const contactConfigured = hasText(cfg.observability?.incidentContact);
  const destinationConfigured = hasText(cfg.observability?.alertDestination);
  const runbookConfigured = hasText(cfg.observability?.alertRunbookUrl);
  const configured =
    ownerConfigured &&
    contactConfigured &&
    destinationConfigured &&
    runbookConfigured;

  return {
    status: configured ? "configured" : "missing_config",
    safeForPublicHealth: true,
    incidentOwnerConfigured: ownerConfigured,
    incidentContactConfigured: contactConfigured,
    alertDestinationConfigured: destinationConfigured,
    alertRunbookConfigured: runbookConfigured,
    alertProviderConfigured: hasText(cfg.observability?.alertProvider),
    alertEvidenceConfigured: hasText(cfg.observability?.alertEvidenceUrl),
    alertProviderType: hasText(cfg.observability?.alertProvider)
      ? "configured"
      : "vendor_neutral",
    runbookRef: hasText(cfg.observability?.alertRunbookUrl)
      ? cfg.observability.alertRunbookUrl
      : "docs/runbooks/v1-production-observability.md",
    requiredCoverage: V1_OBSERVABILITY_COVERAGE,
  };
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
  return runWithSystemDbContext("health_operational_readiness", () =>
    getOperationalReadinessSummary(db, {
      enforced,
    })
  );
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
    observability: buildObservabilityHealthStatus(),
    rateLimit: buildRateLimitControlStatus(),
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
  process = {},
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
    process,
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
