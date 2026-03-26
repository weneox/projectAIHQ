import test from "node:test";
import assert from "node:assert/strict";

import { buildFrontendReviewShape } from "../src/services/workspace/setup/reviewShape.js";
import { loadCurrentReviewPayload } from "../src/services/workspace/setup/reviewFlow.js";
import { projectSetupReviewDraftToCanonical } from "../src/services/workspace/setup/projection.js";
import { loadSetupTruthPayload } from "../src/services/workspace/setup/truthPayloads.js";

test("service extraction: review shape keeps bundle and provenance summary", () => {
  const shaped = buildFrontendReviewShape({
    session: { id: "session-1", primarySourceId: "source-1" },
    draft: {
      businessProfile: {
        companyName: "Alpha Studio",
        fieldSources: {
          companyName: {
            sourceType: "website",
            sourceUrl: "https://alpha.example",
            authorityRank: 300,
          },
        },
      },
      services: [{ key: "branding", title: "Branding" }],
      knowledgeItems: [{ key: "faq", title: "FAQ" }],
      warnings: ["needs_review"],
      draftPayload: {
        sourceContributions: {
          "website|https://alpha.example": {
            businessProfile: { companyName: "Alpha Studio" },
            services: [{ key: "branding", title: "Branding" }],
            knowledgeItems: [],
            warnings: [],
            sourceSummary: {
              latestImport: {
                sourceType: "website",
                sourceUrl: "https://alpha.example",
              },
            },
          },
        },
      },
      sourceSummary: {
        imports: [
          {
            sourceId: "source-1",
            sourceType: "website",
            sourceUrl: "https://alpha.example",
            sourceLabel: "Website",
          },
        ],
      },
    },
    sources: [{ sourceId: "source-1", sourceType: "website", role: "primary" }],
    events: [{ id: "event-1" }],
  });

  assert.equal(shaped.bundleSources.length, 1);
  assert.equal(shaped.bundleSources[0].role, "primary");
  assert.equal(shaped.fieldProvenance.companyName.sourceType, "website");
  assert.equal(shaped.reviewDraftSummary.serviceCount, 1);
});

test("service extraction: current review payload keeps shaped review and setup", async () => {
  const payload = await loadCurrentReviewPayload(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        role: "owner",
        tenant: null,
      },
      eventLimit: 12,
    },
    {
      async getCurrentSetupReview() {
        return {
          session: { id: "session-1" },
          draft: { businessProfile: { companyName: "Alpha Studio" } },
          sources: [],
        };
      },
      async listSetupReviewEvents({ limit }) {
        assert.equal(limit, 12);
        return [{ id: "event-1" }];
      },
      async buildSetupStatus() {
        return { progress: { nextRoute: "/setup/review" } };
      },
    }
  );

  assert.equal(payload.review.session.id, "session-1");
  assert.equal(payload.review.events.length, 1);
  assert.equal(payload.setup.progress.nextRoute, "/setup/review");
});

test("service extraction: projection still creates truth version and projection summaries", async () => {
  let versionInput = null;

  const projected = await projectSetupReviewDraftToCanonical(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        user: { name: "Reviewer" },
      },
      session: {
        id: "session-1",
        primarySourceType: "website",
      },
      draft: {
        version: 4,
        businessProfile: {
          companyName: "Alpha Studio",
          description: "Brand strategy and design",
        },
        capabilities: {
          supportsWhatsapp: true,
          primaryLanguage: "en",
        },
        sourceSummary: {
          primarySourceType: "website",
          primarySourceUrl: "https://alpha.example",
        },
        services: [],
        knowledgeItems: [],
      },
      sources: [
        {
          sourceId: "source-1",
          sourceType: "website",
          role: "primary",
          sourceUrl: "https://alpha.example",
        },
      ],
    },
    {
      knowledgeHelper: {
        async getBusinessProfile() {
          return null;
        },
        async getBusinessCapabilities() {
          return null;
        },
        async upsertBusinessProfile(input) {
          return {
            id: "profile-1",
            approved_by: "Reviewer",
            approved_at: "2026-03-25T02:00:00.000Z",
            source_summary_json: input.sourceSummaryJson,
          };
        },
        async upsertBusinessCapabilities() {
          return {
            id: "capabilities-1",
            approved_by: "Reviewer",
          };
        },
      },
      truthVersionHelper: {
        async createVersion(input) {
          versionInput = input;
          return { id: "version-1" };
        },
      },
    }
  );

  assert.equal(projected.projectedProfile, true);
  assert.equal(projected.projectedCapabilities, true);
  assert.equal(projected.truthVersion.id, "version-1");
  assert.equal(versionInput.reviewSessionId, "session-1");
  assert.equal(versionInput.metadataJson.reviewSessionProjection, true);
});

test("service extraction: truth payload keeps approved-truth blocker semantics", async () => {
  const payload = await loadSetupTruthPayload(
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

  assert.equal(payload.truth.readiness.status, "blocked");
  assert.equal(payload.truth.readiness.blockers[0].reasonCode, "approved_truth_unavailable");
  assert.equal(payload.setup.progress.nextRoute, "/setup/business");
});
