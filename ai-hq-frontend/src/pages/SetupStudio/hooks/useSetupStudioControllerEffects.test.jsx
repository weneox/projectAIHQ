import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSetupStudioControllerEffects } from "./useSetupStudioControllerEffects.js";

function renderControllerEffects(overrides = {}) {
  const actions = {
    loadData: vi.fn(),
  };
  const autoRevealRef = { current: "" };
  const setShowKnowledge = vi.fn();

  const props = {
    actions,
    autoRevealRef,
    freshEntryMode: false,
    meta: {
      setupCompleted: false,
      nextStudioStage: "",
    },
    knowledgeCandidates: [],
    discoveryState: {
      mode: "partial",
      profile: { companyName: "Acme Bakery" },
      warnings: ["http_403"],
    },
    hasVisibleResults: true,
    autoRevealKey: "website|acme.example",
    activeReviewAligned: true,
    visibleKnowledgeItems: [{ id: "candidate-1" }],
    visibleServiceItems: [],
    discoveryProfileRows: [],
    setShowKnowledge,
    barrierOnlyAutoReveal: false,
    ...overrides,
  };

  return {
    ...props,
    ...renderHook((currentProps) => useSetupStudioControllerEffects(currentProps), {
      initialProps: props,
    }),
  };
}

describe("useSetupStudioControllerEffects", () => {
  it("loads setup data on bootstrap", () => {
    const { actions } = renderControllerEffects();

    expect(actions.loadData).toHaveBeenCalledTimes(1);
    expect(actions.loadData).toHaveBeenCalledWith({
      hydrateReview: false,
      preserveBusinessForm: false,
      seedBootProfile: false,
    });
  });

  it("opens the knowledge workspace when the next stage points there", () => {
    const { setShowKnowledge } = renderControllerEffects({
      meta: {
        setupCompleted: false,
        nextStudioStage: "knowledge",
      },
      knowledgeCandidates: [{ id: "candidate-1" }],
    });

    expect(setShowKnowledge).toHaveBeenCalledWith(true);
  });

  it("reveals knowledge once results become eligible", () => {
    const rendered = renderControllerEffects({
      freshEntryMode: true,
      hasVisibleResults: false,
      autoRevealKey: "",
    });

    act(() => {
      rendered.rerender({
        actions: rendered.actions,
        autoRevealRef: rendered.autoRevealRef,
        freshEntryMode: false,
        meta: rendered.meta,
        knowledgeCandidates: rendered.knowledgeCandidates,
        discoveryState: rendered.discoveryState,
        hasVisibleResults: true,
        autoRevealKey: "website|acme.example",
        activeReviewAligned: true,
        visibleKnowledgeItems: rendered.visibleKnowledgeItems,
        visibleServiceItems: rendered.visibleServiceItems,
        discoveryProfileRows: rendered.discoveryProfileRows,
        setShowKnowledge: rendered.setShowKnowledge,
        barrierOnlyAutoReveal: false,
      });
    });

    expect(rendered.autoRevealRef.current).toBe("website|acme.example");
    expect(rendered.setShowKnowledge).toHaveBeenCalledWith(true);
  });
});
