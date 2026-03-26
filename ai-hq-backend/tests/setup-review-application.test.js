import test from "node:test";
import assert from "node:assert/strict";

import {
  applySetupReviewPatch,
  finalizeSetupReviewComposition,
  normalizeReviewPatchBody,
} from "../src/services/workspace/setup/reviewApp.js";
import {
  loadSetupTruthPayloadWithStatus,
  loadSetupTruthVersionPayloadWithStatus,
} from "../src/services/workspace/setup/readApp.js";
import { executeSetupImport } from "../src/services/workspace/setup/importApp.js";

test("review app normalizes patch aliases into canonical draft patch fields", () => {
  const patch = normalizeReviewPatchBody({
    patch: {
      business_profile: { companyName: "Alpha Studio" },
      capabilities_json: { primaryLanguage: "en" },
      serviceItems: [{ title: "Branding" }],
      knowledge_items: [{ title: "FAQ" }],
      channels: [{ type: "instagram" }],
      source_summary: { primarySourceType: "website" },
      warnings: ["needs_review"],
      completeness: { score: 2 },
      confidence_summary: { high: 1 },
      diff_from_canonical: { changed: ["companyName"] },
      draft_payload: { staged: true },
      last_snapshot_id: "snapshot-1",
    },
  });

  assert.deepEqual(patch, {
    draftPayload: { staged: true },
    businessProfile: { companyName: "Alpha Studio" },
    capabilities: { primaryLanguage: "en" },
    services: [{ title: "Branding" }],
    knowledgeItems: [{ title: "FAQ" }],
    channels: [{ type: "instagram" }],
    sourceSummary: { primarySourceType: "website" },
    warnings: ["needs_review"],
    completeness: { score: 2 },
    confidenceSummary: { high: 1 },
    diffFromCanonical: { changed: ["companyName"] },
    lastSnapshotId: "snapshot-1",
  });
});

test("review app preserves lock conflict responses fail-closed", async () => {
  const result = await applySetupReviewPatch(
    {
      db: {},
      actor: { tenantId: "tenant-1" },
      body: { metadata: { draftVersion: 3 } },
    },
    {
      async getCurrentSetupReview() {
        return {
          session: { id: "session-1" },
          draft: { version: 7 },
        };
      },
      buildReviewLockConflict() {
        return {
          status: 409,
          error: "SetupReviewVersionConflict",
          reason: "draft version mismatch",
          code: "SETUP_REVIEW_DRAFT_VERSION_MISMATCH",
          requested: { draftVersion: 3 },
          concurrency: { sessionId: "session-1", draftVersion: 7 },
          finalizeProtection: { protectionMode: "canonical_baseline_drift" },
        };
      },
    }
  );

  assert.equal(result.status, 409);
  assert.equal(result.body.code, "SETUP_REVIEW_DRAFT_VERSION_MISMATCH");
  assert.deepEqual(result.body.concurrency, {
    sessionId: "session-1",
    draftVersion: 7,
  });
});

test("review finalize composition audits finalized session and truth version creation", async () => {
  const auditCalls = [];
  let projected = false;

  const result = await finalizeSetupReviewComposition(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        role: "owner",
        tenant: null,
        user: {
          email: "ops@example.com",
          name: "Ops",
        },
      },
      body: { reason: "ship it" },
      log: {
        info() {},
        error() {},
      },
    },
    {
      async getCurrentSetupReview() {
        return {
          session: { id: "session-1", status: "ready" },
          draft: { version: 9 },
        };
      },
      async finalizeSetupReviewSession(input) {
        await input.projectDraftToCanonical({
          client: { name: "tx" },
          tenantId: "tenant-1",
          session: { id: "session-1", status: "ready" },
          draft: { version: 9 },
          sources: [],
        });
        return {
          session: { id: "session-1", status: "finalized" },
          reviewSessionId: "session-1",
        };
      },
      async projectSetupReviewDraftToCanonical() {
        projected = true;
        return {
          truthVersion: {
            id: "version-1",
            approvedAt: "2026-03-25T02:00:00.000Z",
            approvedBy: "Ops",
          },
          runtimeProjection: {
            id: "runtime-1",
          },
        };
      },
      async buildSetupStatus() {
        return { progress: { nextRoute: "/setup/truth" } };
      },
      async auditSetupAction(...args) {
        auditCalls.push(args);
      },
      buildReviewConcurrencyInfo() {
        return { draftVersion: 9 };
      },
      buildFinalizeProtectionInfo() {
        return { mode: "canonical_baseline_drift" };
      },
    }
  );

  assert.equal(projected, true);
  assert.equal(result.status, 200);
  assert.equal(result.body.projectionSummary.truthVersion.id, "version-1");
  assert.equal(auditCalls.length, 2);
  assert.equal(auditCalls[0][2], "setup.review.finalized");
  assert.equal(auditCalls[1][2], "truth.version.created");
});

test("read app injects setup status builder into truth payload loaders", async () => {
  const current = await loadSetupTruthPayloadWithStatus(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        role: "owner",
        tenant: null,
      },
    },
    {
      async loadSetupTruthPayload(args, deps) {
        return deps.setupBuilder({
          db: args.db,
          tenantId: args.actor.tenantId,
          tenantKey: args.actor.tenantKey,
          role: args.actor.role,
          tenant: args.actor.tenant,
        }).then((setup) => ({
          truth: { readiness: { status: "blocked" } },
          setup,
        }));
      },
      knowledgeHelper: {
        async getBusinessProfile() {
          return null;
        },
      },
      truthVersionHelper: {
        async listVersions() {
          return [];
        },
        buildHistoryEntries() {
          return [];
        },
      },
      async setupBuilder() {
        return {
          progress: {
            nextRoute: "/setup/business",
            primaryMissingStep: "approved_truth",
          },
        };
      },
    }
  );

  assert.equal(current.setup.progress.nextRoute, "/setup/business");

  const version = await loadSetupTruthVersionPayloadWithStatus(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        role: "owner",
        tenant: null,
      },
      versionId: "version-1",
    },
    {
      async loadSetupTruthVersionPayload(args, deps) {
        return deps.setupBuilder({
          db: args.db,
          tenantId: args.actor.tenantId,
          tenantKey: args.actor.tenantKey,
          role: args.actor.role,
          tenant: args.actor.tenant,
        }).then((setup) => ({
          truthVersion: { id: args.versionId },
          previousTruthVersion: null,
          compare: null,
          setup,
        }));
      },
      truthVersionHelper: {
        async compareVersions() {
          return {
            version: {
              id: "version-1",
              approved_at: "2026-03-25T00:00:00.000Z",
              approved_by: "Ops",
              profile_snapshot_json: {},
              capabilities_snapshot_json: {},
              field_provenance_json: {},
              source_summary_json: {},
            },
            previousVersion: null,
            diff: {
              versionId: "version-1",
              previousVersionId: "",
              changedFields: [],
              fieldChanges: [],
              summary: { totalChangedFields: 0 },
            },
          };
        },
      },
      async setupBuilder() {
        return {
          progress: {
            nextRoute: "/setup/truth",
          },
        };
      },
    }
  );

  assert.equal(version.truthVersion.id, "version-1");
  assert.equal(version.setup.progress.nextRoute, "/setup/truth");
});

test("import app centralizes response wiring and response body extensions", async () => {
  const result = await executeSetupImport(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
      },
      body: {
        note: "refresh",
      },
      requestId: "req-1",
      log: {
        info() {},
      },
      logLabel: "setup.import.source.requested",
      logContext: {
        sourceType: "website",
      },
      async executeImport(input) {
        assert.equal(input.requestId, "req-1");
        return {
          ok: true,
          mode: "accepted",
          reviewSessionId: "session-1",
        };
      },
      executeArgs: {
        sourceType: "website",
        url: "https://alpha.example",
      },
      response: {
        successMessage: "Website import completed",
        acceptedMessage: "Website import accepted",
        partialMessage: "Website import finished with warnings",
        errorCode: "WebsiteImportFailed",
        errorMessage: "website import failed",
      },
      responseBody(body) {
        return {
          ...body,
          sourceType: "website",
        };
      },
    },
    {
      async enrichImportDataWithReview({ data }) {
        return {
          ...data,
          review: { session: { id: "session-1" } },
        };
      },
    }
  );

  assert.equal(result.status, 202);
  assert.equal(result.body.accepted, true);
  assert.equal(result.body.sourceType, "website");
  assert.equal(result.body.review.session.id, "session-1");
});
