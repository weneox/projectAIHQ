import test from "node:test";
import assert from "node:assert/strict";
import {
  validateSetupCurrentReviewPayload,
  validateSetupFinalizeResponse,
  validateSetupTruthPayload,
  validateSetupTruthPublicationSummary,
} from "@aihq/shared-contracts/setup";

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
import { buildFrontendReviewShape } from "../src/services/workspace/setup/reviewShape.js";

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
  assert.equal(validateSetupFinalizeResponse(result.body).ok, true);
  assert.equal(
    validateSetupTruthPublicationSummary(result.body.projectionSummary).ok,
    true
  );
  assert.equal(auditCalls.length, 2);
  assert.equal(auditCalls[0][2], "setup.review.finalized");
  assert.equal(auditCalls[1][2], "truth.version.created");
});

test("review finalize composition surfaces the strict runtime projection in the finalize response", async () => {
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
          runtimeProjection: {
            id: "runtime-1",
            status: "ready",
          },
          runtimeProjectionFreshness: {
            stale: false,
            reasons: [],
          },
        };
      },
      async projectSetupReviewDraftToCanonical() {
        return {
          truthVersionCreated: false,
          truthVersion: {
            id: "version-existing-1",
          },
          runtimeProjection: null,
        };
      },
      async buildSetupStatus() {
        return { progress: { nextRoute: "/inbox" } };
      },
      async auditSetupAction() {},
      buildReviewConcurrencyInfo() {
        return {};
      },
      buildFinalizeProtectionInfo() {
        return {};
      },
    }
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.projectionSummary.truthVersion.id, "version-existing-1");
  assert.equal(result.body.projectionSummary.runtimeProjection.id, "runtime-1");
  assert.equal(
    result.body.projectionSummary.verification.runtimeProjectionRefreshed,
    true
  );
  assert.equal(
    result.body.projectionSummary.verification.truthVersionCreated,
    false
  );
  assert.equal(validateSetupFinalizeResponse(result.body).ok, true);
});

test("review finalize composition audits failed finalize attempts with outcome metadata", async () => {
  const auditCalls = [];

  await assert.rejects(
    () =>
      finalizeSetupReviewComposition(
        {
          db: {},
          actor: {
            tenantId: "tenant-1",
            tenantKey: "alpha",
            role: "owner",
            requestId: "req-finalize-1",
            correlationId: "corr-finalize-1",
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
          async finalizeSetupReviewSession() {
            const error = new Error("baseline drift");
            error.code = "SETUP_REVIEW_DRAFT_VERSION_MISMATCH";
            throw error;
          },
          async auditSetupAction(...args) {
            auditCalls.push(args);
          },
        }
      ),
    /baseline drift/
  );

  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0][2], "setup.review.finalize");
  assert.equal(auditCalls[0][5].outcome, "failed");
  assert.equal(auditCalls[0][5].reasonCode, "SETUP_REVIEW_DRAFT_VERSION_MISMATCH");
  assert.equal(auditCalls[0][1].requestId, "req-finalize-1");
  assert.equal(auditCalls[0][1].correlationId, "corr-finalize-1");
});

test("review finalize composition blocks insufficient roles and audits the denial", async () => {
  const auditCalls = [];

  const result = await finalizeSetupReviewComposition(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        role: "operator",
        requestId: "req-finalize-blocked-1",
        correlationId: "corr-finalize-blocked-1",
        tenant: null,
        user: {
          email: "operator@example.com",
          name: "Operator",
        },
      },
      body: { reason: "ship it" },
      log: {
        info() {},
        warn() {},
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
      async finalizeSetupReviewSession() {
        throw new Error("not expected");
      },
      async auditSetupAction(...args) {
        auditCalls.push(args);
      },
    }
  );

  assert.equal(result.status, 403);
  assert.equal(result.body?.error, "Forbidden");
  assert.equal(result.body?.reasonCode, "insufficient_role");
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0][2], "setup.review.finalize");
  assert.equal(auditCalls[0][5].outcome, "blocked");
  assert.equal(auditCalls[0][5].reasonCode, "insufficient_role");
  assert.equal(auditCalls[0][5].attemptedRole, "operator");
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
  assert.equal(
    validateSetupTruthPayload({
      truth: {
        profile: {},
        fieldProvenance: {},
        history: [],
        readiness: {
          status: "blocked",
          reasonCode: "approved_truth_unavailable",
          blockers: [
            {
              blocked: true,
              category: "truth",
              dependencyType: "approved_truth",
              reasonCode: "approved_truth_unavailable",
              title: "Approved truth blocker",
              suggestedRepairActionId: "open_setup_route",
              nextAction: {
                id: "open_setup_route",
                kind: "route",
                label: "Open setup",
                requiredRole: "operator",
                allowed: true,
              },
            },
          ],
        },
      },
      setup: current.setup,
    }).ok,
    true
  );

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

test("truth payload contract stays compatible with shared setup truth surface", async () => {
  const payload = await loadSetupTruthPayloadWithStatus(
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
        const setup = await deps.setupBuilder({
          db: args.db,
          tenantId: args.actor.tenantId,
          tenantKey: args.actor.tenantKey,
          role: args.actor.role,
          tenant: args.actor.tenant,
        });

        return {
          truth: {
            profile: {
              companyName: "Alpha Studio",
            },
            fieldProvenance: {},
            history: [],
            approvedAt: "",
            approvedBy: "",
            generatedAt: "2026-03-26T00:00:00.000Z",
            generatedBy: "system",
            profileStatus: "draft",
            sourceSummary: {},
            metadata: {},
            readiness: {
              status: "blocked",
              reasonCode: "approved_truth_unavailable",
              blockers: [
                {
                  blocked: true,
                  category: "truth",
                  dependencyType: "approved_truth",
                  reasonCode: "approved_truth_unavailable",
                  title: "Approved truth blocker",
                  suggestedRepairActionId: "open_setup_route",
                  nextAction: {
                    id: "open_setup_route",
                    kind: "route",
                    label: "Open setup",
                    requiredRole: "operator",
                    allowed: true,
                  },
                },
              ],
            },
          },
          setup,
        };
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

  const checked = validateSetupTruthPayload(payload);
  assert.equal(checked.ok, true);
  assert.equal(checked.value.truth.readiness.status, "blocked");
});

test("review current payload shape stays compatible with shared setup contract", () => {
  const checked = validateSetupCurrentReviewPayload({
    review: {
      session: {
        id: "session-1",
        status: "draft",
        currentStep: "review",
      },
      draft: {
        version: 4,
        businessProfile: {
          companyName: "Alpha",
        },
      },
      sources: [],
      events: [],
      bundleSources: [],
      contributionSummary: [],
      fieldProvenance: {},
      reviewDraftSummary: {
        warningCount: 0,
        warnings: [],
        serviceCount: 0,
        knowledgeCount: 0,
        hasBusinessProfile: true,
      },
    },
    bundleSources: [],
    contributionSummary: [],
    fieldProvenance: {},
    reviewDraftSummary: {
      warningCount: 0,
    },
    setup: {
      progress: {
        nextRoute: "/setup/review",
      },
    },
  });

  assert.equal(checked.ok, true);
  assert.equal(checked.value.review.session.id, "session-1");
});

test("frontend review shape producer stays compatible with shared setup review contract", () => {
  const review = buildFrontendReviewShape({
    session: {
      id: "session-1",
      status: "draft",
      currentStep: "review",
      primarySourceId: "source-1",
    },
    draft: {
      version: 4,
      businessProfile: {
        companyName: "Alpha",
        fieldSources: {
          companyName: {
            sourceType: "website",
            sourceUrl: "https://alpha.example",
            authorityRank: 10,
          },
        },
      },
      warnings: [],
      services: [{ title: "Branding" }],
      knowledgeItems: [],
      draftPayload: {},
      sourceSummary: {
        imports: [],
      },
    },
    sources: [
      {
        sourceId: "source-1",
        sourceType: "website",
        role: "primary",
        label: "Alpha",
      },
    ],
    events: [],
  });

  const checked = validateSetupCurrentReviewPayload({
    review,
    bundleSources: review.bundleSources,
    contributionSummary: review.contributionSummary,
    fieldProvenance: review.fieldProvenance,
    reviewDraftSummary: review.reviewDraftSummary,
    setup: {
      progress: {
        nextRoute: "/setup/review",
      },
    },
  });

  assert.equal(checked.ok, true);
  assert.equal(checked.value.review.session.id, "session-1");
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
