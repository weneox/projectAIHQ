import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const useInboxData = vi.fn();
const useInboxRealtime = vi.fn();
const useInboxThreadListSurface = vi.fn();
const getAppSessionContext = vi.fn();
const areInternalRoutesEnabled = vi.fn();
const useInboxComposerSurface = vi.fn();

vi.mock("../hooks/useInboxData.js", () => ({
  useInboxData: (...args) => useInboxData(...args),
}));

vi.mock("../components/inbox/hooks/useInboxThreadListSurface.js", () => ({
  useInboxThreadListSurface: (...args) => useInboxThreadListSurface(...args),
}));

vi.mock("../components/inbox/hooks/useInboxComposerSurface.js", () => ({
  useInboxComposerSurface: (...args) => useInboxComposerSurface(...args),
}));

vi.mock("../hooks/useInboxRealtime.js", () => ({
  useInboxRealtime: (...args) => useInboxRealtime(...args),
}));

vi.mock("../lib/appSession.js", () => ({
  getAppSessionContext: (...args) => getAppSessionContext(...args),
}));

vi.mock("../lib/appEntry.js", () => ({
  areInternalRoutesEnabled: (...args) => areInternalRoutesEnabled(...args),
}));

import Inbox from "./Inbox.jsx";

describe("Inbox", () => {
  it("renders shared page shell feedback", async () => {
    getAppSessionContext.mockResolvedValue({ tenantKey: "acme", actorName: "operator" });
    areInternalRoutesEnabled.mockReturnValue(false);
    useInboxThreadListSurface.mockReturnValue({
      filter: "all",
      setFilter: vi.fn(),
      deepLinkNotice: "",
      stats: { open: 0, aiActive: 0, handoff: 0, resolved: 0 },
      filteredThreads: [],
      openThread: vi.fn(),
      surface: { loading: false, error: "", unavailable: true, ready: false, refresh: vi.fn() },
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
        saveSuccess: "Operator reply sent.",
        refresh: vi.fn(),
      },
      handleSend: vi.fn(),
      handleRelease: vi.fn(),
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
        saveSuccess: "Operator reply sent.",
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

    render(
      <MemoryRouter>
        <Inbox />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: /^inbox$/i })).toBeInTheDocument();
    expect(screen.getByText(/operator reply sent/i)).toBeInTheDocument();
    expect(screen.getByText(/inbox operations are temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/db disabled/i)).toBeInTheDocument();
  });
});
