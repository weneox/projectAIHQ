import { describe, expect, it } from "vitest";

import { createEmptyReviewState } from "../state/shared.js";
import {
  buildSetupStudioReviewSyncIssue,
  buildSetupStudioScanErrorState,
  buildSetupStudioScanRevealState,
  reconcileSetupStudioScanResult,
} from "./scanFlowResult.js";

function buildPlan(overrides = {}) {
  return {
    request: {
      hasUnsupportedSources: false,
      sourceCount: 1,
    },
    requestedSources: [
      { sourceType: "website", url: "https://acme.example", isPrimary: true },
    ],
    requestedPrimarySource: {
      sourceType: "website",
      url: "https://acme.example",
      isPrimary: true,
    },
    sourceType: "website",
    sourceUrl: "https://acme.example",
    hasImportableSource: true,
    hasRequestedSources: true,
    requestedPrimarySourceType: "website",
    requestedPrimarySourceUrl: "https://acme.example",
    shouldUseBundledImport: false,
    uiSourceType: "website",
    displaySourceType: "website",
    displaySourceUrl: "https://acme.example",
    ...overrides,
  };
}

describe("reconcileSetupStudioScanResult", () => {
  it("keeps mismatched review sessions isolated and records source-mismatch state", () => {
    const result = reconcileSetupStudioScanResult({
      plan: buildPlan(),
      importResult: {
        warnings: ["remote_site_temporarily_unavailable"],
      },
      analyzeResult: {
        mode: "partial",
        shouldReview: true,
        candidateCount: 2,
        requestId: "req-1",
        profile: {
          companyName: "Acme Bakery",
          summaryShort:
            "Neighborhood bakery serving breads, cakes, and coffee every day.",
        },
      },
      reviewPayload: {
        review: {
          session: {
            id: "session-42",
            status: "active",
            freshness: "fresh",
          },
          draft: {
            businessProfile: {
              companyName: "Acme Bakery",
              summaryShort:
                "Neighborhood bakery serving breads, cakes, and coffee every day.",
              websiteUrl: "https://other.example",
            },
            sourceSummary: {
              latestImport: {
                sourceType: "website",
                sourceUrl: "https://other.example",
              },
            },
            services: [],
            knowledgeItems: [],
          },
          sources: [
            {
              sourceType: "website",
              url: "https://other.example",
            },
          ],
        },
      },
      createEmptyReviewState,
    });

    expect(result.importedReviewMatchesActiveSource).toBe(false);
    expect(result.combinedWarnings).toContain(
      "The backend review session did not match this source yet, so the editable draft stayed isolated."
    );
    expect(result.finalDiscoveryState.lastSourceType).toBe("website");
    expect(result.finalDiscoveryState.lastUrl).toBe("https://acme.example");
    expect(result.finalDiscoveryState.hasResults).toBe(true);

    const syncIssue = buildSetupStudioReviewSyncIssue({
      importedReview: result.importedReview,
      reviewProjection: result.reviewProjection,
      hasImportableSource: true,
      importedReviewMatchesActiveSource: false,
    });

    expect(syncIssue.freshness).toBe("source_mismatch");
    expect(syncIssue.message).toMatch(/editing remains isolated/i);
  });

  it("keeps reveal actions closed for barrier-only results", () => {
    const revealState = buildSetupStudioScanRevealState({
      refreshResult: {
        routed: false,
        snapshot: {
          pendingKnowledge: [{ id: "candidate-1" }],
          meta: { nextStudioStage: "knowledge" },
        },
      },
      barrierOnlyResult: true,
      analyzeResult: {
        shouldReview: true,
        candidateCount: 1,
      },
      importedVisibleKnowledgeItems: [{ id: "candidate-1" }],
      importedVisibleServiceItems: [{ id: "service-1" }],
      hasImmediateVisibleResults: true,
      bestIncomingProfile: {
        companyName: "Acme Bakery",
      },
      importedProfileRows: [{ key: "companyName" }],
    });

    expect(revealState.shouldOpenKnowledge).toBe(false);
    expect(revealState.shouldOpenRefine).toBe(false);
  });

  it("shapes scan errors without leaving stale result state behind", () => {
    const errorState = buildSetupStudioScanErrorState({
      prev: {
        requestId: "req-1",
        importedKnowledgeItems: [{ id: "candidate-1" }],
      },
      message: "The business draft could not be prepared.",
      requestedPrimarySourceUrl: "https://acme.example",
      sourceUrl: "",
      uiSourceType: "website",
      displaySourceType: "website",
    });

    expect(errorState.mode).toBe("error");
    expect(errorState.lastUrl).toBe("https://acme.example");
    expect(errorState.sourceLabel).toBe("Website");
    expect(errorState.importedKnowledgeItems).toEqual([]);
    expect(errorState.importedServices).toEqual([]);
  });

  it("does not invent locale fields for sparse website scan results without source evidence", () => {
    const result = reconcileSetupStudioScanResult({
      plan: buildPlan(),
      importResult: {
        warnings: [],
        profile: {
          websiteUrl: "https://acme.example",
          primaryPhone: "+15550001111",
        },
      },
      analyzeResult: {
        mode: "success",
        shouldReview: false,
        candidateCount: 0,
        requestId: "req-2",
        profile: {
          websiteUrl: "https://acme.example",
          primaryPhone: "+15550001111",
        },
      },
      reviewPayload: {},
      createEmptyReviewState,
    });

    expect(result.bestIncomingProfile.websiteUrl).toBe("https://acme.example");
    expect(result.bestIncomingProfile.primaryPhone).toBe("+15550001111");
    expect(result.bestIncomingProfile.language || "").toBe("");
    expect(result.bestIncomingProfile.mainLanguage || "").toBe("");
    expect(result.bestIncomingProfile.primaryLanguage || "").toBe("");
    expect(result.bestIncomingProfile.timezone || "").toBe("");
  });
});
