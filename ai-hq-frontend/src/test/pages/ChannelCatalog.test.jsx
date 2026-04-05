import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
const getMetaChannelStatus = vi.fn();
const getMetaConnectUrl = vi.fn();
const disconnectMetaChannel = vi.fn();
const selectMetaChannelCandidate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("../../api/channelConnect.js", () => ({
  getMetaChannelStatus: (...args) => getMetaChannelStatus(...args),
  getMetaConnectUrl: (...args) => getMetaConnectUrl(...args),
  disconnectMetaChannel: (...args) => disconnectMetaChannel(...args),
  selectMetaChannelCandidate: (...args) => selectMetaChannelCandidate(...args),
}));

import ChannelCatalog from "../../pages/ChannelCatalog.jsx";

function renderCatalog(initialEntries = ["/channels"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <ChannelCatalog />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  getMetaChannelStatus.mockResolvedValue({
    ok: true,
    state: "connected",
    account: {
      displayName: "Instagram @acme",
      username: "acme",
      igUserId: "ig-1",
      metaUserId: "meta-user-1",
    },
    runtime: {
      webhookReady: true,
      deliveryReady: true,
    },
    review: {
      story:
        "Businesses connect their own Instagram Business / Professional account and the platform helps them manage inbound customer conversations using tenant-specific business settings and runtime.",
      requestedScopes: [
        "pages_show_list",
        "pages_manage_metadata",
        "instagram_basic",
        "instagram_manage_messages",
      ],
    },
    readiness: {
      message: "Instagram DM automation is ready.",
      blockers: [],
    },
    actions: {
      connectAvailable: true,
      disconnectAvailable: true,
    },
  });
  getMetaConnectUrl.mockResolvedValue({ ok: true, url: "https://example.test/meta" });
  disconnectMetaChannel.mockResolvedValue({ ok: true });
  selectMetaChannelCandidate.mockResolvedValue({ ok: true, connected: true });
});

afterEach(() => {
  cleanup();
  navigate.mockReset();
  getMetaChannelStatus.mockReset();
  getMetaConnectUrl.mockReset();
  disconnectMetaChannel.mockReset();
  selectMetaChannelCandidate.mockReset();
});

describe("ChannelCatalog", () => {
  it("renders the DM-first connector mix instead of fake all-ready connectors", () => {
    renderCatalog();

    expect(screen.getByText("Instagram")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
    expect(screen.getAllByText("Phase 2").length).toBeGreaterThan(0);
  });

  it("filters connectors by search query", () => {
    renderCatalog();

    fireEvent.change(screen.getByPlaceholderText("Search connector or use case"), {
      target: { value: "telegram" },
    });

    expect(screen.getByText("Telegram")).toBeInTheDocument();
    expect(screen.queryByText("Instagram")).not.toBeInTheDocument();
  });

  it("opens the Instagram drawer with live tenant status", async () => {
    renderCatalog();

    fireEvent.click(screen.getByRole("button", { name: "Open Instagram" }));

    expect(await screen.findByText("Review-aligned permission model")).toBeInTheDocument();
    expect(screen.getByText("instagram_manage_messages")).toBeInTheDocument();
    expect(screen.getByText("Instagram is connected for this tenant.")).toBeInTheDocument();
  });

  it("shows the multi-account chooser and only connects after explicit selection", async () => {
    getMetaChannelStatus.mockResolvedValueOnce({
      ok: true,
      state: "not_connected",
      account: {
        displayName: "Instagram",
      },
      runtime: {
        webhookReady: false,
        deliveryReady: false,
      },
      review: {
        story:
          "Businesses connect their own Instagram Business / Professional account and the platform helps them manage inbound customer conversations using tenant-specific business settings and runtime.",
        requestedScopes: [
          "pages_show_list",
          "pages_manage_metadata",
          "instagram_basic",
          "instagram_manage_messages",
        ],
      },
      readiness: {
        message:
          "Instagram connect is waiting for an explicit account selection before this tenant can be bound.",
        blockers: [
          {
            reasonCode: "instagram_account_selection_required",
            title: "Choose which Instagram Business account to bind to this tenant.",
          },
        ],
      },
      actions: {
        connectAvailable: false,
        disconnectAvailable: true,
        selectionAvailable: true,
      },
      pendingSelection: {
        required: true,
        selectionToken: "selection-token-1",
        candidates: [
          {
            id: "page-1",
            displayName: "Instagram @acme.one",
            pageName: "Acme One",
            igUsername: "acme.one",
            igUserId: "ig-1",
          },
          {
            id: "page-2",
            displayName: "Instagram @acme.two",
            pageName: "Acme Two",
            igUsername: "acme.two",
            igUserId: "ig-2",
          },
        ],
      },
    });

    renderCatalog(["/channels?channel=instagram&meta_selection=1"]);

    expect(
      await screen.findByText(
        "Instagram account selection is required before this tenant can connect."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/choose which instagram business account belongs to this tenant/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/instagram connected successfully/i)
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", { name: /select instagram/i })[1]
    );

    await waitFor(() =>
      expect(selectMetaChannelCandidate).toHaveBeenCalledWith({
        selectionToken: "selection-token-1",
        candidateId: "page-2",
      })
    );
  });

  it("opens phase 2 connectors as honest detail views instead of navigating to fake setup paths", () => {
    renderCatalog();

    fireEvent.click(screen.getByRole("button", { name: "Details Gmail" }));

    expect(
      screen.getByText(/not part of the DM-first launch path/i)
    ).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});
