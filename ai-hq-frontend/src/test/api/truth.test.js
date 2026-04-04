import { describe, expect, it } from "vitest";

import { __test__ } from "../../api/truth.js";

describe("truth api normalization", () => {
it("normalizeTruthResponse maps approved truth metadata, provenance, and history", () => {
  const normalized = __test__.normalizeTruthResponse(
    {
      truth: {
        profile: {
          companyName: "North Clinic",
          websiteUrl: "https://north.example",
          nicheBehavior: {
            businessType: "clinic",
            niche: "dental_clinic",
            subNiche: "cosmetic_dentistry",
            conversionGoal: "book_consultation",
            primaryCta: "Book your consultation",
            leadQualificationMode: "service_booking_triage",
            qualificationQuestions: ["What treatment are you interested in?"],
            bookingFlowType: "appointment_request",
            handoffTriggers: ["human_request"],
            disallowedClaims: ["diagnosis_or_treatment_guarantees"],
            toneProfile: "warm_reassuring",
            channelBehavior: {
              voice: {
                primaryAction: "book_or_route_call",
              },
            },
          },
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
        readiness: {
          status: "ready",
          reasonCode: "",
          intentionallyUnavailable: false,
          message: "Approved truth is available.",
          blockers: [],
        },
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
  expect(normalized.behavior.hasBehavior).toBe(true);
  expect(normalized.behavior.rows.some((row) => row.label === "Business type")).toBe(true);
  expect(normalized.behavior.rows.some((row) => row.label === "Channel behavior")).toBe(true);
  expect(normalized.fields[0].provenance).toMatch(/Website/);
  expect(normalized.governance.quarantinedClaimCount).toBe(2);
  expect(normalized.finalizeImpact.runtimeAreas).toEqual(["voice"]);
});

it("normalizeTruthResponse no longer treats legacy snapshot roots as approved truth", () => {
  const normalized = __test__.normalizeTruthResponse({
    snapshot: {
      profile: {
        companyName: "North Clinic",
      },
    },
  });

  expect(normalized.hasTruth).toBe(false);
  expect(normalized.fields).toEqual([]);
});

it("normalizeCompareResponse maps backend truth version compare detail", () => {
  const normalized = __test__.normalizeCompareResponse(
    {
      truthVersion: {
        id: "v3",
        version: "v3",
        versionLabel: "Truth version v3",
        approvedAt: "2026-03-25T10:00:00.000Z",
        approvedBy: "reviewer@aihq.test",
        sourceSummary: {
          primaryLabel: "Website",
          primaryUrl: "https://north.example/about",
        },
        profileJson: {
          nicheBehavior: {
            businessType: "clinic",
            primaryCta: "Book your consultation",
            toneProfile: "warm_reassuring",
            qualificationQuestions: ["What treatment are you interested in?"],
            channelBehavior: {
              voice: {
                primaryAction: "book_or_route_call",
              },
            },
          },
        },
      },
      previousTruthVersion: {
        id: "v2",
        version: "v2",
        versionLabel: "Truth version v2",
        approvedAt: "2026-03-24T09:00:00.000Z",
        approvedBy: "owner@aihq.test",
        profileJson: {
          nicheBehavior: {
            businessType: "clinic",
            primaryCta: "Contact the team",
            toneProfile: "professional",
            qualificationQuestions: [],
            channelBehavior: {
              voice: {
                primaryAction: "route_or_capture_callback",
              },
            },
          },
        },
      },
      currentTruthVersion: {
        id: "v4",
        version: "v4",
        versionLabel: "Truth version v4",
        approvedAt: "2026-03-26T11:00:00.000Z",
        approvedBy: "reviewer@aihq.test",
      },
      compare: {
        previousVersionId: "v2",
        changedFields: ["companyName", "websiteUrl", "profile.nicheBehavior.primaryCta"],
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
      versionDiff: {
        fromVersion: {
          id: "v2",
          version: "v2",
        },
        toVersion: {
          id: "v3",
          version: "v3",
        },
        canonicalAreasChanged: ["business_profile"],
        canonicalPathsChanged: ["profile.companyName", "profile.websiteUrl"],
        runtimeAreasLikelyAffected: ["tenant_profile", "contact_channels"],
        affectedSurfaces: ["inbox", "voice"],
        autonomyImpact: "follow_up_required",
        valueSummary: {
          added: 0,
          removed: 0,
          changed: 2,
          changedFields: ["profile.companyName", "profile.websiteUrl"],
        },
        summaryExplanation: "2 canonical field changes span 1 governed area.",
      },
      rollbackPreview: {
        currentApprovedVersion: {
          id: "v4",
          version: "v4",
        },
        targetRollbackVersion: {
          id: "v3",
          version: "v3",
        },
        canonicalAreasChangedBack: ["business_profile"],
        canonicalPathsChangedBack: ["profile.companyName"],
        runtimeAreasLikelyAffected: ["tenant_profile"],
        affectedSurfaces: ["inbox"],
        postureImpact: {
          autonomyDelta: "reviewable",
        },
        readinessImplications: [
          "Runtime projection refresh will be required before governed runtime reflects the rollback.",
        ],
        rollbackDisposition: "follow_up_required",
        summaryExplanation: "Rolling back to v3 would revert 1 canonical field and trigger runtime follow-up.",
        action: {
          actionType: "execute_safe_rollback",
          label: "Execute governed rollback",
          allowed: true,
          reason: "Rollback is allowed, but runtime verification and follow-up will still be required.",
        },
      },
    },
    "v3",
    "v2"
  );

  expect(normalized.selectedVersion.version).toBe("v3");
  expect(normalized.comparedVersion.version).toBe("v2");
  expect(normalized.currentVersion.version).toBe("v4");
  expect(normalized.changedFields).toHaveLength(3);
  expect(normalized.fieldChanges.length).toBeGreaterThanOrEqual(2);
  expect(normalized.fieldChanges[0].beforeSummary).toBe("Old Clinic");
  expect(normalized.fieldChanges[0].afterSummary).toBe("North Clinic");
  expect(normalized.behavior.selected.rows.some((row) => row.label === "Primary CTA")).toBe(true);
  expect(normalized.behavior.changes.some((change) => change.label === "Primary CTA")).toBe(true);
  expect(normalized.changedFields.some((field) => field.label === "Primary CTA")).toBe(true);
  expect(normalized.sectionChanges).toHaveLength(1);
  expect(normalized.versionDiff.runtimeAreasLikelyAffected).toEqual([
    "tenant_profile",
    "contact_channels",
  ]);
  expect(normalized.rollbackPreview.rollbackDisposition).toBe("follow_up_required");
  expect(normalized.rollbackAction.actionType).toBe("execute_safe_rollback");
  expect(normalized.hasStructuredDiff).toBe(true);
});

it("normalizeCompareResponse keeps approval metadata strict", () => {
  const normalized = __test__.normalizeCompareResponse(
    {
      truthVersion: {
        id: "v3",
        createdAt: "2026-03-25T10:00:00.000Z",
        actor: "reviewer@aihq.test",
      },
      previousTruthVersion: {
        id: "v2",
      },
      currentTruthVersion: {
        id: "v4",
      },
      compare: {
        previousVersionId: "v2",
      },
      versionDiff: {},
      rollbackPreview: {},
    },
    "v3",
    "v2"
  );

  expect(normalized.selectedVersion.approvedAt).toBe("");
  expect(normalized.selectedVersion.approvedBy).toBe("");
  expect(normalized.selectedVersion.version).toBe("v3");
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

it("normalizePublishReceipt preserves verified publish outcome and sparse comparison detail safely", () => {
  const normalized = __test__.normalizePublishReceipt({
    approvalActionResult: "approved",
    publishStatus: "partial_success",
    truthVersionId: "truth-version-7",
    runtimeProjectionId: "runtime-projection-9",
    runtimeRefreshResult: "refreshed",
    projectionHealthStatus: "healthy",
    actual: {
      canonical: {
        areas: ["business_profile"],
        paths: ["profile.primaryPhone"],
      },
      runtime: {
        areas: ["contact_channels"],
        paths: ["runtime.business.contacts.primaryPhone"],
      },
      channels: {
        affectedSurfaces: ["voice", "inbox"],
      },
      policy: {
        autonomyDelta: "unchanged",
      },
    },
    previewComparison: {
      status: "partial_match",
      previewHadUnknowns: true,
      canonical: {
        status: "matched",
        matched: true,
      },
      runtime: {
        status: "unknown",
        previewUnknown: true,
      },
      channels: {
        status: "differs",
        matched: false,
        addedInActual: ["inbox"],
      },
    },
    verification: {
      truthVersionCreated: true,
      runtimeProjectionRefreshed: true,
      runtimeControlWarnings: ["projection refreshed without surface diff telemetry"],
      repairRecommendation: "",
    },
    actor: "owner@aihq.test",
    timestamp: "2026-03-28T10:10:00.000Z",
    summaryExplanation: "Approval committed with partial verification detail.",
  });

  expect(normalized.publishStatus).toBe("partial_success");
  expect(normalized.truthVersionId).toBe("truth-version-7");
  expect(normalized.actual.runtime.areas).toEqual(["contact_channels"]);
  expect(normalized.previewComparison.previewHadUnknowns).toBe(true);
  expect(normalized.previewComparison.channels.addedInActual).toEqual(["inbox"]);
  expect(normalized.verification.runtimeControlWarnings[0]).toMatch(/surface diff telemetry/i);
});

it("normalizeRollbackReceipt preserves verified rollback outcome safely", () => {
  const normalized = __test__.normalizeRollbackReceipt({
    rollbackActionResult: "executed",
    rollbackStatus: "repair_required",
    sourceCurrentVersion: { id: "v4", version: "v4" },
    targetRollbackVersion: { id: "v3", version: "v3" },
    resultingTruthVersion: { id: "v5", version: "v5" },
    resultingTruthVersionId: "v5",
    runtimeProjectionId: "projection-rollback-1",
    runtimeRefreshResult: "failed",
    actual: {
      canonical: {
        areas: ["business_profile"],
        paths: ["profile.companyName"],
      },
      runtime: {
        areas: [],
        paths: [],
      },
      channels: {
        affectedSurfaces: [],
      },
      policy: {
        autonomyDelta: "tightens",
      },
    },
    previewComparison: {
      status: "partial_match",
      previewHadUnknowns: true,
      canonical: {
        status: "matched",
        matched: true,
      },
      runtime: {
        status: "unknown",
        previewUnknown: true,
      },
      channels: {
        status: "unknown",
        previewUnknown: true,
      },
    },
    verification: {
      truthVersionCreated: true,
      runtimeProjectionRefreshed: false,
      projectionHealthStatus: "degraded",
      runtimeControlWarnings: ["Repair runtime projection before trusting rollback in governed runtime."],
      repairRecommendation: "Open repair controls",
    },
    actor: "owner@aihq.test",
    timestamp: "2026-03-28T10:20:00.000Z",
    summaryExplanation: "Rollback committed, but runtime verification requires repair.",
  });

  expect(normalized.rollbackStatus).toBe("repair_required");
  expect(normalized.resultingTruthVersionId).toBe("v5");
  expect(normalized.previewComparison.previewHadUnknowns).toBe(true);
  expect(normalized.verification.projectionHealthStatus).toBe("degraded");
  expect(normalized.verification.repairRecommendation).toBe("Open repair controls");
});
});
