import "dotenv/config";

import { cfg } from "../src/config.js";
import { assertConfigValid } from "../src/config/validate.js";
import { closeDb, getDb, initDb } from "../src/db/index.js";
import { runOperationalDataBackfill } from "../src/db/helpers/operationalBackfill.js";

async function main() {
  assertConfigValid(console);
  await initDb();

  const db = getDb();
  if (!db?.query) {
    throw new Error("DATABASE_URL is required to backfill operational data");
  }

  const result = await runOperationalDataBackfill(db, {
    actor: "manual_operational_backfill",
  });

  console.log("[operational-backfill] completed", result);
}

main()
  .catch((error) => {
    console.error("[operational-backfill] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
