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

const DM_FIRST_REQUESTED_SCOPES = [
  "pages_show_list",
  "instagram_basic",
  "instagram_manage_messages",
];

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
      requestedScopes: DM_FIRST_REQUESTED_SCOPES,
      excludedScopes: [
        "business_management",
        "instagram_manage_comments",
        "instagram_content_publish",
      ],
    },
    lifecycle: {
      userToken: {
        status: "valid",
        expiresAt: "2026-04-05T06:00:00.000Z",
      },
    },
    attention: {
      items: [],
      reconnectRecommended: false,
    },
    readiness: {
      message: "Instagram DM automation is ready.",
      blockers: [],
    },
    actions: {
      connectAvailable: true,
      reconnectAvailable: true,
      reconnectRecommended: false,
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

  it("filters connectors by active group tab", () => {
    renderCatalog();

    fireEvent.click(screen.getByRole("button", { name: /business/i }));

    expect(screen.getByText("Gmail")).toBeInTheDocument();
    expect(screen.queryByText("Instagram")).not.toBeInTheDocument();
  });

  it("opens the Instagram drawer with live tenant status", async () => {
    renderCatalog();

    fireEvent.click(screen.getByRole("button", { name: "Open Instagram" }));

    expect(await screen.findByText("Review-aligned permission model")).toBeInTheDocument();
    expect(await screen.findByText("instagram_manage_messages")).toBeInTheDocument();
    expect(await screen.findByText("business_management")).toBeInTheDocument();
    expect(screen.getByText("Instagram is connected for this tenant.")).toBeInTheDocument();
  });

  it("shows reconnect guidance when the stored Meta user token is expired", async () => {
    getMetaChannelStatus.mockResolvedValueOnce({
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
      lifecycle: {
        userToken: {
          status: "expired",
          expiresAt: "2026-04-05T04:00:00.000Z",
          reconnectRecommended: true,
        },
      },
      attention: {
        items: [
          {
            reasonCode: "user_token_expired",
            title: "The stored Meta user token has expired.",
            subtitle:
              "Current page-backed DM delivery can remain live, but this launch path does not auto-refresh user tokens. Reconnect this tenant to renew the operator-granted auth context.",
          },
        ],
        reconnectRecommended: true,
      },
      review: {
        story:
          "Businesses connect their own Instagram Business / Professional account and the platform helps them manage inbound customer conversations using tenant-specific business settings and runtime.",
        requestedScopes: DM_FIRST_REQUESTED_SCOPES,
        excludedScopes: [
          "business_management",
          "instagram_manage_comments",
          "instagram_content_publish",
        ],
      },
      readiness: {
        message:
          "Instagram DM automation is currently live, but reconnect is recommended soon because the stored Meta user token is no longer comfortably fresh.",
        blockers: [],
      },
      actions: {
        connectAvailable: true,
        reconnectAvailable: true,
        reconnectRecommended: true,
        disconnectAvailable: true,
      },
    });

    renderCatalog();

    fireEvent.click(screen.getByRole("button", { name: "Open Instagram" }));

    expect(
      await screen.findByText("The stored Meta user token has expired.")
    ).toBeInTheDocument();
    expect(screen.getByText("User token status")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconnect" })).toBeInTheDocument();
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
        requestedScopes: DM_FIRST_REQUESTED_SCOPES,
        excludedScopes: [
          "business_management",
          "instagram_manage_comments",
          "instagram_content_publish",
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
      expect(selectMetaChannelCandidate).toHaveBeenCalledWith(
        {
          selectionToken: "selection-token-1",
          candidateId: "page-2",
        },
        expect.anything()
      )
    );
  });

  it("shows the precise latest reconnect blocker when Meta denied a required permission", async () => {
    getMetaChannelStatus.mockResolvedValueOnce({
      ok: true,
      state: "not_connected",
      reasonCode: "meta_missing_granted_permissions",
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
        requestedScopes: DM_FIRST_REQUESTED_SCOPES,
        excludedScopes: [
          "business_management",
          "instagram_manage_comments",
          "instagram_content_publish",
        ],
      },
      lastConnectFailure: {
        reasonCode: "meta_missing_granted_permissions",
        missingGrantedScopes: ["instagram_manage_messages"],
      },
      readiness: {
        message:
          "The latest Instagram connect attempt failed before this tenant could be rebound.",
        blockers: [
          {
            reasonCode: "meta_missing_granted_permissions",
            title:
              "Meta did not grant every required permission for the latest connect attempt.",
            subtitle:
              "Missing: instagram_manage_messages. Granted: pages_show_list, instagram_basic.",
          },
        ],
      },
      lifecycle: {
        userToken: {
          status: "unknown",
        },
      },
      attention: {
        items: [],
        reconnectRecommended: false,
      },
      actions: {
        connectAvailable: true,
        reconnectAvailable: true,
        disconnectAvailable: true,
      },
    });

    renderCatalog();

    fireEvent.click(screen.getByRole("button", { name: "Open Instagram" }));

    expect(
      await screen.findByText(
        "Meta did not grant every required permission for the latest connect attempt."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Missing: instagram_manage_messages. Granted: pages_show_list, instagram_basic."
      )
    ).toBeInTheDocument();
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
