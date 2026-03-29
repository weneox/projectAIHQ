import fs from "fs/promises";
import path from "path";
import pg from "pg";
import { __test__ } from "../ai-hq-backend/src/db/runSchemaMigrations.js";

const { Pool } = pg;
const { buildMigrationPlan } = __test__;

const TARGETS = new Set([
  "15_tenant_sources_and_knowledge.sql",
  "91_data_repairs.sql",
]);

function s(v, d = "") {
  return String(v ?? d).trim();
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function stripWrappedQuotes(value = "") {
  const x = s(value);
  if (
    (x.startsWith('"') && x.endsWith('"')) ||
    (x.startsWith("'") && x.endsWith("'"))
  ) {
    return x.slice(1, -1);
  }
  return x;
}

function parseEnvText(text = "") {
  const out = {};
  const lines = String(text || "").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const key = s(match[1]);
    const value = stripWrappedQuotes(match[2]);
    out[key] = value;
  }

  return out;
}

async function loadDatabaseUrl() {
  if (s(process.env.DATABASE_URL)) {
    return s(process.env.DATABASE_URL);
  }

  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "ai-hq-backend", ".env"),
    path.resolve(process.cwd(), "ai-hq-backend", ".env.local"),
  ];

  for (const filePath of candidates) {
    if (!(await fileExists(filePath))) continue;

    const raw = await fs.readFile(filePath, "utf8");
    const parsed = parseEnvText(raw);
    if (s(parsed.DATABASE_URL)) {
      return s(parsed.DATABASE_URL);
    }
  }

  return "";
}

const databaseUrl = await loadDatabaseUrl();
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL could not be found in the current shell or common .env files."
  );
}

const { plan } = await buildMigrationPlan({
  schemaDir: "./ai-hq-backend/src/db/schema",
  entryFile: "index.base.sql",
});

const wanted = plan.filter((step) => TARGETS.has(step.name));
if (!wanted.length) {
  throw new Error("Target migrations were not found in the migration plan.");
}

console.log(
  "[reconcile] target checksums:",
  wanted.map((step) => ({
    name: step.name,
    checksum: step.checksum,
  }))
);

const pool = new Pool({
  connectionString: databaseUrl,
});

const client = await pool.connect();

try {
  await client.query("begin");

  for (const step of wanted) {
    const existing = await client.query(
      `
      select migration_name, checksum, applied_at
      from schema_migrations
      where migration_name = $1
      `,
      [step.name]
    );

    if (!existing.rows.length) {
      throw new Error(`schema_migrations row not found for ${step.name}.`);
    }

    console.log("[reconcile] before:", existing.rows[0]);

    await client.query(
      `
      update schema_migrations
         set checksum = $2
       where migration_name = $1
      `,
      [step.name, step.checksum]
    );

    const updated = await client.query(
      `
      select migration_name, checksum, applied_at
      from schema_migrations
      where migration_name = $1
      `,
      [step.name]
    );

    console.log("[reconcile] after:", updated.rows[0]);
  }

  await client.query("commit");
  console.log("[reconcile] done");
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error("[reconcile] failed:", error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}