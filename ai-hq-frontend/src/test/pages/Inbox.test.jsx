import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useInboxData = vi.fn();
const useInboxRealtime = vi.fn();
const useInboxThreadListSurface = vi.fn();
const getAppSessionContext = vi.fn();
const areInternalRoutesEnabled = vi.fn();
const useInboxComposerSurface = vi.fn();
const useThreadOutboundAttemptsSurface = vi.fn();
const useWorkspaceTenantKey = vi.fn();
const getSettingsTrustView = vi.fn();
const getMetaChannelStatus = vi.fn();
const getTelegramChannelStatus = vi.fn();
const getWebsiteWidgetStatus = vi.fn();
const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      pathname: "/inbox",
      search: "",
      hash: "",
      state: null,
      key: "test",
    }),
    useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
  };
});

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
  useThreadOutboundAttemptsSurface: (...args) => useThreadOutboundAttemptsSurface(...args),
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
}));

vi.mock("../../api/channelConnect.js", () => ({
  getMetaChannelStatus: (...args) => getMetaChannelStatus(...args),
  getTelegramChannelStatus: (...args) => getTelegramChannelStatus(...args),
  getWebsiteWidgetStatus: (...args) => getWebsiteWidgetStatus(...args),
}));

vi.mock("../../lib/appEntry.js", () => ({
  areInternalRoutesEnabled: (...args) => areInternalRoutesEnabled(...args),
}));

import Inbox from "../../pages/Inbox.jsx";

describe("Inbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceTenantKey.mockReturnValue({
      tenantKey: "acme",
      loading: false,
      ready: true,
    });
    getSettingsTrustView.mockRejectedValue(new Error("truth unavailable"));
    getMetaChannelStatus.mockRejectedValue(new Error("meta unavailable"));
    getTelegramChannelStatus.mockRejectedValue(new Error("telegram unavailable"));
    getWebsiteWidgetStatus.mockRejectedValue(new Error("website unavailable"));
  });

  it("renders the inbox launch and fallback feedback", async () => {
    getAppSessionContext.mockResolvedValue({
      tenantKey: "acme",
      actorName: "operator",
    });

    areInternalRoutesEnabled.mockReturnValue(false);

    useInboxRealtime.mockReturnValue({
      connected: false,
      reconnecting: false,
      lastMessageAt: "",
    });

    useInboxThreadListSurface.mockReturnValue({
      filter: "all",
      setFilter: vi.fn(),
      deepLinkNotice: "",
      stats: { open: 0, aiActive: 0, handoff: 0, resolved: 0 },
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
        saveSuccess:
          "Reply accepted. Waiting for outbound attempt status to confirm delivery.",
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
      dbDisabled: true,
      surface: {
        loading: false,
        error: "",
        unavailable: true,
        ready: false,
        saving: false,
        saveError: "",
        saveSuccess:
          "Reply accepted. Waiting for outbound attempt status to confirm delivery.",
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
      openLeadDetail: vi.fn(),
    });

    render(<Inbox />);

    expect(
      await screen.findByRole("heading", { name: /live conversation inbox/i })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/inbox operations are temporarily unavailable/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/inbox launch posture is unavailable/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /all conversations/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/conversation workspace/i)).toBeInTheDocument();
    expect(
      screen.getByText(/select a thread to open the timeline/i)
    ).toBeInTheDocument();
  });
});
