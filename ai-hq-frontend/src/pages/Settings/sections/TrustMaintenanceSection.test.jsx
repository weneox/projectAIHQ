import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dispatchRepairAction = vi.fn();

vi.mock("../../../components/readiness/dispatchRepairAction.js", () => ({
  dispatchRepairAction: (...args) => dispatchRepairAction(...args),
}));

let TrustMaintenanceSection;

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  dispatchRepairAction.mockReset();
  dispatchRepairAction.mockResolvedValue({ ok: true });
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
                  reasonCode: "runtime_projection_missing",
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
                present: false,
                usable: false,
                stale: false,
                status: "",
                reasonCode: "runtime_projection_missing",
                canRepair: true,
              },
              repair: {
                canRepair: true,
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
    expect(screen.getAllByText(/runtime projection blocker/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/approved truth is present and a rebuild can be triggered here/i)).toBeInTheDocument();
    expect(screen.getByText(/last repair failed/i)).toBeInTheDocument();
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
    expect(screen.getByText(/recent sync health/i)).toBeInTheDocument();
  });
});
