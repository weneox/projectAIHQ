import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSetupStudioControllerState } from "./useSetupStudioControllerState.js";

describe("useSetupStudioControllerState", () => {
  it("normalizes and stores the active source scope", () => {
    const { result } = renderHook(() => useSetupStudioControllerState());

    let nextScope;
    act(() => {
      nextScope = result.current.updateActiveSourceScope(
        "",
        "example.com/about"
      );
    });

    expect(nextScope).toEqual({
      sourceType: "website",
      sourceUrl: "example.com/about",
      fingerprint: "website|example.com",
    });
    expect(result.current.activeSourceScope).toEqual(nextScope);
    expect(result.current.activeSourceRef.current).toEqual(nextScope);
  });

  it("hydrates review state, business form, and manual sections from a review payload", () => {
    const { result } = renderHook(() => useSetupStudioControllerState());

    act(() => {
      result.current.applyReviewState(
        {
          review: {
            session: {
              id: "session-42",
              status: "active",
              revision: "draft-7",
            },
            draft: {
              businessProfile: {
                companyName: "Acme Bakery",
                summaryShort:
                  "Neighborhood bakery serving breads, cakes, and coffee every day.",
                websiteUrl: "https://acme.example",
                primaryPhone: "+994 12 555 12 12",
                primaryEmail: "hello@acme.example",
                primaryAddress: "Baku Old City 10",
              },
              services: [
                {
                  title: "Custom Cakes",
                  description: "Celebration cakes made to order",
                },
              ],
              knowledgeItems: [
                {
                  title: "Do you deliver?",
                  valueText: "Yes, same-day delivery is available in central Baku.",
                  category: "faq",
                },
                {
                  title: "Returns",
                  valueText: "Custom orders are non-refundable once production starts.",
                  category: "policy",
                },
              ],
              sourceSummary: {
                latestImport: {
                  sourceType: "website",
                  sourceUrl: "https://acme.example",
                },
              },
            },
          },
        },
        { preserveBusinessForm: false }
      );
    });

    expect(result.current.currentReview.session.id).toBe("session-42");
    expect(result.current.reviewDraft.overview.companyName).toBe("Acme Bakery");
    expect(result.current.businessForm.companyName).toBe("Acme Bakery");
    expect(result.current.businessForm.websiteUrl).toBe("https://acme.example");
    expect(result.current.manualSections.servicesText).toContain("Custom Cakes");
    expect(result.current.manualSections.faqsText).toContain("Do you deliver?");
    expect(result.current.manualSections.policiesText).toContain("Returns");
    expect(result.current.discoveryState.reviewSessionId).toBe("session-42");
    expect(result.current.discoveryState.lastSourceType).toBe("website");
    expect(result.current.discoveryState.lastUrl).toBe("https://acme.example");
    expect(result.current.activeSourceScope).toEqual({
      sourceType: "website",
      sourceUrl: "https://acme.example",
      fingerprint: "website|acme.example",
    });
  });
});
