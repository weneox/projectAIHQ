import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const useWorkspaceNarration = vi.fn();

vi.mock("../../view-models/useWorkspaceNarration.js", () => ({
  default: () => useWorkspaceNarration(),
}));

vi.mock("../../view-models/workspaceIntents.js", () => ({
  getWorkspaceIntentExamples: () => ["continue setup", "open inbox"],
  parseWorkspaceIntent: vi.fn(),
}));

import WorkspacePage from "./WorkspacePage.jsx";

describe("WorkspacePage smoke", () => {
  it("renders the primary workspace operating surface", () => {
    useWorkspaceNarration.mockReturnValue({
      loading: false,
      error: "",
      suggestedActions: [],
      systemBrief: {
        changed: "Business memory was updated.",
        mattersMost: "One item needs review.",
        safeToIgnore: "No urgent capability issues.",
      },
      setupGuidance: {
        visible: false,
      },
      businessMemory: {
        visible: true,
        headline: "Business memory is mostly stable",
        description: "Current approved business memory and review pressure.",
        currentKnown: "Core facts are approved.",
        mayHaveChanged: "Weekend hours may have changed.",
        needsConfirmation: "One candidate needs review.",
        blocked: "Nothing is blocked.",
        recentlyReliable: "Latest synced facts are now reliable.",
      },
      decisions: [],
      capabilities: [],
      recentOutcomes: [],
    });

    render(
      <MemoryRouter>
        <WorkspacePage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: /command workspace/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/what matters right now/i)).toBeInTheDocument();
    expect(screen.getByText(/business memory/i)).toBeInTheDocument();
  });
});
