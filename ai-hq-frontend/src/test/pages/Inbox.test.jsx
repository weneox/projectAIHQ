import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useInboxData = vi.fn();
const useInboxRealtime = vi.fn();
const useInboxThreadListSurface = vi.fn();
const getAppSessionContext = vi.fn();
const useInboxComposerSurface = vi.fn();
const useThreadOutboundAttemptsSurface = vi.fn();
const useWorkspaceTenantKey = vi.fn();
const getLaunchPosture = vi.fn();
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

vi.mock("../../api/launch.js", () => ({
  getLaunchPosture: (...args) => getLaunchPosture(...args),
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
  default: ({ selectedThreadId, launchChannelConnected }) => (
    <section aria-label="Thread list panel">
      <h2>All conversations</h2>
      <div>selected-thread:{selectedThreadId || "none"}</div>
      <div>
        launch-channel-connected:{launchChannelConnected ? "yes" : "no"}
      </div>
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

function buildLaunchPosture({
  truthReady = true,
  runtimeReady = true,
  readyChannelIds = [],
  connectedChannelIds = readyChannelIds,
  overall = {},
} = {}) {
  const channelLabels = {
    website: "Website chat",
    instagram: "Instagram",
    telegram: "Telegram",
  };
  const channelKinds = {
    website: "website_chat",
    instagram: "instagram_dm",
    telegram: "telegram_private_bot_chat",
  };
  const channels = Object.fromEntries(
    ["website", "instagram", "telegram"].map((id) => {
      const deliveryReady = readyChannelIds.includes(id);
      const connected = deliveryReady || connectedChannelIds.includes(id);
      let status = "not_connected";
      if (deliveryReady) {
        status = "ready";
      } else if (connected) {
        status = "connected_blocked";
      }

      return [
        id,
        {
          id,
          label: channelLabels[id],
          kind: channelKinds[id],
          status,
          connected,
          deliveryReady,
          available: true,
          reasonCode: deliveryReady ? "" : "channel_not_delivery_ready",
          account: null,
          readiness: {
            status: deliveryReady ? "ready" : "blocked",
            message: deliveryReady
              ? "Channel is ready for live delivery."
              : "Channel is not ready for live delivery.",
          },
          blockers: deliveryReady
            ? []
            : [{ reasonCode: "channel_not_delivery_ready" }],
          repairActions: deliveryReady
            ? []
            : [{ label: "Open channels", path: "/channels" }],
          capabilities: {
            inbound: true,
            outbound: true,
          },
        },
      ];
    })
  );
  const launchReady =
    truthReady === true && runtimeReady === true && readyChannelIds.length > 0;

  return {
    ok: true,
    version: "launch_posture_v1",
    generatedAt: "2026-04-29T10:00:00.000Z",
    tenant: {
      id: "tenant-1",
      tenantKey: "acme",
    },
    scope: {
      id: "aihq_launch_v1_narrow",
      surfaces: [
        "home",
        "channels",
        "truth",
        "inbox",
        "website_chat",
        "instagram_dm",
        "telegram_private_bot_chat",
      ],
    },
    overall: {
      status: launchReady ? "ready" : "blocked",
      launchReady,
      title: launchReady ? "Launch posture ready" : "Launch channel required",
      message: launchReady
        ? "Approved business info, runtime, channel delivery, and inbox are ready."
        : "Connect a launch channel before relying on live inbox replies.",
      primaryAction: launchReady
        ? { label: "Open inbox", path: "/inbox" }
        : { label: "Open channels", path: "/channels" },
      secondaryAction: { label: "Open truth", path: "/truth" },
      ...overall,
    },
    truth: {
      ready: truthReady,
      status: truthReady ? "ready" : "blocked",
      reasonCode: truthReady ? "" : "approved_truth_unavailable",
      message: truthReady
        ? "Approved truth is ready."
        : "Approved truth is not ready yet.",
      latestVersionId: truthReady ? "truth_v_123" : "",
    },
    runtime: {
      ready: runtimeReady,
      status: runtimeReady ? "ready" : "blocked",
      reasonCode: runtimeReady ? "" : "runtime_repair_required",
      message: runtimeReady
        ? "Runtime projection is ready."
        : "Runtime projection still needs repair.",
    },
    channels,
    channelSummary: {
      readyCount: readyChannelIds.length,
      connectedCount: connectedChannelIds.length,
      deliveryReadyChannelIds: readyChannelIds,
      selectedChannelId: readyChannelIds[0] || "",
    },
    inbox: {
      available: true,
      unreadCount: 0,
      openCount: 0,
      handoffCount: 0,
      assignedOpenCount: 0,
      pendingOutboundCount: 0,
      failedOutboundCount: 0,
      retryingOutboundCount: 0,
    },
    blockers: [],
    repairActions: [],
    unavailable: [],
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

    getLaunchPosture.mockResolvedValue(
      buildLaunchPosture({
        truthReady: true,
        runtimeReady: true,
        readyChannelIds: [],
        overall: {
          status: "blocked",
          launchReady: false,
          title: "Launch channel required",
          message:
            "Connect a launch channel before relying on live inbox replies.",
          primaryAction: { label: "Open channels", path: "/channels" },
        },
      })
    );
    getSettingsTrustView.mockResolvedValue(buildTrustView({ status: "ready" }));
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

  it("keeps the launch readiness banner hidden when no launch channel is connected", async () => {
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
      screen.getByText(/automation-status:\s*AI ON/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/launch channel required/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open channels/i })).not.toBeInTheDocument();
    expect(screen.getByText(/launch-channel-connected:no/i)).toBeInTheDocument();
    expect(screen.getByText(/selected-thread:none/i)).toBeInTheDocument();
    expect(screen.getByText(/selected-thread-name:none/i)).toBeInTheDocument();

    expect(getLaunchPosture).toHaveBeenCalledTimes(1);
    expect(getMetaChannelStatus).not.toHaveBeenCalled();
    expect(getTelegramChannelStatus).not.toHaveBeenCalled();
    expect(getWebsiteWidgetStatus).not.toHaveBeenCalled();
  });

  it("keeps the launch readiness banner hidden when truth is not ready", async () => {
    getLaunchPosture.mockResolvedValue(
      buildLaunchPosture({
        truthReady: false,
        runtimeReady: true,
        readyChannelIds: ["instagram"],
        overall: {
          status: "blocked",
          launchReady: false,
          title: "Approved truth required",
          message: "Approve truth before live replies are trusted.",
          primaryAction: { label: "Open setup", path: "/home?assistant=setup" },
        },
      })
    );

    renderInbox();

    await waitFor(() => {
      expect(getLaunchPosture).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(getLaunchPosture).toHaveBeenCalled();
    });
    expect(screen.queryByText(/truth approval required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/approve truth before trusting live ai replies/i)).not.toBeInTheDocument();
    expect(screen.getByText(/launch-channel-connected:yes/i)).toBeInTheDocument();
    expect(getMetaChannelStatus).not.toHaveBeenCalled();
    expect(getTelegramChannelStatus).not.toHaveBeenCalled();
    expect(getWebsiteWidgetStatus).not.toHaveBeenCalled();
  });

  it("keeps the launch readiness banner hidden while trust policy is still loading", async () => {
    let resolveTrustView;

    getSettingsTrustView.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTrustView = resolve;
        })
    );
    getLaunchPosture.mockResolvedValue(
      buildLaunchPosture({
        truthReady: false,
        runtimeReady: true,
        readyChannelIds: ["telegram"],
        overall: {
          status: "blocked",
          launchReady: false,
          title: "Approved truth required",
          message: "Approve truth before live replies are trusted.",
          primaryAction: { label: "Open setup", path: "/home?assistant=setup" },
        },
      })
    );

    renderInbox();
    await waitFor(() => {
      expect(getLaunchPosture).toHaveBeenCalled();
    });
    expect(screen.queryByText(/truth approval required/i)).not.toBeInTheDocument();

    expect(getLaunchPosture).toHaveBeenCalledTimes(1);
    expect(getSettingsTrustView).toHaveBeenCalledTimes(1);
    expect(getMetaChannelStatus).not.toHaveBeenCalled();
    expect(getTelegramChannelStatus).not.toHaveBeenCalled();
    expect(getWebsiteWidgetStatus).not.toHaveBeenCalled();

    await act(async () => {
      resolveTrustView(buildTrustView({ status: "ready" }));
    });
  });

  it("uses launch posture instead of trust view for the truth approval notice", async () => {
    getSettingsTrustView.mockResolvedValue(
      buildTrustView({
        status: "blocked",
      })
    );
    getLaunchPosture.mockResolvedValue(
      buildLaunchPosture({
        truthReady: true,
        runtimeReady: true,
        readyChannelIds: ["website"],
      })
    );

    renderInbox();

    await waitFor(() => {
      expect(getLaunchPosture).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(
        screen.queryByText(/truth approval required/i)
      ).not.toBeInTheDocument();
    });
    expect(
      screen.queryByText(/launch channel required/i)
    ).not.toBeInTheDocument();
    expect(screen.getByText(/launch-channel-connected:yes/i)).toBeInTheDocument();
    expect(getSettingsTrustView).toHaveBeenCalled();
    expect(getLaunchPosture).toHaveBeenCalledTimes(1);
    expect(getMetaChannelStatus).not.toHaveBeenCalled();
    expect(getTelegramChannelStatus).not.toHaveBeenCalled();
    expect(getWebsiteWidgetStatus).not.toHaveBeenCalled();
  });

  it("keeps the launch readiness banner hidden when launch posture cannot be loaded", async () => {
    getLaunchPosture.mockRejectedValue(new Error("posture unavailable"));

    renderInbox();
    await waitFor(() => {
      expect(getLaunchPosture).toHaveBeenCalled();
    });
    expect(
      await screen.findByText(/launch-channel-connected:no/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/launch readiness unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/posture unavailable/i)).not.toBeInTheDocument();
    expect(getMetaChannelStatus).not.toHaveBeenCalled();
    expect(getTelegramChannelStatus).not.toHaveBeenCalled();
    expect(getWebsiteWidgetStatus).not.toHaveBeenCalled();
  });
});

