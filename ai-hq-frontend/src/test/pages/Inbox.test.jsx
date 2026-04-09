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
const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();

vi.mock("react-router-dom", () => ({
  MemoryRouter: ({ children }) => children,
  Link: ({ children, to = "#", ...props }) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>
      {children}
    </a>
  ),
  NavLink: ({ children, to = "#", ...props }) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>
      {typeof children === "function" ? children({ isActive: false }) : children}
    </a>
  ),
  Navigate: () => null,
  Outlet: ({ children }) => children ?? null,
  useNavigate: () => mockNavigate,
  useLocation: () => ({
    pathname: "/inbox",
    search: "",
    hash: "",
    state: null,
    key: "test",
  }),
  useParams: () => ({}),
  useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
  useMatch: () => null,
  useResolvedPath: (to) => ({
    pathname: typeof to === "string" ? to : "/inbox",
  }),
}));

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
  });

  it("renders the primary conversation-work surface feedback", async () => {
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
      await screen.findByRole("heading", { name: /operator messaging workspace/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/reply accepted/i)).toBeInTheDocument();
    expect(
      screen.getByText(/inbox operations are temporarily unavailable/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/thread-first triage on the left/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/fallback mode/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /all conversations/i })
    ).toBeInTheDocument();
  });
});
