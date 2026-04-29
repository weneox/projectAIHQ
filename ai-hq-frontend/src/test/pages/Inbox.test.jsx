import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useInboxData = vi.fn();
const useInboxRealtime = vi.fn();
const useInboxThreadListSurface = vi.fn();
const getAppSessionContext = vi.fn();
const useInboxComposerSurface = vi.fn();
const useThreadOutboundAttemptsSurface = vi.fn();
const useWorkspaceTenantKey = vi.fn();
const getSettingsTrustView = vi.fn();
const saveSettingsTrustPolicyControl = vi.fn();
const getMetaChannelStatus = vi.fn();
const getTelegramChannelStatus = vi.fn();
const getWebsiteWidgetStatus = vi.fn();

vi.mock("../../hooks/useInboxData.js", () => ({
  useInboxData: (...args) => useInboxData(...args),
}));

vi.mock("../../components/inbox/hooks/useInboxThreadListSurface.js", () => ({
  useInboxThreadListSurface: (...args) => useInboxThreadListSurface(...args),
}));

vi.mock("../../components/inbox/hooks/useInboxComposerSurface.js", () => ({
  useInboxComposerSurface: (...args) => useInboxComposerSurface(...args),
}));

vi.mock("../../components/inbox/hooks/useThreadOutboundAttemptsSurface.js", () => ({
  useThreadOutboundAttemptsSurface: (...args) =>
    useThreadOutboundAttemptsSurface(...args),
}));

vi.mock("../../hooks/useInboxRealtime.js", () => ({
  useInboxRealtime: (...args) => useInboxRealtime(...args),
}));

vi.mock("../../hooks/useWorkspaceTenantKey.js", () => ({
  default: (...args) => useWorkspaceTenantKey(...args),
  useWorkspaceTenantKey: (...args) => useWorkspaceTenantKey(...args),
}));

vi.mock("../../lib/appSession.js", () => ({
  getAppSessionContext: (...args) => getAppSessionContext(...args),
}));

vi.mock("../../api/trust.js", () => ({
  getSettingsTrustView: (...args) => getSettingsTrustView(...args),
  saveSettingsTrustPolicyControl: (...args) =>
    saveSettingsTrustPolicyControl(...args),
}));

vi.mock("../../api/channelConnect.js", () => ({
  getMetaChannelStatus: (...args) => getMetaChannelStatus(...args),
  getTelegramChannelStatus: (...args) => getTelegramChannelStatus(...args),
  getWebsiteWidgetStatus: (...args) => getWebsiteWidgetStatus(...args),
}));

vi.mock("../../components/inbox/InboxThreadListPanel.jsx", () => ({
  default: ({ selectedThreadId }) => (
    <section aria-label="Thread list panel">
      <h2>All conversations</h2>
      <div>selected-thread:{selectedThreadId || "none"}</div>
    </section>
  ),
}));

vi.mock("../../components/inbox/InboxDetailPanel.jsx", () => ({
  default: ({ selectedThread, composer, automationControl }) => (
    <section aria-label="Inbox detail panel">
      <div>
        selected-thread-name:
        {selectedThread?.customer_name ||
          selectedThread?.external_username ||
          "none"}
      </div>
      <div>automation-status:{automationControl?.statusLabel || "unknown"}</div>
      {composer}
    </section>
  ),
}));

vi.mock("../../components/inbox/InboxLeadPanel.jsx", () => ({
  default: () => <section aria-label="Inbox lead panel">Lead panel</section>,
}));

vi.mock("../../components/inbox/InboxComposer.jsx", () => ({
  default: ({ replyText }) => (
    <div aria-label="Inbox composer">composer:{replyText || ""}</div>
  ),
}));

import Inbox from "../../pages/Inbox.jsx";

function renderInbox() {
  return render(
    <MemoryRouter initialEntries={["/inbox"]}>
      <Inbox />
    </MemoryRouter>
  );
}

function buildTrustView({
  status = "blocked",
  controlMode = "autonomy_enabled",
} = {}) {
  const ready = String(status || "").trim().toLowerCase() === "ready";

  return {
    summary: {
      truth: {
        latestVersionId: ready ? "truth_v_123" : "",
        readiness: {
          status: ready ? "ready" : "blocked",
          reasonCode: ready ? "" : "approved_truth_unavailable",
          message: ready
            ? "Approved truth is ready."
            : "Approved truth is not ready yet.",
          blockers: ready
            ? []
            : [
                {
                  blocked: true,
                  title: "Approval required",
                  subtitle: "Approved truth is not ready yet.",
                  reasonCode: "approved_truth_unavailable",
                },
              ],
        },
      },
      runtimeProjection: {
        readiness: {
          status: ready ? "ready" : "blocked",
          reasonCode: ready ? "" : "runtime_repair_required",
          message: ready
            ? "Runtime projection is ready."
            : "Runtime projection still needs repair.",
          blockers: ready
            ? []
            : [
                {
                  blocked: true,
                  title: "Runtime repair required",
                  subtitle: "Runtime projection still needs repair.",
                  reasonCode: "runtime_repair_required",
                },
              ],
        },
        health: {
          usable: ready,
          autonomousAllowed: ready,
          reasonCode: ready ? "" : "runtime_repair_required",
          lastFailure: ready
            ? null
            : {
                errorCode: "runtime_repair_required",
                errorMessage: "Runtime projection still needs repair.",
              },
        },
        authority: {
          available: ready,
          runtimeProjectionId: ready ? "runtime_proj_123" : "",
        },
      },
      policyControls: {
        tenantDefault: {
          controlMode,
          availableModes: [
            { mode: "autonomy_enabled", allowed: true },
            { mode: "operator_only_mode", allowed: true },
          ],
        },
        items: [],
      },
    },
  };
}

function buildConnectedMetaStatus() {
  return {
    connected: true,
    state: "connected",
    runtime: {
      deliveryReady: true,
    },
    readiness: {
      status: "ready",
      message: "Instagram inbox is ready.",
      blockers: [],
    },
  };
}

describe("Inbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useWorkspaceTenantKey.mockReturnValue({
      tenantKey: "acme",
      loading: false,
      ready: true,
    });

    getAppSessionContext.mockResolvedValue({
      tenantKey: "acme",
      actorName: "operator",
    });

    getSettingsTrustView.mockRejectedValue(new Error("truth unavailable"));
    getMetaChannelStatus.mockRejectedValue(new Error("meta unavailable"));
    getTelegramChannelStatus.mockRejectedValue(
      new Error("telegram unavailable")
    );
    getWebsiteWidgetStatus.mockRejectedValue(new Error("website unavailable"));

    useInboxRealtime.mockReturnValue(undefined);

    useInboxThreadListSurface.mockReturnValue({
      filter: "all",
      setFilter: vi.fn(),
      deepLinkNotice: "",
      filteredThreads: [],
      openThread: vi.fn(),
      surface: {
        loading: false,
        error: "",
        unavailable: true,
        ready: false,
        refresh: vi.fn(),
      },
    });

    useInboxComposerSurface.mockReturnValue({
      replyText: "",
      setReplyText: vi.fn(),
      composerSurface: {
        loading: false,
        error: "",
        unavailable: false,
        ready: false,
        saving: false,
        saveError: "",
        saveSuccess: "",
        refresh: vi.fn(),
      },
      handleSend: vi.fn(),
      handleRelease: vi.fn(),
    });

    useThreadOutboundAttemptsSurface.mockReturnValue({
      attempts: [],
      surface: {
        loading: false,
        error: "",
        unavailable: false,
        ready: true,
        saving: false,
        saveError: "",
        saveSuccess: "",
        refresh: vi.fn(),
      },
      actionState: {
        isActionPending: vi.fn().mockReturnValue(false),
      },
      handleResend: vi.fn(),
      handleMarkDead: vi.fn(),
    });

    useInboxData.mockReturnValue({
      threads: [],
      setThreads: vi.fn(),
      messages: [],
      setMessages: vi.fn(),
      selectedThread: null,
      setSelectedThread: vi.fn(),
      relatedLead: null,
      setRelatedLead: vi.fn(),
      surface: {
        loading: false,
        error: "",
        unavailable: true,
        ready: false,
        saving: false,
        saveError: "",
        saveSuccess: "Reply accepted.",
        refresh: vi.fn(),
      },
      detailSurface: {
        loading: false,
        error: "",
        unavailable: false,
        ready: true,
        saving: false,
        saveError: "",
        saveSuccess: "",
        refresh: vi.fn(),
      },
      leadSurface: {
        loading: false,
        error: "",
        unavailable: false,
        ready: true,
        saving: false,
        saveError: "",
        saveSuccess: "",
        refresh: vi.fn(),
      },
      actionState: {
        isActionPending: vi.fn().mockReturnValue(false),
      },
      loadThreads: vi.fn(),
      loadThreadDetail: vi.fn(),
      loadMessages: vi.fn(),
      loadRelatedLead: vi.fn(),
      markRead: vi.fn(),
      assignThread: vi.fn(),
      activateHandoff: vi.fn(),
      releaseHandoff: vi.fn(),
      setThreadStatus: vi.fn(),
      sendOperatorReply: vi.fn(),
    });
  });

  it("renders the launch prompt when no launch channel is connected", async () => {
    renderInbox();

    expect(
      await screen.findByText(/inbox operations are temporarily unavailable/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /all conversations/i })
    ).toBeInTheDocument();

    expect(screen.getByLabelText(/thread list panel/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/inbox detail panel/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/inbox composer/i)).toBeInTheDocument();

    expect(
      screen.getByText(/automation-status:autonomy enabled/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/selected-thread:none/i)).toBeInTheDocument();
    expect(screen.getByText(/selected-thread-name:none/i)).toBeInTheDocument();
  });

  it("shows truth approval notice when a launch channel is connected but truth is not ready", async () => {
    getMetaChannelStatus.mockResolvedValue(buildConnectedMetaStatus());
    getTelegramChannelStatus.mockResolvedValue({ state: "disconnected" });
    getWebsiteWidgetStatus.mockResolvedValue({ state: "not_connected" });
    getSettingsTrustView.mockResolvedValue(
      buildTrustView({
        status: "blocked",
      })
    );

    renderInbox();

    await waitFor(() => {
      expect(getSettingsTrustView).toHaveBeenCalled();
    });

    expect(
      await screen.findByText(/truth approval required/i)
    ).toBeInTheDocument();

    expect(
      await screen.findByText(
        /a channel is live, but approved truth is not ready yet\. approve truth before trusting live ai replies\./i
      )
    ).toBeInTheDocument();
  });

  it("does not show the truth approval notice when a launch channel is connected and truth is ready", async () => {
    getMetaChannelStatus.mockResolvedValue(buildConnectedMetaStatus());
    getTelegramChannelStatus.mockResolvedValue({ state: "disconnected" });
    getWebsiteWidgetStatus.mockResolvedValue({ state: "not_connected" });
    getSettingsTrustView.mockResolvedValue(
      buildTrustView({
        status: "ready",
      })
    );

    renderInbox();

    await waitFor(() => {
      expect(getSettingsTrustView).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(
        screen.queryByText(/truth approval required/i)
      ).not.toBeInTheDocument();
    });
  });
});
