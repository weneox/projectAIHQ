import test from "node:test";
import assert from "node:assert/strict";

import { __test__ } from "./useSourceIntelligence.js";

test("describeSourceSyncOutcome uses backend review object for queued review work", () => {
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

  assert.match(message, /queued/i);
  assert.match(message, /review-backed follow-up work/i);
  assert.match(message, /Approved truth will not change until review is completed/i);
});

test("describeSourceSyncOutcome reports candidate counts from backend review object", () => {
  const message = __test__.describeSourceSyncOutcome({
    status: "completed",
    review: {
      required: true,
      candidateDraftCount: 3,
      candidateCreatedCount: 1,
    },
  });

  assert.match(message, /3 review items may affect approved truth next/i);
});
