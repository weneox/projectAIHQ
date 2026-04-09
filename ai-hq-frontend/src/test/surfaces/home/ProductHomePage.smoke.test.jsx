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
    launchPhaseLabel: "Connect launch channel",
    launchHeadline: "Connect Telegram first.",
    launchSummary:
      "The launch lane stays blocked until the tenant Telegram bot is attached.",
    primaryAction: { label: "Open channels", path: "/channels?channel=telegram" },
    secondaryAction: { label: "Open AI setup", path: "/home?assistant=setup" },
    progressPercent: 25,
    launchReady: false,
    primaryBlocker: {
      title: "Connect launch channel",
      label: "Connect launch channel",
      summary: "Connect Telegram before the rest of the launch lane can move.",
      detail: "Use Channels to connect the Telegram bot for this workspace.",
    },
    launchChannel: {
      channelLabel: "Telegram",
      statusLabel: "Connect required",
      summary: "Use Channels to connect the Telegram bot for this workspace.",
      accountDisplayName: "",
      accountHandle: "",
    },
    launchSteps: [
      {
        id: "channel",
        label: "Connect launch channel",
        statusLabel: "Connect required",
        tone: "danger",
        summary: "Connect Telegram before the rest of the launch lane can move.",
        detail: "Use Channels to connect the Telegram bot for this workspace.",
        action: { label: "Open channels", path: "/channels?channel=telegram" },
        complete: false,
      },
      {
        id: "setup",
        label: "Create or continue setup draft",
        statusLabel: "Start draft",
        tone: "info",
        summary: "Open the Home assistant after the launch channel is attached.",
        detail: "Setup stays inside the floating assistant widget on Home.",
        action: { label: "Open AI setup", path: "/home?assistant=setup" },
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

  it("renders Home as the launch surface and routes the primary CTA into channels", () => {
    render(
      <MemoryRouter>
        <ProductHomePage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", {
        name: "Connect Telegram first.",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Main flow")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Open channels" })[0]);

    expect(navigate).toHaveBeenCalledWith("/channels?channel=telegram");
  });

  it("keeps Home visible while the setup widget is requested from the query param", () => {
    render(
      <MemoryRouter initialEntries={["/home?assistant=setup"]}>
        <ProductHomePage />
      </MemoryRouter>
    );

    expect(
      screen.getByText("Setup is open in the assistant widget.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Connect Telegram first." })
    ).toBeInTheDocument();
  });
});
