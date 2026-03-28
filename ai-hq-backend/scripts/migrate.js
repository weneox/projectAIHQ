import "dotenv/config";

import { cfg } from "../src/config.js";
import { assertSelectedConfigValid } from "../src/config/validate.js";
import {
  closeDb,
  getDb,
  getMigrationStatus,
  initDb,
  migrate,
} from "../src/db/index.js";
import { createLogger } from "../src/utils/logger.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

async function main() {
  const logger = createLogger({
    service: "ai-hq-backend",
    component: "db-migrate-cli",
    env: cfg.app.env,
  });

  assertSelectedConfigValid(["db.url"], console);
  await initDb();

  if (!cfg?.db?.url) {
    throw new Error("DATABASE_URL is required to run migrations");
  }

  if (!getDb()) {
    throw new Error(
      "Database connection could not be established for migrations. Check DATABASE_URL and database availability."
    );
  }

  const before = await getMigrationStatus();
  logger.info("db.migrate.status.before", {
    ledgerExists: !!before?.ledgerExists,
    migrationCount: Number(before?.migrationCount || 0),
    appliedCount: Number(before?.appliedCount || 0),
    pendingCount: Number(before?.pendingCount || 0),
    driftedCount: Number(before?.drifted?.length || 0),
    missingRequiredRelationCount: Number(
      before?.missingRequiredRelationCount || 0
    ),
  });

  const result = await migrate();
  if (!result?.ok) {
    throw new Error(s(result?.error || result?.reason || "migration failed"));
  }

  const after = await getMigrationStatus();
  logger.info("db.migrate.status.after", {
    ledgerExists: !!after?.ledgerExists,
    migrationCount: Number(after?.migrationCount || 0),
    appliedCount: Number(after?.appliedCount || 0),
    pendingCount: Number(after?.pendingCount || 0),
    driftedCount: Number(after?.drifted?.length || 0),
    missingRequiredRelationCount: Number(
      after?.missingRequiredRelationCount || 0
    ),
  });
}

main()
  .catch((error) => {
    createLogger({
      service: "ai-hq-backend",
      component: "db-migrate-cli",
      env: cfg.app.env,
    }).error("db.migrate.failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
