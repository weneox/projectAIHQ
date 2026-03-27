// src/db/runSchemaMigrations.js
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

const DEFAULT_LEDGER_TABLE = "schema_migrations";
const DEFAULT_LOCK_KEY = 2146124091;
const LEGACY_MIGRATION_CHECKSUMS = new Map([
  [
    "52_operational_data_backfill.sql",
    new Set([
      "0da24391c435b20c39e0caefe5d42d96346415a7b50ceb09f71d6b02dd478f87",
    ]),
  ],
]);

function s(v, d = "") {
  return String(v ?? d).trim();
}

function assertSafeIdentifier(value, fallback) {
  const x = s(value, fallback);
  if (!/^[a-z_][a-z0-9_]*$/i.test(x)) {
    throw new Error(`Unsafe SQL identifier: ${x || "(empty)"}`);
  }
  return x;
}

function sha256(text = "") {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

function acceptsLegacyChecksum(migrationName = "", checksum = "") {
  const accepted = LEGACY_MIGRATION_CHECKSUMS.get(s(migrationName));
  return Boolean(accepted?.has(s(checksum)));
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeSqlPath(baseDir, includePath) {
  const clean = s(includePath).replace(/^['"]|['"]$/g, "");
  return path.resolve(baseDir, clean);
}

async function buildMigrationPlanFromFile(
  filePath,
  {
    rootDir,
    stack = new Set(),
    planned = new Set(),
    plan = [],
  } = {}
) {
  const absPath = path.resolve(filePath);

  if (stack.has(absPath)) {
    throw new Error(`Circular SQL include detected: ${absPath}`);
  }

  stack.add(absPath);

  const raw = await fs.readFile(absPath, "utf8");
  const baseDir = path.dirname(absPath);
  const lines = raw.split(/\r?\n/);
  const localSqlLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^\\i\s+(.+)$/);

    if (match) {
      const childPath = normalizeSqlPath(baseDir, match[1]);
      const exists = await fileExists(childPath);

      if (!exists) {
        throw new Error(`Included SQL file not found: ${childPath}`);
      }

      await buildMigrationPlanFromFile(childPath, {
        rootDir,
        stack,
        planned,
        plan,
      });
      continue;
    }

    localSqlLines.push(line);
  }

  const localSql = localSqlLines.join("\n").trim();
  const migrationName = path.relative(rootDir, absPath).replace(/\\/g, "/");

  if (localSql && !planned.has(migrationName)) {
    planned.add(migrationName);
    plan.push({
      name: migrationName,
      filePath: absPath,
      sql: localSql,
      checksum: sha256(localSql),
    });
  }

  stack.delete(absPath);
  return plan;
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = "";

  let inSingle = false;
  let inDouble = false;
  let inDollar = false;
  let dollarTag = null;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    current += ch;

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        current += next;
        i++;
        inBlockComment = false;
      }
      continue;
    }

    if (!inSingle && !inDouble && !inDollar) {
      if (ch === "-" && next === "-") {
        current += next;
        i++;
        inLineComment = true;
        continue;
      }

      if (ch === "/" && next === "*") {
        current += next;
        i++;
        inBlockComment = true;
        continue;
      }
    }

    if (!inDouble && !inDollar && ch === "'" && sql[i - 1] !== "\\") {
      inSingle = !inSingle;
      continue;
    }

    if (!inSingle && !inDollar && ch === '"' && sql[i - 1] !== "\\") {
      inDouble = !inDouble;
      continue;
    }

    if (!inSingle && !inDouble && ch === "$") {
      const rest = sql.slice(i);
      const m = rest.match(/^(\$[A-Za-z0-9_]*\$)/);

      if (m) {
        const tag = m[1];

        if (!inDollar) {
          inDollar = true;
          dollarTag = tag;
          if (tag.length > 1) {
            current += tag.slice(1);
            i += tag.length - 1;
          }
          continue;
        }

        if (inDollar && tag === dollarTag) {
          if (tag.length > 1) {
            current += tag.slice(1);
            i += tag.length - 1;
          }
          inDollar = false;
          dollarTag = null;
          continue;
        }
      }
    }

    if (!inSingle && !inDouble && !inDollar && ch === ";") {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
    }
  }

  const tail = current.trim();
  if (tail) statements.push(tail);

  return statements;
}

async function ensureMigrationLedger(db, ledgerTable) {
  await db.query(`
    create table if not exists ${ledgerTable} (
      migration_name text primary key,
      entry_file text not null,
      checksum text not null,
      statement_count integer not null default 0,
      applied_at timestamptz not null default now()
    )
  `);
}

async function advisoryLock(db, lockKey) {
  await db.query("select pg_advisory_lock($1)", [lockKey]);
}

async function advisoryUnlock(db, lockKey) {
  await db.query("select pg_advisory_unlock($1)", [lockKey]);
}

async function getLedgerRows(db, ledgerTable) {
  const result = await db.query(
    `
      select
        migration_name,
        entry_file,
        checksum,
        statement_count,
        applied_at
      from ${ledgerTable}
      order by applied_at asc, migration_name asc
    `
  );

  return Array.isArray(result?.rows) ? result.rows : [];
}

async function ledgerExists(db, ledgerTable) {
  const result = await db.query("select to_regclass($1) as regclass", [ledgerTable]);
  return Boolean(result?.rows?.[0]?.regclass);
}

async function buildMigrationPlan(options = {}) {
  const schemaDir = path.resolve(
    s(options.schemaDir) || path.resolve(process.cwd(), "src", "db", "schema")
  );
  const entryFile = s(options.entryFile, "index.base.sql");
  const entryPath = path.join(schemaDir, entryFile);

  const exists = await fileExists(entryPath);
  if (!exists) {
    throw new Error(`Schema entry file not found: ${entryPath}`);
  }

  const plan = await buildMigrationPlanFromFile(entryPath, {
    rootDir: schemaDir,
  });

  return {
    schemaDir,
    entryFile,
    entryPath,
    plan,
  };
}

export async function describeSchemaMigrations(db, options = {}) {
  const ledgerTable = assertSafeIdentifier(
    options.ledgerTable,
    DEFAULT_LEDGER_TABLE
  );
  const { schemaDir, entryFile, plan } = await buildMigrationPlan(options);
  const hasLedger = await ledgerExists(db, ledgerTable);
  const appliedRows = hasLedger ? await getLedgerRows(db, ledgerTable) : [];
  const appliedByName = new Map(appliedRows.map((row) => [s(row.migration_name), row]));
  const drifted = [];
  const pending = [];

  for (const step of plan) {
    const applied = appliedByName.get(step.name);
    if (!applied) {
      pending.push(step);
      continue;
    }

    if (
      s(applied.checksum) !== s(step.checksum) &&
      !acceptsLegacyChecksum(step.name, applied.checksum)
    ) {
      drifted.push({
        name: step.name,
        expectedChecksum: step.checksum,
        appliedChecksum: s(applied.checksum),
        appliedAt: applied.applied_at || null,
      });
    }
  }

  return {
    ok: true,
    schemaDir,
    entryFile,
    ledgerTable,
    ledgerExists: hasLedger,
    migrationCount: plan.length,
    appliedCount: appliedRows.length,
    pendingCount: pending.length,
    pending: pending.map((step) => ({
      name: step.name,
      checksum: step.checksum,
    })),
    applied: appliedRows.map((row) => ({
      name: s(row.migration_name),
      checksum: s(row.checksum),
      appliedAt: row.applied_at || null,
      entryFile: s(row.entry_file),
      statementCount: Number(row.statement_count || 0),
    })),
    drifted,
  };
}

export async function runSchemaMigrations(db, options = {}) {
  const ledgerTable = assertSafeIdentifier(
    options.ledgerTable,
    DEFAULT_LEDGER_TABLE
  );
  const lockKey = Number.isFinite(Number(options.lockKey))
    ? Number(options.lockKey)
    : DEFAULT_LOCK_KEY;
  const useTransaction = options.useTransaction !== false;
  const { entryFile, plan } = await buildMigrationPlan(options);

  let lockHeld = false;
  let appliedCount = 0;
  let skippedCount = 0;
  let statementCount = 0;
  const appliedMigrations = [];

  await advisoryLock(db, lockKey);
  lockHeld = true;

  try {
    await ensureMigrationLedger(db, ledgerTable);
    const appliedRows = await getLedgerRows(db, ledgerTable);
    const appliedByName = new Map(appliedRows.map((row) => [s(row.migration_name), row]));

    for (const step of plan) {
      const existing = appliedByName.get(step.name);

      if (existing) {
        if (
          s(existing.checksum) !== s(step.checksum) &&
          !acceptsLegacyChecksum(step.name, existing.checksum)
        ) {
          throw new Error(
            `Applied migration was modified after execution: ${step.name}`
          );
        }

        skippedCount += 1;
        continue;
      }

      const statements = splitSqlStatements(step.sql);

      try {
        if (useTransaction) {
          await db.query("begin");
        }

        for (let i = 0; i < statements.length; i += 1) {
          await db.query(statements[i]);
        }

        await db.query(
          `
            insert into ${ledgerTable} (
              migration_name,
              entry_file,
              checksum,
              statement_count
            )
            values ($1, $2, $3, $4)
          `,
          [step.name, entryFile, step.checksum, statements.length]
        );

        if (useTransaction) {
          await db.query("commit");
        }
      } catch (err) {
        if (useTransaction) {
          try {
            await db.query("rollback");
          } catch {}
        }

        err.migrationName = step.name;
        err.entryFile = entryFile;
        err.statementCount = statements.length;
        throw err;
      }

      appliedCount += 1;
      statementCount += statements.length;
      appliedMigrations.push(step.name);
    }
  } finally {
    if (lockHeld) {
      try {
        await advisoryUnlock(db, lockKey);
      } catch {}
    }
  }

  return {
    ok: true,
    entryFile,
    ledgerTable,
    lockKey,
    migrationCount: plan.length,
    appliedCount,
    skippedCount,
    statementCount,
    appliedMigrations,
  };
}

export const __test__ = {
  buildMigrationPlan,
  splitSqlStatements,
  acceptsLegacyChecksum,
};
