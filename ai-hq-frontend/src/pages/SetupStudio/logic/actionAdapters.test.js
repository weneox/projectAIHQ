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
      discoveryForm: { sourceValue: "https://acme.example" },
      freshEntryMode: false,
      activeSourceScope: {
        sourceType: "website",
        sourceUrl: "https://acme.example",
      },
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
      discoveryForm: {},
      freshEntryMode: true,
      activeSourceScope: {
        sourceType: "manual",
        sourceUrl: "",
      },
      setShowKnowledge: vi.fn(),
    };

    const adapters = createSetupStudioActionAdapters(ctx, actions);
    adapters.refreshStudio();

    expect(actions.loadData).toHaveBeenCalledWith({
      silent: true,
      preserveBusinessForm: false,
      hydrateReview: false,
      seedBootProfile: false,
      activeSourceType: "manual",
      activeSourceUrl: "",
    });
  });

  it("keeps review hydration available once the user explicitly resumes review mode", () => {
    const actions = {
      loadCurrentReview: vi.fn(),
      loadData: vi.fn(),
      onScanBusiness: vi.fn(),
    };
    const ctx = {
      discoveryForm: {},
      freshEntryMode: false,
      activeSourceScope: {
        sourceType: "website",
        sourceUrl: "https://acme.example",
      },
      setShowKnowledge: vi.fn(),
    };

    const adapters = createSetupStudioActionAdapters(ctx, actions);
    adapters.refreshStudio();

    expect(actions.loadData).toHaveBeenCalledWith({
      silent: true,
      preserveBusinessForm: true,
      hydrateReview: true,
      seedBootProfile: true,
      activeSourceType: "website",
      activeSourceUrl: "https://acme.example",
    });
  });
});
