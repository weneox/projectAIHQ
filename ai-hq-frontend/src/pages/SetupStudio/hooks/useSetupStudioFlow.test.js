import { describe, expect, it, vi } from "vitest";

import { createSetupStudioFlow } from "./useSetupStudioFlow.js";

describe("createSetupStudioFlow", () => {
  it("navigates to workspace with bypass state for the temporary preview action", () => {
    const navigate = vi.fn();

    const flow = createSetupStudioFlow(
      {
        navigate,
        freshEntryMode: true,
        activeSourceScope: { sourceType: "", sourceUrl: "" },
        setError: vi.fn(),
        setShowKnowledge: vi.fn(),
      },
      {
        loadData: vi.fn(),
      }
    );

    flow.onOpenWorkspacePreview();

    expect(navigate).toHaveBeenCalledWith("/workspace", {
      replace: true,
      state: {
        allowSetupBypass: true,
        fromSetupPreview: true,
      },
    });
  });
});
