import { describe, expect, it } from "vitest";

import { __test__ } from "./truth.js";

describe("truth api normalization", () => {
it("normalizeTruthResponse maps approved truth metadata, provenance, and history", () => {
  const normalized = __test__.normalizeTruthResponse(
    {
      truth: {
        profile: {
          companyName: "North Clinic",
          websiteUrl: "https://north.example",
        },
        fieldProvenance: {
          companyName: {
            sourceLabel: "Website",
            sourceUrl: "https://north.example/about",
            authorityRank: 1,
          },
        },
        approvedAt: "2026-03-25T10:00:00.000Z",
        approvedBy: "reviewer@aihq.test",
        profileStatus: "approved",
        sourceSummary: {
          governance: {
            disposition: "quarantined",
            quarantinedClaimCount: 2,
          },
          finalizeImpact: {
            canonicalAreas: ["profile"],
            runtimeAreas: ["voice"],
            affectedSurfaces: ["voice", "inbox"],
          },
        },
        history: [
          {
            id: "approval-1",
            version: "v3",
            versionLabel: "Truth version v3",
            approvedAt: "2026-03-24T09:00:00.000Z",
            approvedBy: "owner@aihq.test",
            sourceSummary: {
              primaryLabel: "Website",
              primaryUrl: "https://north.example/about",
              supportingCount: 2,
            },
            changedFields: ["companyName", "websiteUrl", "services"],
          },
        ],
      },
    },
    "/api/setup/truth/current"
  );

  expect(normalized.source).toBe("/api/setup/truth/current");
  expect(normalized.hasTruth).toBe(true);
  expect(normalized.hasApprovalMeta).toBe(true);
  expect(normalized.hasHistory).toBe(true);
  expect(normalized.hasProvenance).toBe(true);
  expect(normalized.approval.approvedAt).toBe("2026-03-25T10:00:00.000Z");
  expect(normalized.approval.approvedBy).toBe("reviewer@aihq.test");
  expect(normalized.approval.version).toBe("approved");
  expect(normalized.history).toHaveLength(1);
  expect(normalized.history[0].version).toBe("v3");
  expect(normalized.history[0].versionLabel).toBe("Truth version v3");
  expect(normalized.history[0].sourceSummary).toMatch(/Website/);
  expect(normalized.history[0].diffSummary).toMatch(/companyName/);
  expect(normalized.fields[0].provenance).toMatch(/Website/);
  expect(normalized.governance.quarantinedClaimCount).toBe(2);
  expect(normalized.finalizeImpact.runtimeAreas).toEqual(["voice"]);
});

it("normalizeCompareResponse maps backend truth version compare detail", () => {
  const normalized = __test__.normalizeCompareResponse(
    {
      version: {
        id: "v3",
        version: "v3",
        versionLabel: "Truth version v3",
        approvedAt: "2026-03-25T10:00:00.000Z",
        approvedBy: "reviewer@aihq.test",
        sourceSummary: {
          primaryLabel: "Website",
          primaryUrl: "https://north.example/about",
        },
      },
      previousVersion: {
        id: "v2",
        version: "v2",
        versionLabel: "Truth version v2",
        approvedAt: "2026-03-24T09:00:00.000Z",
        approvedBy: "owner@aihq.test",
      },
      diff: {
        changedFields: ["companyName", "websiteUrl"],
        fieldChanges: [
          {
            key: "companyName",
            label: "Company name",
            before: { value: "Old Clinic" },
            after: { value: "North Clinic" },
          },
        ],
        sectionChanges: [
          {
            key: "identity",
            label: "Identity",
            summary: "Core business identity was refreshed.",
          },
        ],
      },
    },
    "v3",
    "v2"
  );

  expect(normalized.selectedVersion.version).toBe("v3");
  expect(normalized.comparedVersion.version).toBe("v2");
  expect(normalized.changedFields).toHaveLength(2);
  expect(normalized.fieldChanges).toHaveLength(1);
  expect(normalized.fieldChanges[0].beforeSummary).toBe("Old Clinic");
  expect(normalized.fieldChanges[0].afterSummary).toBe("North Clinic");
  expect(normalized.sectionChanges).toHaveLength(1);
  expect(normalized.hasStructuredDiff).toBe(true);
});

it("approved truth unavailable snapshot refuses non-approved fallback data", () => {
  const snapshot = __test__.buildApprovedTruthUnavailableSnapshot();

  expect(snapshot.hasTruth).toBe(false);
  expect(snapshot.approvedTruthUnavailable).toBe(true);
  expect(snapshot.unavailableReasonCode).toBe("approved_truth_unavailable");
  expect(snapshot.notices[0]).toMatch(/no non-approved fallback data is being shown/i);
});

it("normalizeTruthReviewWorkbench preserves policy, conflict, and impact detail safely", () => {
  const normalized = __test__.normalizeTruthReviewWorkbench({
    summary: {
      total: 2,
      conflicting: 1,
      quarantined: 1,
      highRisk: 1,
      blocked_high_risk: 1,
    },
    items: [
      {
        id: "candidate-1",
        queueBucket: "conflicting",
        category: "contact",
        itemKey: "phone_primary",
        title: "Primary phone",
        valueText: "+15551112222",
        source: {
          displayName: "Main Website",
          sourceType: "website",
          trustTier: "official_website",
          trustLabel: "Official Website",
        },
        confidence: {
          score: 0.91,
          label: "high",
        },
        governance: {
          quarantine: false,
          reviewExplanation: ["Trust tier Official Website"],
        },
        approvalPolicy: {
          outcome: "review_required",
          requiredRole: "reviewer",
          reasonCodes: ["reviewable_conflict"],
          highRiskOperationalTruth: false,
          riskLevel: "medium",
        },
        finalizeImpactPreview: {
          canonicalAreas: ["business_profile"],
          runtimeAreas: ["contact_channels"],
          affectedSurfaces: ["voice"],
        },
        publishPreview: {
          values: {
            currentApprovedValue: {
              title: "Current approved phone",
              valueText: "+15550000000",
            },
            proposedValue: {
              title: "Primary phone",
              valueText: "+15551112222",
            },
            changed: true,
          },
          canonical: {
            areas: ["business_profile"],
            paths: ["profile.primaryPhone"],
          },
          runtime: {
            areas: ["contact_channels"],
            paths: ["runtime.business.contacts.primaryPhone"],
            readinessDelta: "projection_refresh_required",
          },
          channels: {
            affectedSurfaces: ["voice", "inbox"],
          },
          policy: {
            currentOutcome: "review_required",
            proposedOutcome: "review_required",
            autonomyDelta: "unchanged",
            executionPostureDelta: "unchanged",
            riskDelta: "unknown",
          },
          guidance: {
            likelyAffectedAreas: ["business_profile", "contact_channels", "voice"],
            likelyReadinessImplications: ["Runtime projection refresh will be required before governed runtime reflects this change."],
            confidence: "deterministic_impact_with_inferred_posture",
          },
          auditSummary: {
            proposedOutcome: "review_required",
          },
        },
        conflictResolution: {
          classification: "conflicting_but_reviewable",
          reviewRequired: true,
          peerCount: 2,
          previewChoices: [
            {
              candidateId: "candidate-1",
              title: "Primary phone",
              valueText: "+15551112222",
              outcome: "review_required",
              riskLevel: "medium",
              affectedSurfaces: ["voice"],
              publishPreview: {
                values: {
                  proposedValue: { valueText: "+15551112222" },
                },
              },
            },
          ],
          peers: [
            {
              id: "candidate-2",
              valueText: "+15553334444",
              trustTier: "weak_inferred_scrape",
              freshnessBucket: "stale",
              publishPreview: {
                values: {
                  proposedValue: { valueText: "+15553334444" },
                },
              },
              whyStrongerOrWeaker: ["stronger source trust"],
            },
          ],
        },
        actions: [
          {
            actionType: "approve",
            label: "Approve selected value",
            allowed: true,
          },
        ],
      },
      {
        id: "candidate-3",
        actions: [],
      },
    ],
  });

  expect(normalized.summary.conflicting).toBe(1);
  expect(normalized.items[0].source.trustTier).toBe("official_website");
  expect(normalized.items[0].approvalPolicy.reasonCodes).toEqual(["reviewable_conflict"]);
  expect(normalized.items[0].conflictResolution.peers[0].freshnessBucket).toBe("stale");
  expect(normalized.items[0].finalizeImpactPreview.runtimeAreas).toEqual(["contact_channels"]);
  expect(normalized.items[0].publishPreview.values.currentApprovedValue.valueText).toBe("+15550000000");
  expect(normalized.items[0].publishPreview.runtime.readinessDelta).toBe("projection_refresh_required");
  expect(normalized.items[0].conflictResolution.previewChoices[0].publishPreview.values.proposedValue.valueText).toBe("+15551112222");
  expect(normalized.items[1].actions).toEqual([]);
});
});
