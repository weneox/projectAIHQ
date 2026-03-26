import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TrustMaintenanceSection from "./TrustMaintenanceSection.jsx";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(window, "location", {
    writable: true,
    value: {
      ...window.location,
      assign: vi.fn(),
    },
  });
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
    expect(screen.getByText(/runtime projection blocker/i)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /open runtime setup/i })[0]);
    expect(window.location.assign).toHaveBeenCalledWith("/setup/runtime");
    expect(screen.getByText(/recent sync health/i)).toBeInTheDocument();
  });
});
