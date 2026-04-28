import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ChannelCatalog from "../../pages/ChannelCatalog.jsx";
import { emitLaunchSliceRefresh } from "../../lib/launchSliceRefresh.js";

const navigate = vi.fn();
const getMetaChannelStatus = vi.fn();
const getMetaConnectUrl = vi.fn();
const disconnectMetaChannel = vi.fn();
const selectMetaChannelCandidate = vi.fn();
const getTelegramChannelStatus = vi.fn();
const connectTelegramChannel = vi.fn();
const disconnectTelegramChannel = vi.fn();
const getWebsiteWidgetStatus = vi.fn();
const saveWebsiteWidgetConfig = vi.fn();
const getWebsiteDomainVerificationStatus = vi.fn();
const createWebsiteDomainVerificationChallenge = vi.fn();
const checkWebsiteDomainVerification = vi.fn();
const createWebsiteWidgetInstallHandoff = vi.fn();
const createWebsiteWidgetGtmInstallHandoff = vi.fn();
const createWebsiteWidgetWordpressInstallHandoff = vi.fn();
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
  getMetaConnectUrl: (...args) => getMetaConnectUrl(...args),
  disconnectMetaChannel: (...args) => disconnectMetaChannel(...args),
  selectMetaChannelCandidate: (...args) => selectMetaChannelCandidate(...args),
  getTelegramChannelStatus: (...args) => getTelegramChannelStatus(...args),
  connectTelegramChannel: (...args) => connectTelegramChannel(...args),
  disconnectTelegramChannel: (...args) => disconnectTelegramChannel(...args),
  getWebsiteWidgetStatus: (...args) => getWebsiteWidgetStatus(...args),
  saveWebsiteWidgetConfig: (...args) => saveWebsiteWidgetConfig(...args),
  getWebsiteDomainVerificationStatus: (...args) =>
    getWebsiteDomainVerificationStatus(...args),
  createWebsiteDomainVerificationChallenge: (...args) =>
    createWebsiteDomainVerificationChallenge(...args),
  checkWebsiteDomainVerification: (...args) =>
    checkWebsiteDomainVerification(...args),
  createWebsiteWidgetInstallHandoff: (...args) =>
    createWebsiteWidgetInstallHandoff(...args),
  createWebsiteWidgetGtmInstallHandoff: (...args) =>
    createWebsiteWidgetGtmInstallHandoff(...args),
  createWebsiteWidgetWordpressInstallHandoff: (...args) =>
    createWebsiteWidgetWordpressInstallHandoff(...args),
}));

vi.mock("../../api/trust.js", () => ({
  getSettingsTrustView: (...args) => getSettingsTrustView(...args),
}));

vi.mock("../../hooks/useWorkspaceTenantKey.js", () => ({
  default: (...args) => useWorkspaceTenantKey(...args),
  useWorkspaceTenantKey: (...args) => useWorkspaceTenantKey(...args),
  buildWorkspaceScopedQueryKey: (baseKey, tenantKey) => [
    ...(Array.isArray(baseKey) ? baseKey : [baseKey]),
    "workspace",
    String(tenantKey || "").trim().toLowerCase(),
  ],
}));

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

async function findChannelCard(titleText) {
  const matcher = new RegExp(`^${escapeRegExp(titleText)}$`, "i");
  const titleNodes = await screen.findAllByText(matcher);
  const card = titleNodes.map((node) => node.closest("article")).find(Boolean);

  expect(card).toBeTruthy();
  return card;
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
    status: "connected",
    connected: true,
    ready: true,
    deliveryReady: true,
    username: "acme",
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
      message: "Instagram inbox is ready.",
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
    ready: true,
    deliveryReady: true,
    state: "connected",
    status: "connected",
    botUsername: "acme_support_bot",
    account: {
      displayName: "Telegram @acme_support_bot",
      botUserId: "bot-1",
      botUsername: "acme_support_bot",
      botTokenMasked: "1234***abcd",
      verified: true,
    },
    webhook: {
      verified: true,
      ready: true,
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
    status: "connected",
    connected: true,
    ready: true,
    deliveryReady: true,
    domain: "acme.example",
    installId: "ww_acme_widget",
    verified: true,
    domainVerified: true,
    widget: {
      enabled: true,
      ready: true,
      publicWidgetId: "ww_acme_widget",
      installId: "ww_acme_widget",
      websiteUrl: "https://acme.example",
      domain: "acme.example",
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
  getMetaConnectUrl.mockResolvedValue({
    ok: true,
    url: "https://example.test/meta",
  });
  disconnectMetaChannel.mockResolvedValue({ ok: true });
  selectMetaChannelCandidate.mockResolvedValue({ ok: true, connected: true });

  getTelegramChannelStatus.mockResolvedValue(createTelegramStatus());
  connectTelegramChannel.mockResolvedValue({ ok: true, connected: true });
  disconnectTelegramChannel.mockResolvedValue({ ok: true, disconnected: true });

  getWebsiteWidgetStatus.mockResolvedValue(createWebsiteStatus());
  saveWebsiteWidgetConfig.mockResolvedValue(createWebsiteStatus());

  getWebsiteDomainVerificationStatus.mockResolvedValue({
    ok: true,
    verified: true,
  });
  createWebsiteDomainVerificationChallenge.mockResolvedValue({
    ok: true,
    challenge: {
      type: "TXT",
      name: "_neox.acme.example",
      value: "neox-domain-verification=acme",
    },
  });
  checkWebsiteDomainVerification.mockResolvedValue({
    ok: true,
    verified: true,
  });
  createWebsiteWidgetInstallHandoff.mockResolvedValue({ ok: true });
  createWebsiteWidgetGtmInstallHandoff.mockResolvedValue({ ok: true });
  createWebsiteWidgetWordpressInstallHandoff.mockResolvedValue({ ok: true });

  getSettingsTrustView.mockResolvedValue(createTrustView());
});

afterEach(() => {
  cleanup();
});

describe("ChannelCatalog", () => {
  it("renders the compact launch-channel mix after readiness loads", async () => {
    renderCatalog();

    const websiteCard = await findChannelCard("Website chat");
    const instagramCard = await findChannelCard("Instagram");
    const telegramCard = await findChannelCard("Telegram");

    expect(screen.getByText(/3\/3 ready/i)).toBeInTheDocument();

    expect(within(websiteCard).getByText(/^connected$/i)).toBeInTheDocument();
    expect(within(instagramCard).getByText(/^connected$/i)).toBeInTheDocument();
    expect(within(telegramCard).getByText(/^connected$/i)).toBeInTheDocument();

    for (const card of [websiteCard, instagramCard, telegramCard]) {
      expect(
        within(card).getByRole("button", { name: /details/i })
      ).toBeInTheDocument();

      expect(
        within(card).getByRole("button", { name: /^(open )?inbox$/i })
      ).toBeInTheDocument();
    }
  });

  it("opens the Instagram drawer with live tenant status", async () => {
    renderCatalog();

    const instagramCard = await findChannelCard("Instagram");

    fireEvent.click(
      within(instagramCard).getByRole("button", { name: /details/i })
    );

    await waitFor(() => {
      expect(getMetaChannelStatus.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    expect(screen.getAllByText(/^instagram$/i).length).toBeGreaterThan(0);

    expect(
      await screen.findByText(
        /ready for live messages|instagram dms are ready|instagram is connected for this tenant/i
      )
    ).toBeInTheDocument();
  });

  it("refreshes launch posture after a tenant-scoped launch mutation signal", async () => {
    let trustView = createTrustView();

    getSettingsTrustView.mockImplementation(() => Promise.resolve(trustView));

    renderCatalog();

    await findChannelCard("Instagram");

    await waitFor(() => {
      expect(screen.getAllByText(/^connected$/i).length).toBeGreaterThan(0);
    });

    const initialCallCount = getSettingsTrustView.mock.calls.length;

    trustView = createTrustView({
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
    });

    act(() => {
      emitLaunchSliceRefresh({
        tenantKey: "acme",
        reason: "test-refresh",
      });
    });

    await waitFor(() => {
      expect(getSettingsTrustView.mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    await waitFor(() => {
      expect(
        screen.queryAllByText(/truth still needs approval/i).length
      ).toBeGreaterThan(0);
    });
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

    await findChannelCard("Instagram");

    expect(screen.getAllByText(/^connected$/i).length).toBeGreaterThan(0);

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

    expect(screen.queryAllByText(/^connected$/i)).toHaveLength(0);

    resolveMeta(
      createMetaStatus({
        state: "disconnected",
        status: "disconnected",
        connected: false,
        ready: false,
        deliveryReady: false,
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
        status: "disconnected",
        ready: false,
        deliveryReady: false,
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
        status: "not_connected",
        connected: false,
        ready: false,
        deliveryReady: false,
        verified: false,
        domainVerified: false,
        widget: {
          enabled: false,
          publicWidgetId: "",
          installId: "",
          websiteUrl: "https://globex.example",
          domain: "globex.example",
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

    await waitFor(() => {
      expect(screen.queryAllByText(/^connected$/i)).toHaveLength(0);
    });

    expect(await findChannelCard("Instagram")).toBeInTheDocument();
    expect(await findChannelCard("Telegram")).toBeInTheDocument();
    expect(await findChannelCard("Website chat")).toBeInTheDocument();
  });
});