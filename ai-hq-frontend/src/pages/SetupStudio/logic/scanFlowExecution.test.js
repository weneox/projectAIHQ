import { describe, expect, it, vi, beforeEach } from "vitest";

const setupApiMocks = vi.hoisted(() => ({
  importBundleForSetup: vi.fn(),
  importSourceForSetup: vi.fn(),
  analyzeSetupIntake: vi.fn(),
  getCurrentSetupReview: vi.fn(),
}));

vi.mock("../../../api/setup.js", () => ({
  importBundleForSetup: setupApiMocks.importBundleForSetup,
  importSourceForSetup: setupApiMocks.importSourceForSetup,
  analyzeSetupIntake: setupApiMocks.analyzeSetupIntake,
  getCurrentSetupReview: setupApiMocks.getCurrentSetupReview,
}));

import { executeSetupStudioScanPlan } from "./scanFlowExecution.js";

function buildPlan(overrides = {}) {
  return {
    sourceType: "website",
    sourceUrl: "https://beta.example",
    hasImportableSource: true,
    shouldUseBundledImport: false,
    request: {
      note: "scan this site",
    },
    analyzePayload: {
      manualText: "",
      answers: {},
    },
    requestedSources: [
      {
        sourceType: "website",
        url: "https://beta.example",
        isPrimary: true,
      },
    ],
    requestedPrimarySource: {
      sourceType: "website",
      url: "https://beta.example",
      isPrimary: true,
    },
    ...overrides,
  };
}

describe("executeSetupStudioScanPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps website-only scans on the new analyze review payload", async () => {
    const review = {
      review: {
        session: { id: "session-b" },
        draft: {
          businessProfile: {
            companyName: "Beta Dental",
          },
        },
      },
    };

    setupApiMocks.importSourceForSetup.mockResolvedValue({ ok: true });
    setupApiMocks.analyzeSetupIntake.mockResolvedValue({
      mode: "success",
      review,
    });

    const result = await executeSetupStudioScanPlan(buildPlan());

    expect(setupApiMocks.importSourceForSetup).toHaveBeenCalledWith(
      expect.objectContaining({
        allowSessionReuse: false,
      })
    );
    expect(setupApiMocks.analyzeSetupIntake).toHaveBeenCalledTimes(1);
    expect(setupApiMocks.getCurrentSetupReview).not.toHaveBeenCalled();
    expect(result.reviewPayload).toEqual(review);
  });

  it("keeps bundled scans isolated from stale current-review reloads", async () => {
    const staleReview = {
      review: {
        session: { id: "session-a" },
        draft: {
          businessProfile: {
            companyName: "Alpha Legal",
            primaryPhone: "+44 20 7946 0958",
            summaryShort: "Old unfinished review",
          },
        },
      },
    };
    const bundledReview = {
      review: {
        session: { id: "session-b" },
        draft: {
          businessProfile: {
            companyName: "Beta Dental",
            websiteUrl: "https://beta.example",
          },
          sourceSummary: {
            latestImport: {
              sourceType: "website",
              sourceUrl: "https://beta.example",
            },
          },
        },
      },
    };

    setupApiMocks.importBundleForSetup.mockResolvedValue({
      ok: true,
      review: bundledReview,
    });
    setupApiMocks.getCurrentSetupReview.mockResolvedValue(staleReview);

    const result = await executeSetupStudioScanPlan(
      buildPlan({
        shouldUseBundledImport: true,
        requestedSources: [
          {
            sourceType: "website",
            url: "https://beta.example",
            isPrimary: true,
          },
          {
            sourceType: "instagram",
            url: "https://instagram.com/beta",
          },
        ],
      })
    );

    expect(setupApiMocks.importBundleForSetup).toHaveBeenCalledWith(
      expect.objectContaining({
        allowSessionReuse: false,
      })
    );
    expect(setupApiMocks.getCurrentSetupReview).not.toHaveBeenCalled();
    expect(setupApiMocks.analyzeSetupIntake).not.toHaveBeenCalled();
    expect(result.reviewPayload).toEqual(bundledReview);
    expect(result.reviewPayload.review.draft.businessProfile.companyName).toBe(
      "Beta Dental"
    );
  });
});
