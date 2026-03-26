import { describe, expect, it, vi } from "vitest";

import { createSetupStudioActionAdapters } from "./actionAdapters.js";

describe("createSetupStudioActionAdapters", () => {
  it("loads the active review with staged review defaults and source scope", () => {
    const actions = {
      loadCurrentReview: vi.fn(),
      loadData: vi.fn(),
      onScanBusiness: vi.fn(),
    };
    const ctx = {
      navigate: vi.fn(),
      discoveryForm: { sourceValue: "https://acme.example" },
      freshEntryMode: false,
      activeSourceScope: {
        sourceType: "website",
        sourceUrl: "https://acme.example",
      },
      setShowRefine: vi.fn(),
      setShowKnowledge: vi.fn(),
    };

    const adapters = createSetupStudioActionAdapters(ctx, actions);
    adapters.loadActiveReview();

    expect(actions.loadCurrentReview).toHaveBeenCalledWith({
      preserveBusinessForm: true,
      activateReviewSession: true,
      activeSourceType: "website",
      activeSourceUrl: "https://acme.example",
    });
  });

  it("refreshes using hydrate-review defaults tied to the active source", () => {
    const actions = {
      loadCurrentReview: vi.fn(),
      loadData: vi.fn(),
      onScanBusiness: vi.fn(),
    };
    const ctx = {
      navigate: vi.fn(),
      discoveryForm: {},
      freshEntryMode: true,
      activeSourceScope: {
        sourceType: "manual",
        sourceUrl: "",
      },
      setShowRefine: vi.fn(),
      setShowKnowledge: vi.fn(),
    };

    const adapters = createSetupStudioActionAdapters(ctx, actions);
    adapters.refreshStudio();

    expect(actions.loadData).toHaveBeenCalledWith({
      silent: true,
      preserveBusinessForm: false,
      hydrateReview: true,
      activeSourceType: "manual",
      activeSourceUrl: "",
    });
  });
});
