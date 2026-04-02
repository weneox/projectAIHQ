import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSetupStudioStageFlow } from "./useSetupStudioStageFlow.js";

function buildProps(overrides = {}) {
  return {
    importingWebsite: false,
    discoveryMode: "idle",
    nextStudioStage: "",
    hasVisibleResults: false,
    services: [],
    discoveryProfileRows: [],
    knowledgeItems: [],
    reviewSources: [],
    reviewEvents: [],
    discoveryWarnings: [],
    onContinueFlow: vi.fn(),
    onResumeReview: vi.fn(),
    ...overrides,
  };
}

describe("useSetupStudioStageFlow", () => {
  it("unlocks entry and invokes the continue/resume callbacks", () => {
    const continueFlow = vi.fn();
    const resumeReview = vi.fn();
    const { result } = renderHook((props) => useSetupStudioStageFlow(props), {
      initialProps: buildProps({
        onContinueFlow: continueFlow,
        onResumeReview: resumeReview,
      }),
    });

    act(() => {
      result.current.handleContinueFromEntry();
    });

    expect(continueFlow).toHaveBeenCalledTimes(1);
    expect(result.current.entryLocked).toBe(false);

    act(() => {
      result.current.handleResumeFromEntry();
    });

    expect(resumeReview).toHaveBeenCalledTimes(1);
  });

  it("moves from entry to review and then confirm in a straight line", () => {
    const rendered = renderHook((props) => useSetupStudioStageFlow(props), {
      initialProps: buildProps(),
    });

    act(() => {
      rendered.result.current.handleContinueFromEntry();
    });

    act(() => {
      rendered.rerender(
        buildProps({
          hasVisibleResults: true,
          discoveryProfileRows: [{ label: "Business name", value: "Acme" }],
        })
      );
    });

    expect(rendered.result.current.stage).toBe("review");

    act(() => {
      rendered.result.current.goToConfirm();
    });

    expect(rendered.result.current.stage).toBe("confirm");

    act(() => {
      rendered.result.current.goToReview();
    });

    expect(rendered.result.current.stage).toBe("review");
  });
});
