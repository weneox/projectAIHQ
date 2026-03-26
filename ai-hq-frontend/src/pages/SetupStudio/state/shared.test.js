import { describe, expect, it } from "vitest";

import {
  createEmptyReviewState,
  normalizeReviewState,
} from "./shared.js";

describe("setup studio shared state", () => {
it("createEmptyReviewState keeps concurrency containers available", () => {
  const state = createEmptyReviewState();

  expect(state.concurrency).toEqual({});
  expect(state.finalizeProtection).toEqual({});
});

it("normalizeReviewState preserves backend concurrency and draft version", () => {
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

  expect(review.session?.id).toBe("session-123");
  expect(review.session?.status).toBe("active");
  expect(review.session?.revision).toBe("v7");
  expect(review.sessionMeta.sessionId).toBe("session-123");
  expect(review.sessionMeta.revision).toBe("v7");
  expect(review.concurrency).toEqual({
    sessionId: "session-123",
    sessionStatus: "active",
    draftVersion: "v7",
  });
  expect(review.finalizeProtection).toEqual({
    lockConflict: false,
  });
});
});
