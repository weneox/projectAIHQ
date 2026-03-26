import { describe, expect, it } from "vitest";

import {
  buildSetupStudioHydratedBusinessForm,
  buildSetupStudioHydratedReviewUi,
  buildSetupStudioReviewLoadFailureIssue,
  buildSetupStudioSourceMismatchIssue,
  reconcileSetupStudioLoadedReview,
} from "./loaderFlowReview.js";

describe("loaderFlowReview", () => {
  it("detects active-source mismatches when preserving the active draft", () => {
    const result = reconcileSetupStudioLoadedReview({
      reviewPayload: {
        review: {
          session: { id: "session-42", status: "active", revision: "draft-7" },
          draft: {
            businessProfile: {
              companyName: "Acme Bakery",
              websiteUrl: "https://other.example",
            },
            sourceSummary: {
              latestImport: {
                sourceType: "website",
                sourceUrl: "https://other.example",
              },
            },
          },
        },
      },
      preserveBusinessForm: true,
      sourceScope: {
        sourceType: "website",
        sourceUrl: "https://acme.example",
      },
    });

    expect(result.shouldApplyIntoActiveStudio).toBe(false);

    const issue = buildSetupStudioSourceMismatchIssue({
      normalized: result.normalized,
      legacy: result.legacy,
      message: "A review session exists, but it belongs to a different source than the active draft.",
    });

    expect(issue.freshness).toBe("source_mismatch");
    expect(issue.message).toMatch(/different source/i);
  });

  it("shapes hydrated review ui details for matching reviews", () => {
    const reconciled = reconcileSetupStudioLoadedReview({
      reviewPayload: {
        review: {
          session: { id: "session-42", status: "active" },
          draft: {
            businessProfile: {
              companyName: "Acme Bakery",
              summaryShort:
                "Neighborhood bakery serving breads, cakes, and coffee every day.",
              websiteUrl: "https://acme.example",
            },
            sourceSummary: {
              latestImport: {
                sourceType: "website",
                sourceUrl: "https://acme.example",
              },
            },
            services: [{ title: "Custom Cakes", description: "Made to order" }],
            knowledgeItems: [
              {
                title: "Do you deliver?",
                valueText: "Yes, same-day delivery is available.",
                category: "faq",
              },
            ],
          },
        },
      },
      preserveBusinessForm: false,
      sourceScope: {
        sourceType: "website",
        sourceUrl: "https://acme.example",
      },
    });

    const reviewUi = buildSetupStudioHydratedReviewUi({
      reviewState: reconciled.normalized,
      legacyDraft: reconciled.legacy,
      preserveBusinessForm: false,
    });

    const businessForm = buildSetupStudioHydratedBusinessForm({
      prev: {},
      baseProfile: reviewUi.baseProfile,
      preserveBusinessForm: false,
      reviewInfo: reviewUi.reviewInfo,
    });

    expect(reviewUi.shouldUpdateActiveSource).toBe(true);
    expect(reviewUi.manualSections.servicesText).toContain("Custom Cakes");
    expect(reviewUi.manualSections.faqsText).toContain("Do you deliver?");
    expect(businessForm.companyName).toBe("Acme Bakery");
    expect(businessForm.websiteUrl).toBe("https://acme.example");
  });

  it("shapes a review-load failure issue conservatively", () => {
    const issue = buildSetupStudioReviewLoadFailureIssue(
      new Error("boom")
    );

    expect(issue.freshness).toBe("unknown");
    expect(issue.message).toBe("boom");
  });
});
