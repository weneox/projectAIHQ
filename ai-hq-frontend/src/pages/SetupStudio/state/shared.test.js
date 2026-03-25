import test from "node:test";
import assert from "node:assert/strict";

import {
  createEmptyReviewState,
  normalizeReviewState,
} from "./shared.js";

test("createEmptyReviewState keeps concurrency containers available", () => {
  const state = createEmptyReviewState();

  assert.deepEqual(state.concurrency, {});
  assert.deepEqual(state.finalizeProtection, {});
});

test("normalizeReviewState preserves backend concurrency and draft version", () => {
  const review = normalizeReviewState({
    concurrency: {
      sessionId: "session-123",
      sessionStatus: "active",
      draftVersion: "v7",
    },
    finalizeProtection: {
      lockConflict: false,
    },
    review: {
      draft: {
        version: "v7",
      },
      session: {
        id: "session-123",
      },
    },
  });

  assert.equal(review.session?.id, "session-123");
  assert.equal(review.session?.status, "active");
  assert.equal(review.session?.revision, "v7");
  assert.equal(review.sessionMeta.sessionId, "session-123");
  assert.equal(review.sessionMeta.revision, "v7");
  assert.deepEqual(review.concurrency, {
    sessionId: "session-123",
    sessionStatus: "active",
    draftVersion: "v7",
  });
  assert.deepEqual(review.finalizeProtection, {
    lockConflict: false,
  });
});
