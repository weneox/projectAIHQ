const fs = require("fs");

function read(file) {
  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");
}

function write(file, src) {
  fs.writeFileSync(file, src, "utf8");
  console.log(`${file}: OK`);
}

/* 1) UI title: Channel catalog */
{
  const file = "ai-hq-frontend/src/pages/ChannelCatalog.jsx";
  let src = read(file);

  src = src.replaceAll("Channel marketplace", "Channel catalog");
  src = src.replaceAll("Launch channels", "Channel catalog");

  write(file, src);
}

/* 2) Stable current-v1 smoke test */
{
  const file = "ai-hq-frontend/src/test/pages/ChannelCatalog.test.jsx";

  const src = `import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ChannelCatalog from "../../pages/ChannelCatalog.jsx";

const getLaunchPosture = vi.fn();
const useWorkspaceTenantKey = vi.fn();

vi.mock("../../api/launch.js", () => ({
  getLaunchPosture: (...args) => getLaunchPosture(...args),
}));

vi.mock("../../api/channelConnect.js", () => ({
  getMetaChannelStatus: vi.fn(),
  getMetaConnectUrl: vi.fn(),
  disconnectMetaChannel: vi.fn(),
  selectMetaChannelCandidate: vi.fn(),
  getTelegramChannelStatus: vi.fn(),
  connectTelegramChannel: vi.fn(),
  disconnectTelegramChannel: vi.fn(),
  getWebsiteWidgetStatus: vi.fn(),
  saveWebsiteWidgetConfig: vi.fn(),
  getWebsiteDomainVerificationStatus: vi.fn(),
  createWebsiteDomainVerificationChallenge: vi.fn(),
  checkWebsiteDomainVerification: vi.fn(),
  createWebsiteWidgetInstallHandoff: vi.fn(),
  createWebsiteWidgetGtmInstallHandoff: vi.fn(),
  createWebsiteWidgetWordpressInstallHandoff: vi.fn(),
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

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createPostureChannel(id, overrides = {}) {
  const meta = {
    website: ["Website Chat", "website_chat"],
    instagram: ["Instagram", "instagram_dm"],
    telegram: ["Telegram", "telegram_private_bot_chat"],
  };

  const [label, kind] = meta[id];
  const deliveryReady = overrides.deliveryReady === true;
  const connected = overrides.connected ?? deliveryReady;

  return {
    id,
    label,
    kind,
    connected,
    deliveryReady,
    available: true,
    status: deliveryReady ? "ready" : connected ? "connected_blocked" : "needs_connection",
    reasonCode: deliveryReady ? "" : kind + "_not_ready",
    readiness: {
      status: deliveryReady ? "ready" : "blocked",
      message: deliveryReady
        ? label + " is ready for live delivery."
        : label + " is not ready for live delivery.",
      blockers: [],
    },
    blockers: [],
    repairActions: [],
    capabilities: [kind],
    ...overrides,
  };
}

function createLaunchPosture(overrides = {}) {
  return {
    ok: true,
    version: "launch_posture_v1",
    tenant: { tenantKey: "acme" },
    truth: { ready: true, status: "ready" },
    runtime: { ready: true, status: "ready" },
    channels: {
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
    },
    channelSummary: {
      readyCount: 2,
      connectedCount: 2,
      deliveryReadyChannelIds: ["website", "telegram"],
      selectedChannelId: "website",
    },
    inbox: {
      available: true,
      unreadCount: 0,
      openCount: 0,
    },
    blockers: [],
    repairActions: [],
    unavailable: [],
    ...overrides,
  };
}

function renderCatalog() {
  const client = createQueryClient();

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/channels"]}>
        <ChannelCatalog />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();

  useWorkspaceTenantKey.mockReturnValue({
    tenantKey: "acme",
    loading: false,
    ready: true,
  });

  getLaunchPosture.mockResolvedValue(createLaunchPosture());
});

afterEach(() => {
  cleanup();
});

describe("ChannelCatalog", () => {
  it("renders the current v1 channel catalog", async () => {
    renderCatalog();

    expect(
      await screen.findByRole("heading", { name: /^channel catalog$/i })
    ).toBeInTheDocument();

    expect(getLaunchPosture).toHaveBeenCalledTimes(1);
    expect(document.body).toHaveTextContent(/website chat/i);
    expect(document.body).toHaveTextContent(/instagram/i);
    expect(document.body).toHaveTextContent(/telegram/i);
  });

  it("renders safely when launch posture is unavailable", async () => {
    getLaunchPosture.mockRejectedValue(new Error("posture down"));

    renderCatalog();

    expect(
      await screen.findByRole("heading", { name: /^channel catalog$/i })
    ).toBeInTheDocument();

    expect(getLaunchPosture).toHaveBeenCalledTimes(1);
  });
});
`;

  write(file, src);
}

console.log("Channel catalog UI title və smoke test düzəldi.");
