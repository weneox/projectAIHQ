import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const migrationPath = path.join(
  rootDir,
  "src",
  "db",
  "schema",
  "52_operational_data_backfill.sql"
);
const helperPath = path.join(
  rootDir,
  "src",
  "db",
  "helpers",
  "operationalBackfill.js"
);
const migrationRunnerPath = path.join(
  rootDir,
  "src",
  "db",
  "runSchemaMigrations.js"
);

test("operational backfill migration and helper use tenant_profiles instead of tenants.meta", async () => {
  const [migrationSql, helperSource] = await Promise.all([
    fs.readFile(migrationPath, "utf8"),
    fs.readFile(helperPath, "utf8"),
  ]);

  assert.equal(/\bt\.meta\b/.test(migrationSql), false);
  assert.equal(/\bt\.meta\b/.test(helperSource), false);
  assert.match(migrationSql, /left join tenant_profiles tp on tp\.tenant_id = t\.id/i);
  assert.match(helperSource, /left join tenant_profiles tp on tp\.tenant_id = t\.id/i);
});

test("migration runner accepts the original 52 checksum for already-applied ledgers", async () => {
  const source = await fs.readFile(migrationRunnerPath, "utf8");

  assert.match(
    source,
    /52_operational_data_backfill\.sql[\s\S]*0da24391c435b20c39e0caefe5d42d96346415a7b50ceb09f71d6b02dd478f87/i
  );
});
