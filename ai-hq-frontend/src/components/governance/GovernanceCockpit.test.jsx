import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import GovernanceCockpit from "./GovernanceCockpit.jsx";

afterEach(() => {
  cleanup();
});

describe("GovernanceCockpit", () => {
  it("renders safe defaults when truth and runtime telemetry are sparse", () => {
    render(<GovernanceCockpit truth={{}} trust={{}} />);

    expect(screen.getByText(/governance cockpit/i)).toBeInTheDocument();
    expect(screen.getAllByText(/policy telemetry is unavailable/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/no canonical area summary was returned/i)).toBeInTheDocument();
    expect(screen.getByText(/channel autonomy telemetry is unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/operator-manageable autonomy controls/i)).toBeInTheDocument();
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
                  target: { path: "/setup/runtime" },
                },
              },
            },
            policyPosture: {
              truthPublicationPosture: "review_required",
              executionPosture: "blocked_until_repair",
              blockedUntilRepair: true,
              requiredRole: "operator",
              requiredAction: "Repair runtime authority",
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
    expect(screen.getByText(/projection-1/i)).toBeInTheDocument();
    expect(screen.getAllByText(/repair runtime authority/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/operator-manageable autonomy controls/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open runtime setup/i }));
    expect(onRunAction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "open_setup_route",
      })
    );
    fireEvent.click(screen.getByRole("button", { name: /operator only mode/i }));
    expect(onSavePolicyControl).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: "voice",
        controlMode: "operator_only_mode",
      })
    );
  });
});
