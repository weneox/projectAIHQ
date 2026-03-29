import test from "node:test";
import assert from "node:assert/strict";

import {
  stageApprovedCandidateInMaintenanceSessionInternal,
  stageSourceChannelCapabilitiesInMaintenanceSessionInternal,
} from "../src/db/helpers/tenantKnowledge/projection.js";
import { projectSetupReviewDraftToCanonical } from "../src/services/workspace/setup/projection.js";

test("approved candidate is staged into a refresh maintenance session seeded from published truth", async () => {
  const candidate = {
    id: "candidate-1",
    tenant_id: "tenant-1",
    tenant_key: "alpha",
    category: "contact",
    item_key: "phone_primary",
    title: "Primary phone",
    value_text: "+15551112222",
    value_json: { phone: "+15551112222" },
    confidence: 0.93,
    confidence_label: "high",
    source_evidence_json: [
      {
        source_type: "website",
      },
    ],
  };

  const captured = {
    sessionInput: null,
    draftPatch: null,
    sessionUpdate: null,
  };

  const staged = await stageApprovedCandidateInMaintenanceSessionInternal(
    {},
    candidate,
    {
      reviewerId: "reviewer-1",
      reviewerName: "Reviewer",
    },
    {
      truthVersionHelpers: {
        async getLatestVersion() {
          return {
            id: "truth-version-5",
            profile_snapshot_json: {
              companyName: "Alpha Studio",
              primaryPhone: "+15550000000",
            },
            capabilities_snapshot_json: {
              canCapturePhone: true,
            },
          };
        },
      },
      async getBusinessProfileInternal() {
        return null;
      },
      async getBusinessCapabilitiesInternal() {
        return null;
      },
      async getCurrentSetupReview() {
        return {
          session: null,
          draft: null,
        };
      },
      async getOrCreateActiveSetupReviewSession(input) {
        captured.sessionInput = input;
        return {
          id: "session-maintenance-1",
          mode: "refresh",
          status: "draft",
          currentStep: "maintenance_review",
          metadata: {},
        };
      },
      async readSetupReviewDraft() {
        return null;
      },
      async patchSetupReviewDraft(input) {
        captured.draftPatch = input.patch;
        return {
          version: 2,
          businessProfile: input.patch.businessProfile,
          capabilities: input.patch.capabilities,
          sourceSummary: input.patch.sourceSummary,
        };
      },
      async updateSetupReviewSession(sessionId, patch) {
        captured.sessionUpdate = { sessionId, patch };
        return {
          id: sessionId,
          mode: patch.mode,
          status: patch.status,
          currentStep: patch.currentStep,
        };
      },
    }
  );

  assert.equal(captured.sessionInput?.mode, "refresh");
  assert.equal(
    captured.draftPatch?.businessProfile?.companyName,
    "Alpha Studio"
  );
  assert.equal(
    captured.draftPatch?.businessProfile?.primaryPhone,
    "+15551112222"
  );
  assert.equal(
    captured.draftPatch?.sourceSummary?.maintenance?.sourceCurrentTruthVersionId,
    "truth-version-5"
  );
  assert.equal(
    captured.sessionUpdate?.patch?.currentStep,
    "maintenance_review"
  );
  assert.equal(staged.maintenanceSession?.id, "session-maintenance-1");
  assert.equal(staged.maintenanceDraft?.version, 2);
  assert.equal(staged.runtimeProjection, null);
  assert.equal(staged.truthVersion, null);
  assert.equal(staged.projectionGuard?.maintenanceStaged, true);
});

test("source-derived capability refresh stages a governed maintenance draft instead of mutating live capabilities", async () => {
  const captured = {
    sessionInput: null,
    draftPatch: null,
    sessionUpdate: null,
  };

  const staged = await stageSourceChannelCapabilitiesInMaintenanceSessionInternal(
    {},
    {
      tenantId: "tenant-1",
      tenantKey: "alpha",
      sourceTypes: ["instagram"],
      reviewerId: "reviewer-1",
      reviewerName: "Reviewer",
      source: "refreshChannelCapabilitiesFromSources",
    },
    {
      async resolveTenantIdentity() {
        return {
          tenant_id: "tenant-1",
          tenant_key: "alpha",
        };
      },
      truthVersionHelpers: {
        async getLatestVersion() {
          return {
            id: "truth-version-5",
            profile_snapshot_json: {
              companyName: "Alpha Studio",
            },
            capabilities_snapshot_json: {
              supportsInstagramDm: false,
              supportsComments: false,
              supportsEmail: false,
            },
          };
        },
      },
      async getBusinessProfileInternal() {
        return null;
      },
      async getBusinessCapabilitiesInternal() {
        return null;
      },
      async getCurrentSetupReview() {
        return {
          session: null,
          draft: null,
        };
      },
      async getOrCreateActiveSetupReviewSession(input) {
        captured.sessionInput = input;
        return {
          id: "session-maintenance-cap-1",
          mode: "refresh",
          status: "draft",
          currentStep: "maintenance_review",
          metadata: {},
        };
      },
      async readSetupReviewDraft() {
        return null;
      },
      async patchSetupReviewDraft(input) {
        captured.draftPatch = input.patch;
        return {
          version: 2,
          businessProfile: input.patch.businessProfile,
          capabilities: input.patch.capabilities,
          sourceSummary: input.patch.sourceSummary,
        };
      },
      async updateSetupReviewSession(sessionId, patch) {
        captured.sessionUpdate = { sessionId, patch };
        return {
          id: sessionId,
          mode: patch.mode,
          status: patch.status,
          currentStep: patch.currentStep,
        };
      },
    }
  );

  assert.equal(captured.sessionInput?.mode, "refresh");
  assert.equal(captured.draftPatch?.capabilities?.supportsInstagramDm, true);
  assert.equal(captured.draftPatch?.capabilities?.supportsComments, true);
  assert.equal(
    captured.draftPatch?.sourceSummary?.maintenance?.source,
    "refreshChannelCapabilitiesFromSources"
  );
  assert.equal(staged.publishStatus, "review_required");
  assert.equal(staged.reviewRequired, true);
  assert.equal(staged.canonicalCapabilitiesMutated, false);
  assert.equal(staged.runtimeProjectionRefreshed, false);
  assert.equal(staged.runtimeProjection, null);
  assert.equal(staged.truthVersion, null);
  assert.equal(staged.maintenanceSession?.id, "session-maintenance-cap-1");
  assert.equal(staged.maintenanceDraft?.version, 2);
  assert.equal(staged.projectionGuard?.maintenanceStaged, true);
  assert.deepEqual(staged.projectionGuard?.stagedCapabilityFields, [
    "supportsInstagramDm",
    "supportsFacebookMessenger",
    "supportsWhatsapp",
    "supportsComments",
  ]);
  assert.equal(
    captured.sessionUpdate?.patch?.currentStep,
    "maintenance_review"
  );
});

test("publishing a maintenance review draft creates a truth version and refreshes runtime", async () => {
  let versionInput = null;
  let refreshInput = null;
  let serviceRows = [];
  let contactRows = [];
  let locationRows = [];

  const projected = await projectSetupReviewDraftToCanonical(
    {
      db: {
        async query(text, params = []) {
          const sql = String(text || "").toLowerCase();
          if (sql.includes("from tenant_setup_review_sessions")) {
            return {
              rows: [
                {
                  id: params[0],
                },
              ],
            };
          }
          if (sql.includes("from tenants") && (sql.includes("where id = $1::uuid") || sql.includes("where tenant_key = $1"))) {
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
          if (sql.includes("from tenant_services")) {
            return {
              rows: serviceRows,
            };
          }
          if (sql.includes("from tenant_contacts")) {
            return {
              rows: contactRows,
            };
          }
          if (sql.includes("from tenant_locations")) {
            return {
              rows: locationRows,
            };
          }
          if (sql.includes("insert into tenant_services")) {
            serviceRows = [
              {
                id: "service-1",
                tenant_key: "alpha",
                service_key: "consultation",
                title: "Consultation",
                description: "Initial consult",
                category: "service",
                currency: "AZN",
                pricing_model: "custom_quote",
                duration_minutes: 30,
                is_active: true,
                sort_order: 0,
                highlights_json: [],
                created_at: "2026-03-29T00:00:00.000Z",
                updated_at: "2026-03-29T00:00:00.000Z",
              },
            ];
            return {
              rows: serviceRows,
            };
          }
          if (sql.includes("insert into tenant_contacts")) {
            contactRows = [
              {
                id: "contact-1",
                tenant_id: "tenant-1",
                contact_key: "main-phone",
                channel: "phone",
                label: "Main line",
                value: "+15551112222",
                is_primary: false,
                enabled: true,
                visible_public: true,
                visible_in_ai: true,
                sort_order: 0,
                meta: {},
              },
            ];
            return {
              rows: contactRows,
            };
          }
          if (sql.includes("insert into tenant_locations")) {
            locationRows = [
              {
                id: "location-1",
                tenant_id: "tenant-1",
                location_key: "hq",
                title: "Head Office",
                city: "Baku",
                address_line: "1 Governance Ave",
                map_url: "",
                phone: "",
                email: "",
                working_hours: {},
                delivery_areas: [],
                is_primary: false,
                enabled: true,
                sort_order: 0,
                meta: {},
              },
            ];
            return {
              rows: locationRows,
            };
          }
          return { rows: [] };
        },
      },
      actor: {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        user: {
          name: "Reviewer",
        },
      },
      session: {
        id: "session-maintenance-1",
        mode: "refresh",
        primarySourceType: "website",
      },
      draft: {
        version: 3,
        businessProfile: {
          companyName: "Alpha Studio",
          primaryPhone: "+15551112222",
        },
        capabilities: {
          canCapturePhone: true,
        },
        sourceSummary: {
          maintenance: {
            sourceCurrentTruthVersionId: "truth-version-5",
          },
        },
        services: [
          {
            key: "consultation",
            title: "Consultation",
            description: "Initial consult",
          },
        ],
        contacts: [
          {
            contactKey: "main-phone",
            channel: "phone",
            label: "Main line",
            value: "+15551112222",
          },
        ],
        locations: [
          {
            locationKey: "hq",
            title: "Head Office",
            city: "Baku",
            addressLine: "1 Governance Ave",
          },
        ],
        knowledgeItems: [],
      },
      sources: [],
    },
    {
      knowledgeHelper: {
        async getBusinessProfile() {
          return {
            id: "profile-1",
            approved_at: "2026-03-25T02:00:00.000Z",
            approved_by: "Reviewer",
          };
        },
        async getBusinessCapabilities() {
          return {
            id: "capabilities-1",
            approved_by: "Reviewer",
          };
        },
        async upsertBusinessProfile(input) {
          return {
            id: "profile-1",
            company_name: "Alpha Studio",
            primary_phone: input.profileJson.primaryPhone,
            profile_status: "approved",
            approved_by: input.approvedBy,
            approved_at: input.approvedAt,
            profile_json: input.profileJson,
            source_summary_json: input.sourceSummaryJson,
          };
        },
        async upsertBusinessCapabilities(input) {
          return {
            id: "capabilities-1",
            can_capture_phone: true,
            approved_by: input.approvedBy,
            capabilities_json: input.capabilitiesJson,
          };
        },
      },
      truthVersionHelper: {
        async createVersion(input) {
          versionInput = input;
          return {
            id: "truth-version-6",
          };
        },
      },
      async refreshRuntimeProjectionBestEffort(db, input) {
        refreshInput = input;
        return {
          projection: {
            id: "runtime-projection-6",
            status: "ready",
          },
        };
      },
    }
  );

  assert.equal(projected.truthVersion?.id, "truth-version-6");
  assert.ok(refreshInput, "expected governed publish to trigger a runtime refresh");
  assert.equal(versionInput?.reviewSessionId, "session-maintenance-1");
  assert.equal(
    versionInput?.profile?.profile_json?.primaryPhone,
    "+15551112222"
  );
  assert.equal(versionInput?.services?.length, 1);
  assert.equal(versionInput?.services?.[0]?.serviceKey, "consultation");
  assert.equal(versionInput?.contacts?.length, 1);
  assert.equal(versionInput?.contacts?.[0]?.contact_key, "main-phone");
  assert.equal(versionInput?.locations?.length, 1);
  assert.equal(versionInput?.locations?.[0]?.location_key, "hq");
  assert.equal(refreshInput?.triggerType, "review_approval");
});
