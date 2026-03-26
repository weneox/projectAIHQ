import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSetupStudioStageFlow } from "./useSetupStudioStageFlow.js";

function buildProps(overrides = {}) {
  return {
    importingWebsite: false,
    discoveryMode: "idle",
    setupCompleted: false,
    nextStudioStage: "",
    hasVisibleResults: false,
    showKnowledge: false,
    visibleKnowledgeCount: 0,
    visibleServiceCount: 0,
    serviceSuggestionTitle: "",
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

  it("moves into knowledge/service/ready with the same gating behavior", () => {
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
          showKnowledge: true,
          visibleKnowledgeCount: 2,
          serviceSuggestionTitle: "Suggested service",
          visibleServiceCount: 1,
        })
      );
    });

    expect(rendered.result.current.stage).toBe("knowledge");

    act(() => {
      rendered.result.current.goNextFromKnowledge();
    });

    expect(rendered.result.current.stage).toBe("service");

    act(() => {
      rendered.result.current.goNextFromService();
    });

    expect(rendered.result.current.stage).toBe("ready");
  });
});
