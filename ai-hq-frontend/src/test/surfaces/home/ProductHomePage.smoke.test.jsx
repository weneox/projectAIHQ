import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
const useProductHome = vi.fn();

function createHomeState(overrides = {}) {
  return {
    loading: false,
    isFetching: false,
    refetch: vi.fn(),
    availabilityNote: null,
    primaryAction: { label: "Open setup", path: "/home?assistant=setup" },
    secondaryAction: null,
    launchReady: false,
    nextStep: { id: "truth" },
    assistant: {
      hasApprovedSetupBaseline: false,
      readyForApproval: false,
    },
    truthRuntime: {
      truthReady: false,
      ready: false,
      summary: "Business truth still needs approval.",
    },
    inboxState: {
      status: "ready",
      counts: {
        unreadCount: 0,
        openCount: 0,
        handoffCount: 0,
        pendingOutboundCount: 0,
        outboundPending: 0,
      },
    },
    launchChannel: {
      provider: "telegram",
      connected: false,
      deliveryReady: false,
      readyCount: 0,
      connectedCount: 0,
      channelLabel: "Telegram",
      statusLabel: "Connect required",
      summary: "Use Channels to connect the Telegram bot for this workspace.",
      accountDisplayName: "",
      accountHandle: "",
    },
    launchSteps: [
      {
        id: "truth",
        label: "Business truth",
        statusLabel: "Setup required",
        tone: "danger",
        summary: "Approve the business facts the AI can safely use.",
        action: { label: "Open setup", path: "/home?assistant=setup" },
        complete: false,
      },
      {
        id: "channel",
        label: "Channel",
        statusLabel: "Not connected",
        tone: "warning",
        summary: "Connect one live customer channel.",
        action: { label: "Open channels", path: "/channels?channel=telegram" },
        complete: false,
      },
      {
        id: "inbox",
        label: "Inbox",
        statusLabel: "Waiting",
        tone: "success",
        summary: "Operate conversations here after truth and channel are ready.",
        action: { label: "Open inbox", path: "/inbox" },
        complete: false,
      },
    ],
    ...overrides,
  };
}

vi.mock("../../../view-models/useProductHome.js", () => ({
  default: (...args) => useProductHome(...args),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

import ProductHomePage from "../../../surfaces/home/ProductHomePage.jsx";

describe("ProductHomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProductHome.mockReturnValue(createHomeState());
  });

  it("renders Home as the launch surface and routes the primary CTA into setup", () => {
    render(
      <MemoryRouter>
        <ProductHomePage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", {
        name: "Approve your business info",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(
      screen.getByText(
        /AI should not answer customers until your business details are reviewed and approved/i
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Open setup" })[0]);

    expect(navigate).toHaveBeenCalledWith("/home?assistant=setup");
  });

  it("keeps Home visible while the setup widget is requested from the query param", () => {
    render(
      <MemoryRouter initialEntries={["/home?assistant=setup"]}>
        <ProductHomePage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: "Approve your business info" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open setup" })).toBeInTheDocument();
  });

  it("routes the primary CTA into channels after truth and runtime are ready", () => {
    useProductHome.mockReturnValue(
      createHomeState({
        primaryAction: { label: "Open channels", path: "/channels?channel=telegram" },
        secondaryAction: { label: "Open truth", path: "/truth" },
        nextStep: { id: "channel" },
        truthRuntime: {
          truthReady: true,
          ready: true,
          summary: "Approved business truth is backing runtime.",
        },
        launchSteps: [
          {
            id: "truth",
            label: "Business truth",
            statusLabel: "Ready",
            tone: "success",
            summary: "Runtime is using approved truth.",
            action: { label: "Open truth", path: "/truth" },
            complete: true,
          },
          {
            id: "channel",
            label: "Channel",
            statusLabel: "Not connected",
            tone: "warning",
            summary: "Connect one live customer channel.",
            action: { label: "Open channels", path: "/channels?channel=telegram" },
            complete: false,
          },
          {
            id: "inbox",
            label: "Inbox",
            statusLabel: "Waiting",
            tone: "success",
            summary: "Operate conversations here after truth and channel are ready.",
            action: { label: "Open inbox", path: "/inbox" },
            complete: false,
          },
        ],
      })
    );

    render(
      <MemoryRouter>
        <ProductHomePage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", {
        name: "Connect a customer channel",
      })
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Open channels" })[0]);

    expect(navigate).toHaveBeenCalledWith("/channels?channel=telegram");
  });

  it("uses unread message pressure and pending outbound counts for launch-ready posture", () => {
    useProductHome.mockReturnValue(
      createHomeState({
        primaryAction: { label: "Reply now", path: "/inbox" },
        secondaryAction: { label: "Open channels", path: "/channels" },
        launchReady: true,
        nextStep: { id: "inbox" },
        truthRuntime: {
          truthReady: true,
          ready: true,
          summary: "Business info is ready.",
        },
        inboxState: {
          status: "attention",
          counts: {
            unreadCount: 24,
            openCount: 0,
            handoffCount: 1,
            pendingOutboundCount: 72,
            outboundPending: 72,
          },
        },
        launchChannel: {
          provider: "",
          connected: true,
          deliveryReady: true,
          readyCount: 3,
          connectedCount: 3,
          providerStates: [
            { provider: "website", available: true },
            { provider: "instagram", available: true },
            { provider: "telegram", available: true },
          ],
        },
      })
    );

    render(
      <MemoryRouter>
        <ProductHomePage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: "24 customer messages waiting" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "24 customer messages need a reply. Business info is ready and 3 channels can receive messages."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/1 conversation need a reply/i)
    ).not.toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("Replies pending")).toBeInTheDocument();
  });

  it("uses singular grammar for one unread customer message", () => {
    useProductHome.mockReturnValue(
      createHomeState({
        primaryAction: { label: "Reply now", path: "/inbox" },
        truthRuntime: {
          truthReady: true,
          ready: true,
          summary: "Business info is ready.",
        },
        inboxState: {
          status: "attention",
          counts: {
            unreadCount: 1,
            openCount: 0,
            handoffCount: 0,
            pendingOutboundCount: 0,
            outboundPending: 0,
          },
        },
        launchChannel: {
          provider: "telegram",
          connected: true,
          deliveryReady: true,
          readyCount: 1,
          connectedCount: 1,
          providerStates: [{ provider: "telegram", available: true }],
        },
      })
    );

    render(
      <MemoryRouter>
        <ProductHomePage />
      </MemoryRouter>
    );

    expect(
      screen.getByText(
        "1 customer message needs a reply. Business info is ready and 1 channel can receive messages."
      )
    ).toBeInTheDocument();
  });
});
