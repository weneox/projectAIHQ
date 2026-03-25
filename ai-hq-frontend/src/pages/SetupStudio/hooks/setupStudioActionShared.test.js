import test from "node:test";
import assert from "node:assert/strict";

import {
  buildReviewConcurrencyPayload,
  currentReviewConcurrencyMeta,
  parseReviewConcurrencyError,
} from "./setupStudioActionShared.js";

test("currentReviewConcurrencyMeta uses backend draft version and session id", () => {
  const meta = currentReviewConcurrencyMeta(
    {
      session: { id: "session-9", status: "active" },
      draft: { version: "draft-42" },
      concurrency: { sessionId: "ignored-session", draftVersion: "ignored" },
    },
    {}
  );

  assert.equal(meta.sessionId, "session-9");
  assert.equal(meta.sessionStatus, "active");
  assert.equal(meta.revision, "draft-42");
  assert.deepEqual(buildReviewConcurrencyPayload(meta), {
    sessionId: "session-9",
    draftVersion: "draft-42",
  });
});

test("parseReviewConcurrencyError recognizes explicit backend mismatch codes", () => {
  const issue = parseReviewConcurrencyError(
    {
      message: "Draft version no longer matches",
      code: "SETUP_REVIEW_DRAFT_VERSION_MISMATCH",
      payload: { code: "SETUP_REVIEW_DRAFT_VERSION_MISMATCH" },
    },
    { sessionId: "session-9", revision: "draft-42" }
  );

  assert.equal(issue.conflicted, true);
  assert.equal(issue.stale, false);
  assert.equal(issue.freshness, "conflict");
  assert.equal(issue.sessionId, "session-9");
  assert.equal(issue.revision, "draft-42");
});

test("parseReviewConcurrencyError recognizes baseline drift payloads as stale", () => {
  const issue = parseReviewConcurrencyError({
    message: "Canonical baseline drift detected",
    payload: {
      code: "SETUP_REVIEW_BASELINE_DRIFT",
      baseline: { companyName: "Old" },
      current: { companyName: "New" },
      reason: "Approved truth changed before finalize.",
    },
  });

  assert.equal(issue.stale, true);
  assert.equal(issue.conflicted, false);
  assert.equal(issue.freshness, "stale");
  assert.equal(issue.message, "Approved truth changed before finalize.");
});
