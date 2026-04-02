import { describe, expect, it } from "vitest";

import {
  getSetupStudioHasAnyReviewContent,
  resolveSetupStudioNextStageFromConfirm,
  resolveSetupStudioNextStageFromEntry,
  resolveSetupStudioNextStageFromReview,
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

  it("moves from scanning into review when draft content exists", () => {
    expect(
      resolveSetupStudioStage({
        prevStage: "scanning",
        entryLocked: false,
        hasVisibleResults: true,
        hasAnyReviewContent: true,
      })
    ).toBe("review");
  });

  it("recognizes review content gates", () => {
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

  it("uses the new straight-line next-stage rules", () => {
    expect(resolveSetupStudioNextStageFromEntry()).toBe("scanning");
    expect(resolveSetupStudioNextStageFromReview()).toBe("confirm");
    expect(resolveSetupStudioNextStageFromConfirm()).toBe("confirm");
  });
});
