import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSetupState = vi.fn();
const getCurrentSetupAssistantSession = vi.fn();
const getSettingsTrustView = vi.fn();
const listInboxThreads = vi.fn();
const getOutboundSummary = vi.fn();
const getMetaChannelStatus = vi.fn();
const getTelegramChannelStatus = vi.fn();
const getWebsiteWidgetStatus = vi.fn();
const useWorkspaceTenantKey = vi.fn();
let workspaceScope = {
  tenantKey: "acme",
  loading: false,
  ready: true,
};

vi.mock("../../api/setup.js", () => ({
  getSetupState: (...args) => getSetupState(...args),
  getCurrentSetupAssistantSession: (...args) =>
    getCurrentSetupAssistantSession(...args),
}));

vi.mock("../../api/trust.js", () => ({
  getSettingsTrustView: (...args) => getSettingsTrustView(...args),
}));

vi.mock("../../api/inbox.js", () => ({
  listInboxThreads: (...args) => listInboxThreads(...args),
  getOutboundSummary: (...args) => getOutboundSummary(...args),
}));

vi.mock("../../api/channelConnect.js", () => ({
  getMetaChannelStatus: (...args) => getMetaChannelStatus(...args),
  getTelegramChannelStatus: (...args) => getTelegramChannelStatus(...args),
  getWebsiteWidgetStatus: (...args) => getWebsiteWidgetStatus(...args),
}));

vi.mock("../../hooks/useWorkspaceTenantKey.js", () => ({
  useWorkspaceTenantKey: (...args) => useWorkspaceTenantKey(...args),
  buildWorkspaceScopedQueryKey: (baseKey, tenantKey) => [
    ...(Array.isArray(baseKey) ? baseKey : [baseKey]),
    "workspace",
    String(tenantKey || "").trim().toLowerCase(),
  ],
}));

import useProductHome from "../../view-models/useProductHome.js";

function createWrapper(queryClient = null) {
  const client =
    queryClient ||
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

  return function Wrapper({ children }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function createTrustView(overrides = {}) {
  return {
    summary: {
      truth: {
        latestVersionId: "truth-1",
        readiness: {
          status: "ready",
        },
      },
      runtimeProjection: {
        readiness: {
          status: "ready",
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
    recentRuns: [],
    ...overrides,
  };
}

function createTelegramStatus(overrides = {}) {
  return {
    connected: true,
    state: "connected",
    readiness: {
      message: "Telegram bot, webhook, and tenant runtime are ready for live delivery.",
    },
    runtime: {
      deliveryReady: true,
    },
    account: {
      botUsername: "acmebot",
    },
    ...overrides,
  };
}

describe("useProductHome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workspaceScope = {
      tenantKey: "acme",
      loading: false,
      ready: true,
    };

    getSetupState.mockResolvedValue({});
    getSettingsTrustView.mockResolvedValue(createTrustView());
    listInboxThreads.mockResolvedValue({ threads: [] });
    getOutboundSummary.mockResolvedValue({ pendingCount: 0 });
    getMetaChannelStatus.mockRejectedValue(new Error("meta unavailable"));
    getTelegramChannelStatus.mockResolvedValue(createTelegramStatus());
    getWebsiteWidgetStatus.mockRejectedValue(new Error("website unavailable"));
    getCurrentSetupAssistantSession.mockResolvedValue(null);
    useWorkspaceTenantKey.mockImplementation(() => workspaceScope);
  });

  it("uses a connect CTA posture when Telegram is not connected", async () => {
    getTelegramChannelStatus.mockResolvedValue(
      createTelegramStatus({
        connected: false,
        state: "disconnected",
        runtime: {
          deliveryReady: false,
        },
      })
    );

    const { result } = renderHook(() => useProductHome(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.launchChannel.connected).toBe(false);
    expect(result.current.assistant.launchPosture).toBe("connect_channel");
    expect(result.current.primaryAction.path).toBe("/channels?channel=telegram");
  });

  it("switches to setup-needed posture when Telegram is connected but truth/runtime is not ready", async () => {
    getSettingsTrustView.mockResolvedValue(
      createTrustView({
        summary: {
          truth: {
            latestVersionId: "",
            readiness: {
              status: "blocked",
              reasonCode: "approved_truth_unavailable",
            },
          },
          runtimeProjection: {
            readiness: {
              status: "blocked",
            },
            health: {
              usable: false,
              reasonCode: "approved_truth_unavailable",
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

    getCurrentSetupAssistantSession.mockResolvedValue({
      session: {
        id: "session-1",
        draftVersion: 2,
      },
      setup: {
        draft: {
          businessProfile: {
            websiteUrl: "https://acme.test",
          },
          services: [],
          contacts: [],
          hours: [],
          version: 2,
        },
        summary: {
          hasAnyDraft: true,
        },
        review: {
          message: "Draft answers remain isolated until approval exists.",
        },
        websitePrefill: {
          websiteUrl: "https://acme.test",
        },
      },
    });

    const { result } = renderHook(() => useProductHome(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.launchChannel.connected).toBe(true);
    expect(result.current.truthRuntime.ready).toBe(false);
    expect(result.current.assistant.launchPosture).toBe("setup_needed");
    expect(result.current.assistant.setupNeeded).toBe(true);
    expect(result.current.primaryAction.path).toBe("/home?assistant=setup");
  });

  it("keeps home truthful when Telegram is connected but runtime is still unavailable", async () => {
    getSettingsTrustView.mockResolvedValue(
      createTrustView({
        summary: {
          truth: {
            latestVersionId: "truth-1",
            readiness: {
              status: "ready",
            },
          },
          runtimeProjection: {
            readiness: {
              status: "blocked",
              reasonCode: "runtime_projection_missing",
            },
            health: {
              usable: false,
              reasonCode: "runtime_projection_missing",
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

    getTelegramChannelStatus.mockResolvedValue(
      createTelegramStatus({
        runtime: {
          deliveryReady: false,
        },
        readiness: {
          message: "Inbound Telegram messages cannot reach the AI reply path until the approved runtime projection is ready.",
        },
      })
    );

    const { result } = renderHook(() => useProductHome(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.truthRuntime.ready).toBe(false);
    expect(result.current.assistant.launchPosture).toBe("runtime_repair_needed");
    expect(result.current.truthRuntime.summary).toMatch(/runtime projection/i);
    expect(result.current.launchHeadline).not.toMatch(/aligned|ready/i);
  });

  it("moves into normal operation when Telegram, truth, and runtime are ready", async () => {
    const { result } = renderHook(() => useProductHome(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.launchChannel.connected).toBe(true);
    expect(result.current.truthRuntime.ready).toBe(true);
    expect(result.current.assistant.launchPosture).toBe("normal_operation");
    expect(result.current.assistant.setupNeeded).toBe(false);
    expect(result.current.primaryAction.path).toBe("/inbox");
  });

  it("treats website chat as a real launch channel when it is the only ready option", async () => {
    getTelegramChannelStatus.mockRejectedValue(new Error("telegram unavailable"));
    getWebsiteWidgetStatus.mockResolvedValue({
      state: "connected",
      readiness: {
        status: "ready",
        message: "Website chat is configured with trusted origins and a live widget ID.",
      },
      widget: {
        enabled: true,
        title: "Website chat",
        websiteUrl: "https://acme.test",
        publicWidgetId: "ww_acme",
      },
    });

    const { result } = renderHook(() => useProductHome(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.launchChannel.provider).toBe("website");
    expect(result.current.launchChannel.connected).toBe(true);
    expect(result.current.launchChannel.action.path).toBe("/channels?channel=website");
  });

  it("does not reuse another workspace's cached launch posture", async () => {
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    workspaceScope = {
      tenantKey: "acme",
      loading: false,
      ready: true,
    };
    getSetupState.mockResolvedValueOnce({});

    const first = renderHook(() => useProductHome(), { wrapper });

    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
    });

    expect(getSetupState).toHaveBeenCalledTimes(1);
    first.unmount();

    workspaceScope = {
      tenantKey: "globex",
      loading: false,
      ready: true,
    };
    getSetupState.mockResolvedValueOnce({});

    const second = renderHook(() => useProductHome(), { wrapper });

    await waitFor(() => {
      expect(second.result.current.loading).toBe(false);
    });

    expect(getSetupState).toHaveBeenCalledTimes(2);
  });
});
