import "dotenv/config";

import { assertConfigValid } from "../src/config/validate.js";
import { closeDb, getDb, initDb } from "../src/db/index.js";
import {
  getOperationalReadinessSummary,
  hasOperationalReadinessBlockers,
} from "../src/services/operationalReadiness.js";

async function main() {
  assertConfigValid(console);
  await initDb();

  const db = getDb();
  if (!db?.query) {
    throw new Error("DATABASE_URL is required to check operational readiness");
  }

  const summary = await getOperationalReadinessSummary(db);
  console.log("[operational-readiness] summary", JSON.stringify(summary, null, 2));

  if (hasOperationalReadinessBlockers(summary)) {
    throw new Error("Operational readiness blockers detected");
  }
}

main()
  .catch((error) => {
    console.error("[operational-readiness] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
