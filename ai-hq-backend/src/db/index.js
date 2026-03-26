// src/db/index.js
import pg from "pg";
import { cfg } from "../config.js";
import {
  describeSchemaMigrations,
  runSchemaMigrations,
} from "./runSchemaMigrations.js";

const { Pool } = pg;

function s(v, d = "") {
  return String(v ?? d).trim();
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

export function getDb() {
  return db;
}

export async function initDb() {
  const url = s(
    cfg?.DATABASE_URL ||
      cfg?.databaseUrl ||
      cfg?.db?.url ||
      process.env.DATABASE_URL
  );

  if (!url) {
    console.error("[ai-hq] DATABASE_URL is missing");
    db = null;
    return null;
  }

  const useSsl = shouldUseSsl(url);

  const pool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 7_000,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  try {
    await pool.query("select 1 as ok");
    console.log("[ai-hq] DB=ON", {
      ssl: useSsl ? "on" : "off",
      demoSeedEnabled: s(process.env.DB_SCHEMA_DEMO).toLowerCase() === "true",
    });

    db = pool;
    return pool;
  } catch (e) {
    console.error("[ai-hq] DB connect failed", {
      code: e?.code || null,
      message: String(e?.message || e),
    });
    try {
      await pool.end();
    } catch {}
    db = null;
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
    console.log("[db-migrate] start", { entryFile, withDemoSeed });

    const result = await runSchemaMigrations(db, {
      entryFile,
      useTransaction: cfg?.db?.migrateTx !== false,
    });

    console.log("[db-migrate] done", {
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
    console.error("[db-migrate] failed", {
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

  return describeSchemaMigrations(db, { entryFile });
}

export function decideStartupMigrationPolicy({
  env = cfg?.app?.env,
  autoMigrateOnStartup = cfg?.db?.autoMigrateOnStartup,
  pendingCount = 0,
  driftedCount = 0,
} = {}) {
  const normalizedEnv = s(env, "production").toLowerCase();
  const pending = Math.max(0, Number(pendingCount || 0));
  const drifted = Math.max(0, Number(driftedCount || 0));
  const autoMigrate =
    Boolean(autoMigrateOnStartup) && normalizedEnv === "development";

  return {
    env: normalizedEnv,
    autoMigrate,
    shouldBlock: drifted > 0 || (pending > 0 && !autoMigrate),
    reason:
      drifted > 0
        ? "schema_drift_detected"
        : pending > 0 && autoMigrate
          ? "auto_migrate_enabled"
          : pending > 0
            ? "pending_migrations"
            : "up_to_date",
  };
}

export async function closeDb() {
  if (!db) return;
  try {
    await db.end();
  } catch {}
  db = null;
}
