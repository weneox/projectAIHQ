import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const canonicalMigrationPath = path.join(
  rootDir,
  "src",
  "db",
  "schema",
  "52_operational_data_backfill.sql"
);
const correctiveMigrationPath = path.join(
  rootDir,
  "src",
  "db",
  "schema",
  "94_operational_data_backfill_correction.sql"
);
const helperPath = path.join(
  rootDir,
  "src",
  "db",
  "helpers",
  "operationalBackfill.js"
);

test("operational backfill keeps 52 canonical and applies the schema fix in the corrective migration", async () => {
  const [canonicalMigrationSql, correctiveMigrationSql, helperSource] = await Promise.all([
    fs.readFile(canonicalMigrationPath, "utf8"),
    fs.readFile(correctiveMigrationPath, "utf8"),
    fs.readFile(helperPath, "utf8"),
  ]);

  assert.equal(/\bt\.meta\b/.test(canonicalMigrationSql), true);
  assert.equal(/\btenant_profiles tp\b/i.test(canonicalMigrationSql), false);
  assert.equal(/\bt\.meta\b/.test(correctiveMigrationSql), false);
  assert.equal(/\bt\.meta\b/.test(helperSource), false);
  assert.match(
    correctiveMigrationSql,
    /left join tenant_profiles tp on tp\.tenant_id = t\.id/i
  );
  assert.match(helperSource, /left join tenant_profiles tp on tp\.tenant_id = t\.id/i);
});
