import { StrictMode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAppSessionContext = vi.fn();
const getAppBootstrap = vi.fn();
const getSetupOverview = vi.fn();
const getSettingsTrustView = vi.fn();
const getTruthReviewWorkbench = vi.fn();
const listInboxThreads = vi.fn();
const getOutboundSummary = vi.fn();
const listComments = vi.fn();
const buildCapabilitySystemSignals = vi.fn();
const buildInboxSystemSignals = vi.fn();
const buildPublishSystemSignals = vi.fn();
const buildSetupSystemSignals = vi.fn();
const buildTruthSystemSignals = vi.fn();
const buildWorkspaceSuggestedActions = vi.fn();
const buildWorkspaceBusinessMemory = vi.fn();

vi.mock("../../lib/appSession.js", () => ({
  getAppSessionContext: (...args) => getAppSessionContext(...args),
}));

vi.mock("../../api/app.js", () => ({
  getAppBootstrap: (...args) => getAppBootstrap(...args),
}));

vi.mock("../../api/setup.js", () => ({
  getSetupOverview: (...args) => getSetupOverview(...args),
}));

vi.mock("../../api/trust.js", () => ({
  getSettingsTrustView: (...args) => getSettingsTrustView(...args),
}));

vi.mock("../../api/truth.js", () => ({
  getTruthReviewWorkbench: (...args) => getTruthReviewWorkbench(...args),
}));

vi.mock("../../api/inbox.js", () => ({
  listInboxThreads: (...args) => listInboxThreads(...args),
  getOutboundSummary: (...args) => getOutboundSummary(...args),
}));

vi.mock("../../api/comments.js", () => ({
  listComments: (...args) => listComments(...args),
}));

vi.mock("../../orchestration/contracts/index.js", () => ({
  dedupeNarrationItems: (items) => items,
  signalsToNarrationItems: (items) => items,
  sortByPriorityAndTime: (items) => items,
}));

vi.mock("../../orchestration/adapters/index.js", () => ({
  buildCapabilitySystemSignals: (...args) => buildCapabilitySystemSignals(...args),
  buildInboxSystemSignals: (...args) => buildInboxSystemSignals(...args),
  buildPublishSystemSignals: (...args) => buildPublishSystemSignals(...args),
  buildSetupSystemSignals: (...args) => buildSetupSystemSignals(...args),
  buildTruthSystemSignals: (...args) => buildTruthSystemSignals(...args),
}));

vi.mock("../../view-models/workspaceBusinessMemory.js", () => ({
  buildWorkspaceBusinessMemory: (...args) => buildWorkspaceBusinessMemory(...args),
}));

vi.mock("../../view-models/workspaceIntents.js", () => ({
  buildWorkspaceSuggestedActions: (...args) => buildWorkspaceSuggestedActions(...args),
}));

vi.mock("../../view-models/workspaceRouteMap.js", () => ({
  applyWorkspaceRouteMap: (item) => item,
}));

import useWorkspaceNarration from "../../view-models/useWorkspaceNarration.js";

function createWrapper({ strict = false } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }) {
    const content = (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return strict ? <StrictMode>{content}</StrictMode> : content;
  };
}

describe("useWorkspaceNarration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAppSessionContext.mockResolvedValue({
      bootstrap: { workspace: { tenantKey: "acme" } },
    });
    getAppBootstrap.mockResolvedValue({ workspace: { tenantKey: "acme" } });
    getSetupOverview.mockResolvedValue({});
    getSettingsTrustView.mockResolvedValue({});
    getTruthReviewWorkbench.mockResolvedValue({ items: [] });
    listInboxThreads.mockResolvedValue({ threads: [] });
    getOutboundSummary.mockResolvedValue({ summary: {} });
    listComments.mockResolvedValue({ comments: [] });
    buildCapabilitySystemSignals.mockReturnValue([]);
    buildInboxSystemSignals.mockReturnValue([]);
    buildPublishSystemSignals.mockReturnValue([]);
    buildSetupSystemSignals.mockReturnValue([]);
    buildTruthSystemSignals.mockReturnValue([]);
    buildWorkspaceSuggestedActions.mockReturnValue([]);
    buildWorkspaceBusinessMemory.mockReturnValue({ visible: false, stats: {} });
  });

  it("dedupes the workspace load batch under StrictMode and reuses session bootstrap", async () => {
    const wrapper = createWrapper({ strict: true });
    const { result } = renderHook(() => useWorkspaceNarration(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(getAppSessionContext).toHaveBeenCalledTimes(1);
    expect(getAppBootstrap).not.toHaveBeenCalled();
    expect(getSetupOverview).toHaveBeenCalledTimes(1);
    expect(getSettingsTrustView).toHaveBeenCalledTimes(1);
    expect(getTruthReviewWorkbench).toHaveBeenCalledTimes(1);
    expect(listInboxThreads).toHaveBeenCalledTimes(1);
    expect(getOutboundSummary).toHaveBeenCalledTimes(1);
    expect(listComments).toHaveBeenCalledTimes(1);
  });

  it("suppresses generic continue-setup actions when setup signal is unavailable", async () => {
    getAppSessionContext.mockResolvedValue(null);
    getAppBootstrap.mockRejectedValue(new Error("bootstrap unavailable"));
    getSetupOverview.mockRejectedValue(new Error("setup unavailable"));

    const { result } = renderHook(() => useWorkspaceNarration(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.setupState.status).toBe("unavailable");
    expect(result.current.actionItems.some((item) => item.id === "setup-state")).toBe(false);
    expect(
      result.current.postureItems.find((item) => item.id === "posture-setup")?.status
    ).toBe("unavailable");
    expect(
      result.current.suggestedActions.some((item) => item.id === "continue-setup")
    ).toBe(false);
  });

  it("uses one authoritative setup action even when setup narration also exists", async () => {
    getAppSessionContext.mockResolvedValue(null);
    getAppBootstrap.mockResolvedValue({
      workspace: {
        setupCompleted: false,
        primaryMissingStep: "hours",
      },
    });
    getSetupOverview.mockResolvedValue({
      progress: {
        setupCompleted: false,
        primaryMissingStep: "hours",
      },
    });
    buildSetupSystemSignals.mockReturnValue([
      {
        id: "setup-narration",
        kind: "recommended_action",
        relatedCapability: "setup_intake",
        requiresHuman: true,
        priority: "high",
        whatHappened: "Finish setup intake",
        title: "Finish setup intake",
        nextAction: {
          label: "Continue setup",
          path: "/home?assistant=setup",
        },
      },
    ]);

    const { result } = renderHook(() => useWorkspaceNarration(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.setupState.status).toBe("ready_to_continue");
    expect(
      result.current.actionItems.filter((item) => item.id === "setup-state")
    ).toHaveLength(1);
    expect(
      result.current.actionItems.some((item) => item.title === "Finish setup intake")
    ).toBe(false);
    expect(
      result.current.postureItems.find((item) => item.id === "posture-setup")?.status
    ).toBe("ready_to_continue");
  });

  it("treats business memory as partial when review work is available but trust snapshot is unavailable", async () => {
    getSettingsTrustView.mockRejectedValue(new Error("trust unavailable"));
    getTruthReviewWorkbench.mockResolvedValue({
      items: [{ id: "candidate-1", title: "Weekend hours changed" }],
    });
    buildWorkspaceBusinessMemory.mockReturnValue({
      visible: true,
      mayHaveChanged: "1 proposed business change is waiting.",
      needsConfirmation: "1 item still needs human confirmation.",
      recentlyReliable: "",
      currentKnown: "",
      blocked: "",
      stats: {
        approvedVersionId: "",
        pendingCount: 1,
        blockerCount: 0,
      },
      primaryAction: {
        label: "Open business changes review",
        path: "/truth",
      },
    });

    const { result } = renderHook(() => useWorkspaceNarration(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.domainStates.business_memory.status).toBe("limited");
    expect(result.current.domainStates.business_memory.statusLabel).toBe("Review available");
    expect(result.current.availabilityNotice.title).toBe("Workspace is showing partial signal");
    expect(result.current.availabilityNotice.description).toMatch(/business memory is partially available/i);
    expect(
      result.current.actionItems.find((item) => item.id === "business-memory-review")?.title
    ).toBe("Review business changes.");
    expect(
      result.current.postureItems.find((item) => item.id === "posture-business_memory")?.status
    ).toBe("limited");
  });

  it("builds a useful recent-outcomes fallback from live review data", async () => {
    getTruthReviewWorkbench.mockResolvedValue({
      items: [{ id: "candidate-1", title: "Holiday hours changed" }],
    });

    const { result } = renderHook(() => useWorkspaceNarration(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.outcomeItems[0]?.title).toBe("Business review queue changed.");
    expect(result.current.outcomeItems[0]?.summary).toMatch(/holiday hours changed/i);
  });
});
