import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const useWorkspaceNarration = vi.fn();

vi.mock("../../../view-models/useWorkspaceNarration.js", () => ({
  default: () => useWorkspaceNarration(),
}));

vi.mock("../../../view-models/workspaceIntents.js", () => ({
  getWorkspaceIntentExamples: () => ["continue setup", "open inbox"],
  parseWorkspaceIntent: vi.fn(),
}));

import WorkspacePage from "../../../surfaces/workspace/WorkspacePage.jsx";

function buildWorkspaceState(overrides = {}) {
  return {
    loading: false,
    isFetching: false,
    refetch: vi.fn(),
    error: "",
    availabilityNotice: {
      title: "",
      description: "",
      partial: false,
      tone: "neutral",
    },
    suggestedActions: [],
    nextBestAction: null,
    actionItems: [],
    postureItems: [],
    outcomeItems: [],
    systemBrief: {
      changed: "Business memory was updated.",
      mattersMost: "One item needs review.",
      safeToIgnore: "No urgent capability issues.",
    },
    setupGuidance: { visible: false },
    businessMemory: { visible: false },
    decisions: [],
    capabilities: [],
    recentOutcomes: [],
    ...overrides,
  };
}

describe("WorkspacePage smoke", () => {
  it("renders the workspace loading surface instead of inline loading text", () => {
    useWorkspaceNarration.mockReturnValue(
      buildWorkspaceState({
        loading: true,
      })
    );

    render(
      <MemoryRouter>
        <WorkspacePage />
      </MemoryRouter>
    );

    expect(
      screen.getByLabelText(/preparing workspace brief/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/loading workspace brief/i)).not.toBeInTheDocument();
  });

  it("renders the operator workspace layout", () => {
    useWorkspaceNarration.mockReturnValue(
      buildWorkspaceState({
        nextBestAction: {
          id: "setup-follow-up",
          title: "Finish setup to stabilize the workspace.",
          impact: "Setup still needs a few details.",
          action: {
            label: "Continue setup",
            path: "/setup",
          },
        },
        actionItems: [
          {
            id: "setup-follow-up",
            status: "Continue setup",
            tone: "info",
            title: "Finish setup to stabilize the workspace.",
            impact: "Setup still needs a few details.",
            action: {
              label: "Continue setup",
              path: "/setup",
            },
          },
        ],
        postureItems: [
          {
            id: "posture-business-memory",
            label: "Business memory",
            statusLabel: "Stable",
            tone: "success",
            summary: "Approved business memory is currently anchored to version v3.",
            action: null,
          },
        ],
      })
    );

    render(
      <MemoryRouter>
        <WorkspacePage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: /operator workspace/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /what needs action now/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /system posture/i })
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/finish setup to stabilize the workspace\./i).length
    ).toBeGreaterThan(0);
  });

  it("renders partial-signal messaging without collapsing the page", () => {
    useWorkspaceNarration.mockReturnValue(
      buildWorkspaceState({
        availabilityNotice: {
          title: "Workspace is showing partial signal",
          description: "Inbox is unavailable. The rest of the workspace is still live.",
          partial: true,
          tone: "warn",
        },
      })
    );

    render(
      <MemoryRouter>
        <WorkspacePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/workspace is showing partial signal/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /what needs action now/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /recent outcomes/i })
    ).toBeInTheDocument();
  });
});
