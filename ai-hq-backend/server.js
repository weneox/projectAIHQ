import "dotenv/config";

import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";

import { cfg, getMetaConnectStartupConfig } from "./src/config.js";
import { assertConfigValid, isDbRequiredAppEnv } from "./src/config/validate.js";
import { printFeatureReport } from "./src/config/featureReport.js";
import {
  initDb,
  getDb,
  getWorkerDb,
  migrate,
  getMigrationStatus,
  decideStartupMigrationPolicy,
  closeDb,
} from "./src/db/index.js";
import { runWithSystemDbContext } from "./src/db/tenantContext.js";
import { createWsHub } from "./src/wsHub.js";
import { apiRouter } from "./src/routes/api.js";
import { adminAuthRoutes } from "./src/routes/api/adminAuth/index.js";
import { buildRootHealthResponse } from "./src/routes/api/health/builders.js";
import { createLogger, requestContextMiddleware } from "./src/utils/logger.js";
import { apiResponseStandardMiddleware } from "./src/utils/apiResponse.js";
import { apiVersionMiddleware } from "./src/utils/apiVersioning.js";
import {
  buildAllowedCorsOrigins,
  isAllowedOrigin,
  requireSafeDiagnostics,
} from "./src/utils/securitySurface.js";
import {
  attachBuildHeaders,
  buildInfo,
  withBuildMeta,
} from "./src/utils/buildInfo.js";
import {
  createStaticAssetOptions,
  publicAssetGuard,
} from "./src/utils/staticAssets.js";

import { createDurableExecutionWorker } from "./src/workers/durableExecutionWorker.js";
import { createDraftScheduleWorker } from "./src/workers/draftScheduleWorker.js";
import { createMediaJobWorker } from "./src/workers/mediaJobWorker.js";
import { createSourceSyncWorker } from "./src/workers/sourceSyncWorker.js";
import {
  buildProcessRoleOperationalState,
  buildWorkerOperationalState,
  buildRuntimeSignalsSummary,
  buildDurableOperationalStatus,
  classifyWorkerHealth,
  configureRuntimeSignalPersistence,
  summarizeWorkerFleet,
} from "./src/observability/runtimeSignals.js";
import {
  listRecentRuntimeIncidents,
  pruneRuntimeIncidentTrail,
  persistRuntimeIncident,
  summarizeRuntimeIncidentHealthWindow,
} from "./src/services/runtimeIncidentTrail.js";
import { createDurableExecutionHelpers } from "./src/db/helpers/durableExecutions.js";
import {
  getOperationalReadinessSummary,
  hasOperationalReadinessBlockers,
  shouldEnforceOperationalReadinessOnStartup,
} from "./src/services/operationalReadiness.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function pushUnique(target = [], value = "") {
  const item = s(value);
  if (!item || target.includes(item)) return target;
  target.push(item);
  return target;
}

function normalizeRequestPath(req) {
  return s(req?.originalUrl || req?.url || req?.path || "").split("?")[0] || "/";
}

function isWebsiteWidgetInstallCorsPath(req) {
  const path = normalizeRequestPath(req);
  return (
    path === "/api/public/widget/install-token" ||
    path === "/public/widget/install-token"
  );
}

function validateAndLogMetaConnectConfig(logger) {
  const metaConnectConfig = getMetaConnectStartupConfig();

  if (metaConnectConfig.configOutcome === "disabled") {
    logger.info("meta.config.disabled", {
      service: "ai-hq-backend",
      secretRole: "connect_oauth",
      hasAppId: metaConnectConfig.hasAppId === true,
      hasRedirectUri: metaConnectConfig.hasRedirectUri === true,
      hasSecretSourceResolved: metaConnectConfig.hasSecretSourceResolved === true,
      secretSource: metaConnectConfig.secretSource || "",
      configOutcome: "disabled",
    });
    return;
  }

  if (metaConnectConfig.configOutcome === "invalid") {
    const reason = metaConnectConfig.reason || "incomplete_connect_oauth_config";
    logger.error("meta.config.invalid", null, {
      service: "ai-hq-backend",
      secretRole: "connect_oauth",
      reason,
      explicitEnvPresent: metaConnectConfig.explicitEnvPresent === true,
      fallbackEnvPresent: metaConnectConfig.fallbackEnvPresent === true,
      explicitFingerprint: metaConnectConfig.explicitFingerprint || "",
      fallbackFingerprint: metaConnectConfig.fallbackFingerprint || "",
      hasAppId: metaConnectConfig.hasAppId === true,
      hasRedirectUri: metaConnectConfig.hasRedirectUri === true,
      configOutcome: "invalid",
    });

    throw new Error(
      reason === "secret_env_mismatch"
        ? "META_CONNECT_APP_SECRET and META_APP_SECRET are both set but differ. ai-hq-backend must resolve a single Meta connect/reconnect secret."
        : "META_APP_ID, META_CONNECT_APP_SECRET (or legacy META_APP_SECRET), and META_REDIRECT_URI are required for Meta connect/reconnect startup."
    );
  }

  logger.info("meta.config.loaded", {
    service: "ai-hq-backend",
    secretRole: "connect_oauth",
    secretSource: metaConnectConfig.secretSource || "",
    secretFingerprint: metaConnectConfig.secretFingerprint || "",
    hasAppId: metaConnectConfig.hasAppId === true,
    hasRedirectUri: metaConnectConfig.hasRedirectUri === true,
    configOutcome: "ok",
  });
}

function createAuditLogger(db) {
  return {
    async log({
      tenantId = null,
      tenantKey = "",
      actor = "system",
      action = "",
      objectType = "unknown",
      objectId = null,
      meta = {},
    } = {}) {
      if (!db || !action) return null;

      try {
        await db.query(
          `
            insert into audit_log (
              tenant_id,
              tenant_key,
              actor,
              action,
              object_type,
              object_id,
              meta
            )
            values ($1,$2,$3,$4,$5,$6,$7::jsonb)
          `,
          [
            s(tenantId) || null,
            s(tenantKey) || null,
            s(actor, "system"),
            s(action),
            s(objectType, "unknown"),
            s(objectId) || null,
            JSON.stringify(meta && typeof meta === "object" ? meta : {}),
          ]
        );
      } catch (e) {
        createLogger({ service: "ai-hq-backend", env: cfg.app.env }).error(
          "audit.log.failed",
          e
        );
      }
    },
  };
}

async function main() {
  const processWorkerCapable = cfg.app.processRole !== "web";
  const processApiCapable = cfg.app.processRole !== "worker";
  const logger = createLogger({ service: "ai-hq-backend", env: cfg.app.env });
  const runtimeStartedAt = new Date().toISOString();
  validateAndLogMetaConnectConfig(logger);
  assertConfigValid(console);
  printFeatureReport(console);
  const runtimeIncidentRetentionPolicy = {
    retainDays: 14,
    maxRows: 5000,
    pruneIntervalHours: 6,
  };

  let startupOperationalReadiness = {
    ok: false,
    enabled: false,
    enforced: false,
    blockers: { total: 0 },
    status: "unknown",
  };

  const app = express();

  if (cfg.app.trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  const allowedOrigins = buildAllowedCorsOrigins(
    cfg.urls.corsOrigin,
    cfg.app.env
  );

  const baseCorsOptions = {
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-internal-token",
      "x-internal-service",
      "x-internal-audience",
      "x-webhook-token",
      "x-callback-token",
      "x-debug-token",
      "x-correlation-id",
      "x-tenant-key",
      "Accept",
    ],
    optionsSuccessStatus: 204,
  };

  const corsOptions = (req, cb) => {
    const origin = s(req?.headers?.origin);

    if (!origin) {
      return cb(null, {
        ...baseCorsOptions,
        origin: true,
      });
    }

    if (isWebsiteWidgetInstallCorsPath(req)) {
      return cb(null, {
        ...baseCorsOptions,
        origin: true,
      });
    }

    if (isAllowedOrigin(origin, allowedOrigins, cfg.app.env)) {
      return cb(null, {
        ...baseCorsOptions,
        origin: true,
      });
    }

    logger.warn("http.cors.blocked", {
      origin,
      allowedOrigins,
      path: normalizeRequestPath(req),
    });

    return cb(new Error(`CORS blocked for origin: ${origin}`));
  };

  app.use(cors(corsOptions));
  app.options(/.*/, cors(corsOptions));

  app.use(express.json({ limit: "8mb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(requestContextMiddleware({ logger }));
  app.use(apiResponseStandardMiddleware);
  app.use(apiVersionMiddleware);
  app.use((req, res, next) => {
    attachBuildHeaders(res);
    next();
  });

  const diagnosticsGuard = (req, res, next) =>
    requireSafeDiagnostics(req, res, next, { env: cfg.app.env });

  const uploadsDir = path.resolve(process.cwd(), "uploads");
  app.use("/assets", publicAssetGuard, express.static(uploadsDir, createStaticAssetOptions({ maxAge: "1h" })));

  app.get("/", (_req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      ok: true,
      service: "ai-hq-backend",
      env: cfg.app.env,
      marker: "ROOT_BUILD_V4_FEATURES",
      endpoints: [
        "GET /health",
        "GET /__whoami",
        "GET /__buildcheck",
        "GET /api/__buildcheck",
        "POST /api/__voice-test",
        "GET /api/admin-auth/me",
        "POST /api/admin-auth/login",
        "POST /api/admin-auth/logout",
        "POST /api/auth/login",
        "POST /api/auth/logout",
        "GET /api",
      ],
    });
  });

  app.get("/__whoami", diagnosticsGuard, (_req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      ok: true,
      service: "ai-hq-backend",
      env: cfg.app.env,
      port: cfg.app.port,
      hasDatabaseUrl: Boolean(s(cfg.db.url)),
      hasOpenAI: Boolean(s(cfg.ai.openaiApiKey)),
      hasRunway: Boolean(s(cfg.media.runwayApiKey)),
      hasElevenLabs: Boolean(s(cfg.media.elevenlabsApiKey)),
      hasCreatomate: Boolean(s(cfg.media.creatomateApiKey)),
      adminPanelEnabled: !!cfg.auth.adminPanelEnabled,
      hasAdminPasscodeHash: Boolean(s(cfg.auth.adminPasscodeHash)),
      hasAdminSessionSecret: Boolean(s(cfg.auth.adminSessionSecret)),
      hasUserSessionSecret: Boolean(s(cfg.auth.userSessionSecret)),
      hasScheduleWebhook: Boolean(s(cfg.n8n.scheduleDraftUrl)),
      hasWsAuthToken: Boolean(s(cfg.ws.authToken)),
      now: new Date().toISOString(),
      corsOrigin: s(cfg.urls.corsOrigin),
      allowedOrigins,
      marker: "WHOAMI_BUILD_V4_FEATURES",
    });
  });

  app.get("/__buildcheck", diagnosticsGuard, (_req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json(
      withBuildMeta({
        ok: true,
        service: "ai-hq-backend",
        marker: buildInfo.marker,
        env: cfg.app.env,
        port: cfg.app.port,
        time: new Date().toISOString(),
        publicBaseUrl: s(cfg.urls.publicBaseUrl),
        userSessionCookieName: s(cfg.auth.userSessionCookieName),
        hasUserSessionSecret: Boolean(s(cfg.auth.userSessionSecret)),
      })
    );
  });

  app.get("/health", async (_req, res) => {
    const hasDbUrl = Boolean(s(cfg.db.url));
    const db = getDb();

    const workerConfigured = {
      "source-sync-worker": {
        enabled: !!cfg.workers.sourceSyncWorkerEnabled,
        required: true,
      },
      "durable-execution-worker": {
        enabled: !!cfg.workers.durableExecutionWorkerEnabled,
        required: true,
      },
      "draft-schedule-worker": {
        enabled: !!cfg.workers.draftScheduleWorkerEnabled,
        required: false,
      },
      "media-job-worker": {
        enabled: !!cfg.workers.mediaJobWorkerEnabled,
        required: false,
      },
    };

    const processRole = buildProcessRoleOperationalState({
      processRole: cfg.app.processRole,
      workerConfigured,
    });

    const out = await buildRootHealthResponse({
      db,
      startupOperationalReadiness,
      providers: {
        openai: !!cfg.ai.openaiApiKey,
        runway: !!cfg.media.runwayApiKey,
        elevenlabs: !!cfg.media.elevenlabsApiKey,
        creatomate: !!cfg.media.creatomateApiKey,
      },
      workers: {
        sourceSyncWorkerEnabled: !!cfg.workers.sourceSyncWorkerEnabled,
        durableExecutionWorkerEnabled:
          !!cfg.workers.durableExecutionWorkerEnabled,
        draftScheduleEnabled: !!cfg.workers.draftScheduleWorkerEnabled,
        mediaJobWorkerEnabled: !!cfg.workers.mediaJobWorkerEnabled,
      },
      process: processRole,
      operational: {
        status: "ok",
        durableExecution: null,
        sourceSync: null,
      },
    });

    out.db.ok = false;
    out.status = out.ok ? "ready" : "unavailable";
    out.degraded = false;
    out.unavailable = out.status === "unavailable";
    out.reasonCodes = Array.isArray(out?.operationalReadiness?.blockerReasonCodes)
      ? [...out.operationalReadiness.blockerReasonCodes]
      : [];
    out.summary = { message: "" };
    out.incidents = {
      status: "clear",
      total: 0,
      errorCount: 0,
      warnCount: 0,
      latestOccurredAt: "",
      sinceHours: 6,
      scope: "current_runtime",
      activeWindowStartedAt: buildInfo.startedAt,
      history: {
        status: "clear",
        total: 0,
        errorCount: 0,
        warnCount: 0,
        latestOccurredAt: "",
        sinceHours: 6,
        staleBeforeActiveWindowCount: 0,
      },
      services: [],
      reasonCodes: [],
    };

    if (!hasDbUrl || !db) {
      pushUnique(out.reasonCodes, "database_unavailable");
      out.status = "unavailable";
      out.unavailable = true;
      out.ok = false;
      out.summary.message =
        "Database-backed readiness is unavailable, so this runtime is not healthy enough to advertise as ready.";
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(200).json(out);
    }

    try {
      const r = await db.query("select 1 as ok");
      out.db.ok = r?.rows?.[0]?.ok === 1;
    } catch {
      out.db.ok = false;
    }

    if (!out.db.ok) {
      pushUnique(out.reasonCodes, "database_unreachable");
    }

    try {
      const draftScheduleWorkerState =
        app.locals?.draftScheduleWorker?.getState?.() || null;
      const mediaJobWorkerState =
        app.locals?.mediaJobWorker?.getState?.() || null;
      const durableWorkerState =
        app.locals?.durableExecutionWorker?.getState?.() || null;
      const sourceSyncWorkerState =
        app.locals?.sourceSyncWorker?.getState?.() || null;

      const helpers = createDurableExecutionHelpers({ db });
      const durableSummary = await helpers.getExecutionSummary();

      const operational = buildDurableOperationalStatus({
        summary: durableSummary,
        durableWorker: durableWorkerState,
        sourceSyncWorker: sourceSyncWorkerState,
      });

      const workerStates = {
        "source-sync-worker": buildWorkerOperationalState({
          workerName: "source-sync-worker",
          configuredEnabled: workerConfigured["source-sync-worker"].enabled,
          required: workerConfigured["source-sync-worker"].required,
          state: sourceSyncWorkerState,
          processWorkerCapable,
        }),
        "durable-execution-worker": buildWorkerOperationalState({
          workerName: "durable-execution-worker",
          configuredEnabled:
            workerConfigured["durable-execution-worker"].enabled,
          required: workerConfigured["durable-execution-worker"].required,
          state: durableWorkerState,
          processWorkerCapable,
        }),
        "draft-schedule-worker": buildWorkerOperationalState({
          workerName: "draft-schedule-worker",
          configuredEnabled: workerConfigured["draft-schedule-worker"].enabled,
          required: workerConfigured["draft-schedule-worker"].required,
          state: draftScheduleWorkerState,
          processWorkerCapable,
        }),
        "media-job-worker": buildWorkerOperationalState({
          workerName: "media-job-worker",
          configuredEnabled: workerConfigured["media-job-worker"].enabled,
          required: workerConfigured["media-job-worker"].required,
          state: mediaJobWorkerState,
          processWorkerCapable,
        }),
      };

      const workerSummary = summarizeWorkerFleet(Object.values(workerStates));
      const recentIncidents = await listRecentRuntimeIncidents({
        db,
        limit: 10,
        sinceHours: 6,
      });
      const incidentSummary = summarizeRuntimeIncidentHealthWindow(
        recentIncidents,
        {
          activeWindowStartedAt: buildInfo.startedAt,
          sinceHours: 6,
        }
      );

      out.operational = {
        status: operational.status,
        durableExecution: {
          status: classifyWorkerHealth(durableWorkerState).status,
          retryableCount: Number(durableSummary?.counts?.retryable || 0),
          deadLetterCount: Number(durableSummary?.deadLetterCount || 0),
        },
        sourceSync: {
          status: classifyWorkerHealth(sourceSyncWorkerState).status,
          attentionSignals: Number(
            operational?.recentSignals?.sourceSyncAttentionEvents || 0
          ),
        },
        alerts: Array.isArray(operational?.alerts) ? operational.alerts : [],
        workers: workerStates,
        workerSummary,
        incidents: incidentSummary,
      };

      out.workers = {
        ...out.workers,
        summary: workerSummary,
        states: workerStates,
      };
      out.process = processRole;
      out.incidents = incidentSummary;
    } catch {
      out.operational.status = "attention";
      pushUnique(out.reasonCodes, "operational_surface_unavailable");
    }

    if (out?.operationalReadiness?.status === "blocked") {
      out.status = "unavailable";
    } else if (
      out?.operationalReadiness?.status === "attention" &&
      out.status !== "unavailable"
    ) {
      out.status = "degraded";
    }

    const workerSummary = out?.workers?.summary || {};
    if (workerSummary.status === "unavailable") {
      out.status = "unavailable";
    } else if (workerSummary.status === "degraded" && out.status === "ready") {
      out.status = "degraded";
    }

    if (out?.operational?.status === "attention" && out.status === "ready") {
      out.status = "degraded";
    }

    if (processRole.readinessImpact === "unavailable") {
      out.status = "unavailable";
    } else if (
      processRole.readinessImpact === "degraded" &&
      out.status === "ready"
    ) {
      out.status = "degraded";
    }

    if (out?.incidents?.status === "degraded" && out.status === "ready") {
      out.status = "degraded";
    } else if (
      out?.incidents?.status === "attention" &&
      out.status === "ready"
    ) {
      out.status = "degraded";
    }

    if (!out.db.ok) {
      out.status = "unavailable";
    }

    for (const entry of Object.values(out?.workers?.states || {})) {
      if (!entry?.reasonCode) continue;
      pushUnique(out.reasonCodes, entry.reasonCode);
    }

    for (const code of out?.incidents?.reasonCodes || []) {
      pushUnique(out.reasonCodes, code);
    }

    if (out?.operational?.status === "attention") {
      pushUnique(out.reasonCodes, "operational_attention");
    }

    if (processRole.reasonCode) {
      pushUnique(out.reasonCodes, processRole.reasonCode);
    }

    out.unavailable = out.status === "unavailable";
    out.degraded = out.status === "degraded";
    out.ok = out.status !== "unavailable";
    out.summary.message =
      out.status === "ready"
        ? "Readiness, worker fleet, and recent incident signals are currently healthy."
        : out.status === "unavailable"
          ? "The control plane is not ready to advertise healthy availability because required runtime dependencies are blocked or unavailable."
          : "The control plane is reachable but degraded. Operators should review worker or recent incident signals before trusting normal runtime behavior.";

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json(out);
  });

  app.get("/__runtime-signals", diagnosticsGuard, async (req, res) => {
    const db = getDb();
    let durableSummary = {};
    let durableIncidents = [];
    const serviceFilter = String(req.query.service || "").trim();

    if (db?.query) {
      try {
        const helpers = createDurableExecutionHelpers({ db });
        durableSummary = await helpers.getExecutionSummary();
      } catch {}

      try {
        durableIncidents = await listRecentRuntimeIncidents({
          db,
          limit: 20,
          service: serviceFilter,
        });
      } catch {}
    }

    return res.status(200).json({
      ok: true,
      service: "ai-hq-backend",
      filters: {
        service: serviceFilter || null,
      },
      runtimeSignals: buildRuntimeSignalsSummary({
        startupOperationalReadiness,
        durableSummary,
      }),
      durableRecentHistory: durableIncidents,
    });
  });

  try {
    await initDb({ poolRole: "api" });
    if (processWorkerCapable) {
      await initDb({ poolRole: "worker" });
    }

    if (getDb()) {
      configureRuntimeSignalPersistence((incident) =>
        persistRuntimeIncident({
          db: getDb(),
          incident: {
            ...incident,
            service: "ai-hq-backend",
          },
        })
      );

      const pruneOutcome = await runWithSystemDbContext(
        "runtime_incident_prune_startup",
        () =>
          pruneRuntimeIncidentTrail({
            db: getDb(),
            retainDays: runtimeIncidentRetentionPolicy.retainDays,
            maxRows: runtimeIncidentRetentionPolicy.maxRows,
          })
      );
      logger.info("runtime_incident_trail.pruned", pruneOutcome);

      const pruneTimer = setInterval(async () => {
        try {
          const outcome = await runWithSystemDbContext(
            "runtime_incident_prune_timer",
            () =>
              pruneRuntimeIncidentTrail({
                db: getDb(),
                retainDays: runtimeIncidentRetentionPolicy.retainDays,
                maxRows: runtimeIncidentRetentionPolicy.maxRows,
              })
          );

          if (
            Number(outcome.deletedByAge || 0) > 0 ||
            Number(outcome.deletedByCount || 0) > 0
          ) {
            logger.info("runtime_incident_trail.pruned", outcome);
          }
        } catch (error) {
          logger.warn("runtime_incident_trail.prune_failed", {
            error: String(
              error?.message || error || "runtime_incident_trail_prune_failed"
            ),
          });
        }
      }, runtimeIncidentRetentionPolicy.pruneIntervalHours * 60 * 60 * 1000);

      pruneTimer.unref?.();

      const migrationStatus = await runWithSystemDbContext(
        "schema_migration_status",
        () => getMigrationStatus()
      );
      const pendingMigrations = Array.isArray(migrationStatus?.pending)
        ? migrationStatus.pending.map((item) => s(item?.name)).filter(Boolean)
        : [];

      const startupMigrationPolicy = decideStartupMigrationPolicy({
        env: cfg.app.env,
        autoMigrateOnStartup: cfg?.db?.autoMigrateOnStartup,
        pendingCount: migrationStatus?.pendingCount || 0,
        driftedCount: migrationStatus?.drifted?.length || 0,
      });

      if (startupMigrationPolicy.autoMigrate) {
        const m = await migrate();

        if (m?.ok) {
          logger.info("app.migrate.ok", {
            entryFile: m.entryFile || "unknown",
            statementCount: Number(m.statementCount || 0),
            appliedCount: Number(m.appliedCount || 0),
            skippedCount: Number(m.skippedCount || 0),
          });
        } else {
          throw new Error(
            `Auto-migration failed: ${m?.error || m?.reason || "unknown"}`
          );
        }
      } else if (
        startupMigrationPolicy.shouldBlock &&
        isDbRequiredAppEnv(cfg.app.env)
      ) {
        throw new Error(
          startupMigrationPolicy.reason === "schema_drift_detected"
            ? "Applied schema migration files have drifted from the recorded ledger. Resolve migration drift before starting the app."
            : `Pending schema migrations detected (${Number(
                migrationStatus?.pendingCount || 0
              )}): ${
                pendingMigrations.join(", ") || "unknown"
              }. Run 'npm run migrate' before starting the app.`
        );
      } else {
        logger.info("app.migrate.status", {
          entryFile: migrationStatus?.entryFile || "unknown",
          ledgerExists: !!migrationStatus?.ledgerExists,
          migrationCount: Number(migrationStatus?.migrationCount || 0),
          appliedCount: Number(migrationStatus?.appliedCount || 0),
          pendingCount: Number(migrationStatus?.pendingCount || 0),
          pendingMigrations,
          driftedCount: Number(migrationStatus?.drifted?.length || 0),
          autoMigrateOnStartup: !!startupMigrationPolicy.autoMigrate,
          reason: startupMigrationPolicy.reason,
        });
      }
    }
  } catch (e) {
    logger.error("app.migrate.error", e);
    throw e;
  }

  if (isDbRequiredAppEnv(cfg.app.env) && !getDb()) {
    throw new Error(
      `Database is required in ${cfg.app.env || "non-test"} runtime but is unavailable`
    );
  }

  const db = getDb();

  if (db) {
    const enforceOperationalReadiness =
      shouldEnforceOperationalReadinessOnStartup({
        appEnv: cfg.app.env,
        enforceFlag: cfg.operational.enforceReadinessOnStartup,
      });

    try {
      const readinessSummary = await runWithSystemDbContext(
        "startup_operational_readiness",
        () =>
          getOperationalReadinessSummary(db, {
            enforced: enforceOperationalReadiness,
          })
      );

      const hasTenantScopedOperationalBlockers =
        hasOperationalReadinessBlockers(readinessSummary);

      startupOperationalReadiness = {
        ...readinessSummary,
        ok: true,
        enabled: true,
        enforced: enforceOperationalReadiness,
        status: hasTenantScopedOperationalBlockers ? "attention" : "ready",
        tenantScopedBlockersDetected: hasTenantScopedOperationalBlockers,
      };

      if (hasTenantScopedOperationalBlockers) {
        logger.warn("app.operational_readiness.attention", {
          blockersTotal: Number(readinessSummary?.blockers?.total || 0),
          blockerReasonCodes: Array.isArray(
            readinessSummary?.blockerReasonCodes
          )
            ? readinessSummary.blockerReasonCodes
            : [],
          message:
            "Tenant-scoped operational blockers were detected, but startup will continue so the control plane stays reachable.",
        });
      }
    } catch (err) {
      startupOperationalReadiness = {
        ...startupOperationalReadiness,
        ok: false,
        enabled: true,
        enforced: false,
        status: "attention",
        error: String(err?.message || err || "operational_readiness_failed"),
      };

      logger.warn("app.operational_readiness.skipped", {
        error: startupOperationalReadiness.error,
      });
    }
  }

  const dbDisabled = !db;
  const audit = createAuditLogger(db);
  const workerDb = getWorkerDb();

  app.locals.db = db;
  app.locals.workerDb = workerDb;
  app.locals.operationalReadinessStartup = startupOperationalReadiness;

  const server = http.createServer(app);
  const wsHub = createWsHub({
    server,
    logger: logger.child({ component: "realtime" }),
  });

  app.post("/api/__voice-test", diagnosticsGuard, (req, res) => {
    (req.log || logger).info("http.voice_test.hit", {
      body: req.body,
      hasInternalToken: !!req.headers["x-internal-token"],
      hasWebhookToken: !!req.headers["x-webhook-token"],
    });

    return res.status(200).json({
      ok: true,
      route: "__voice-test",
      marker: "VOICE_TEST_BUILD_V4_FEATURES",
      body: req.body || null,
      hasInternalToken: !!req.headers["x-internal-token"],
      hasWebhookToken: !!req.headers["x-webhook-token"],
    });
  });

  app.get("/api/__buildcheck", diagnosticsGuard, (_req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json(
      withBuildMeta({
        ok: true,
        service: "ai-hq-backend",
        marker: buildInfo.marker,
        env: cfg.app.env,
        port: cfg.app.port,
        time: new Date().toISOString(),
        publicBaseUrl: s(cfg.urls.publicBaseUrl),
        userSessionCookieName: s(cfg.auth.userSessionCookieName),
        hasUserSessionSecret: Boolean(s(cfg.auth.userSessionSecret)),
      })
    );
  });

  app.use("/api/v1", adminAuthRoutes({ db, wsHub }));
  app.use("/api", adminAuthRoutes({ db, wsHub }));

  app.use(
    "/api/v1",
    apiRouter({
      db,
      wsHub,
      audit,
      dbDisabled,
    })
  );

  app.use(
    "/api",
    apiRouter({
      db,
      wsHub,
      audit,
      dbDisabled,
    })
  );

  const durableExecutionWorker = createDurableExecutionWorker({
    db: workerDb,
    wsHub,
  });
  app.locals.durableExecutionWorker = durableExecutionWorker;

  const sourceSyncWorker = createSourceSyncWorker({
    db: workerDb,
  });
  app.locals.sourceSyncWorker = sourceSyncWorker;

  const draftScheduleWorker = createDraftScheduleWorker({
    db: workerDb,
  });
  app.locals.draftScheduleWorker = draftScheduleWorker;

  const mediaJobWorker = createMediaJobWorker({
    db: workerDb,
  });
  app.locals.mediaJobWorker = mediaJobWorker;

  if (processWorkerCapable && cfg.workers.sourceSyncWorkerEnabled) {
    sourceSyncWorker?.start?.();
  }

  if (processWorkerCapable && cfg.workers.durableExecutionWorkerEnabled) {
    durableExecutionWorker?.start?.();
  }

  if (processWorkerCapable && cfg.workers.draftScheduleWorkerEnabled) {
    draftScheduleWorker?.start?.();
  }

  if (processWorkerCapable && cfg.workers.mediaJobWorkerEnabled) {
    mediaJobWorker?.start?.();
  }

  app.use((req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(404).json({
      ok: false,
      error: "Not found",
      code: "not_found",
      path: req.path,
      requestId: req.requestId || null,
    });
  });

  app.use((err, req, res, _next) => {
    const msg = String(err?.message || err || "Server error");

    (req?.log || logger).error("http.request.failed", err, {
      path: req?.originalUrl || req?.url || "",
      method: req?.method || "",
      requestId: req?.requestId || null,
      tenantId: s(req?.auth?.tenantId || req?.tenantId),
      tenantKey: s(req?.auth?.tenantKey || req?.tenantKey),
    });

    if (msg.toLowerCase().includes("cors")) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(403).json({
        ok: false,
        error: msg,
        code: "cors_blocked",
        origin: req.headers.origin || null,
        requestId: req.requestId || null,
      });
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(500).json({
      ok: false,
      error: "Server error",
      code: "server_error",
      requestId: req.requestId || null,
      details: cfg.app.env !== "production" ? msg : undefined,
    });
  });

  server.listen(cfg.app.port, () => {
    const hasDb = Boolean(db);

    logger.info("app.started", {
      port: cfg.app.port,
      hasDb,
      processRole: cfg.app.processRole,
      processWorkerCapable,
      processApiCapable,
      corsOrigin: cfg.urls.corsOrigin,
      allowedOrigins,
      sourceSyncWorkerEnabled: !!cfg.workers.sourceSyncWorkerEnabled,
      sourceSyncWorkerIntervalMs: Number(
        cfg.workers.sourceSyncWorkerIntervalMs || 5000
      ),
      sourceSyncWorkerBatchSize: Number(
        cfg.workers.sourceSyncWorkerBatchSize || 4
      ),
      sourceSyncWorkerLeaseMs: Number(
        cfg.workers.sourceSyncWorkerLeaseMs || 600000
      ),
      durableExecutionWorkerEnabled: !!cfg.workers.durableExecutionWorkerEnabled,
      durableExecutionWorkerIntervalMs: Number(
        cfg.workers.durableExecutionWorkerIntervalMs || 15_000
      ),
      durableExecutionWorkerBatchSize: Number(
        cfg.workers.durableExecutionWorkerBatchSize || 10
      ),
      durableExecutionWorkerLeaseMs: Number(
        cfg.workers.durableExecutionWorkerLeaseMs || 60_000
      ),
      draftScheduleWorkerEnabled: !!cfg.workers.draftScheduleWorkerEnabled,
      mediaJobWorkerEnabled: !!cfg.workers.mediaJobWorkerEnabled,
      openaiModel: cfg.ai.openaiModel,
      build: {
        version: buildInfo.version,
        sha: buildInfo.shortSha || "unknown",
        fullSha: buildInfo.fullSha || "unknown",
        releaseSha: buildInfo.releaseSha || "unknown",
        bootId: buildInfo.bootId,
        marker: buildInfo.marker,
      },
    });
  });

  async function shutdown(signal = "SIGTERM") {
    logger.info("app.shutdown.started", { signal });

    try {
      sourceSyncWorker?.stop?.();
    } catch {}

    try {
      durableExecutionWorker?.stop?.();
    } catch {}

    try {
      draftScheduleWorker?.stop?.();
    } catch {}

    try {
      mediaJobWorker?.stop?.();
    } catch {}

    try {
      wsHub?.close?.();
    } catch {}

    try {
      await closeDb();
    } catch {}

    try {
      server.close(() => {
        process.exit(0);
      });

      setTimeout(() => {
        process.exit(0);
      }, 3000).unref();
    } catch {
      process.exit(0);
    }
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((e) => {
  createLogger({ service: "ai-hq-backend", env: cfg.app.env }).error(
    "app.fatal",
    e,
    {
      build: {
        version: buildInfo.version,
        sha: buildInfo.shortSha || "unknown",
        fullSha: buildInfo.fullSha || "unknown",
        releaseSha: buildInfo.releaseSha || "unknown",
        bootId: buildInfo.bootId,
        marker: buildInfo.marker,
      },
    }
  );
  process.exit(1);
});
  