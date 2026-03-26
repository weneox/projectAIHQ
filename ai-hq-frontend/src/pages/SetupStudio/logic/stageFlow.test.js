import { describe, expect, it } from "vitest";

import {
  getSetupStudioHasAnyReviewContent,
  getSetupStudioHasServiceStage,
  resolveSetupStudioNextStageFromIdentity,
  resolveSetupStudioNextStageFromKnowledge,
  resolveSetupStudioNextStageFromService,
  resolveSetupStudioStage,
} from "./stageFlow.js";

describe("stageFlow", () => {
  it("resolves scanning while imports are running", () => {
    expect(
      resolveSetupStudioStage({
        prevStage: "entry",
        importingWebsite: true,
        discoveryMode: "running",
        entryLocked: false,
      })
    ).toBe("scanning");
  });

  it("stays on entry while entry is locked or no results exist", () => {
    expect(
      resolveSetupStudioStage({
        prevStage: "entry",
        entryLocked: true,
        hasVisibleResults: true,
        hasAnyReviewContent: true,
      })
    ).toBe("entry");

    expect(
      resolveSetupStudioStage({
        prevStage: "identity",
        entryLocked: false,
        hasVisibleResults: false,
        hasAnyReviewContent: false,
      })
    ).toBe("entry");
  });

  it("auto-advances to knowledge, service, or ready using current gating rules", () => {
    expect(
      resolveSetupStudioStage({
        prevStage: "entry",
        entryLocked: false,
        hasVisibleResults: true,
        hasAnyReviewContent: true,
        showKnowledge: true,
        visibleKnowledgeCount: 2,
        hasServiceStage: true,
      })
    ).toBe("knowledge");

    expect(
      resolveSetupStudioStage({
        prevStage: "knowledge",
        entryLocked: false,
        hasVisibleResults: true,
        hasAnyReviewContent: true,
        visibleKnowledgeCount: 0,
        hasServiceStage: true,
      })
    ).toBe("service");

    expect(
      resolveSetupStudioStage({
        prevStage: "service",
        entryLocked: false,
        hasVisibleResults: true,
        hasAnyReviewContent: true,
        hasServiceStage: false,
      })
    ).toBe("ready");
  });

  it("recognizes service and review content gates", () => {
    expect(
      getSetupStudioHasServiceStage({
        serviceSuggestionTitle: "",
        services: [],
        visibleServiceCount: 1,
      })
    ).toBe(true);

    expect(
      getSetupStudioHasAnyReviewContent({
        discoveryProfileRows: [],
        knowledgeItems: [],
        services: [],
        reviewSources: [],
        reviewEvents: [],
        discoveryWarnings: ["http_403"],
      })
    ).toBe(true);
  });

  it("uses the same next-stage rules for identity, knowledge, and service", () => {
    expect(
      resolveSetupStudioNextStageFromIdentity({
        visibleKnowledgeCount: 2,
        hasServiceStage: true,
      })
    ).toBe("knowledge");
    expect(
      resolveSetupStudioNextStageFromKnowledge({
        hasServiceStage: true,
      })
    ).toBe("service");
    expect(resolveSetupStudioNextStageFromService()).toBe("ready");
  });
});
