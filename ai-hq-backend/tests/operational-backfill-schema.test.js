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

test("operational backfill no longer references nonexistent tenants.meta", async () => {
  const [migrationSql, helperSource] = await Promise.all([
    fs.readFile(migrationPath, "utf8"),
    fs.readFile(helperPath, "utf8"),
  ]);

  assert.equal(/\bt\.meta\b/.test(migrationSql), false);
  assert.equal(/\bt\.meta\b/.test(helperSource), false);
  assert.match(migrationSql, /left join tenant_profiles tp on tp\.tenant_id = t\.id/i);
  assert.match(helperSource, /left join tenant_profiles tp on tp\.tenant_id = t\.id/i);
});
