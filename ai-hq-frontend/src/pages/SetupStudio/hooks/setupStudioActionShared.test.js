import { describe, expect, it } from "vitest";

import {
  buildReviewConcurrencyPayload,
  currentReviewConcurrencyMeta,
  parseReviewConcurrencyError,
} from "./setupStudioActionShared.js";

describe("setup studio action shared", () => {
it("currentReviewConcurrencyMeta uses backend draft version and session id", () => {
  const meta = currentReviewConcurrencyMeta(
    {
      session: { id: "session-9", status: "active" },
      draft: { version: "draft-42" },
      concurrency: { sessionId: "ignored-session", draftVersion: "ignored" },
    },
    {}
  );

  expect(meta.sessionId).toBe("session-9");
  expect(meta.sessionStatus).toBe("active");
  expect(meta.revision).toBe("draft-42");
  expect(buildReviewConcurrencyPayload(meta)).toEqual({
    sessionId: "session-9",
    draftVersion: "draft-42",
  });
});

it("parseReviewConcurrencyError recognizes explicit backend mismatch codes", () => {
  const issue = parseReviewConcurrencyError(
    {
      message: "Draft version no longer matches",
      code: "SETUP_REVIEW_DRAFT_VERSION_MISMATCH",
      payload: { code: "SETUP_REVIEW_DRAFT_VERSION_MISMATCH" },
    },
    { sessionId: "session-9", revision: "draft-42" }
  );

  expect(issue.conflicted).toBe(true);
  expect(issue.stale).toBe(false);
  expect(issue.freshness).toBe("conflict");
  expect(issue.sessionId).toBe("session-9");
  expect(issue.revision).toBe("draft-42");
});

it("parseReviewConcurrencyError recognizes baseline drift payloads as stale", () => {
  const issue = parseReviewConcurrencyError({
    message: "Canonical baseline drift detected",
    payload: {
      code: "SETUP_REVIEW_BASELINE_DRIFT",
      baseline: { companyName: "Old" },
      current: { companyName: "New" },
      reason: "Approved truth changed before finalize.",
    },
  });

  expect(issue.stale).toBe(true);
  expect(issue.conflicted).toBe(false);
  expect(issue.freshness).toBe("stale");
  expect(issue.message).toBe("Approved truth changed before finalize.");
});
});
