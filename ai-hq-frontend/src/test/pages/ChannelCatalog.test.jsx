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
const getLaunchPosture = vi.fn();
const getSettingsTrustView = vi.fn();
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

vi.mock("../../api/launch.js", () => ({
  getLaunchPosture: (...args) => getLaunchPosture(...args),
}));

vi.mock("../../api/trust.js", () => ({
  getSettingsTrustView: (...args) => getSettingsTrustView(...args),
}));

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
  const titleNode = await screen.findByRole("heading", { name: matcher });

  let node = titleNode.parentElement;

  while (node && node !== document.body) {
    const hasDetails =
      within(node).queryAllByRole("button", { name: /details/i }).length > 0;

    const hasPrimary =
      within(node).queryAllByRole("button", {
        name: /^(inbox|connect|fix)$/i,
      }).length > 0;

    if (hasDetails && hasPrimary) return node;

    node = node.parentElement;
  }

  throw new Error(`Could not find channel card for ${titleText}`);
}

function renderCatalog({
  queryClient = null,
  initialEntries = ["/channels"],
} = {}) {
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
      requestedScopes: [
        "pages_show_list",
        "instagram_basic",
        "instagram_manage_messages",
      ],
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
      message:
        "Telegram bot, webhook, and tenant runtime are ready for live delivery.",
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

function createPostureChannel(id, overrides = {}) {
  const channelMeta = {
    website: ["Website chat", "website_chat"],
    instagram: ["Instagram DM", "instagram_dm"],
    telegram: ["Telegram private bot chat", "telegram_private_bot_chat"],
  };
  const [label, kind] = channelMeta[id];
  const deliveryReady = overrides.deliveryReady === true;
  const connected = overrides.connected ?? deliveryReady;
  const available = overrides.available ?? true;
  const status =
    overrides.status ||
    (deliveryReady ? "ready" : connected ? "connected_blocked" : "needs_connection");
  const reasonCode = overrides.reasonCode || (deliveryReady ? "" : `${kind}_not_ready`);

  return {
    id,
    label,
    kind,
    status,
    connected,
    deliveryReady,
    available,
    reasonCode,
    account: null,
    readiness: {
      status: deliveryReady ? "ready" : "blocked",
      reasonCode,
      message: deliveryReady
        ? `${label} is ready for live delivery.`
        : `${label} is not ready for live delivery.`,
      blockers: [],
    },
    blockers: [],
    repairActions: [],
    capabilities: [kind],
    ...overrides,
  };
}

function createLaunchPosture(overrides = {}) {
  const channels = {
    website: createPostureChannel("website", {
      connected: true,
      deliveryReady: true,
    }),
    instagram: createPostureChannel("instagram", {
      connected: false,
      deliveryReady: false,
    }),
    telegram: createPostureChannel("telegram", {
      connected: true,
      deliveryReady: true,
    }),
    ...(overrides.channels || {}),
  };
  const deliveryReadyChannelIds = Object.entries(channels)
    .filter(([, channel]) => channel.deliveryReady === true)
    .map(([id]) => id);
  const connectedCount = Object.values(channels).filter(
    (channel) => channel.connected === true
  ).length;
  const truth = {
    ready: true,
    status: "ready",
    reasonCode: "",
    message: "Approved business info is available.",
    latestVersionId: "truth-1",
    ...(overrides.truth || {}),
  };
  const runtime = {
    ready: true,
    status: "ready",
    reasonCode: "",
    message: "Approved runtime authority is available.",
    ...(overrides.runtime || {}),
  };
  const channelSummary = {
    readyCount: deliveryReadyChannelIds.length,
    connectedCount,
    deliveryReadyChannelIds,
    selectedChannelId: deliveryReadyChannelIds[0] || "",
    ...(overrides.channelSummary || {}),
  };
  const launchReady =
    truth.ready === true &&
    runtime.ready === true &&
    channelSummary.readyCount > 0;

  return {
    ok: true,
    version: "launch_posture_v1",
    generatedAt: "2026-04-29T10:00:00.000Z",
    tenant: {
      id: "tenant-1",
      tenantKey: "acme",
    },
    scope: {
      id: "aihq_launch_v1_narrow",
      surfaces: [
        "home",
        "channels",
        "truth",
        "inbox",
        "website_chat",
        "instagram_dm",
        "telegram_private_bot_chat",
      ],
    },
    overall: {
      status: launchReady ? "ready" : "blocked",
      launchReady,
      title: launchReady ? "Launch posture ready" : "Launch posture blocked",
      message: launchReady
        ? "Approved business info, runtime, channel delivery, and inbox are ready."
        : "A launch dependency still needs review.",
      primaryAction: launchReady
        ? { label: "Open inbox", path: "/inbox" }
        : { label: "Open channels", path: "/channels" },
      secondaryAction: { label: "Open Business Info", path: "/truth" },
      ...(overrides.overall || {}),
    },
    truth,
    runtime,
    channels,
    channelSummary,
    inbox: {
      available: true,
      unreadCount: 0,
      openCount: 0,
      handoffCount: 0,
      assignedOpenCount: 0,
      pendingOutboundCount: 0,
      failedOutboundCount: 0,
      retryingOutboundCount: 0,
    },
    blockers: overrides.blockers || [],
    repairActions: overrides.repairActions || [],
    unavailable: overrides.unavailable || [],
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

  getLaunchPosture.mockResolvedValue(createLaunchPosture());
});

afterEach(() => {
  cleanup();
});

describe("ChannelCatalog", () => {
  it("renders the compact launch-channel mix after readiness loads", async () => {
    renderCatalog();

    expect(
      await screen.findByRole("heading", { name: /^launch channels$/i })
    ).toBeInTheDocument();

    expect(getLaunchPosture).toHaveBeenCalledTimes(1);
    expect(getSettingsTrustView).not.toHaveBeenCalled();
    expect(getMetaChannelStatus).not.toHaveBeenCalled();
    expect(getTelegramChannelStatus).not.toHaveBeenCalled();
    expect(getWebsiteWidgetStatus).not.toHaveBeenCalled();

    expect((await screen.findAllByText(/^website chat$/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/^instagram$/i)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^telegram$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^whatsapp$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^gmail$/i)).not.toBeInTheDocument();

    expect(document.body).toHaveTextContent(/2\/2 ready/i);

    await waitFor(() => {
      expect(screen.getAllByText(/^connected$/i).length).toBeGreaterThanOrEqual(
        2
      );
    });

    expect(
      screen.getAllByRole("button", { name: /details/i }).length
    ).toBeGreaterThanOrEqual(2);

    expect(screen.getAllByRole("button", { name: /^inbox$/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /^connect$/i })).toBeInTheDocument();
});

  it("uses posture channel readiness for primary card actions", async () => {
    renderCatalog();

    const websiteCard = await findChannelCard("Website chat");

    fireEvent.click(within(websiteCard).getByRole("button", { name: /^inbox$/i }));

    expect(navigate).toHaveBeenCalledWith("/inbox");

    const instagramCard = await findChannelCard("Instagram");

    await act(async () => {
      fireEvent.click(
        within(instagramCard).getByRole("button", { name: /^connect$/i })
      );
    });

    await waitFor(() => {
      expect(getMetaChannelStatus.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows a runtime pending warning from launch posture", async () => {
    getLaunchPosture.mockResolvedValue(
      createLaunchPosture({
        runtime: {
          ready: false,
          status: "blocked",
          reasonCode: "runtime_authority_unavailable",
          message: "Approved runtime authority is not ready for launch.",
        },
        overall: {
          status: "blocked",
          launchReady: false,
          title: "Runtime authority is not ready",
          message: "Approved runtime authority must be ready before launch.",
        },
      })
    );

    renderCatalog();

    await findChannelCard("Website chat");

    expect(document.body).toHaveTextContent(/runtime pending repair/i);
    expect(document.body).toHaveTextContent(/runtime still needs repair/i);
  });

  it("fails closed when launch posture is unavailable", async () => {
    getLaunchPosture.mockRejectedValue(new Error("posture down"));

    renderCatalog();

    expect(
      await screen.findByRole("heading", { name: /^launch channels$/i })
    ).toBeInTheDocument();

    expect(document.body).toHaveTextContent(/posture down/i);
    expect(document.body).toHaveTextContent(/0\/2 ready/i);
    expect(screen.queryAllByRole("button", { name: /^inbox$/i }).length).toBe(0);
    expect(screen.getAllByText(/^unavailable$/i).length).toBeGreaterThanOrEqual(2);
  });

  it("opens the Instagram modal with live tenant status", async () => {
    renderCatalog();

    const instagramCard = await findChannelCard("Instagram");

    await act(async () => {
      fireEvent.click(
        within(instagramCard).getByRole("button", { name: /details/i })
      );
    });

    await waitFor(() => {
      expect(getMetaChannelStatus.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getAllByText(/^instagram$/i).length).toBeGreaterThan(0);

    expect(
      await screen.findByText(/instagram is connected/i)
    ).toBeInTheDocument();

    expect(document.body).toHaveTextContent(
      /Inbound DMs can resolve against tenant runtime/i
    );
  });

  it("refreshes launch posture after a tenant-scoped launch mutation signal", async () => {
    let posture = createLaunchPosture();

    getLaunchPosture.mockImplementation(() => Promise.resolve(posture));

    renderCatalog();

    await findChannelCard("Instagram");

    await waitFor(() => {
      expect(screen.getAllByText(/^connected$/i).length).toBeGreaterThan(0);
    });

    const initialCallCount = getLaunchPosture.mock.calls.length;

    posture = createLaunchPosture({
      truth: {
        ready: false,
        status: "blocked",
        reasonCode: "approved_truth_unavailable",
        message: "Approved business info is unavailable.",
        latestVersionId: "",
      },
      runtime: {
        ready: false,
        status: "blocked",
        reasonCode: "approved_truth_unavailable",
        message: "Approved runtime authority is not ready for launch.",
      },
      overall: {
        status: "blocked",
        launchReady: false,
        title: "Business info needs approval",
        message: "Approve business info before launch posture can turn ready.",
      },
    });

    await act(async () => {
      emitLaunchSliceRefresh({
        tenantKey: "acme",
        reason: "test-refresh",
      });
    });

    await waitFor(() => {
      expect(getLaunchPosture.mock.calls.length).toBeGreaterThan(
        initialCallCount
      );
    });

    await waitFor(() => {
      expect(document.body).toHaveTextContent(/business info still needs approval/i);
    });
  });

  it("drops the previous tenant posture while the next tenant is still loading", async () => {
    let resolvePosture;

    const nextPosture = new Promise((resolve) => {
      resolvePosture = resolve;
    });

    const view = renderCatalog();

    await findChannelCard("Instagram");

    expect(screen.getAllByText(/^connected$/i).length).toBeGreaterThan(0);

    workspaceScope = {
      tenantKey: "globex",
      loading: false,
      ready: true,
    };

    getLaunchPosture.mockImplementationOnce(() => nextPosture);

    await act(async () => {
      rerenderCatalog(view);
    });

    await waitFor(() => {
      expect(getLaunchPosture).toHaveBeenCalledTimes(2);
    });
    expect(document.body).toHaveTextContent(/loading channels/i);

    await act(async () => {
      resolvePosture(
        createLaunchPosture({
          channels: {
            website: createPostureChannel("website", {
              connected: false,
              deliveryReady: false,
            }),
            instagram: createPostureChannel("instagram", {
              connected: false,
              deliveryReady: false,
            }),
            telegram: createPostureChannel("telegram", {
              connected: false,
              deliveryReady: false,
            }),
          },
          channelSummary: {
            readyCount: 0,
            connectedCount: 0,
            deliveryReadyChannelIds: [],
            selectedChannelId: "",
          },
          truth: {
            ready: false,
            status: "blocked",
            reasonCode: "approved_truth_unavailable",
            message: "Approved business info is unavailable.",
            latestVersionId: "",
          },
          runtime: {
            ready: false,
            status: "blocked",
            reasonCode: "approved_truth_unavailable",
            message: "Approved runtime authority is not ready for launch.",
          },
          overall: {
            status: "blocked",
            launchReady: false,
          },
        })
      );
    });

    await waitFor(() => {
      expect(document.body).toHaveTextContent(/0\/2 ready/i);
    });

    expect(await findChannelCard("Instagram")).toBeInTheDocument();
    expect(screen.queryByText(/^telegram$/i)).not.toBeInTheDocument();
    expect(await findChannelCard("Website chat")).toBeInTheDocument();

    expect(document.body).toHaveTextContent(/0\/2 ready/i);
  });
});

