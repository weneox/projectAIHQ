import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCanonicalProfileSourceSummary,
  projectSetupReviewDraftToCanonical,
} from "../src/services/workspace/setup/projection.js";
import { buildCanonicalTruthVersionSnapshot } from "../src/db/helpers/tenantTruthVersions.js";

function createDb() {
  return {
    async query(queryText, params = []) {
      const sql = String(
        typeof queryText === "string" ? queryText : queryText?.text || ""
      ).toLowerCase();

      if (sql.includes("from tenant_setup_review_sessions")) {
        return {
          rows: [{ id: params[0] || "session-1" }],
        };
      }

      if (sql.includes("from tenants")) {
        return {
          rows: [
            {
              id: "tenant-1",
              tenant_key: "alpha",
              company_name: "Alpha Studio",
            },
          ],
        };
      }

      return { rows: [] };
    },
  };
}

function createKnowledgeHelper() {
  return {
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
        profile_json: input.profileJson,
        source_summary_json: input.sourceSummaryJson,
      };
    },
    async upsertBusinessCapabilities(input) {
      return {
        id: "capabilities-1",
        approved_by: "Reviewer",
        capabilities_json: input.capabilitiesJson,
      };
    },
  };
}

function createProjectionInput() {
  return {
    db: createDb(),
    actor: {
      tenantId: "tenant-1",
      tenantKey: "alpha",
      role: "admin",
      tenant: {
        id: "tenant-1",
      },
      user: {
        name: "Reviewer",
      },
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
      },
      sourceSummary: {
        primarySourceType: "website",
        primarySourceUrl: "https://alpha.example",
      },
      services: [],
      contacts: [],
      locations: [],
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
  };
}

function createProjectionDeps(overrides = {}) {
  return {
    knowledgeHelper: createKnowledgeHelper(),
    refreshRuntimeProjectionBestEffort: async () => ({
      projection: {
        status: "queued",
      },
    }),
    ...overrides,
  };
}

function createReusableTruthVersion({
  id = "version-reused-1",
  businessProfileId = "profile-old-1",
  businessCapabilitiesId = "capabilities-old-1",
} = {}) {
  const sourceSummary = buildCanonicalProfileSourceSummary({
    session: {
      id: "session-1",
    },
    draft: {
      sourceSummary: {},
      businessProfile: {
        companyName: "Alpha Studio",
        description: "Brand strategy and design",
      },
      capabilities: {
        supportsWhatsapp: true,
      },
      services: [],
    },
    sources: [
      {
        sourceId: "source-1",
        sourceType: "website",
        role: "primary",
        sourceUrl: "https://alpha.example",
      },
    ],
    sourceInfo: {
      primarySourceType: "website",
      primarySourceId: "source-1",
      sourceUrl: "https://alpha.example",
      latestRunId: "",
    },
    approvedAt: "2026-03-25T02:00:00.000Z",
  });

  const snapshot = buildCanonicalTruthVersionSnapshot({
    profile: {
      id: businessProfileId,
      approved_by: "Reviewer",
      approved_at: "2026-03-25T02:00:00.000Z",
      profile_json: {
        companyName: "Alpha Studio",
        description: "Brand strategy and design",
        websiteUrl: "https://alpha.example",
      },
      source_summary_json: sourceSummary,
      confidence: 0,
    },
    capabilities: {
      id: businessCapabilitiesId,
      approved_by: "Reviewer",
      capabilities_json: {
        supportsWhatsapp: true,
      },
    },
    services: [],
    contacts: [],
    locations: [],
    truthFacts: [],
    sourceSummary,
    metadata: {},
  });

  return {
    id,
    business_profile_id: businessProfileId,
    business_capabilities_id: businessCapabilitiesId,
    review_session_id: "session-1",
    approved_at: "2026-03-25T02:00:00.000Z",
    approved_by: "Reviewer",
    source_summary_json: snapshot.sourceSummary,
    profile_snapshot_json: snapshot.profileSnapshot,
    capabilities_snapshot_json: snapshot.capabilitiesSnapshot,
    services_snapshot_json: snapshot.servicesSnapshot,
    contacts_snapshot_json: snapshot.contactsSnapshot,
    locations_snapshot_json: snapshot.locationsSnapshot,
    truth_facts_snapshot_json: snapshot.truthFactsSnapshot,
    field_provenance_json: snapshot.fieldProvenance,
    metadata_json: snapshot.metadata,
  };
}

test("setup review projection reuses versions returned by approved-only helper lookups", async () => {
  const projected = await projectSetupReviewDraftToCanonical(
    createProjectionInput(),
    createProjectionDeps({
      truthVersionHelper: {
        async createVersion() {
          const err = new Error("No new truth version required");
          err.code = "TRUTH_VERSION_NOT_REQUIRED";
          throw err;
        },
        async getLatestApprovedVersion() {
          return {
            id: "version-approved-1",
          };
        },
      },
    })
  );

  assert.equal(projected.truthVersionCreated, false);
  assert.equal(projected.truthVersionReused, true);
  assert.equal(projected.truthVersion.id, "version-approved-1");
  assert.equal(projected.truthVersion.reuseMode, "getLatestApprovedVersion");
  assert.equal(projected.runtimeProjection.status, "queued");
});

test("setup review projection reuses latest published truth by snapshot equivalence when ids drift", async () => {
  const projected = await projectSetupReviewDraftToCanonical(
    createProjectionInput(),
    createProjectionDeps({
      truthVersionHelper: {
        async createVersion() {
          return null;
        },
        async getLatestVersion() {
          return createReusableTruthVersion();
        },
      },
    })
  );

  assert.equal(projected.truthVersionCreated, false);
  assert.equal(projected.truthVersionReused, true);
  assert.equal(projected.truthVersion.id, "version-reused-1");
  assert.equal(projected.truthVersion.reuseMode, "getLatestVersion");
  assert.equal(projected.truthVersion.reuseReason, "snapshot_equivalent");
  assert.equal(projected.runtimeProjection.status, "queued");
});

test("setup review projection does not reuse draft truth versions from generic fallbacks", async () => {
  await assert.rejects(
    () =>
      projectSetupReviewDraftToCanonical(
        createProjectionInput(),
        createProjectionDeps({
          truthVersionHelper: {
            async createVersion() {
              const err = new Error("No new truth version required");
              err.code = "TRUTH_VERSION_NOT_REQUIRED";
              throw err;
            },
            async listVersions() {
              return [
                {
                  id: "version-draft-1",
                  status: "draft",
                },
              ];
            },
          },
        })
      ),
    (err) => {
      assert.equal(err.code, "SETUP_REVIEW_TRUTH_VERSION_REQUIRED");
      assert.equal(err.truthVersionCreateErrorCode, "TRUTH_VERSION_NOT_REQUIRED");
      return true;
    }
  );
});

test("canonical profile source summary keeps primary source context and governance details", () => {
  const summary = buildCanonicalProfileSourceSummary({
    session: {
      id: "session-1",
    },
    draft: {
      lastSnapshotId: "snapshot-1",
      sourceSummary: {
        governance: {
          approvalRequired: true,
        },
      },
      businessProfile: {
        companyName: "Alpha Studio",
        companySummaryShort: "Brand strategy and design",
      },
      capabilities: {
        supportsWhatsapp: true,
      },
      services: [{ title: "Brand strategy" }],
    },
    sources: [
      {
        sourceId: "source-1",
        sourceType: "website",
        role: "primary",
        sourceUrl: "https://alpha.example",
      },
    ],
    sourceInfo: {
      primarySourceType: "website",
      primarySourceId: "source-1",
      sourceUrl: "https://alpha.example",
      latestRunId: "run-1",
    },
    approvedAt: "2026-03-25T03:00:00.000Z",
  });

  assert.equal(summary.reviewSessionId, "session-1");
  assert.equal(summary.primarySourceType, "website");
  assert.equal(summary.primarySourceId, "source-1");
  assert.equal(summary.primarySourceUrl, "https://alpha.example");
  assert.equal(summary.latestRunId, "run-1");
  assert.equal(summary.lastSnapshotId, "snapshot-1");
  assert.equal(summary.governance.approvalRequired, true);
  assert.equal(summary.sources.length, 1);
  assert.equal(summary.sources[0].sourceUrl, "https://alpha.example");
});