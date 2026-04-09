import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ChannelCatalog from "../../pages/ChannelCatalog.jsx";
import { emitLaunchSliceRefresh } from "../../lib/launchSliceRefresh.js";

const navigate = vi.fn();
const getMetaChannelStatus = vi.fn();
const getTelegramChannelStatus = vi.fn();
const getWebsiteWidgetStatus = vi.fn();
const getSettingsTrustView = vi.fn();
const useWorkspaceTenantKey = vi.fn();

let workspaceScope = {
  tenantKey: "acme",
  loading: false,
  ready: true,
};

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("../../api/channelConnect.js", () => ({
  getMetaChannelStatus: (...args) => getMetaChannelStatus(...args),
  getTelegramChannelStatus: (...args) => getTelegramChannelStatus(...args),
  getWebsiteWidgetStatus: (...args) => getWebsiteWidgetStatus(...args),
}));

vi.mock("../../api/trust.js", () => ({
  getSettingsTrustView: (...args) => getSettingsTrustView(...args),
}));

vi.mock("../../hooks/useWorkspaceTenantKey.js", () => ({
  default: (...args) => useWorkspaceTenantKey(...args),
  useWorkspaceTenantKey: (...args) => useWorkspaceTenantKey(...args),
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function renderCatalog({ queryClient = null, initialEntries = ["/channels"] } = {}) {
  const client = queryClient || createQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <ChannelCatalog />
      </MemoryRouter>
    </QueryClientProvider>
  );

  return {
    client,
    ...view,
  };
}

function rerenderCatalog(view, initialEntries = ["/channels"]) {
  view.rerender(
    <QueryClientProvider client={view.client}>
      <MemoryRouter initialEntries={initialEntries}>
        <ChannelCatalog />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function createTrustView(overrides = {}) {
  return {
    summary: {
      truth: {
        latestVersionId: "truth-1",
        readiness: {
          status: "ready",
          blockers: [],
        },
      },
      runtimeProjection: {
        readiness: {
          status: "ready",
          blockers: [],
        },
        health: {
          usable: true,
        },
        authority: {
          available: true,
        },
      },
      reviewQueue: {
        pending: 0,
      },
    },
    ...overrides,
  };
}

function createMetaStatus(overrides = {}) {
  return {
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
        "Businesses connect their own Instagram account and the platform helps them manage inbound customer conversations.",
      requestedScopes: ["pages_show_list", "instagram_basic", "instagram_manage_messages"],
      excludedScopes: ["business_management", "instagram_manage_comments"],
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
      status: "ready",
      message: "Instagram DM automation is ready.",
      blockers: [],
    },
    actions: {
      connectAvailable: true,
      reconnectAvailable: true,
      disconnectAvailable: true,
    },
    ...overrides,
  };
}

function createTelegramStatus(overrides = {}) {
  return {
    ok: true,
    connected: true,
    state: "connected",
    account: {
      displayName: "Telegram @acme_support_bot",
      botUserId: "bot-1",
      botUsername: "acme_support_bot",
      botTokenMasked: "1234***abcd",
      verified: true,
    },
    webhook: {
      verified: true,
      expectedUrl:
        "https://backend.example.test/api/channels/telegram/webhook/acme/[redacted]",
      actualUrl:
        "https://backend.example.test/api/channels/telegram/webhook/acme/[redacted]",
      secretHeaderConfigured: true,
      pendingUpdateCount: 0,
      lastErrorMessage: "",
    },
    runtime: {
      ready: true,
      authorityAvailable: true,
      channelAllowed: true,
      deliveryReady: true,
    },
    lifecycle: {
      connectedAt: "2026-04-05T06:00:00.000Z",
      lastVerifiedAt: "2026-04-05T06:05:00.000Z",
    },
    readiness: {
      status: "ready",
      message: "Telegram bot, webhook, and tenant runtime are ready for live delivery.",
      blockers: [],
    },
    actions: {
      connectAvailable: false,
      reconnectAvailable: false,
      disconnectAvailable: true,
    },
    ...overrides,
  };
}

function createWebsiteStatus(overrides = {}) {
  return {
    state: "connected",
    widget: {
      enabled: true,
      publicWidgetId: "ww_acme_widget",
      websiteUrl: "https://acme.example",
    },
    readiness: {
      status: "ready",
      message:
        "Website chat is configured with a publishable install ID and trusted origin controls.",
      blockers: [],
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  workspaceScope = {
    tenantKey: "acme",
    loading: false,
    ready: true,
  };
  useWorkspaceTenantKey.mockImplementation(() => workspaceScope);
  getMetaChannelStatus.mockResolvedValue(createMetaStatus());
  getTelegramChannelStatus.mockResolvedValue(createTelegramStatus());
  getWebsiteWidgetStatus.mockResolvedValue(createWebsiteStatus());
  getSettingsTrustView.mockResolvedValue(createTrustView());
});

afterEach(() => {
  cleanup();
});

describe("ChannelCatalog", () => {
  it("renders the real launch-channel mix after readiness loads", async () => {
    renderCatalog();

    expect(await screen.findByRole("button", { name: "Open Instagram" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Telegram" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Website chat" })).toBeInTheDocument();
    expect(screen.getAllByText(/launch ready/i).length).toBeGreaterThan(0);
  });

  it("opens the Instagram drawer with live tenant status", async () => {
    renderCatalog();

    fireEvent.click(await screen.findByRole("button", { name: "Open Instagram" }));

    expect(
      await screen.findByText("Instagram is connected for this tenant.")
    ).toBeInTheDocument();
    expect(screen.getByText("Connected account")).toBeInTheDocument();
    expect(screen.getByText("User token status")).toBeInTheDocument();
  });

  it("refreshes launch posture after a tenant-scoped launch mutation signal", async () => {
    getSettingsTrustView
      .mockResolvedValueOnce(createTrustView())
      .mockResolvedValueOnce(
        createTrustView({
          summary: {
            truth: {
              latestVersionId: "",
              readiness: {
                status: "blocked",
                reasonCode: "approved_truth_unavailable",
                blockers: [],
              },
            },
            runtimeProjection: {
              readiness: {
                status: "blocked",
                blockers: [],
              },
              health: {
                usable: false,
              },
              authority: {
                available: false,
              },
            },
            reviewQueue: {
              pending: 1,
            },
          },
        })
      );

    renderCatalog();

    expect(await screen.findByRole("button", { name: "Open Instagram" })).toBeInTheDocument();
    expect(screen.getAllByText(/launch ready/i).length).toBeGreaterThan(0);

    emitLaunchSliceRefresh({
      tenantKey: "acme",
      reason: "test-refresh",
    });

    await waitFor(() => {
      expect(getSettingsTrustView).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText(/approval required/i)).toBeInTheDocument();
  });

  it("drops the previous tenant posture while the next tenant is still loading", async () => {
    let resolveMeta;
    let resolveTelegram;
    let resolveWebsite;
    let resolveTruth;

    const nextMeta = new Promise((resolve) => {
      resolveMeta = resolve;
    });
    const nextTelegram = new Promise((resolve) => {
      resolveTelegram = resolve;
    });
    const nextWebsite = new Promise((resolve) => {
      resolveWebsite = resolve;
    });
    const nextTruth = new Promise((resolve) => {
      resolveTruth = resolve;
    });

    const view = renderCatalog();

    expect(await screen.findByRole("button", { name: "Open Instagram" })).toBeInTheDocument();
    expect(screen.getAllByText(/launch ready/i).length).toBeGreaterThan(0);

    workspaceScope = {
      tenantKey: "globex",
      loading: false,
      ready: true,
    };
    getMetaChannelStatus.mockImplementationOnce(() => nextMeta);
    getTelegramChannelStatus.mockImplementationOnce(() => nextTelegram);
    getWebsiteWidgetStatus.mockImplementationOnce(() => nextWebsite);
    getSettingsTrustView.mockImplementationOnce(() => nextTruth);

    rerenderCatalog(view);

    await waitFor(() => {
      expect(getMetaChannelStatus).toHaveBeenCalledTimes(2);
    });

    expect(screen.queryAllByText(/launch ready/i)).toHaveLength(0);

    resolveMeta(
      createMetaStatus({
        state: "disconnected",
        connected: false,
        runtime: {
          webhookReady: false,
          deliveryReady: false,
        },
        readiness: {
          status: "blocked",
          message: "Instagram is not connected for this tenant.",
          blockers: [],
        },
      })
    );
    resolveTelegram(
      createTelegramStatus({
        connected: false,
        state: "disconnected",
        runtime: {
          ready: false,
          authorityAvailable: false,
          channelAllowed: false,
          deliveryReady: false,
        },
        readiness: {
          status: "blocked",
          message: "Telegram is not connected for this tenant.",
          blockers: [],
        },
      })
    );
    resolveWebsite(
      createWebsiteStatus({
        state: "not_connected",
        widget: {
          enabled: false,
          publicWidgetId: "",
          websiteUrl: "https://globex.example",
        },
        readiness: {
          status: "blocked",
          message: "Website chat is not configured yet.",
          blockers: [],
        },
      })
    );
    resolveTruth(
      createTrustView({
        summary: {
          truth: {
            latestVersionId: "",
            readiness: {
              status: "blocked",
              reasonCode: "approved_truth_unavailable",
              blockers: [],
            },
          },
          runtimeProjection: {
            readiness: {
              status: "blocked",
              blockers: [],
            },
            health: {
              usable: false,
            },
            authority: {
              available: false,
            },
          },
          reviewQueue: {
            pending: 0,
          },
        },
      })
    );

    expect(await screen.findByText(/connect required/i)).toBeInTheDocument();
  });
});
