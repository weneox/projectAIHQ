// src/db/index.js
import pg from "pg";
import { cfg } from "../config.js";
import {
  describeSchemaMigrations,
  runSchemaMigrations,
} from "./runSchemaMigrations.js";
import {
  createTenantGuardedDb,
  runWithSystemDbContext,
} from "./tenantContext.js";
import { createLogger } from "../utils/logger.js";

const { Pool } = pg;
const logger = createLogger({ service: "ai-hq-backend", component: "db" });

function s(v, d = "") {
  return String(v ?? d).trim();
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function shouldUseSsl(url) {
  try {
    const u = new URL(url);

    const sslmode = s(u.searchParams.get("sslmode")).toLowerCase();
    if (
      sslmode === "require" ||
      sslmode === "verify-full" ||
      sslmode === "verify-ca"
    ) {
      return true;
    }

    const host = s(u.hostname).toLowerCase();
    if (host.includes("railway")) return true;
    if (host.includes("render")) return true;
    if (host.includes("supabase")) return true;
    if (host.includes("neon")) return true;

    return false;
  } catch {
    return true;
  }
}

// VACIB: bunu export edirik ki digər fayllarda
// import { db } from "../../index.js";
// işləsin
export let db = null;
export let workerDb = null;

export function getDb() {
  return db;
}

export function getWorkerDb() {
  return workerDb || db;
}

function resolvePoolSettings(poolRole = "api") {
  const role = s(poolRole || "api").toLowerCase() === "worker" ? "worker" : "api";
  const roleCfg = role === "worker" ? cfg?.db?.workerPool : cfg?.db?.apiPool;
  const legacyMax = cfg?.db?.poolMax;

  return {
    poolRole: role,
    poolMax: clampInt(roleCfg?.max ?? legacyMax, role === "worker" ? 10 : 20, 1, 100),
    idleTimeoutMillis: clampInt(
      roleCfg?.idleTimeoutMs ?? cfg?.db?.poolIdleTimeoutMs,
      30_000,
      5_000,
      300_000
    ),
    connectionTimeoutMillis: clampInt(
      roleCfg?.connectionTimeoutMs ?? cfg?.db?.poolConnectionTimeoutMs,
      3_000,
      500,
      30_000
    ),
  };
}

export async function initDb(options = {}) {
  const poolRole = s(options.poolRole || "api").toLowerCase() === "worker" ? "worker" : "api";
  const url = s(
    cfg?.DATABASE_URL ||
      cfg?.databaseUrl ||
      cfg?.db?.url ||
      process.env.DATABASE_URL
  );

  if (!url) {
    logger.error("db.url.missing", null, { poolRole });
    if (poolRole === "worker") workerDb = null;
    else db = null;
    return null;
  }

  const useSsl = shouldUseSsl(url);
  const {
    poolMax,
    idleTimeoutMillis,
    connectionTimeoutMillis,
  } = resolvePoolSettings(poolRole);

  const pool = new Pool({
    connectionString: url,
    max: poolMax,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  try {
    await runWithSystemDbContext("db_bootstrap", () => pool.query("select 1 as ok"));
    logger.info("db.connected", {
      ssl: useSsl ? "on" : "off",
      poolRole,
      poolMax,
      idleTimeoutMillis,
      connectionTimeoutMillis,
      demoSeedEnabled: s(process.env.DB_SCHEMA_DEMO).toLowerCase() === "true",
    });

    const guardedPool = createTenantGuardedDb(pool, { poolRole });
    if (poolRole === "worker") workerDb = guardedPool;
    else db = guardedPool;
    return guardedPool;
  } catch (e) {
    logger.error("db.connect.failed", e, {
      poolRole,
      code: e?.code || null,
      message: String(e?.message || e),
    });
    try {
      await pool.end();
    } catch {}
    if (poolRole === "worker") workerDb = null;
    else db = null;
    return null;
  }
}

export async function migrate(options = {}) {
  if (!db) {
    return { ok: false, reason: "DATABASE_URL not configured (skip)" };
  }

  const withDemoSeed =
    s(options.demo, s(cfg?.DB_SCHEMA_DEMO, process.env.DB_SCHEMA_DEMO))
      .toLowerCase() === "true";

  const entryFile = s(
    options.entryFile,
    withDemoSeed ? "index.demo.sql" : "index.base.sql"
  );

  try {
    logger.info("db.migrate.started", { entryFile, withDemoSeed });

    const result = await runWithSystemDbContext("schema_migration", () =>
      runSchemaMigrations(db, {
        entryFile,
        useTransaction: cfg?.db?.migrateTx !== false,
      })
    );

    logger.info("db.migrate.completed", {
      entryFile,
      statementCount: result?.statementCount || 0,
      appliedCount: result?.appliedCount || 0,
      skippedCount: result?.skippedCount || 0,
    });

    return {
      ok: true,
      entryFile,
      statementCount: result?.statementCount || 0,
      appliedCount: result?.appliedCount || 0,
      skippedCount: result?.skippedCount || 0,
      migrationCount: result?.migrationCount || 0,
      ledgerTable: result?.ledgerTable || "schema_migrations",
    };
  } catch (e) {
    logger.error("db.migrate.failed", e, {
      entryFile,
      migrationName: e?.migrationName || null,
      code: e?.code || null,
      message: String(e?.message || e),
      detail: e?.detail || null,
      hint: e?.hint || null,
      where: e?.where || null,
    });

    return {
      ok: false,
      entryFile,
      error: String(e?.message || e),
      code: e?.code || null,
      detail: e?.detail || null,
      hint: e?.hint || null,
      where: e?.where || null,
      stack: e?.stack || null,
    };
  }
}

export async function getMigrationStatus(options = {}) {
  if (!db) {
    return { ok: false, reason: "DATABASE_URL not configured (skip)" };
  }

  const withDemoSeed =
    s(options.demo, s(cfg?.DB_SCHEMA_DEMO, process.env.DB_SCHEMA_DEMO))
      .toLowerCase() === "true";

  const entryFile = s(
    options.entryFile,
    withDemoSeed ? "index.demo.sql" : "index.base.sql"
  );

  return runWithSystemDbContext("schema_migration_status", () =>
    describeSchemaMigrations(db, { entryFile })
  );
}

export function decideStartupMigrationPolicy({
  env = cfg?.app?.env,
  autoMigrateOnStartup = cfg?.db?.autoMigrateOnStartup,
  pendingCount = 0,
  driftedCount = 0,
  missingRequiredRelationCount = 0,
} = {}) {
  const normalizedEnv = s(env, "production").toLowerCase();
  const pending = Math.max(0, Number(pendingCount || 0));
  const drifted = Math.max(0, Number(driftedCount || 0));
  const missingRequiredRelations = Math.max(
    0,
    Number(missingRequiredRelationCount || 0)
  );
  const autoMigrate =
    Boolean(autoMigrateOnStartup) && normalizedEnv === "development";

  return {
    env: normalizedEnv,
    autoMigrate,
    shouldBlock:
      drifted > 0 ||
      missingRequiredRelations > 0 ||
      (pending > 0 && !autoMigrate),
    reason:
      drifted > 0
        ? "schema_drift_detected"
        : missingRequiredRelations > 0
          ? "required_schema_relations_missing"
        : pending > 0 && autoMigrate
          ? "auto_migrate_enabled"
          : pending > 0
            ? "pending_migrations"
            : "up_to_date",
  };
}

export async function closeDb() {
  const pools = [workerDb, db].filter(Boolean);
  if (!pools.length) return;
  try {
    await Promise.allSettled([...new Set(pools)].map((pool) => pool.end()));
  } catch {}
  workerDb = null;
  db = null;
}
