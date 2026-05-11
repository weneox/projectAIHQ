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
      primaryAction: { label: "Open setup", path: "/home?assistant=setup" },
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
    launchSteps: [],
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

  it("renders a clean Azerbaijani home surface and routes setup", () => {
    render(
      <MemoryRouter>
        <ProductHomePage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: "Müştəri mesajları bir yerdə." })
    ).toBeInTheDocument();
    expect(screen.getByText("Məlumat lazımdır")).toBeInTheDocument();
    expect(screen.getByText("Başlama siyahısı")).toBeInTheDocument();
    expect(screen.queryByText(/runtime|tenant|backend|workspace/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /məlumatları tamamla/i }));

    expect(navigate).toHaveBeenCalledWith("/home?assistant=setup");
  });

  it("keeps Home visible while the setup assistant query is present", () => {
    render(
      <MemoryRouter initialEntries={["/home?assistant=setup"]}>
        <ProductHomePage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: "Müştəri mesajları bir yerdə." })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /məlumatları tamamla/i })
    ).toBeInTheDocument();
  });

  it("routes into channels after business info and assistant are ready", () => {
    useProductHome.mockReturnValue(
      createHomeState({
        truthRuntime: {
          truthReady: true,
          ready: true,
          summary: "Approved business info is ready.",
        },
      })
    );

    render(
      <MemoryRouter>
        <ProductHomePage />
      </MemoryRouter>
    );

    expect(screen.getByText("Kanal qoşulmayıb")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^kanal qoş$/i }));

    expect(navigate).toHaveBeenCalledWith("/channels");
  });

  it("shows customer pressure without exposing internal wording", () => {
    useProductHome.mockReturnValue(
      createHomeState({
        truthRuntime: {
          truthReady: true,
          ready: true,
          summary: "Business info is ready.",
        },
        inboxState: {
          status: "attention",
          counts: {
            unreadCount: 24,
            openCount: 8,
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
            { provider: "website", available: true, connected: true, deliveryReady: true },
            { provider: "instagram", available: true, connected: true, deliveryReady: true },
            { provider: "telegram", available: true, connected: true, deliveryReady: true },
          ],
        },
      })
    );

    render(
      <MemoryRouter>
        <ProductHomePage />
      </MemoryRouter>
    );

    expect(screen.getAllByText("Cavab gözləyir").length).toBeGreaterThan(0);
    expect(screen.getByText("24 oxunmamış")).toBeInTheDocument();
    expect(screen.getByText("Cavab əsası")).toBeInTheDocument();
    expect(screen.queryByText(/runtime|tenant|backend|workspace/i)).not.toBeInTheDocument();
  });
});
