import { describe, expect, it, vi } from "vitest";

import {
  applyPostApproveKnowledgeRefresh,
  applyPostRejectKnowledgeRefresh,
  buildSetupStudioKnowledgeRefreshRequest,
  buildSetupStudioKnowledgeReviewRequest,
  resolveSetupStudioKnowledgeCandidateAction,
  runSetupStudioKnowledgeCandidateMutation,
  runSetupStudioSuggestedServiceCreation,
} from "./knowledgeActionFlow.js";

describe("knowledgeActionFlow", () => {
  it("builds stable review and refresh requests from the active source scope", () => {
    const scope = {
      sourceType: "website",
      sourceUrl: "https://acme.example",
    };

    expect(buildSetupStudioKnowledgeReviewRequest(scope)).toEqual({
      preserveBusinessForm: true,
      activateReviewSession: true,
      activeSourceType: "website",
      activeSourceUrl: "https://acme.example",
    });

    expect(buildSetupStudioKnowledgeRefreshRequest(scope)).toEqual({
      preserveBusinessForm: true,
      hydrateReview: true,
      activeSourceType: "website",
      activeSourceUrl: "https://acme.example",
    });
  });

  it("resolves a candidate id and fails closed when one is missing", () => {
    const resolved = resolveSetupStudioKnowledgeCandidateAction({
      item: {
        candidateUuid: "123e4567-e89b-42d3-a456-426614174000",
      },
      visibleKnowledgeItems: [],
      pickKnowledgeCandidateId: vi.fn(),
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.candidateId).toBe("123e4567-e89b-42d3-a456-426614174000");

    const missing = resolveSetupStudioKnowledgeCandidateAction({
      item: {},
      visibleKnowledgeItems: [],
      pickKnowledgeCandidateId: vi.fn(),
    });

    expect(missing.ok).toBe(false);
    expect(missing.error).toMatch(/review candidate uuid/i);
  });

  it("shapes post-refresh reveal decisions for approve and reject flows", () => {
    expect(
      applyPostApproveKnowledgeRefresh({
        snapshot: { meta: { nextStudioStage: "identity" } },
      })
    ).toEqual({ closeKnowledge: true });

    expect(
      applyPostRejectKnowledgeRefresh({
        snapshot: { meta: { pendingCandidateCount: 0 } },
      })
    ).toEqual({ closeKnowledge: true });
  });

  it("runs candidate mutation, reload, refresh, and after-refresh coordination", async () => {
    const setFreshEntryMode = vi.fn();
    const setActingKnowledgeId = vi.fn();
    const setError = vi.fn();
    const loadCurrentReview = vi.fn().mockResolvedValue({});
    const refreshAndMaybeRouteHome = vi.fn().mockResolvedValue({
      routed: false,
      snapshot: { meta: { nextStudioStage: "knowledge" } },
    });
    const mutateCandidate = vi.fn().mockResolvedValue({});
    const afterRefresh = vi.fn();

    const result = await runSetupStudioKnowledgeCandidateMutation({
      item: {
        candidateUuid: "123e4567-e89b-42d3-a456-426614174000",
      },
      actionLabel: "Candidate could not be approved.",
      visibleKnowledgeItems: [],
      pickKnowledgeCandidateId: vi.fn(),
      activeSourceScope: {
        sourceType: "website",
        sourceUrl: "https://acme.example",
      },
      setFreshEntryMode,
      setActingKnowledgeId,
      setError,
      loadCurrentReview,
      refreshAndMaybeRouteHome,
      mutateCandidate,
      afterRefresh,
    });

    expect(result).toEqual({ ok: true });
    expect(setFreshEntryMode).toHaveBeenCalledWith(false);
    expect(setActingKnowledgeId).toHaveBeenCalledWith(
      "123e4567-e89b-42d3-a456-426614174000"
    );
    expect(mutateCandidate).toHaveBeenCalledWith(
      "123e4567-e89b-42d3-a456-426614174000"
    );
    expect(loadCurrentReview).toHaveBeenCalledWith({
      preserveBusinessForm: true,
      activateReviewSession: true,
      activeSourceType: "website",
      activeSourceUrl: "https://acme.example",
    });
    expect(refreshAndMaybeRouteHome).toHaveBeenCalledWith({
      preserveBusinessForm: true,
      hydrateReview: true,
      activeSourceType: "website",
      activeSourceUrl: "https://acme.example",
    });
    expect(afterRefresh).toHaveBeenCalledTimes(1);
    expect(setActingKnowledgeId).toHaveBeenLastCalledWith("");
  });

  it("runs suggested service creation with refresh and fail-soft error shaping", async () => {
    const setFreshEntryMode = vi.fn();
    const setSavingServiceSuggestion = vi.fn();
    const setError = vi.fn();
    const createService = vi.fn().mockResolvedValue({});
    const refreshAndMaybeRouteHome = vi.fn().mockResolvedValue({});

    const result = await runSetupStudioSuggestedServiceCreation({
      actionLabel: "Suggested service could not be created.",
      activeSourceScope: {
        sourceType: "website",
        sourceUrl: "https://acme.example",
      },
      setFreshEntryMode,
      setSavingServiceSuggestion,
      setError,
      createService,
      refreshAndMaybeRouteHome,
    });

    expect(result).toEqual({ ok: true });
    expect(setSavingServiceSuggestion).toHaveBeenCalledWith("creating");
    expect(createService).toHaveBeenCalledTimes(1);
    expect(refreshAndMaybeRouteHome).toHaveBeenCalledWith({
      preserveBusinessForm: true,
      hydrateReview: true,
      activeSourceType: "website",
      activeSourceUrl: "https://acme.example",
    });
    expect(setSavingServiceSuggestion).toHaveBeenLastCalledWith("");
  });
});
