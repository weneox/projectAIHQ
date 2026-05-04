import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildV1RetentionPolicy,
  runTenantDataRetentionCleanup,
} from "../src/services/dataRetention.js";
import {
  runWithSystemDbContext,
  runWithTenantContext,
} from "../src/db/tenantContext.js";
import { validateLaunchEvidence } from "../../scripts/check-launch-evidence.mjs";

function compactSql(sql = "") {
  return String(sql || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function createRetentionDb({ count = 2, forbidDelete = false } = {}) {
  const queries = [];

  return {
    queries,
    async query(sql, params = []) {
      const text = String(sql || "");
      const compact = compactSql(text);
      queries.push({ text, compact, params });

      if (compact.startsWith("select count")) {
        return { rows: [{ count }] };
      }

      if (forbidDelete) {
        throw new Error(`dry-run attempted destructive SQL: ${compact}`);
      }

      if (compact.startsWith("with candidates")) {
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`unexpected retention query: ${compact}`);
    },
  };
}

function readLaunchEvidence() {
  return JSON.parse(
    readFileSync(
      new URL("../../docs/launch/production-launch-evidence.json", import.meta.url),
      "utf8"
    )
  );
}

test("v1 retention policy covers launch data stores with safer audit retention", () => {
  const policy = buildV1RetentionPolicy({
    websiteWidgetDays: 30,
    inboxMessageDays: 90,
    sourceRawArtifactDays: 30,
    runtimeIncidentDays: 14,
    auditLogDays: 365,
    maxDeleteRows: 1000,
  });
  const byKey = new Map(policy.stores.map((item) => [item.key, item]));

  assert.equal(policy.version, "aihq_v1_data_retention_2026_05");
  assert.equal(policy.defaultDryRun, true);
  assert.equal(byKey.get("website_widget_conversations")?.retainDays, 30);
  assert.equal(byKey.get("inbox_conversations")?.retainDays, 90);
  assert.equal(byKey.get("source_raw_artifacts")?.retainDays, 30);
  assert.equal(byKey.get("runtime_incidents")?.retainDays, 14);
  assert.equal(byKey.get("audit_log")?.retainDays, 365);
  assert.ok(
    byKey.get("audit_log").retainDays >
      byKey.get("website_widget_conversations").retainDays
  );
  assert.ok(policy.excludedTables.includes("tenant_truth_versions"));
  assert.ok(policy.excludedTables.includes("tenant_channels"));
  assert.ok(policy.excludedTables.includes("tenant_secrets"));
});

test("retention cleanup dry-run never executes destructive SQL", async () => {
  const db = createRetentionDb({ forbidDelete: true });

  const result = await runWithSystemDbContext("retention_test", () =>
    runTenantDataRetentionCleanup({
      db,
      tenantKey: "acme",
      dryRun: true,
      now: new Date("2026-05-04T00:00:00.000Z"),
    })
  );

  assert.equal(result.dryRun, true);
  assert.ok(result.results.length >= 9);
  assert.ok(db.queries.every((query) => query.compact.startsWith("select count")));
  assert.ok(result.results.every((item) => item.deleted === 0));
});

test("retention cleanup can expire visitor, inbox, source, runtime, and audit rows by tenant", async () => {
  const db = createRetentionDb();

  const result = await runWithSystemDbContext("retention_test", () =>
    runTenantDataRetentionCleanup({
      db,
      tenantKey: "acme",
      dryRun: false,
      now: new Date("2026-05-04T00:00:00.000Z"),
    })
  );

  assert.equal(result.dryRun, false);
  assert.equal(result.tenantKey, "acme");
  assert.equal(result.cutoffs.websiteWidget, "2026-04-04T00:00:00.000Z");
  assert.equal(result.cutoffs.auditLog, "2025-05-04T00:00:00.000Z");

  const deleteQueries = db.queries.filter((query) =>
    query.compact.startsWith("with candidates")
  );
  assert.ok(deleteQueries.length >= 9);
  assert.ok(deleteQueries.every((query) => query.params[0] === "acme"));
  assert.ok(
    deleteQueries.every((query) => query.compact.includes("tenant_key = $1::text"))
  );

  const allSql = db.queries.map((query) => query.compact).join("\n");
  assert.match(allSql, /delete from inbox_messages/);
  assert.match(allSql, /in \('website', 'web'\)/);
  assert.match(allSql, /not in \('website', 'web'\)/);
  assert.match(allSql, /delete from tenant_source_raw_artifacts/);
  assert.match(allSql, /source_type/);
  assert.match(allSql, /website_page/);
  assert.match(allSql, /delete from runtime_incidents/);
  assert.match(allSql, /delete from audit_log/);

  for (const forbiddenTable of [
    "tenant_truth_versions",
    "tenant_business_profiles",
    "tenant_runtime_projections",
    "tenant_channels",
    "tenant_secrets",
    "content_media_assets",
    "document_file",
    "audio",
    "transcript",
  ]) {
    assert.doesNotMatch(allSql, new RegExp(`\\b${forbiddenTable}\\b`));
  }

  assert.ok(
    result.results.some(
      (item) =>
        item.key === "website_widget_conversations" &&
        item.table === "inbox_messages" &&
        item.deleted === 1
    )
  );
});

test("retention cleanup rejects missing or mismatched tenant scope", async () => {
  const db = createRetentionDb();

  await assert.rejects(
    () =>
      runWithSystemDbContext("retention_test", () =>
        runTenantDataRetentionCleanup({
          db,
          tenantKey: "",
          dryRun: true,
        })
      ),
    { code: "RETENTION_TENANT_KEY_REQUIRED" }
  );

  await assert.rejects(
    () =>
      runWithTenantContext({ tenantKey: "other" }, () =>
        runTenantDataRetentionCleanup({
          db,
          tenantKey: "acme",
          dryRun: true,
        })
      ),
    { code: "TENANT_SCOPE_MISMATCH" }
  );
});

test("P1-005 launch evidence hard-gates every launch target until real retention proof exists", () => {
  const evidence = readLaunchEvidence();
  const item = evidence.items.find((entry) => entry.id === "P1-005");

  assert.ok(item, "P1-005 launch evidence item must exist");
  assert.equal(item.status, "BLOCKED");
  assert.equal(item.blocksLimitedLaunch, true);
  assert.equal(item.blocksPaidLaunch, true);
  assert.equal(item.blocksPublicLaunch, true);
  assert.equal(item.acceptedRiskAllowed, false);
  assert.match(item.evidence, /dataRetention\.js/);
  assert.match(item.evidence, /v1-data-retention\.md/);
  assert.match(item.reasonMissing, /dry-run/i);
  assert.match(item.reasonMissing, /Business Truth/i);

  for (const target of ["limited", "paid", "public"]) {
    const result = validateLaunchEvidence(evidence, { target });
    assert.equal(result.ok, false, target);
    assert.match(result.errors.join("\n"), /P1-005/, target);
  }

  const evidenceWithoutRetention = {
    ...evidence,
    items: evidence.items
      .filter((entry) => entry.id !== "P1-005")
      .map((entry) => ({
        ...entry,
        status: "READY",
        evidence: entry.evidence || "test evidence",
        reasonMissing: "",
        approver: "test approver",
      })),
  };

  for (const target of ["limited", "paid", "public"]) {
    const result = validateLaunchEvidence(evidenceWithoutRetention, { target });
    assert.equal(result.ok, false, target);
    assert.match(result.errors.join("\n"), /Missing required launch evidence item "P1-005"/);
  }
});

test("retention runbook does not overclaim coverage for excluded or external data stores", () => {
  const runbook = readFileSync(
    new URL("../../docs/runbooks/v1-data-retention.md", import.meta.url),
    "utf8"
  );

  assert.match(runbook, /does not prove that production retention is running/i);
  assert.match(runbook, /does not anonymize rows in place/i);
  assert.match(runbook, /content_media_assets/);
  assert.match(runbook, /Application\/platform logs outside the database are not deleted by this repo/i);
  assert.match(runbook, /Binary\/object-store media deletion is not proven by this repo/i);
  assert.match(runbook, /Non-website raw artifacts/i);
  assert.match(runbook, /approved Business Truth/i);
});
