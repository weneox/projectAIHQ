import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dispatchRepairAction = vi.fn();
const saveSettingsTrustPolicyControl = vi.fn();

vi.mock("../../../components/readiness/dispatchRepairAction.js", () => ({
  dispatchRepairAction: (...args) => dispatchRepairAction(...args),
}));
vi.mock("../../../api/trust.js", () => ({
  saveSettingsTrustPolicyControl: (...args) => saveSettingsTrustPolicyControl(...args),
}));

let TrustMaintenanceSection;

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  dispatchRepairAction.mockReset();
  dispatchRepairAction.mockResolvedValue({ ok: true });
  saveSettingsTrustPolicyControl.mockReset();
  saveSettingsTrustPolicyControl.mockResolvedValue({ ok: true });
});

beforeEach(async () => {
  vi.resetModules();
  ({ default: TrustMaintenanceSection } = await import("./TrustMaintenanceSection.jsx"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TrustMaintenanceSection", () => {
  it("renders trust repair state and dispatches route actions from the extracted section", async () => {
    render(
      <TrustMaintenanceSection
        items={[]}
        canManage
        onCreate={vi.fn()}
        onSave={vi.fn()}
        onStartSync={vi.fn()}
        onViewSyncRuns={vi.fn()}
        trust={{
          status: "ready",
          loading: false,
          error: "",
          unavailable: false,
          surface: {
            loading: false,
            error: "",
            unavailable: false,
            ready: true,
            saving: false,
            saveError: "",
            saveSuccess: "",
            refresh: vi.fn(),
          },
          view: {
            summary: {
            readiness: {
              status: "blocked",
              blockers: [
                {
                  blocked: true,
                  category: "runtime",
                  dependencyType: "runtime_projection",
                  reasonCode: "projection_missing",
                  title: "Runtime projection blocker",
                  subtitle: "No approved runtime projection is currently available for trust-controlled runtime surfaces.",
                  missing: ["runtime_projection"],
                  nextAction: {
                    id: "open_setup_route",
                    kind: "route",
                    label: "Open runtime setup",
                    allowed: true,
                    requiredRole: "operator",
                    target: { path: "/setup/runtime" },
                  },
                },
              ],
            },
            sources: {
              total: 0,
              enabled: 0,
              connected: 0,
              running: 0,
              failed: 0,
              reviewRequired: 0,
            },
            runtimeProjection: {
              status: "blocked",
              health: {
                status: "missing",
                primaryReasonCode: "projection_missing",
                autonomousAllowed: false,
                affectedSurfaces: ["inbox", "voice"],
                lastKnownGood: {
                  runtimeProjectionId: "projection-old",
                  diagnosticOnly: true,
                  usableAsAuthority: false,
                },
              },
              repair: {
                canRepair: true,
                action: {
                  id: "rebuild_runtime_projection",
                  kind: "api",
                  label: "Rebuild runtime projection",
                  allowed: true,
                  requiredRole: "operator",
                  target: {
                    path: "/api/settings/trust/runtime-projection/repair",
                    method: "POST",
                  },
                },
                latestRun: {
                  status: "failed",
                },
              },
              updatedAt: "2026-03-25T10:05:00.000Z",
              readiness: {
                status: "blocked",
                blockers: [
                  {
                    blocked: true,
                    category: "runtime",
                    dependencyType: "runtime_projection",
                    reasonCode: "runtime_projection_missing",
                    title: "Runtime projection blocker",
                    missing: ["runtime_projection"],
                    nextAction: {
                      id: "rebuild_runtime_projection",
                      kind: "api",
                      label: "Rebuild runtime projection",
                      allowed: true,
                      requiredRole: "operator",
                      target: {
                        path: "/api/settings/trust/runtime-projection/repair",
                        method: "POST",
                      },
                    },
                  },
                ],
              },
            },
            truth: {
              latestVersionId: "",
              approvalPolicy: {
                strictestOutcome: "approval_required",
              },
              readiness: { status: "ready", blockers: [] },
            },
            setupReview: {
              active: false,
              readiness: { status: "ready", blockers: [] },
            },
            reviewQueue: {
              pending: 0,
              conflicts: 0,
            },
            policyPosture: {
              truthPublicationPosture: "approval_required",
              executionPosture: "blocked_until_repair",
              blockedUntilRepair: true,
              requiredRole: "operator",
              requiredAction: "Rebuild runtime projection",
              explanation:
                "Autonomous execution is fail-closed until runtime projection or strict authority is repaired.",
              reasons: ["truth:approval_required", "runtime:missing"],
              affectedSurfaces: ["inbox", "voice"],
            },
            channelAutonomy: {
              items: [
                {
                  surface: "inbox",
                  policyOutcome: "blocked_until_repair",
                  autonomyStatus: "blocked_until_repair",
                  repairRequired: true,
                  explanation:
                    "Inbox autonomy is blocked until runtime authority or projection health is repaired.",
                  requiredAction: "Rebuild runtime projection",
                  requiredRole: "operator",
                },
                {
                  surface: "voice",
                  policyOutcome: "blocked_until_repair",
                  autonomyStatus: "blocked_until_repair",
                  repairRequired: true,
                  explanation:
                    "Voice autonomy is blocked until runtime authority or projection health is repaired.",
                  requiredAction: "Rebuild runtime projection",
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
                { key: "all", label: "All events", count: 1 },
                { key: "runtime", label: "Runtime/health", count: 1 },
              ],
              items: [
                {
                  id: "decision-1",
                  eventType: "runtime_health_transition",
                  group: "runtime",
                  groupLabel: "Runtime and health",
                  timestamp: "2026-03-25T10:00:00.000Z",
                  actor: "system",
                  source: "settings.trust.runtime-projection.repair",
                  surface: "tenant",
                  channelType: "unknown",
                  policyOutcome: "blocked_until_repair",
                  reasonCodes: ["projection_missing"],
                  runtimeProjectionId: "projection-old",
                  affectedSurfaces: ["voice", "inbox"],
                  recommendedNextAction: {
                    label: "Rebuild runtime projection",
                  },
                },
              ],
            },
          },
            recentRuns: [],
            audit: [],
          },
        }}
        sourceSurface={{
          loading: false,
          error: "",
          unavailable: false,
          ready: true,
          saving: false,
          saveError: "",
          saveSuccess: "",
          refresh: vi.fn(),
        }}
      />
    );

    expect(screen.getByText(/trust repair hub/i)).toBeInTheDocument();
    expect(screen.getByText(/operator governance cockpit/i)).toBeInTheDocument();
    expect(screen.getAllByText(/runtime projection blocker/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/projection authority and repair/i)).toBeInTheDocument();
    expect(screen.getByText(/approval and execution state/i)).toBeInTheDocument();
    expect(screen.getByText(/allowed, reviewed, handed off, or blocked by surface/i)).toBeInTheDocument();
    expect(screen.getByText(/latest approved change footprint/i)).toBeInTheDocument();
    expect(screen.getByText(/decision timeline and incident replay context/i)).toBeInTheDocument();
    expect(screen.getByText(/runtime health transition/i)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /rebuild runtime projection/i })[0]);
    await waitFor(() => {
      expect(dispatchRepairAction).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "rebuild_runtime_projection",
          kind: "api",
          target: {
            path: "/api/settings/trust/runtime-projection/repair",
            method: "POST",
          },
        })
      );
    });
    fireEvent.click(screen.getByRole("button", { name: /operator only mode/i }));
    await waitFor(() => {
      expect(saveSettingsTrustPolicyControl).toHaveBeenCalledWith(
        expect.objectContaining({
          surface: "voice",
          controlMode: "operator_only_mode",
        })
      );
    });
    expect(screen.getByText(/recent evidence refreshes/i)).toBeInTheDocument();
  });
});
