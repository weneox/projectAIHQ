import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import os from "os";
import path from "path";

import { decideStartupMigrationPolicy } from "../src/db/index.js";
import {
  describeSchemaMigrations,
  runSchemaMigrations,
  __test__ as schemaMigrationTest,
} from "../src/db/runSchemaMigrations.js";

class FakeMigrationDb {
  constructor() {
    this.ledgerExists = false;
    this.locked = false;
    this.ledger = new Map();
    this.executedStatements = [];
  }

  async query(sql, params = []) {
    const text = String(sql || "").trim().toLowerCase();

    if (text.startsWith("select to_regclass")) {
      const relation = String(params[0] || "").trim().toLowerCase();
      return {
        rows: [
          {
            regclass:
              relation === "schema_migrations"
                ? this.ledgerExists
                  ? "schema_migrations"
                  : null
                : null,
          },
        ],
      };
    }

    if (text.startsWith("select pg_advisory_lock")) {
      this.locked = true;
      return { rows: [{ pg_advisory_lock: true }] };
    }

    if (text.startsWith("select pg_advisory_unlock")) {
      this.locked = false;
      return { rows: [{ pg_advisory_unlock: true }] };
    }

    if (text.startsWith("create table if not exists schema_migrations")) {
      this.ledgerExists = true;
      return { rows: [] };
    }

    if (text.startsWith("select") && text.includes("from schema_migrations")) {
      return {
        rows: [...this.ledger.values()].map((row) => ({ ...row })),
      };
    }

    if (text === "begin" || text === "commit" || text === "rollback") {
      return { rows: [] };
    }

    if (text.startsWith("insert into schema_migrations")) {
      const row = {
        migration_name: params[0],
        entry_file: params[1],
        checksum: params[2],
        statement_count: params[3],
        applied_at: new Date().toISOString(),
      };
      this.ledger.set(row.migration_name, row);
      return { rows: [] };
    }

    this.executedStatements.push(String(sql || "").trim());
    return { rows: [] };
  }
}

async function withTempSchemaDir(files, run) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aihq-migrations-"));

  try {
    for (const [name, body] of Object.entries(files)) {
      await fs.writeFile(path.join(tempRoot, name), body, "utf8");
    }

    return await run(tempRoot);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

test("migration history is tracked and explicit migrate path is idempotent", async () => {
  await withTempSchemaDir(
    {
      "index.base.sql": "\\i ./01_first.sql\n\\i ./02_second.sql\n",
      "01_first.sql": "create table if not exists a (id int);\n",
      "02_second.sql": "alter table a add column if not exists name text;\n",
    },
    async (schemaDir) => {
      const db = new FakeMigrationDb();

      const before = await describeSchemaMigrations(db, {
        schemaDir,
        entryFile: "index.base.sql",
        requiredRelations: [],
      });

      assert.equal(before.ledgerExists, false);
      assert.equal(before.pendingCount, 2);
      assert.equal(before.appliedCount, 0);

      const firstRun = await runSchemaMigrations(db, {
        schemaDir,
        entryFile: "index.base.sql",
        requiredRelations: [],
      });

      assert.equal(firstRun.ok, true);
      assert.equal(firstRun.appliedCount, 2);
      assert.equal(firstRun.skippedCount, 0);
      assert.equal(db.ledger.size, 2);
      assert.equal(db.locked, false);

      const after = await describeSchemaMigrations(db, {
        schemaDir,
        entryFile: "index.base.sql",
        requiredRelations: [],
      });

      assert.equal(after.ledgerExists, true);
      assert.equal(after.pendingCount, 0);
      assert.equal(after.appliedCount, 2);
      assert.equal(after.drifted.length, 0);

      const secondRun = await runSchemaMigrations(db, {
        schemaDir,
        entryFile: "index.base.sql",
        requiredRelations: [],
      });

      assert.equal(secondRun.appliedCount, 0);
      assert.equal(secondRun.skippedCount, 2);
      assert.equal(db.executedStatements.length, 2);
    }
  );
});

test("real base schema plan includes execution policy controls migration", async () => {
  const schemaDir = path.resolve(process.cwd(), "src", "db", "schema");
  const plan = await schemaMigrationTest.buildMigrationPlan({
    schemaDir,
    entryFile: "index.base.sql",
  });

  assert.ok(
    plan.plan.some(
      (step) => step.name === "61_execution_policy_controls.sql"
    )
  );
});

test("migration status surfaces missing required relations even when pending count is zero", async () => {
  await withTempSchemaDir(
    {
      "index.base.sql": "\\i ./01_first.sql\n",
      "01_first.sql": "create table if not exists a (id int);\n",
    },
    async (schemaDir) => {
      const db = new FakeMigrationDb();

      await runSchemaMigrations(db, {
        schemaDir,
        entryFile: "index.base.sql",
        requiredRelations: [],
      });

      const status = await describeSchemaMigrations(db, {
        schemaDir,
        entryFile: "index.base.sql",
        requiredRelations: ["tenant_execution_policy_controls"],
      });

      assert.equal(status.pendingCount, 0);
      assert.equal(status.missingRequiredRelationCount, 1);
      assert.deepEqual(status.missingRequiredRelations, [
        "tenant_execution_policy_controls",
      ]);
    }
  );
});

test("startup policy blocks production boot when migrations are pending", () => {
  const decision = decideStartupMigrationPolicy({
    env: "production",
    autoMigrateOnStartup: false,
    pendingCount: 3,
    driftedCount: 0,
  });

  assert.equal(decision.autoMigrate, false);
  assert.equal(decision.shouldBlock, true);
  assert.equal(decision.reason, "pending_migrations");
});

test("startup policy blocks when required schema relations are missing", () => {
  const decision = decideStartupMigrationPolicy({
    env: "production",
    autoMigrateOnStartup: false,
    pendingCount: 0,
    driftedCount: 0,
    missingRequiredRelationCount: 1,
  });

  assert.equal(decision.autoMigrate, false);
  assert.equal(decision.shouldBlock, true);
  assert.equal(decision.reason, "required_schema_relations_missing");
});

test("startup policy can only auto-migrate when explicitly enabled in development", () => {
  const decision = decideStartupMigrationPolicy({
    env: "development",
    autoMigrateOnStartup: true,
    pendingCount: 2,
    driftedCount: 0,
  });

  assert.equal(decision.autoMigrate, true);
  assert.equal(decision.shouldBlock, false);
  assert.equal(decision.reason, "auto_migrate_enabled");
});
