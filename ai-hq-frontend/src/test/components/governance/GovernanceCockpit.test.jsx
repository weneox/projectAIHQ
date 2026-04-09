import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import GovernanceCockpit from "../../../components/governance/GovernanceCockpit.jsx";

afterEach(() => {
  cleanup();
});

describe("GovernanceCockpit", () => {
  it("renders safe defaults when truth and runtime telemetry are sparse", () => {
    render(<GovernanceCockpit truth={{}} trust={{}} />);

    expect(screen.getByText(/^governance cockpit$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/policy telemetry is unavailable/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/no canonical area summary was returned/i)).toBeInTheDocument();
    expect(screen.getByText(/channel autonomy telemetry is unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/operator-manageable autonomy controls/i)).toBeInTheDocument();
    expect(screen.getByText(/decision timeline and incident replay context/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open repair controls/i })).not.toBeInTheDocument();
  });

  it("renders runtime health details and dispatches the primary repair action", () => {
    const onRunAction = vi.fn();
    const onSavePolicyControl = vi.fn();

    render(
      <GovernanceCockpit
        truth={{
          finalizeImpact: {
            canonicalAreas: ["profile"],
            runtimeAreas: ["voice"],
            affectedSurfaces: ["voice", "inbox"],
          },
          governance: {
            freshness: { bucket: "review" },
            support: { evidenceCount: 2, strongEvidenceCount: 1 },
          },
        }}
        trust={{
          summary: {
            truth: {
              latestVersionId: "truth-v2",
              approvedAt: "2026-03-25T10:00:00.000Z",
              approvalPolicy: {
                strictestOutcome: "review_required",
              },
            },
            reviewQueue: {
              pending: 3,
              conflicts: 1,
            },
            runtimeProjection: {
              status: "stale",
              health: {
                status: "stale",
                reasonCodes: ["projection_stale", "truth_version_drift"],
                autonomousAllowed: false,
                affectedSurfaces: ["voice", "meta"],
                nextRecommendedRepair: {
                  id: "refresh_projection",
                  action: "refresh_projection",
                },
                lastKnownGood: {
                  runtimeProjectionId: "projection-1",
                  lastGoodAt: "2026-03-24T09:00:00.000Z",
                },
                lastFailure: {
                  errorCode: "projection_build_failed",
                  finishedAt: "2026-03-25T09:00:00.000Z",
                },
              },
              repair: {
                action: {
                    id: "open_setup_route",
                    kind: "route",
                    label: "Open runtime setup",
                    target: { path: "/truth" },
                  },
              },
            },
            policyPosture: {
              truthPublicationPosture: "review_required",
              executionPosture: "blocked_until_repair",
              blockedUntilRepair: true,
              requiredRole: "operator",
              requiredAction: "Repair runtime authority",
              nextAction: {
                id: "open_runtime_health",
                actionType: "open_runtime_health",
                kind: "route",
                label: "Inspect runtime health",
                allowed: true,
                target: { path: "/truth?trustFocus=runtime_health" },
              },
              affectedSurfaces: ["voice", "meta"],
              reasons: ["runtime:stale", "truth:review_required"],
              explanation:
                "Autonomous execution is fail-closed until runtime projection or strict authority is repaired.",
            },
            channelAutonomy: {
              items: [
                {
                  surface: "inbox",
                  policyOutcome: "blocked_until_repair",
                  autonomyStatus: "blocked_until_repair",
                  explanation:
                    "Inbox autonomy is blocked until runtime authority or projection health is repaired.",
                  why: ["runtime:stale", "truth:review_required"],
                  repairRequired: true,
                  requiredAction: "Repair runtime authority",
                  requiredRole: "operator",
                  nextAction: {
                    id: "open_channel_surface",
                    actionType: "open_channel_surface",
                    kind: "route",
                    label: "View channel restrictions",
                    allowed: true,
                    target: { path: "/workspace?focus=capabilities&channel=inbox" },
                  },
                },
                {
                  surface: "voice",
                  policyOutcome: "blocked_until_repair",
                  autonomyStatus: "blocked_until_repair",
                  explanation:
                    "Voice autonomy is blocked until runtime authority or projection health is repaired.",
                  why: ["runtime:stale"],
                  repairRequired: true,
                  requiredAction: "Repair runtime authority",
                  requiredRole: "operator",
                },
              ],
            },
            policyControls: {
              viewerRole: "admin",
              cannotLoosenAutonomy: true,
              tenantDefault: {
                surface: "tenant",
                controlMode: "human_review_required",
                changedAt: "2026-03-25T10:00:00.000Z",
                changedBy: "admin@aihq.test",
                availableModes: [
                  {
                    mode: "human_review_required",
                    label: "Human Review Required",
                    requiredRole: "operator",
                    allowed: true,
                  },
                ],
              },
              items: [
                {
                  surface: "voice",
                  controlMode: "operator_only_mode",
                  changedAt: "2026-03-25T10:00:00.000Z",
                  changedBy: "admin@aihq.test",
                  availableModes: [
                    {
                      mode: "operator_only_mode",
                      label: "Operator Only Mode",
                      requiredRole: "admin",
                      allowed: true,
                    },
                  ],
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
                  eventType: "blocked_action_outcome",
                  eventLabel: "Blocked Action Outcome",
                  group: "restricted",
                  groupLabel: "Restricted outcomes",
                  timestamp: "2026-03-25T10:10:00.000Z",
                  actor: "system",
                  source: "inbox.ingest",
                  surface: "inbox",
                  channelType: "instagram",
                  policyOutcome: "blocked_until_repair",
                  policyOutcomeLabel: "Blocked Until Repair",
                  reasonCodes: ["projection_stale"],
                  truthVersionId: "truth-v2",
                  runtimeProjectionId: "projection-1",
                  affectedSurfaces: ["inbox"],
                  healthState: {
                    status: "stale",
                    primaryReasonCode: "projection_stale",
                  },
                  approvalPosture: {
                    strictestOutcome: "review_required",
                  },
                  approvalPostureSummary: {
                    primaryLabel: "Review Required",
                    detail: "Projection Stale",
                  },
                  executionPosture: {
                    outcome: "blocked_until_repair",
                  },
                  executionPostureSummary: {
                    primaryLabel: "Blocked Until Repair",
                    detail: "Repair runtime authority",
                  },
                  runtimeHealthPosture: {
                    primaryLabel: "Stale",
                    detail: "Projection Stale",
                  },
                  decisionContextSnapshot: {
                    objectVersion: "truth-v2",
                    projectionStatus: "stale",
                    controlScope: "channel",
                    eventCategory: "restricted",
                    channelSurface: "inbox",
                    channelType: "instagram",
                    summary: "Truth truth-v2 · Projection projection-1 · Runtime Stale",
                  },
                  remediation: {
                    blocked: true,
                    repairRequired: true,
                    headline:
                      "Repair strict runtime authority before autonomous execution can resume.",
                    repair:
                      "Check projection health, repair status, and rebuild runtime authority from approved truth.",
                    nextActionLabel: "Repair runtime authority",
                    requiredRole: "operator",
                    actions: [
                      {
                        id: "open_repair_flow",
                        actionType: "open_repair_flow",
                        kind: "route",
                        label: "Open repair controls",
                        allowed: true,
                        target: {
                          path: "/truth?trustFocus=repair_hub&historyFilter=runtime&eventId=decision-1",
                        },
                      },
                    ],
                  },
                  links: {
                    truthVersionId: "truth-v2",
                    runtimeProjectionId: "projection-1",
                    surface: "inbox",
                    channelType: "instagram",
                    controlScope: "channel",
                    eventCategory: "restricted",
                  },
                  recommendedNextAction: {
                    label: "Repair runtime authority",
                  },
                },
                {
                  id: "decision-2",
                  eventType: "policy_control_change",
                  eventLabel: "Policy Control Change",
                  group: "controls",
                  groupLabel: "Control changes",
                  timestamp: "2026-03-25T09:00:00.000Z",
                  actor: "admin@aihq.test",
                  source: "settings.trust.policy-controls",
                  surface: "voice",
                  channelType: "unknown",
                  policyOutcome: "operator_only",
                  policyOutcomeLabel: "Operator Only",
                  reasonCodes: ["operator_only_mode"],
                  truthVersionId: "truth-v2",
                  runtimeProjectionId: "projection-1",
                  affectedSurfaces: ["voice"],
                  controlState: {
                    controlMode: "operator_only_mode",
                    changedBy: "admin@aihq.test",
                  },
                  executionPostureSummary: {
                    primaryLabel: "Operator Only",
                  },
                  runtimeHealthPosture: {
                    primaryLabel: "Unknown runtime health",
                  },
                  decisionContextSnapshot: {
                    objectVersion: "truth-v2",
                    controlScope: "channel",
                    eventCategory: "controls",
                    channelSurface: "voice",
                    summary: "Truth truth-v2 · Projection projection-1 · Control Operator Only Mode",
                  },
                  remediation: {
                    operatorOnly: true,
                    headline:
                      "This path is intentionally restricted to operator-only execution.",
                    operator:
                      "Keep this surface in an operator-only lane until controls are deliberately changed.",
                    nextActionLabel: "Operate in safer mode",
                    requiredRole: "operator",
                  },
                  links: {
                    truthVersionId: "truth-v2",
                    runtimeProjectionId: "projection-1",
                    surface: "voice",
                    channelType: "unknown",
                    controlScope: "channel",
                    eventCategory: "controls",
                  },
                  recommendedNextAction: {
                    label: "Operate in safer mode",
                  },
                },
              ],
            },
          },
        }}
        onRunAction={onRunAction}
        onSavePolicyControl={onSavePolicyControl}
        policyControlState={{ savingSurface: "", error: "" }}
      />
    );

    expect(screen.getByText(/approval and execution state/i)).toBeInTheDocument();
    expect(screen.getByText(/allowed, reviewed, handed off, or blocked by surface/i)).toBeInTheDocument();
    expect(screen.getByText(/projection authority and repair/i)).toBeInTheDocument();
    expect(screen.getAllByText(/stale/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/voice/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/projection-1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/repair runtime authority/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/operator-manageable autonomy controls/i)).toBeInTheDocument();
    expect(screen.getByText(/decision timeline and incident replay context/i)).toBeInTheDocument();
    expect(screen.getAllByText(/blocked action outcome/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/policy control change/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/guided remediation/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /inspect runtime health/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view channel restrictions/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open repair controls/i })).toBeInTheDocument();
    expect(
      screen.getByText(/repair strict runtime authority before autonomous execution can resume/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/check projection health, repair status, and rebuild runtime authority from approved truth/i)
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /^restricted outcomes \(1\)$/i })
    );
    expect(screen.getAllByText(/repair runtime authority/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /open runtime setup/i }));
    expect(onRunAction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "open_setup_route",
      })
    );
    fireEvent.click(screen.getByRole("button", { name: /inspect runtime health/i }));
    fireEvent.click(screen.getByRole("button", { name: /view channel restrictions/i }));
    fireEvent.click(screen.getByRole("button", { name: /open repair controls/i }));
    expect(onRunAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "open_repair_flow",
      })
    );
    fireEvent.click(screen.getByRole("button", { name: /^all events \(2\)$/i }));
    fireEvent.click(
      screen.getByRole("button", {
        name: /policy control change.*operate in safer mode/i,
      })
    );
    expect(
      screen.getByText(/intentionally restricted to operator-only execution/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^all events \(2\)$/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /^operator only modeapply$/i })
    );
    expect(onSavePolicyControl).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: "voice",
        controlMode: "operator_only_mode",
      })
    );
  });
});
