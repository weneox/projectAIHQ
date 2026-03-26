import { describe, expect, it } from "vitest";

import { __test__ } from "./useSourceIntelligence.js";

describe("useSourceIntelligence helpers", () => {
it("describeSourceSyncOutcome uses backend review object for queued review work", () => {
  const message = __test__.describeSourceSyncOutcome({
    accepted: true,
    status: "queued",
    review: {
      required: true,
      sessionId: "review-session-1",
      projectionStatus: "pending_review",
      candidateDraftCount: 2,
      candidateCreatedCount: 1,
      canonicalProjection: "protected",
    },
  });

  expect(message).toMatch(/queued/i);
  expect(message).toMatch(/review-backed follow-up work/i);
  expect(message).toMatch(/Approved truth will not change until review is completed/i);
});

it("describeSourceSyncOutcome reports candidate counts from backend review object", () => {
  const message = __test__.describeSourceSyncOutcome({
    status: "completed",
    review: {
      required: true,
      candidateDraftCount: 3,
      candidateCreatedCount: 1,
    },
  });

  expect(message).toMatch(/3 review items may affect approved truth next/i);
});
});
