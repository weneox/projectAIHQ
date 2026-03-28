import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../api/settings.js", () => ({
  listSettingsSources: vi.fn(),
  createSettingsSource: vi.fn(),
  updateSettingsSource: vi.fn(),
  getSettingsSourceSyncRuns: vi.fn(),
  startSettingsSourceSync: vi.fn(),
}));

vi.mock("../../../api/truth.js", () => ({
  getTruthReviewWorkbench: vi.fn(),
  approveTruthReviewCandidate: vi.fn(),
  rejectTruthReviewCandidate: vi.fn(),
  markTruthReviewCandidateForFollowUp: vi.fn(),
  keepTruthReviewCandidateQuarantined: vi.fn(),
}));

import {
  createSettingsSource,
  listSettingsSources,
} from "../../../api/settings.js";
import { getTruthReviewWorkbench } from "../../../api/truth.js";
import { useSourceIntelligence } from "./useSourceIntelligence.js";

describe("useSourceIntelligence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes the unified surface contract on refresh", async () => {
    listSettingsSources.mockResolvedValue({ items: [{ id: "source-1" }] });
    getTruthReviewWorkbench.mockResolvedValue({
      summary: {
        total: 1,
      },
      items: [{ id: "candidate-1" }],
    });

    const { result } = renderHook(() =>
      useSourceIntelligence({
        tenantKey: "tenant-a",
        canManageSettings: true,
        setWorkspace: vi.fn(),
        setInitialWorkspace: vi.fn(),
        onRefreshBusinessBrain: vi.fn(),
        onRefreshTrust: vi.fn(),
      })
    );

    await result.current.refreshSourceIntelligence();

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
    });

    expect(result.current.sources).toHaveLength(1);
    expect(result.current.knowledgeReview).toHaveLength(1);
    expect(result.current.knowledgeReviewSummary.total).toBe(1);
    expect(typeof result.current.surface.refresh).toBe("function");
  });

  it("uses the shared save-state vocabulary for source saves", async () => {
    listSettingsSources.mockResolvedValue({ items: [] });
    getTruthReviewWorkbench.mockResolvedValue({ summary: {}, items: [] });
    createSettingsSource.mockResolvedValue({ ok: true });

    const { result } = renderHook(() =>
      useSourceIntelligence({
        tenantKey: "tenant-a",
        canManageSettings: true,
        setWorkspace: vi.fn(),
        setInitialWorkspace: vi.fn(),
        onRefreshBusinessBrain: vi.fn(),
        onRefreshTrust: vi.fn(),
      })
    );

    await result.current.handleSaveSource({
      source_type: "website",
      display_name: "Main Website",
    });

    await waitFor(() => {
      expect(result.current.surface.saveSuccess).toMatch(/source added/i);
    });
  });
});
