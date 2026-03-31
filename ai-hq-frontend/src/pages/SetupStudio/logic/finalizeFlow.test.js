import { describe, expect, it, vi } from "vitest";

import {
  assertSetupStudioFinalizeGuard,
  buildSetupStudioFinalizeFailure,
  buildSetupStudioFinalizeGuard,
  buildSetupStudioFinalizePatch,
  buildSetupStudioFinalizeRequestPayloads,
  buildSetupStudioPostFinalizeRefreshRequest,
  buildSetupStudioPostFinalizeReviewRequest,
} from "./finalizeFlow.js";

describe("finalizeFlow", () => {
  it("fails closed when there is no active review session or the source is mismatched", () => {
    expect(() =>
      assertSetupStudioFinalizeGuard(
        {
          reviewMeta: {},
          concurrencyPayload: {},
          activeSessionId: "session-42",
          activeReviewAligned: true,
          finalizePermission: {
            allowed: false,
            message: "Only owner/admin can finalize setup review.",
          },
        },
        vi.fn()
      )
    ).toThrow(/only owner\/admin can finalize setup review/i);

    expect(() =>
      assertSetupStudioFinalizeGuard(
        {
          reviewMeta: {},
          concurrencyPayload: {},
          activeSessionId: "",
          activeReviewAligned: true,
        },
        vi.fn()
      )
    ).toThrow(/no active matching review session/i);

    expect(() =>
      assertSetupStudioFinalizeGuard(
        {
          reviewMeta: {},
          concurrencyPayload: {},
          activeSessionId: "session-42",
          activeReviewAligned: false,
        },
        vi.fn()
      )
    ).toThrow(/does not match the active source draft/i);
  });

  it("syncs review issues before blocking stale or conflicted finalization", () => {
    const setReviewSyncIssue = vi.fn();

    expect(() =>
      assertSetupStudioFinalizeGuard(
        {
          reviewMeta: {
            sessionId: "session-42",
            conflicted: true,
            message: "Review conflicted.",
          },
          concurrencyPayload: {},
          activeSessionId: "session-42",
          activeReviewAligned: true,
        },
        setReviewSyncIssue
      )
    ).toThrow(/review conflicted/i);

    expect(setReviewSyncIssue).toHaveBeenCalledWith({
      sessionId: "session-42",
      conflicted: true,
      message: "Review conflicted.",
    });
  });

  it("builds the staged finalize patch from business, service, and knowledge drafts", () => {
    const patch = buildSetupStudioFinalizePatch({
      currentReview: {
        draft: {
          businessProfile: {
            companyName: "Acme Bakery",
            nicheBehavior: {
              primaryCta: "Contact us",
            },
          },
          capabilities: {},
          services: [],
          knowledgeItems: [],
        },
      },
      discoveryState: {
        requestId: "req-1",
      },
      businessForm: {
        companyName: "Acme Bakery",
        description: "Neighborhood bakery",
        timezone: "Asia/Baku",
        language: "en",
        websiteUrl: "https://acme.example",
        behavior: {
          businessType: "bakery",
          niche: "bakery",
          subNiche: "custom_cakes",
          conversionGoal: "order_now",
          primaryCta: "Book your cake tasting",
          leadQualificationMode: "service_booking_triage",
          qualificationQuestions: ["What date do you need the order for?"],
          bookingFlowType: "appointment_request",
          handoffTriggers: ["human_request"],
          disallowedClaims: ["instant_result_guarantees"],
          toneProfile: "warm_reassuring",
          channelBehavior: {
            inbox: {
              primaryAction: "qualify_and_capture",
            },
            voice: {
              primaryAction: "book_or_route_call",
            },
          },
        },
      },
      manualSections: {
        servicesText: "Custom Cakes | Made to order",
        faqsText: "Do you deliver? | Yes",
        policiesText: "Returns | Custom orders are non-refundable",
      },
    });

    expect(patch.businessProfile.companyName).toBe("Acme Bakery");
    expect(patch.capabilities.primaryLanguage).toBe("en");
    expect(patch.businessProfile.nicheBehavior.primaryCta).toBe(
      "Book your cake tasting"
    );
    expect(patch.businessProfile.nicheBehavior.channelBehavior.voice.primaryAction).toBe(
      "book_or_route_call"
    );
    expect(
      patch.draftPayload.stagedInputs.runtimePreferences.nicheBehavior.qualificationQuestions
    ).toEqual(["What date do you need the order for?"]);
    expect(patch.services[0].title).toBe("Custom Cakes");
    expect(patch.knowledgeItems).toHaveLength(2);
  });

  it("shapes finalize request payloads and post-finalize refresh requests", () => {
    const guard = buildSetupStudioFinalizeGuard({
      currentReview: {
        session: { id: "session-42", status: "active" },
        draft: { version: "draft-7" },
        viewerRole: "owner",
        permissions: {
          setupReviewFinalize: {
            allowed: true,
          },
        },
      },
      discoveryState: {},
      activeReviewAligned: true,
    });

    const { patchPayload, finalizePayload } = buildSetupStudioFinalizeRequestPayloads({
      guard,
      patch: { businessProfile: { companyName: "Acme Bakery" } },
      discoveryState: { requestId: "req-1" },
    });

    expect(patchPayload.sessionId).toBe("session-42");
    expect(patchPayload.draftVersion).toBe("draft-7");
    expect(patchPayload.metadata).toEqual({ requestId: "req-1" });
    expect(finalizePayload.reason).toBe("setup_studio_finalize");
    expect(guard.finalizePermission.allowed).toBe(true);

    expect(
      buildSetupStudioPostFinalizeRefreshRequest({
        sourceType: "website",
        sourceUrl: "https://acme.example",
      })
    ).toEqual({
      preserveBusinessForm: false,
      hydrateReview: true,
      activeSourceType: "website",
      activeSourceUrl: "https://acme.example",
    });

    expect(
      buildSetupStudioPostFinalizeReviewRequest({
        sourceType: "website",
        sourceUrl: "https://acme.example",
      })
    ).toEqual({
      preserveBusinessForm: false,
      activateReviewSession: true,
      activeSourceType: "website",
      activeSourceUrl: "https://acme.example",
    });
  });

  it("does not invent locale defaults in the staged finalize patch when the draft has no locale evidence", () => {
    const patch = buildSetupStudioFinalizePatch({
      currentReview: {
        draft: {
          businessProfile: {
            companyName: "Acme Bakery",
          },
          capabilities: {},
          services: [],
          knowledgeItems: [],
        },
      },
      discoveryState: {
        requestId: "req-2",
      },
      businessForm: {
        companyName: "Acme Bakery",
        description: "Neighborhood bakery",
        timezone: "",
        language: "",
        websiteUrl: "https://acme.example",
        behavior: {},
      },
      manualSections: {
        servicesText: "",
        faqsText: "",
        policiesText: "",
      },
    });

    expect(patch.businessProfile.mainLanguage || "").toBe("");
    expect(patch.businessProfile.primaryLanguage || "").toBe("");
    expect(patch.businessProfile.language || "").toBe("");
    expect(patch.businessProfile.timezone || "").toBe("");
    expect(patch.capabilities.primaryLanguage || "").toBe("");
    expect(Array.isArray(patch.capabilities.supportedLanguages)).toBe(true);
    expect(patch.capabilities.supportedLanguages).toEqual([]);
  });

  it("shapes finalize failures and preserves concurrency issue propagation", () => {
    const failure = buildSetupStudioFinalizeFailure({
      error: {
        message: "Draft version no longer matches",
        code: "SETUP_REVIEW_DRAFT_VERSION_MISMATCH",
        payload: { code: "SETUP_REVIEW_DRAFT_VERSION_MISMATCH" },
      },
      currentReview: {
        session: { id: "session-42", status: "active" },
        draft: { version: "draft-7" },
      },
      discoveryState: {},
    });

    expect(failure.shouldSyncIssue).toBe(true);
    expect(failure.issue.conflicted).toBe(true);
    expect(failure.message).toBe("Draft version no longer matches");
  });
});
