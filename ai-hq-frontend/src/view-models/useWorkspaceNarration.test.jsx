import { StrictMode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAppSessionContext = vi.fn();
const getAppBootstrap = vi.fn();
const getSetupOverview = vi.fn();
const getSettingsTrustView = vi.fn();
const getTruthReviewWorkbench = vi.fn();
const listInboxThreads = vi.fn();
const getOutboundSummary = vi.fn();
const listComments = vi.fn();

vi.mock("../lib/appSession.js", () => ({
  getAppSessionContext: (...args) => getAppSessionContext(...args),
}));

vi.mock("../api/app.js", () => ({
  getAppBootstrap: (...args) => getAppBootstrap(...args),
}));

vi.mock("../api/setup.js", () => ({
  getSetupOverview: (...args) => getSetupOverview(...args),
}));

vi.mock("../api/trust.js", () => ({
  getSettingsTrustView: (...args) => getSettingsTrustView(...args),
}));

vi.mock("../api/truth.js", () => ({
  getTruthReviewWorkbench: (...args) => getTruthReviewWorkbench(...args),
}));

vi.mock("../api/inbox.js", () => ({
  listInboxThreads: (...args) => listInboxThreads(...args),
  getOutboundSummary: (...args) => getOutboundSummary(...args),
}));

vi.mock("../api/comments.js", () => ({
  listComments: (...args) => listComments(...args),
}));

vi.mock("../orchestration/contracts/index.js", () => ({
  dedupeNarrationItems: (items) => items,
  signalsToNarrationItems: (items) => items,
  sortByPriorityAndTime: (items) => items,
}));

vi.mock("../orchestration/adapters/index.js", () => ({
  buildCapabilitySystemSignals: () => [],
  buildInboxSystemSignals: () => [],
  buildPublishSystemSignals: () => [],
  buildSetupSystemSignals: () => [],
  buildTruthSystemSignals: () => [],
}));

vi.mock("./workspaceSetupGuidance.js", () => ({
  buildWorkspaceSetupGuidance: () => ({ visible: false }),
}));

vi.mock("./workspaceBusinessMemory.js", () => ({
  buildWorkspaceBusinessMemory: () => ({ visible: false }),
}));

vi.mock("./workspaceIntents.js", () => ({
  buildWorkspaceSuggestedActions: () => [],
}));

vi.mock("./workspaceRouteMap.js", () => ({
  applyWorkspaceRouteMap: (item) => item,
}));

import useWorkspaceNarration from "./useWorkspaceNarration.js";

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
  });

  it("dedupes the workspace load batch under StrictMode and reuses session bootstrap", async () => {
    const wrapper = ({ children }) => <StrictMode>{children}</StrictMode>;
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
});
