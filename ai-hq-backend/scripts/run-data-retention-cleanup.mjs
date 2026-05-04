import { cfg } from "../src/config.js";
import { initDb, closeDb } from "../src/db/index.js";
import {
  buildV1RetentionPolicy,
  parseRetentionDryRunFlag,
  runDataRetentionCleanupForAllTenants,
} from "../src/services/dataRetention.js";

function s(value = "", fallback = "") {
  const out = String(value ?? "").trim();
  return out || String(fallback ?? "").trim();
}

function parseArgs(argv = []) {
  const args = {
    dryRun: cfg.retention?.dryRunDefault !== false,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") args.dryRun = true;
    if (arg === "--execute") args.dryRun = false;
  }

  if (s(process.env.DATA_RETENTION_DRY_RUN)) {
    args.dryRun = parseRetentionDryRunFlag(
      process.env.DATA_RETENTION_DRY_RUN,
      args.dryRun
    );
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const policy = buildV1RetentionPolicy();
  const db = await initDb({ poolRole: "worker" });

  if (!db) {
    throw new Error("DATABASE_URL is required for data retention cleanup");
  }

  const result = await runDataRetentionCleanupForAllTenants({
    db,
    policy,
    dryRun: args.dryRun,
  });

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        dryRun: result.dryRun,
        policyVersion: result.policyVersion,
        tenantCount: result.tenantCount,
        generatedAt: new Date().toISOString(),
        summary: result.results.map((tenantResult) => ({
          tenantKey: tenantResult.tenantKey,
          matched: tenantResult.results.reduce(
            (sum, item) => sum + Number(item.matched || 0),
            0
          ),
          deleted: tenantResult.results.reduce(
            (sum, item) => sum + Number(item.deleted || 0),
            0
          ),
        })),
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: "data_retention_cleanup_failed",
          message: String(error?.message || error),
          code: error?.code || null,
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
