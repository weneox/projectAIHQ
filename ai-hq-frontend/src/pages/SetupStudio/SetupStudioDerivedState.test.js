import { describe, expect, it } from "vitest";

import {
  getHasStoredReview,
  getScopedReviewState,
  getReviewProjection,
} from "./SetupStudioDerivedState.js";

describe("SetupStudioDerivedState", () => {
  it("treats canonical currentReview as the stored review authority", () => {
    const currentReview = {
      session: { id: "session-42" },
      draft: {
        businessProfile: {
          companyName: "Acme Bakery",
        },
      },
    };

    expect(getHasStoredReview(currentReview)).toBe(true);
    expect(getReviewProjection(currentReview).overview.companyName).toBe(
      "Acme Bakery"
    );
  });

  it("scopes mismatched review sessions out of the active studio flow", () => {
    const currentReview = {
      session: { id: "session-42" },
      draft: {
        businessProfile: {
          companyName: "Other Bakery",
          websiteUrl: "https://other.example",
        },
      },
    };

    const { scopedCurrentReview } = getScopedReviewState({
      hasStoredReview: true,
      activeReviewAligned: false,
      currentReview,
      activeSourceScope: {
        sourceType: "website",
        sourceUrl: "https://acme.example",
      },
      discoveryState: {
        lastSourceType: "website",
        lastUrl: "https://acme.example",
      },
    });

    expect(scopedCurrentReview).toEqual({
      session: null,
      concurrency: {},
      finalizeProtection: {},
      sessionMeta: {
        sessionId: "",
        sessionStatus: "",
        revision: "",
        freshness: "unknown",
        stale: false,
        conflicted: false,
        hasRevision: false,
        hasSessionId: false,
        sourceFingerprint: "",
        conflictMessage: "",
      },
      draft: {},
      sources: [],
      events: [],
      bundleSources: [],
      contributionSummary: {},
      fieldProvenance: {},
      reviewDraftSummary: {},
    });
  });
});
