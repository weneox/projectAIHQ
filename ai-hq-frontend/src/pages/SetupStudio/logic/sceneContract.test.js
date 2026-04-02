import { describe, expect, it, vi } from "vitest";

import { buildSetupStudioSceneContract } from "./sceneContract.js";

describe("buildSetupStudioSceneContract", () => {
  it("groups controller state and handlers into a smaller scene contract", () => {
    const state = {
      loading: false,
      refreshing: true,
      importingWebsite: false,
      savingBusiness: false,
      actingKnowledgeId: "candidate-1",
      savingServiceSuggestion: "",
      showKnowledge: false,
      error: "",
      businessForm: { companyName: "Acme Bakery" },
      discoveryForm: { sourceValue: "https://acme.example" },
      manualSections: { servicesText: "Custom Cakes" },
      discoveryState: { mode: "success" },
      services: [{ id: "svc-1" }],
      meta: { setupCompleted: true },
      setBusinessField: vi.fn(),
      setManualSection: vi.fn(),
      setDiscoveryField: vi.fn(),
    };
    const viewModel = {
      scopedCurrentReview: {
        draft: { businessProfile: { companyName: "Acme Bakery" } },
      },
      effectiveMeta: { setupCompleted: true },
      visibleSources: [{ id: "source-1" }],
      visibleEvents: [{ id: "event-1" }],
      reviewSyncState: { level: "ready" },
      hasStoredReview: true,
      currentTitle: "Acme Bakery",
      currentDescription: "Neighborhood bakery",
      discoveryProfileRows: [{ key: "companyName" }],
      knowledgePreview: "Preview",
      visibleKnowledgeItems: [{ id: "knowledge-1" }],
      serviceSuggestionTitle: "Suggested service",
      studioProgress: { nextStudioStage: "ready" },
      hasVisibleResults: true,
      visibleServiceItems: [{ id: "svc-1" }],
    };
    const actions = {
      onScanBusiness: vi.fn(),
      onSaveBusiness: vi.fn(),
      onApproveKnowledge: vi.fn(),
      onRejectKnowledge: vi.fn(),
      onCreateSuggestedService: vi.fn(),
      onOpenWorkspace: vi.fn(),
    };
    const adapters = {
      continueFlow: vi.fn(),
      loadActiveReview: vi.fn(),
      refreshStudio: vi.fn(),
      toggleKnowledge: vi.fn(),
    };

    const contract = buildSetupStudioSceneContract({
      state,
      viewModel,
      actions,
      adapters,
    });

    expect(contract.status.refreshing).toBe(true);
    expect(contract.forms.businessForm.companyName).toBe("Acme Bakery");
    expect(contract.review.hasStoredReview).toBe(true);
    expect(contract.review.hasApprovedTruth).toBe(true);
    expect(contract.content.visibleKnowledgeCount).toBe(1);
    expect(contract.content.visibleServiceCount).toBe(1);
    expect(contract.actions.resumeReview).toBe(adapters.loadActiveReview);
    expect(contract.actions.scanBusiness).toBe(actions.onScanBusiness);
  });
});
