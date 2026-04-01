import "dotenv/config";

import { closeDb, getDb, initDb } from "../src/db/index.js";
import { __test__ as migrationInternals } from "../src/db/runSchemaMigrations.js";

const { buildMigrationPlan, splitSqlStatements } = migrationInternals;

function s(v, d = "") {
  return String(v ?? d).trim();
}

async function main() {
  await initDb();

  const db = getDb();
  if (!db) {
    throw new Error("DB connection is not available");
  }

  const { entryFile, plan } = await buildMigrationPlan({
    entryFile: "index.base.sql",
  });

  await db.query(`
    create table if not exists schema_migrations (
      migration_name text primary key,
      entry_file text not null,
      checksum text not null,
      statement_count integer not null default 0,
      applied_at timestamptz not null default now()
    )
  `);

  let inserted = 0;
  let updated = 0;

  for (const step of plan) {
    const statementCount = splitSqlStatements(step.sql).length;

    const result = await db.query(
      `
        insert into schema_migrations (
          migration_name,
          entry_file,
          checksum,
          statement_count
        )
        values ($1, $2, $3, $4)
        on conflict (migration_name)
        do update set
          entry_file = excluded.entry_file,
          checksum = excluded.checksum,
          statement_count = excluded.statement_count
      `,
      [s(step.name), s(entryFile), s(step.checksum), Number(statementCount || 0)]
    );

    if (result?.rowCount) {
      inserted += 1;
    } else {
      updated += 1;
    }
  }

  const countResult = await db.query(
    `select count(*)::int as count from schema_migrations`
  );

  console.log("[schema-ledger] done", {
    entryFile,
    planCount: plan.length,
    inserted,
    updated,
    ledgerCount: Number(countResult?.rows?.[0]?.count || 0),
  });
}

main()
  .catch((error) => {
    console.error("[schema-ledger] failed", {
      message: error?.message || String(error),
      stack: error?.stack || null,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });