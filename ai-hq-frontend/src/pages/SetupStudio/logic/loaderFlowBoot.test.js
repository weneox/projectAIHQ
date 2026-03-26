import { describe, expect, it } from "vitest";

import {
  buildSetupStudioBootSnapshot,
  buildSetupStudioLoaderErrorResult,
} from "./loaderFlowBoot.js";

describe("loaderFlowBoot", () => {
  it("builds the boot snapshot with pending knowledge, services, and meta", () => {
    const snapshot = buildSetupStudioBootSnapshot({
      boot: {
        workspace: {
          setupCompleted: false,
          nextStudioStage: "knowledge",
        },
        setup: {
          businessProfile: {
            companyName: "Acme Bakery",
          },
        },
      },
      knowledgePayload: {
        items: [
          { id: "k1", status: "pending" },
          { id: "k2", status: "approved" },
        ],
      },
      servicesPayload: {
        items: [{ id: "svc-1" }],
      },
    });

    expect(snapshot.profile.companyName).toBe("Acme Bakery");
    expect(snapshot.pendingKnowledge).toHaveLength(1);
    expect(snapshot.serviceItems).toHaveLength(1);
    expect(snapshot.meta.pendingCandidateCount).toBe(1);
  });

  it("shapes a fail-closed empty loader result", () => {
    const result = buildSetupStudioLoaderErrorResult("failed");

    expect(result.error).toBe("failed");
    expect(result.pendingKnowledge).toEqual([]);
    expect(result.currentReview).toEqual({});
  });
});
