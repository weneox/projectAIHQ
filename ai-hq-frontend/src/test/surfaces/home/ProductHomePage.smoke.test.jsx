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
    actorName: "Owner",
    companyName: "Acme Clinic",
    availabilityNote: null,
    currentStatus: {
      title: "Connect Telegram before launching AI conversations.",
      summary:
        "The guided setup lane stays locked until the tenant Telegram bot is connected.",
      action: { label: "Open channels", path: "/channels?channel=telegram" },
      secondaryAction: { label: "Open AI setup", path: "/home?assistant=setup" },
    },
    heroStats: [
      {
        id: "channel",
        label: "Launch channel",
        status: "Connect required",
        summary: "Use Channels to connect the Telegram bot for this workspace.",
        action: { label: "Open channels", path: "/channels?channel=telegram" },
      },
      {
        id: "setup",
        label: "AI setup",
        status: "Waiting for Telegram",
        summary: "The setup assistant stays in connect-CTA posture until Telegram is attached.",
        action: { label: "Open AI setup", path: "/home?assistant=setup" },
      },
      {
        id: "runtime",
        label: "Truth and runtime",
        status: "Blocked",
        summary: "Approved truth and runtime activation stay fail-closed.",
        action: { label: "Open truth", path: "/truth" },
      },
    ],
    setupFlow: {
      title: "Connect Telegram to unlock guided setup.",
      summary:
        "The setup assistant stays in connect-CTA posture until the tenant Telegram bot is attached.",
      detail: "Use Channels to connect the Telegram bot for this workspace.",
      action: { label: "Open channels", path: "/channels?channel=telegram" },
      secondaryAction: { label: "Open home", path: "/home" },
      review: {
        message:
          "Website or chat answers stay draft-only here. Nothing in this batch publishes directly into approved truth or the strict runtime.",
      },
      draft: {
        businessProfile: {},
      },
      servicesCount: 0,
      contactsCount: 0,
      hoursCount: 0,
      websiteUrl: "",
    },
    entryPoints: [
      {
        id: "inbox",
        title: "Inbox",
        status: "Waiting on launch readiness",
        summary:
          "The inbox becomes the main operating surface after Telegram, approved truth, and runtime are aligned.",
        detail:
          "Approved truth exists, but the strict runtime projection is not ready for Telegram yet.",
        action: { label: "Open inbox", path: "/inbox" },
      },
      {
        id: "comments",
        title: "Comments",
        status: "Separate surface",
        summary: "Comments remain available, but they are not the launch surface for this setup flow.",
        detail: "Keep the setup story narrow for this phase.",
        action: { label: "Open comments", path: "/comments" },
      },
      {
        id: "voice",
        title: "Voice Receptionist",
        status: "Separate surface",
        summary: "Voice stays available as its own surface.",
        detail: "Voice readiness does not drive the Telegram setup path.",
        action: { label: "Open voice", path: "/voice" },
      },
      {
        id: "channels",
        title: "Channels",
        status: "Connect required",
        summary: "Connect and inspect the tenant Telegram bot.",
        detail: "Use Channels to connect Telegram.",
        action: { label: "Open channels", path: "/channels?channel=telegram" },
      },
      {
        id: "truth",
        title: "Truth",
        status: "Blocked",
        summary: "Approved truth and runtime stay protected.",
        detail: "Draft setup does not publish automatically.",
        action: { label: "Open truth", path: "/truth" },
      },
      {
        id: "workspace",
        title: "Workspace",
        status: "Support",
        summary: "Use the workspace for broader operator posture.",
        detail: "Workspace remains a support surface.",
        action: { label: "Open workspace", path: "/workspace" },
      },
    ],
    entryPointGroups: {
      featured: [
        {
          id: "inbox",
          title: "Inbox",
          status: "Waiting on launch readiness",
          action: { label: "Open inbox", path: "/inbox" },
        },
        {
          id: "comments",
          title: "Comments",
          status: "Separate surface",
          action: { label: "Open comments", path: "/comments" },
        },
        {
          id: "voice",
          title: "Voice Receptionist",
          status: "Separate surface",
          action: { label: "Open voice", path: "/voice" },
        },
      ],
      secondary: [
        {
          id: "channels",
          title: "Channels",
          status: "Connect required",
          action: { label: "Open channels", path: "/channels?channel=telegram" },
        },
        {
          id: "truth",
          title: "Truth",
          status: "Blocked",
          action: { label: "Open truth", path: "/truth" },
        },
        {
          id: "workspace",
          title: "Workspace",
          status: "Support",
          action: { label: "Open workspace", path: "/workspace" },
        },
      ],
    },
    assistant: {
      title: "Connect Telegram to unlock guided setup.",
    },
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

  it("renders the home orchestration surface and routes the primary CTA into channels", () => {
    render(
      <MemoryRouter>
        <ProductHomePage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", {
        name: "Operate live from one surface.",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Setup")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Open channels" })[0]);

    expect(navigate).toHaveBeenCalledWith("/channels?channel=telegram");
  });

  it("reflects the assistant-open query posture on home", () => {
    render(
      <MemoryRouter initialEntries={["/home?assistant=setup"]}>
        <ProductHomePage />
      </MemoryRouter>
    );

    expect(screen.getByText("Assistant active")).toBeInTheDocument();
    expect(screen.getByText("Awaiting website")).toBeInTheDocument();
  });
});
