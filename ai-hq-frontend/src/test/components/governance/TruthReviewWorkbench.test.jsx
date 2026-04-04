import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TruthReviewWorkbench from "../../../components/governance/TruthReviewWorkbench.jsx";

const baseWorkbench = {
  summary: {
    total: 3,
    pending: 1,
    quarantined: 1,
    conflicting: 1,
    autoApprovable: 0,
    blockedHighRisk: 1,
    highRisk: 1,
  },
  items: [
    {
      id: "candidate-conflict",
      queueBucket: "conflicting",
      category: "contact",
      title: "Primary phone",
      valueText: "+15551112222",
      source: {
        displayName: "Main Website",
        trustLabel: "Official Website",
      },
      confidence: {
        score: 0.93,
        label: "high",
      },
      governance: {
        freshness: { bucket: "fresh" },
        support: { uniqueSourceCount: 2 },
        reviewExplanation: ["Trust tier Official Website", "Freshness Fresh"],
      },
      approvalPolicy: {
        outcome: "review_required",
        requiredRole: "reviewer",
        reasonCodes: ["reviewable_conflict"],
        riskLevel: "medium",
        highRiskOperationalTruth: false,
      },
      currentTruth: {
        title: "Current approved phone",
        valueText: "+15550000000",
      },
      finalizeImpactPreview: {
        canonicalAreas: ["business_profile"],
        runtimeAreas: ["contact_channels"],
        canonicalPaths: ["profile.primaryPhone"],
        affectedSurfaces: ["inbox", "voice"],
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
          autonomyDelta: "unchanged",
          executionPostureDelta: "unchanged",
          riskDelta: "unknown",
        },
        guidance: {
          likelyAffectedAreas: ["business_profile", "contact_channels", "voice"],
          likelyReadinessImplications: [
            "Runtime projection refresh will be required before governed runtime reflects this change.",
          ],
          confidence: "deterministic_impact_with_inferred_posture",
        },
      },
      review: {
        reviewReason: "Competing phone values require operator review.",
        firstSeenAt: "2026-03-28T10:00:00.000Z",
        updatedAt: "2026-03-28T10:05:00.000Z",
      },
      auditContext: {
        latestAction: "approve",
        latestDecision: "approved",
        latestBy: "owner@aihq.test",
        latestAt: "2026-03-28T10:06:00.000Z",
      },
      conflictResolution: {
        previewChoices: [
          {
            candidateId: "candidate-conflict",
            title: "Primary phone",
            valueText: "+15551112222",
            publishPreview: {
              values: {
                proposedValue: {
                  valueText: "+15551112222",
                },
              },
              canonical: {
                areas: ["business_profile"],
              },
              runtime: {
                areas: ["contact_channels"],
                readinessDelta: "projection_refresh_required",
              },
              channels: {
                affectedSurfaces: ["voice"],
              },
              policy: {
                autonomyDelta: "unchanged",
                executionPostureDelta: "unchanged",
                riskDelta: "unknown",
              },
            },
          },
          {
            candidateId: "candidate-peer",
            title: "Primary phone",
            valueText: "+15553334444",
            publishPreview: {
              values: {
                proposedValue: {
                  valueText: "+15553334444",
                },
              },
              canonical: {
                areas: ["business_profile"],
              },
              runtime: {
                areas: ["contact_channels"],
                readinessDelta: "projection_refresh_required",
              },
              channels: {
                affectedSurfaces: ["voice"],
              },
              policy: {
                autonomyDelta: "tightens",
                executionPostureDelta: "stricter",
                riskDelta: "higher",
              },
            },
          },
        ],
        peers: [
          {
            id: "candidate-peer",
            title: "Primary phone",
            valueText: "+15553334444",
            sourceDisplayName: "Maps Listing",
            trustTier: "weak_inferred_scrape",
            freshnessBucket: "stale",
            confidence: 0.81,
            publishPreview: {
              values: {
                proposedValue: {
                  valueText: "+15553334444",
                },
              },
              policy: {
                autonomyDelta: "tightens",
              },
            },
            whyStrongerOrWeaker: ["stronger source trust", "fresher evidence"],
          },
        ],
      },
      actions: [
        { actionType: "approve", label: "Approve selected value", allowed: true },
        { actionType: "reject", label: "Reject", allowed: true },
        { actionType: "mark_follow_up", label: "Needs review", allowed: true },
      ],
    },
    {
      id: "candidate-quarantined",
      queueBucket: "quarantined",
      category: "summary",
      title: "Business summary",
      valueText: "Aging source summary",
      source: {
        displayName: "Instagram",
        trustLabel: "Connected Official Provider",
      },
      confidence: {
        score: 0.62,
        label: "medium",
      },
      governance: {
        freshness: { bucket: "aging" },
        support: { uniqueSourceCount: 1 },
        reviewExplanation: ["Freshness Aging"],
      },
      approvalPolicy: {
        outcome: "quarantined",
        requiredRole: "reviewer",
        reasonCodes: ["stale_signal"],
        riskLevel: "medium",
        highRiskOperationalTruth: false,
      },
      finalizeImpactPreview: {
        canonicalAreas: ["business_profile"],
        runtimeAreas: ["tenant_profile"],
        canonicalPaths: ["profile.summaryShort"],
        affectedSurfaces: ["inbox"],
      },
      publishPreview: {
        values: {
          currentApprovedValue: {
            title: "Current approved summary",
            valueText: "Clinic summary",
          },
          proposedValue: {
            title: "Business summary",
            valueText: "Aging source summary",
          },
          changed: true,
        },
        canonical: {
          areas: ["business_profile"],
          paths: ["profile.summaryShort"],
        },
        runtime: {
          areas: ["tenant_profile"],
          paths: ["runtime.business.profile.summaryShort"],
          readinessDelta: "projection_refresh_required",
        },
        channels: {
          affectedSurfaces: ["inbox"],
        },
        policy: {
          autonomyDelta: "unchanged",
          executionPostureDelta: "unchanged",
          riskDelta: "unknown",
        },
        guidance: {
          likelyAffectedAreas: ["business_profile", "tenant_profile"],
          likelyReadinessImplications: [],
          confidence: "deterministic_impact_with_inferred_posture",
        },
      },
      review: {
        reviewReason: "Needs stronger evidence before approval.",
      },
      auditContext: {},
      actions: [
        { actionType: "keep_quarantined", label: "Keep quarantined", allowed: true },
      ],
    },
    {
      id: "candidate-high-risk",
      queueBucket: "blocked_high_risk",
      category: "capability",
      title: "Auto handoff on low confidence",
      valueText: "true",
      source: {
        displayName: "Manual note",
        trustLabel: "Unknown",
      },
      confidence: {
        score: 0.4,
        label: "low",
      },
      governance: {
        freshness: { bucket: "unknown" },
        support: { uniqueSourceCount: 1 },
        reviewExplanation: ["Trust tier Unknown"],
      },
      approvalPolicy: {
        outcome: "owner_approval_required",
        requiredRole: "owner",
        reasonCodes: ["behavioral_policy_change"],
        riskLevel: "high",
        highRiskOperationalTruth: true,
      },
      finalizeImpactPreview: {
        canonicalAreas: ["business_capabilities"],
        runtimeAreas: ["behavioral_policy"],
        canonicalPaths: ["capabilities.autoHandoffOnLowConfidence"],
        affectedSurfaces: ["voice", "automation_executions"],
      },
      publishPreview: {
        values: {
          currentApprovedValue: {
            title: "Current capability",
            valueText: "false",
          },
          proposedValue: {
            title: "Auto handoff on low confidence",
            valueText: "true",
          },
          changed: true,
        },
        canonical: {
          areas: ["business_capabilities"],
          paths: ["capabilities.autoHandoffOnLowConfidence"],
        },
        runtime: {
          areas: ["behavioral_policy"],
          paths: ["runtime.business.capabilities.autoHandoffOnLowConfidence"],
          readinessDelta: "repair_or_review_gate",
        },
        channels: {
          affectedSurfaces: ["voice", "automation_executions"],
        },
        policy: {
          autonomyDelta: "tightens",
          executionPostureDelta: "stricter",
          riskDelta: "higher",
        },
        guidance: {
          likelyAffectedAreas: ["business_capabilities", "behavioral_policy", "voice"],
          likelyReadinessImplications: ["Behavioral policy surfaces may receive a stricter runtime posture after approval."],
          confidence: "deterministic_impact_with_inferred_posture",
        },
      },
      review: {
        reviewReason: "Operational truth change requires stronger approval.",
      },
      auditContext: {},
      actions: [
        {
          actionType: "approve",
          label: "Approve candidate",
          allowed: false,
          unavailableReason: "Requires Owner approval authority.",
        },
      ],
    },
  ],
};

describe("TruthReviewWorkbench", () => {
  const publishReceipt = {
    approvalActionResult: "approved",
    publishStatus: "success",
    truthVersionId: "truth-version-7",
    runtimeProjectionId: "runtime-projection-9",
    runtimeRefreshResult: "refreshed",
    projectionHealthStatus: "healthy",
    projectionHealthLabel: "Healthy",
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
        executionPostureDelta: "unchanged",
        riskDelta: "unknown",
      },
    },
    previewComparison: {
      status: "matched",
      canonical: { status: "matched", matched: true },
      runtime: { status: "matched", matched: true },
      channels: { status: "matched", matched: true },
    },
    verification: {
      truthVersionCreated: true,
      runtimeProjectionRefreshed: true,
      runtimeControlWarnings: [],
      repairRecommendation: "",
    },
    actor: "owner@aihq.test",
    timestamp: "2026-03-28T10:10:00.000Z",
    summaryExplanation:
      "Approval completed and verification matched the governed publish path.",
  };

  it("renders pending, quarantined, conflicting, and high-risk review context", () => {
    render(<TruthReviewWorkbench workbench={baseWorkbench} canManage />);

    expect(screen.getByText(/truth review workbench/i)).toBeInTheDocument();
    expect(screen.getByText(/competing values are shown side by side/i)).toBeInTheDocument();
    expect(screen.getByText(/current approved phone/i)).toBeInTheDocument();
    expect(screen.getByText(/reviewable conflict/i)).toBeInTheDocument();
    expect(screen.getByText(/change impact simulator/i)).toBeInTheDocument();
    expect(screen.getByText(/runtime projection refresh will be required/i)).toBeInTheDocument();
    expect(screen.getByText(/finalize impact preview/i)).toBeInTheDocument();
    expect(screen.getAllByText(/business profile/i).length).toBeGreaterThanOrEqual(2);
  });

  it("runs safe candidate actions and supports filter changes", () => {
    const onRunAction = vi.fn();
    render(
      <TruthReviewWorkbench
        workbench={baseWorkbench}
        canManage
        onRunAction={onRunAction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /approve selected value/i }));
    expect(onRunAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: "candidate-conflict" }),
      expect.objectContaining({ actionType: "approve" })
    );

    fireEvent.click(screen.getByRole("button", { name: /quarantined \(1\)/i }));
    expect(screen.getAllByText(/aging source summary/i)).toHaveLength(2);
    expect(screen.getByRole("button", { name: /keep quarantined/i })).toBeInTheDocument();
  });

  it("compares conflict choice previews before approval", () => {
    render(<TruthReviewWorkbench workbench={baseWorkbench} canManage />);

    const choiceButtons = screen.getAllByRole("button", {
      name: /primary phone option|support phone option/i,
    });

    fireEvent.click(choiceButtons[0]);
    expect(screen.getByText(/if primary phone wins/i)).toBeInTheDocument();
    expect(screen.getAllByText(/autonomy unchanged/i).length).toBeGreaterThanOrEqual(1);

    fireEvent.click(choiceButtons[1]);
    expect(screen.getAllByText(/if primary phone wins/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/autonomy tightens/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/risk higher/i).length).toBeGreaterThanOrEqual(1);
  });

  it("degrades safely when actions are unavailable", () => {
    render(
      <TruthReviewWorkbench
        workbench={baseWorkbench}
        canManage={false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /high risk \(1\)/i }));
    expect(screen.getByText(/requires owner approval authority/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve candidate/i })).toBeDisabled();
    expect(screen.getByText(/read-only for your account/i)).toBeInTheDocument();
  });

  it("renders partial preview data safely as unavailable or unknown", () => {
    render(
      <TruthReviewWorkbench
        workbench={{
          summary: { total: 1, pending: 1 },
          items: [
            {
              id: "candidate-sparse",
              queueBucket: "pending",
              category: "summary",
              title: "Sparse candidate",
              valueText: "",
              source: {},
              confidence: {},
              governance: {},
              approvalPolicy: {},
              actions: [],
            },
          ],
        }}
        canManage
      />
    );

    expect(screen.getByText(/candidate value unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/no approved value was available for comparison/i)).toBeInTheDocument();
    expect(screen.getByText(/likely affected areas are unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/no readiness implication could be inferred safely/i)).toBeInTheDocument();
  });

  it("renders a successful publish receipt with preview-vs-actual verification", () => {
    render(
      <TruthReviewWorkbench
        workbench={baseWorkbench}
        canManage
        surface={{ publishReceipt }}
      />
    );

    expect(screen.getByText(/change receipt/i)).toBeInTheDocument();
    expect(screen.getByText(/approval completed and verification matched/i)).toBeInTheDocument();
    expect(screen.getByText(/truth-version-7/i)).toBeInTheDocument();
    expect(screen.getByText(/runtime-projection-9/i)).toBeInTheDocument();
    expect(screen.getByText(/preview vs actual/i)).toBeInTheDocument();
    expect(screen.getAllByText(/matched/i).length).toBeGreaterThanOrEqual(2);
  });

  it("renders partial verification data safely when receipt fields are missing", () => {
    render(
      <TruthReviewWorkbench
        workbench={baseWorkbench}
        canManage
        surface={{
          publishReceipt: {
            publishStatus: "partial_success",
            previewComparison: {
              status: "partial_match",
              canonical: {
                status: "unknown",
                previewUnknown: true,
              },
            },
            verification: {
              runtimeControlWarnings: ["projection refreshed without surface diff telemetry"],
            },
            summaryExplanation: "Approval committed with partial verification detail.",
          },
        }}
      />
    );

    expect(screen.getByText(/approval committed with partial verification detail/i)).toBeInTheDocument();
    expect(screen.getByText(/preview had unknowns/i)).toBeInTheDocument();
    expect(screen.queryByText(/publish completed without runtime control warnings/i)).not.toBeInTheDocument();
    expect(screen.getByText(/projection refreshed without surface diff telemetry/i)).toBeInTheDocument();
    expect(screen.getAllByText(/unavailable/i).length).toBeGreaterThanOrEqual(1);
  });
});
