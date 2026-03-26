// src/db/index.js
import pg from "pg/lib/index.js";
import { cfg } from "../config.js";
import {
  describeSchemaMigrations,
  runSchemaMigrations,
} from "./runSchemaMigrations.js";

const { Pool } = pg;

function s(v, d = "") {
  return String(v ?? d).trim();
}

function redact(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = "****";
    return u.toString();
  } catch {
    return "(invalid DATABASE_URL)";
  }
}

function maskDbUrl(url = "") {
  try {
    const u = new URL(String(url || ""));
    const host = u.hostname || "";
    const dbName = (u.pathname || "").replace(/^\//, "");
    const user = u.username || "";
    return `${u.protocol}//${user ? `${user}@` : ""}${host}/${dbName}`;
  } catch {
    return "(invalid DATABASE_URL)";
  }
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

async function logDbFingerprint(client, label = "db") {
  try {
    const meta = await client.query(`
      select
        current_database() as current_database,
        current_user as current_user,
        current_schema() as current_schema,
        current_setting('search_path') as search_path,
        inet_server_addr()::text as server_addr,
        inet_server_port() as server_port
    `);

    console.log(`[${label}] fingerprint`, meta.rows[0]);

    const tables = await client.query(`
      select
        n.nspname as schema_name,
        c.relname as table_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relname = 'inbox_messages'
      order by 1, 2
    `);

    console.log(`[${label}] inbox_messages tables`, tables.rows);

    const constraints = await client.query(`
      select
        n.nspname as schema_name,
        c.relname as table_name,
        con.conname,
        pg_get_constraintdef(con.oid) as definition
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where c.relname = 'inbox_messages'
      order by 1, 2, 3
    `);

    console.log(`[${label}] inbox_messages constraints`, constraints.rows);
  } catch (err) {
    console.error(`[${label}] fingerprint failed`, err);
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
    console.log("[ai-hq] DB=ON", redact(url), `ssl=${useSsl ? "on" : "off"}`);
    console.log("[db-runtime] DATABASE_URL masked =", maskDbUrl(url));
    console.log(
      "[db-runtime] DB_SCHEMA_DEMO =",
      process.env.DB_SCHEMA_DEMO || null
    );

    await logDbFingerprint(pool, "db-runtime");

    db = pool;
    return pool;
  } catch (e) {
    console.error("[ai-hq] DB connect failed:", redact(url));
    console.error("[ai-hq]", e?.code || "", String(e?.message || e));
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
