/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const dispatchRepairAction = vi.fn();

vi.mock("../../../api/truth.js", () => ({
  approveTruthReviewCandidate: vi.fn().mockResolvedValue({
    ok: true,
    publishReceipt: {
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
      actor: "reviewer@aihq.test",
      timestamp: "2026-03-28T10:10:00.000Z",
      summaryExplanation:
        "Approval completed and verification matched the governed publish path.",
    },
  }),
  getCanonicalTruthSnapshot: vi.fn().mockResolvedValue({
    fields: [
      {
        key: "companyName",
        label: "Company name",
        value: "North Clinic",
        provenance: "Website, https://north.example/about - Authority 1",
      },
    ],
    behavior: {
      hasBehavior: true,
      summary: "Clinic · Cosmetic Dentistry · Book your consultation",
      rows: [
        { key: "businessType", label: "Business type", value: "Clinic" },
        { key: "niche", label: "Niche", value: "Dental Clinic" },
        { key: "subNiche", label: "Sub-niche", value: "Cosmetic Dentistry" },
        { key: "conversionGoal", label: "Conversion goal", value: "Book Consultation" },
        { key: "primaryCta", label: "Primary CTA", value: "Book your consultation" },
        { key: "leadQualificationMode", label: "Lead qualification mode", value: "Service Booking Triage" },
        { key: "qualificationQuestions", label: "Qualification questions", value: "What treatment are you interested in?" },
        { key: "bookingFlowType", label: "Booking flow", value: "Appointment Request" },
        { key: "handoffTriggers", label: "Handoff triggers", value: "Human Request" },
        { key: "disallowedClaims", label: "Disallowed claims", value: "Diagnosis Or Treatment Guarantees" },
        { key: "toneProfile", label: "Tone profile", value: "Warm Reassuring" },
        { key: "channelBehavior", label: "Channel behavior", value: "Voice: book_or_route_call" },
      ],
    },
    approval: {
      approvedAt: "2026-03-25T10:00:00.000Z",
      approvedBy: "reviewer@aihq.test",
      version: "approved",
    },
    history: [
      {
        id: "approval-1",
        version: "v3",
        versionLabel: "Truth version v3",
        previousVersionId: "v2",
        profileStatus: "approved",
        approvedAt: "2026-03-24T09:00:00.000Z",
        approvedBy: "owner@aihq.test",
        sourceSummary: "Website - https://north.example/about - 2 supporting sources",
        diffSummary: "companyName, websiteUrl, services",
        behaviorSummary: "Clinic · Cosmetic Dentistry · Book your consultation",
        behaviorChanges: [
          {
            key: "behavior.primaryCta",
            label: "Primary CTA",
          },
        ],
      },
    ],
    notices: [],
    hasProvenance: true,
    governance: {
      disposition: "promotable",
      support: {
        evidenceCount: 3,
        strongEvidenceCount: 2,
        uniqueSourceCount: 2,
        staleEvidenceCount: 0,
      },
      trust: {
        strongestTier: "official_website",
        strongestSourceType: "website",
      },
      freshness: {
        bucket: "fresh",
      },
    },
    finalizeImpact: {
      canonicalAreas: ["profile"],
      runtimeAreas: ["voice"],
      affectedSurfaces: ["voice", "inbox"],
    },
    readiness: {
      status: "ready",
      blockers: [],
    },
  }),
  getTruthReviewWorkbench: vi.fn().mockResolvedValue({
    summary: {
      total: 2,
      pending: 0,
      quarantined: 1,
      conflicting: 1,
      autoApprovable: 0,
      blockedHighRisk: 1,
      highRisk: 1,
    },
    items: [
      {
        id: "candidate-1",
        queueBucket: "conflicting",
        category: "contact",
        title: "Primary phone",
        valueText: "+15551112222",
        source: {
          displayName: "Main Website",
          sourceType: "website",
          trustLabel: "Official Website",
        },
        confidence: {
          score: 0.92,
          label: "high",
        },
        governance: {
          freshness: {
            bucket: "fresh",
          },
          support: {
            uniqueSourceCount: 2,
          },
          reviewExplanation: ["Trust tier Official Website"],
        },
        approvalPolicy: {
          outcome: "review_required",
          requiredRole: "reviewer",
          reasonCodes: ["reviewable_conflict"],
          riskLevel: "medium",
        },
        finalizeImpactPreview: {
          canonicalAreas: ["business_profile"],
          runtimeAreas: ["contact_channels"],
          canonicalPaths: ["profile.primaryPhone"],
          affectedSurfaces: ["voice", "inbox"],
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
          auditSummary: {
            proposedOutcome: "review_required",
          },
        },
        currentTruth: {
          title: "Current approved phone",
          valueText: "+15550000000",
        },
        conflictResolution: {
          previewChoices: [
            {
              candidateId: "candidate-1",
              title: "Primary phone",
              valueText: "+15551112222",
              publishPreview: {
                policy: {
                  autonomyDelta: "unchanged",
                },
              },
            },
          ],
          peers: [
            {
              id: "candidate-2",
              title: "Primary phone",
              valueText: "+15553334444",
              sourceDisplayName: "Maps Listing",
              trustTier: "weak_inferred_scrape",
              freshnessBucket: "stale",
              confidence: 0.61,
              whyStrongerOrWeaker: ["stronger source trust"],
            },
          ],
        },
        review: {
          reviewReason: "Competing phone values require operator review.",
          firstSeenAt: "2026-03-28T09:00:00.000Z",
          updatedAt: "2026-03-28T09:05:00.000Z",
        },
        auditContext: {
          latestAction: "approve",
          latestDecision: "approved",
          latestBy: "owner@aihq.test",
          latestAt: "2026-03-28T09:06:00.000Z",
        },
        actions: [
          {
            actionType: "approve",
            label: "Approve selected value",
            allowed: true,
          },
        ],
      },
    ],
  }),
  getTruthVersionDetail: vi.fn().mockResolvedValue({
    selectedVersion: {
      id: "v3",
      version: "v3",
      versionLabel: "Truth version v3",
      approvedAt: "2026-03-25T10:00:00.000Z",
      approvedBy: "reviewer@aihq.test",
      sourceSummary: "Website - https://north.example/about",
    },
    comparedVersion: {
      id: "v2",
      version: "v2",
      versionLabel: "Truth version v2",
      approvedAt: "2026-03-24T09:00:00.000Z",
      approvedBy: "owner@aihq.test",
    },
    currentVersion: {
      id: "v4",
      version: "v4",
      versionLabel: "Truth version v4",
      approvedAt: "2026-03-26T11:00:00.000Z",
      approvedBy: "reviewer@aihq.test",
    },
    behavior: {
      selected: {
        summary: "Clinic · Book your consultation · Warm Reassuring",
        rows: [
          { key: "businessType", label: "Business type", value: "Clinic" },
          { key: "primaryCta", label: "Primary CTA", value: "Book your consultation" },
          { key: "toneProfile", label: "Tone profile", value: "Warm Reassuring" },
        ],
      },
      compared: {
        summary: "Clinic · Contact the team · Professional",
        rows: [
          { key: "businessType", label: "Business type", value: "Clinic" },
          { key: "primaryCta", label: "Primary CTA", value: "Contact the team" },
          { key: "toneProfile", label: "Tone profile", value: "Professional" },
        ],
      },
      changes: [
        {
          key: "behavior.primaryCta",
          label: "Primary CTA",
          beforeSummary: "Contact the team",
          afterSummary: "Book your consultation",
        },
      ],
    },
    changedFields: [{ key: "companyName", label: "companyName" }],
    fieldChanges: [
      {
        key: "companyName",
        label: "Company name",
        beforeSummary: "Old Clinic",
        afterSummary: "North Clinic",
      },
    ],
    sectionChanges: [],
    versionDiff: {
      canonicalAreasChanged: ["business_profile"],
      canonicalPathsChanged: ["profile.companyName"],
      runtimeAreasLikelyAffected: ["tenant_profile"],
      affectedSurfaces: ["inbox"],
      autonomyImpact: "follow_up_required",
      valueSummary: {
        changed: 1,
      },
      summaryExplanation: "1 canonical field change spans 1 governed area.",
    },
    rollbackPreview: {
      currentApprovedVersion: {
        id: "v4",
        version: "v4",
        versionLabel: "Truth version v4",
      },
      targetRollbackVersion: {
        id: "v3",
        version: "v3",
        versionLabel: "Truth version v3",
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
    diffSummary: "companyName changed",
    hasStructuredDiff: true,
  }),
  keepTruthReviewCandidateQuarantined: vi.fn().mockResolvedValue({ ok: true }),
  markTruthReviewCandidateForFollowUp: vi.fn().mockResolvedValue({ ok: true }),
  rejectTruthReviewCandidate: vi.fn().mockResolvedValue({ ok: true }),
  rollbackTruthVersion: vi.fn().mockResolvedValue({
    ok: true,
    rollbackReceipt: {
      rollbackActionResult: "executed",
      rollbackStatus: "follow_up_required",
      sourceCurrentVersion: { id: "v4", version: "v4", versionLabel: "Truth version v4" },
      targetRollbackVersion: { id: "v3", version: "v3", versionLabel: "Truth version v3" },
      resultingTruthVersion: { id: "v5", version: "v5", versionLabel: "Truth version v5" },
      resultingTruthVersionId: "v5",
      runtimeProjectionId: "runtime-projection-rollback",
      runtimeRefreshResult: "refreshed",
      actual: {
        canonical: { areas: ["business_profile"], paths: ["profile.companyName"] },
        runtime: { areas: ["tenant_profile"], paths: ["profile.companyName"] },
        channels: { affectedSurfaces: ["inbox"] },
        policy: {
          autonomyDelta: "reviewable",
          executionPostureDelta: "unknown",
          riskDelta: "unknown",
        },
      },
      previewComparison: { status: "matched" },
      verification: {
        truthVersionCreated: true,
        runtimeProjectionRefreshed: true,
        runtimeControlWarnings: [],
        repairRecommendation: "",
      },
      actor: "owner@aihq.test",
      timestamp: "2026-03-28T10:20:00.000Z",
      summaryExplanation:
        "Rollback committed, but follow-up is required before the governed revert path is fully clean.",
    },
  }),
}));

vi.mock("../../../api/trust.js", () => ({
  getSettingsTrustView: vi.fn().mockResolvedValue({
    viewerRole: "owner",
    summary: {
      readiness: { status: "ready", blockers: [] },
      runtimeProjection: {
        status: "ready",
        health: {
          status: "healthy",
          primaryReasonCode: "",
          autonomousAllowed: true,
          autonomousOperation: "continue",
          affectedSurfaces: ["voice", "inbox"],
          lastKnownGood: {
            runtimeProjectionId: "projection-1",
            diagnosticOnly: true,
            usableAsAuthority: false,
          },
        },
        repair: {
          action: {
            id: "open_setup_route",
            kind: "route",
            label: "Open runtime setup",
            target: { path: "/setup/runtime" },
          },
        },
      },
      truth: {
        latestVersionId: "truth-v3",
        approvedAt: "2026-03-25T10:00:00.000Z",
        approvedBy: "reviewer@aihq.test",
        approvalPolicy: {
          strictestOutcome: "approved",
        },
      },
      reviewQueue: {
        pending: 2,
        conflicts: 1,
      },
      policyPosture: {
        truthPublicationPosture: "approved",
        executionPosture: "allowed_with_logging",
        requiredRole: "operator",
        requiredAction: "Monitor audit trail",
        explanation:
          "Autonomy is available, but medium-risk work stays in the logged execution lane.",
        affectedSurfaces: ["voice", "inbox"],
      },
      channelAutonomy: {
        items: [
          {
            surface: "inbox",
            policyOutcome: "allowed_with_logging",
            autonomyStatus: "autonomous_with_logging",
            explanation:
              "Inbox is allowed for low or medium risk work, but the action path stays audit-visible.",
            requiredAction: "Monitor audit trail",
            requiredRole: "operator",
          },
          {
            surface: "voice",
            policyOutcome: "handoff_required",
            autonomyStatus: "handoff_required",
            handoffRequired: true,
            explanation:
              "Voice autonomy requires a human handoff before sensitive actions can continue.",
            requiredAction: "Complete operator handoff",
            requiredRole: "operator",
          },
        ],
      },
      decisionAudit: {
        availableFilters: [
          { key: "all", label: "All events", count: 2 },
          { key: "restricted", label: "Restricted outcomes", count: 1 },
        ],
        items: [
          {
            id: "decision-1",
            eventType: "execution_policy_decision",
            eventLabel: "Execution Policy Decision",
            group: "execution",
            groupLabel: "Execution decisions",
            timestamp: "2026-03-25T10:05:00.000Z",
            actor: "system",
            source: "inbox.ingest",
            surface: "inbox",
            channelType: "instagram",
            policyOutcome: "allowed_with_logging",
            policyOutcomeLabel: "Allowed With Logging",
            reasonCodes: ["runtime_healthy"],
            truthVersionId: "truth-v3",
            runtimeProjectionId: "projection-1",
            affectedSurfaces: ["inbox"],
            executionPostureSummary: {
              primaryLabel: "Allowed With Logging",
            },
            runtimeHealthPosture: {
              primaryLabel: "Healthy",
            },
            remediation: {
              headline: "No operator action is currently required.",
              nextActionLabel: "Monitor audit trail",
              requiredRole: "operator",
            },
            recommendedNextAction: {
              label: "Monitor audit trail",
            },
          },
          {
            id: "decision-2",
            eventType: "handoff_required_action_outcome",
            eventLabel: "Handoff Required Action Outcome",
            group: "restricted",
            groupLabel: "Restricted outcomes",
            timestamp: "2026-03-25T10:06:00.000Z",
            actor: "system",
            source: "voice.runtime",
            surface: "voice",
            channelType: "voice",
            policyOutcome: "handoff_required",
            policyOutcomeLabel: "Handoff Required",
            reasonCodes: ["high_risk_action"],
            truthVersionId: "truth-v3",
            runtimeProjectionId: "projection-1",
            affectedSurfaces: ["voice"],
            executionPostureSummary: {
              primaryLabel: "Handoff Required",
            },
            remediation: {
              handoffRequired: true,
              headline:
                "A human handoff is required before the affected channel can proceed.",
              operator: "Route the affected action to an operator handoff lane.",
              nextActionLabel: "Complete operator handoff",
              requiredRole: "operator",
            },
            recommendedNextAction: {
              label: "Complete operator handoff",
            },
          },
        ],
      },
    },
  }),
}));

vi.mock("../../../components/readiness/dispatchRepairAction.js", () => ({
  dispatchRepairAction: (...args) => dispatchRepairAction(...args),
}));

import TruthViewerPage from "../../../pages/Truth/TruthViewerPage.jsx";
import {
  approveTruthReviewCandidate,
  getCanonicalTruthSnapshot,
  rollbackTruthVersion,
} from "../../../api/truth.js";
import { getSettingsTrustView } from "../../../api/trust.js";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  dispatchRepairAction.mockReset();
  dispatchRepairAction.mockResolvedValue({ ok: true });
});

describe("Truth viewer smoke", () => {
  function renderPage(entry = "/truth") {
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <TruthViewerPage />
      </MemoryRouter>
    );
  }

  it("renders approved truth metadata, provenance, and history", async () => {
    renderPage();

    expect(
      screen.getByText(/loading approved business truth/i)
    ).toBeInTheDocument();

    expect(
      await screen.findByRole("heading", { name: /approved business data/i })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: /approved business data/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/approval and runtime state/i)).toBeInTheDocument();
    expect(screen.getByText(/business data review/i)).toBeInTheDocument();
    expect(screen.getByText(/conflict resolution/i)).toBeInTheDocument();
    expect(screen.getByText(/current approved phone/i)).toBeInTheDocument();
    expect(screen.getByText(/change impact simulator/i)).toBeInTheDocument();
    expect(
      screen.getByText(/runtime projection refresh will be required/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/allowed, reviewed, handed off, or blocked by surface/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/projection authority and repair/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/latest approved change footprint/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/decision timeline and incident replay context/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/handoff required action outcome/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/guided remediation/i).length).toBeGreaterThan(0);
    expect(screen.getByText("2026-03-25T10:00:00.000Z")).toBeInTheDocument();
    expect(screen.getByText("reviewer@aihq.test")).toBeInTheDocument();
    expect(screen.getByText("North Clinic")).toBeInTheDocument();
    expect(screen.getByText(/approved behavior profile/i)).toBeInTheDocument();
    expect(
      screen.getByText(/field-level provenance is available/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/truth version timeline/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/truth version v3/i)).toBeInTheDocument();
    expect(screen.getByText(/source context:/i)).toBeInTheDocument();
    expect(screen.getByText(/changed fields:/i)).toBeInTheDocument();
    expect(screen.getByText(/behavior snapshot:/i)).toBeInTheDocument();
    expect(screen.getByText(/behavior changes:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/owner@aihq\.test/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /view compare/i }));

    expect(
      await screen.findByTestId("truth-version-compare-open")
    ).toBeInTheDocument();

    expect(
      await screen.findByText(/rolling back to v3 would revert 1 canonical field/i)
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/rollback preview/i).length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/selected version behavior/i)).toBeInTheDocument();
    expect(screen.getByText(/compared version behavior/i)).toBeInTheDocument();
    expect(screen.getAllByText(/primary cta/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/old clinic/i)).toBeInTheDocument();
    expect(screen.getAllByText(/north clinic/i).length).toBeGreaterThan(1);
  });

  it("shows an explicit approved truth unavailable state without fallback data", async () => {
    getCanonicalTruthSnapshot.mockResolvedValueOnce({
      fields: [],
      approval: { approvedAt: "", approvedBy: "", version: "" },
      history: [],
      notices: [
        "Approved truth is unavailable. No non-approved fallback data is being shown.",
      ],
      hasProvenance: false,
      approvedTruthUnavailable: true,
      readiness: {
        status: "blocked",
        reasonCode: "approved_truth_unavailable",
        intentionallyUnavailable: true,
        blockers: [
          {
            blocked: true,
            category: "truth",
            dependencyType: "approved_truth",
            reasonCode: "approved_truth_unavailable",
            title: "Approved truth blocker",
            subtitle: "No approved truth is being shown.",
            missing: ["approved_truth"],
            suggestedRepairActionId: "open_setup_route",
            nextAction: {
              id: "open_setup_route",
              kind: "route",
              label: "Open setup",
              requiredRole: "operator",
              allowed: true,
              target: {
                path: "/setup",
              },
            },
          },
        ],
      },
    });

    renderPage();

    expect(
      await screen.findByText(/approved truth is currently unavailable/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/approved truth blocker/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /open setup/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open setup/i }));

    expect(dispatchRepairAction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "open_setup_route",
        kind: "route",
        target: { path: "/setup" },
      })
    );

    expect(
      screen.getByText(/no non-approved fallback data is being shown/i)
    ).toBeInTheDocument();
  });

  it("renders safely when governance and runtime telemetry are partial", async () => {
    getCanonicalTruthSnapshot.mockResolvedValueOnce({
      fields: [
        {
          key: "companyName",
          label: "Company name",
          value: "North Clinic",
          provenance: "",
        },
      ],
      approval: {
        approvedAt: "",
        approvedBy: "",
        version: "approved",
      },
      history: [],
      notices: [],
      hasProvenance: false,
      governance: {},
      finalizeImpact: {},
      readiness: {
        status: "ready",
        blockers: [],
      },
    });

    getSettingsTrustView.mockResolvedValueOnce({
      viewerRole: "owner",
      summary: {
        runtimeProjection: {},
        truth: {},
        reviewQueue: {},
        readiness: {
          status: "ready",
          blockers: [],
        },
      },
    });

    renderPage();

    expect(
      await screen.findByRole("heading", { name: /approved business data/i })
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/policy telemetry is unavailable/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/governance history is unavailable/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/north clinic/i)).toBeInTheDocument();
  });

  it("opens a deep-linked truth version from remediation navigation", async () => {
    renderPage("/truth?versionId=v3&focus=history");

    expect(
      await screen.findByTestId("truth-version-compare-open")
    ).toBeInTheDocument();

    expect(screen.getByText(/old clinic/i)).toBeInTheDocument();
  });

  it("shows a publish receipt after approving a reviewed candidate", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: /approved business data/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /approve selected value/i }));

    await waitFor(() =>
      expect(approveTruthReviewCandidate).toHaveBeenCalledWith(
        "candidate-1",
        expect.objectContaining({
          metadataJson: {
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
              auditSummary: {
                proposedOutcome: "review_required",
              },
            },
          },
        })
      )
    );

    expect(await screen.findByText(/change receipt/i)).toBeInTheDocument();
    expect(
      screen.getByText(/approval completed and verification matched/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/truth-version-7/i)).toBeInTheDocument();
    expect(screen.getByText(/runtime-projection-9/i)).toBeInTheDocument();
    expect(screen.getByText(/preview vs actual/i)).toBeInTheDocument();
  });

  it("executes governed rollback from truth compare and shows the receipt", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: /approved business data/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /view compare/i }));

    expect(
      await screen.findByTestId("truth-version-compare-open")
    ).toBeInTheDocument();

    const rollbackButton = await screen.findByRole("button", {
      name: /execute governed rollback/i,
    });

    fireEvent.click(rollbackButton);

    await waitFor(() =>
      expect(rollbackTruthVersion).toHaveBeenCalledWith(
        "v3",
        expect.objectContaining({
          metadataJson: {
            rollbackPreview: expect.objectContaining({
              rollbackDisposition: "follow_up_required",
            }),
          },
        })
      )
    );

    expect((await screen.findAllByText(/rollback receipt/i)).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/rollback committed, but follow-up is required/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/truth version v5/i).length).toBeGreaterThan(0);
  });
});
