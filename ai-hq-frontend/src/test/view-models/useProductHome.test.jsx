import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getLaunchPosture = vi.fn();
const getCurrentSetupAssistantSession = vi.fn();
const useWorkspaceTenantKey = vi.fn();
let workspaceScope = {
  tenantKey: "acme",
  loading: false,
  ready: true,
};

vi.mock("../../api/launch.js", () => ({
  getLaunchPosture: (...args) => getLaunchPosture(...args),
}));

vi.mock("../../api/setup.js", () => ({
  getCurrentSetupAssistantSession: (...args) =>
    getCurrentSetupAssistantSession(...args),
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
import { emitLaunchSliceRefresh } from "../../lib/launchSliceRefresh.js";

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

function createChannel(id, overrides = {}) {
  const labels = {
    website: ["Website chat", "website_chat"],
    instagram: ["Instagram DM", "instagram_dm"],
    telegram: ["Telegram private bot chat", "telegram_private_bot_chat"],
  };
  const [label, kind] = labels[id];
  const deliveryReady = overrides.deliveryReady === true;
  const connected = overrides.connected ?? deliveryReady;
  const available = overrides.available ?? true;
  const status =
    overrides.status ||
    (deliveryReady ? "ready" : connected ? "connected_blocked" : "needs_connection");
  const reasonCode =
    overrides.reasonCode ||
    (deliveryReady ? "" : `${kind}_not_ready`);

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
    website: createChannel("website", { connected: false, deliveryReady: false }),
    instagram: createChannel("instagram", {
      connected: false,
      deliveryReady: false,
    }),
    telegram: createChannel("telegram", {
      connected: true,
      deliveryReady: true,
      account: {
        botUsername: "acmebot",
      },
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
  const inbox = {
    available: true,
    unreadCount: 0,
    openCount: 0,
    handoffCount: 0,
    assignedOpenCount: 0,
    pendingOutboundCount: 0,
    failedOutboundCount: 0,
    retryingOutboundCount: 0,
    ...(overrides.inbox || {}),
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
    channelSummary.readyCount > 0 &&
    inbox.available === true;

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
        : { label: "Open setup", path: "/home?assistant=setup" },
      secondaryAction: { label: "Open channels", path: "/channels" },
      ...(overrides.overall || {}),
    },
    truth,
    runtime,
    channels,
    channelSummary,
    inbox,
    blockers: overrides.blockers || [],
    repairActions: overrides.repairActions || [],
    unavailable: overrides.unavailable || [],
  };
}

function createBlockedTruthPosture(overrides = {}) {
  return createLaunchPosture({
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
      primaryAction: { label: "Open setup", path: "/home?assistant=setup" },
      secondaryAction: { label: "Open channels", path: "/channels" },
    },
    ...overrides,
  });
}

describe("useProductHome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workspaceScope = {
      tenantKey: "acme",
      loading: false,
      ready: true,
    };

    getLaunchPosture.mockResolvedValue(createLaunchPosture());
    getCurrentSetupAssistantSession.mockResolvedValue(null);
    useWorkspaceTenantKey.mockImplementation(() => workspaceScope);
  });

  it("uses a connect CTA posture when Telegram is not connected", async () => {
    getLaunchPosture.mockResolvedValue(
      createLaunchPosture({
        channels: {
          telegram: createChannel("telegram", {
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
        overall: {
          status: "blocked",
          launchReady: false,
          title: "Connect a launch channel",
          message:
            "Website chat, Instagram DM, or Telegram private bot chat must be delivery ready before launch.",
          primaryAction: { label: "Open channels", path: "/channels" },
          secondaryAction: { label: "Open setup", path: "/home?assistant=setup" },
        },
      })
    );

    const { result } = renderHook(() => useProductHome(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(getLaunchPosture).toHaveBeenCalledTimes(1);
    expect(result.current.launchChannel.connected).toBe(false);
    expect(result.current.assistant.launchPosture).toBe("connect_channel");
    expect(result.current.primaryAction.path).toBe("/channels");
  });

  it("keeps setup as the next action when both approved truth and channel are missing", async () => {
    getLaunchPosture.mockResolvedValue(
      createBlockedTruthPosture({
        channels: {
          telegram: createChannel("telegram", {
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
      })
    );

    const { result } = renderHook(() => useProductHome(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.truthRuntime.truthReady).toBe(false);
    expect(result.current.launchChannel.connected).toBe(false);
    expect(result.current.primaryAction.path).toBe("/home?assistant=setup");
    expect(result.current.nextStep?.id).toBe("truth");
  });

  it("switches to setup-needed posture when Telegram is connected but truth/runtime is not ready", async () => {
    getLaunchPosture.mockResolvedValue(createBlockedTruthPosture());

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
    getLaunchPosture.mockResolvedValue(
      createLaunchPosture({
        runtime: {
          ready: false,
          status: "blocked",
          reasonCode: "runtime_authority_unavailable",
          message: "Approved runtime authority is not ready for launch.",
        },
        channels: {
          telegram: createChannel("telegram", {
            connected: true,
            deliveryReady: false,
            readiness: {
              status: "blocked",
              reasonCode: "runtime_authority_unavailable",
              message:
                "Inbound Telegram messages cannot reach the AI reply path until the approved runtime projection is ready.",
              blockers: [],
            },
          }),
        },
        channelSummary: {
          readyCount: 0,
          connectedCount: 1,
          deliveryReadyChannelIds: [],
          selectedChannelId: "",
        },
        overall: {
          status: "blocked",
          launchReady: false,
          title: "Runtime authority is not ready",
          message: "Approved runtime authority must be ready before launch.",
          primaryAction: { label: "Open setup", path: "/home?assistant=setup" },
          secondaryAction: { label: "Open channels", path: "/channels" },
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
    expect(result.current.truthRuntime.summary).toMatch(/runtime/i);
    expect(result.current.primaryAction.path).toBe("/home?assistant=setup");
  });

  it("moves into normal operation when Telegram, truth, and runtime are ready", async () => {
    getLaunchPosture.mockResolvedValue(
      createLaunchPosture({
        inbox: {
          available: true,
          unreadCount: 2,
          openCount: 4,
          handoffCount: 1,
          assignedOpenCount: 1,
          pendingOutboundCount: 2,
          failedOutboundCount: 1,
          retryingOutboundCount: 1,
        },
        overall: {
          status: "attention",
          launchReady: true,
          title: "Launch ready with inbox attention",
          message: "Launch prerequisites are ready and the inbox needs attention.",
          primaryAction: { label: "Reply now", path: "/inbox" },
          secondaryAction: { label: "Open channels", path: "/channels" },
        },
      })
    );

    const { result } = renderHook(() => useProductHome(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.launchChannel.connected).toBe(true);
    expect(result.current.truthRuntime.truthReady).toBe(true);
    expect(result.current.truthRuntime.ready).toBe(true);
    expect(result.current.inboxState.counts).toMatchObject({
      unreadCount: 2,
      openCount: 4,
      handoffCount: 1,
      pendingOutboundCount: 2,
      failedOutboundCount: 1,
      retryingOutboundCount: 1,
      outboundPending: 4,
    });
    expect(result.current.assistant.launchPosture).toBe("normal_operation");
    expect(result.current.assistant.setupNeeded).toBe(false);
    expect(result.current.primaryAction).toEqual({
      label: "Reply now",
      path: "/inbox",
    });
  });

  it("does not mark launch ready when inbox state is unavailable", async () => {
    getLaunchPosture.mockResolvedValue(
      createLaunchPosture({
        inbox: {
          available: false,
        },
        unavailable: [
          {
            surface: "inbox",
            reasonCode: "inbox_pressure_unavailable",
            message: "Inbox pressure could not be loaded.",
          },
        ],
        overall: {
          status: "unavailable",
          launchReady: false,
          title: "Inbox posture unavailable",
          message: "Inbox pressure must be available before launch.",
          primaryAction: { label: "Open inbox", path: "/inbox" },
          secondaryAction: { label: "Open channels", path: "/channels" },
        },
      })
    );

    const { result } = renderHook(() => useProductHome(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.launchChannel.connected).toBe(true);
    expect(result.current.truthRuntime.ready).toBe(true);
    expect(result.current.inboxState.status).toBe("unavailable");
    expect(result.current.availabilityNote?.description).toMatch(/inbox/i);
    expect(result.current.launchReady).toBe(false);
    expect(result.current.assistant.launchPosture).toBe("inbox_unavailable");
    expect(result.current.nextStep?.id).toBe("inbox");
    expect(result.current.primaryAction.path).toBe("/inbox");
  });

  it("treats website chat as a real launch channel when it is the only ready option", async () => {
    getLaunchPosture.mockResolvedValue(
      createLaunchPosture({
        channels: {
          telegram: createChannel("telegram", {
            connected: false,
            deliveryReady: false,
          }),
          website: createChannel("website", {
            connected: true,
            deliveryReady: true,
            account: {
              targetDomain: "acme.test",
              publicWidgetId: "ww_acme",
            },
          }),
        },
        channelSummary: {
          readyCount: 1,
          connectedCount: 1,
          deliveryReadyChannelIds: ["website"],
          selectedChannelId: "website",
        },
      })
    );

    const { result } = renderHook(() => useProductHome(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.launchChannel.provider).toBe("website");
    expect(result.current.launchChannel.readyCount).toBe(1);
    expect(result.current.launchChannel.connected).toBe(true);
    expect(result.current.launchChannel.deliveryReady).toBe(true);
    expect(result.current.launchChannel.action.path).toBe("/channels?channel=website");
  });

  it("keeps website chat out of the live launch channel when only testing handoffs are available", async () => {
    getLaunchPosture.mockResolvedValue(
      createLaunchPosture({
        channels: {
          telegram: createChannel("telegram", {
            connected: false,
            deliveryReady: false,
          }),
          website: createChannel("website", {
            connected: true,
            deliveryReady: false,
            status: "testing_only",
            reasonCode: "website_testing_only",
            readiness: {
              status: "blocked",
              reasonCode: "website_testing_only",
              message:
                "Website chat is available for test handoff only and is not ready for production delivery.",
              blockers: [],
            },
          }),
        },
        channelSummary: {
          readyCount: 0,
          connectedCount: 1,
          deliveryReadyChannelIds: [],
          selectedChannelId: "",
        },
        overall: {
          status: "blocked",
          launchReady: false,
          title: "Connect a launch channel",
          message:
            "Website chat, Instagram DM, or Telegram private bot chat must be delivery ready before launch.",
          primaryAction: { label: "Open channels", path: "/channels" },
          secondaryAction: { label: "Open setup", path: "/home?assistant=setup" },
        },
      })
    );

    const { result } = renderHook(() => useProductHome(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.launchChannel.deliveryReady).toBe(false);
    expect(result.current.assistant.launchPosture).toBe("connect_channel");
    expect(result.current.primaryAction.path).toBe("/channels");
  });

  it("does not reuse another workspace's cached launch posture", async () => {
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    workspaceScope = {
      tenantKey: "acme",
      loading: false,
      ready: true,
    };

    const first = renderHook(() => useProductHome(), { wrapper });

    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
    });

    expect(getLaunchPosture).toHaveBeenCalledTimes(1);
    first.unmount();

    workspaceScope = {
      tenantKey: "globex",
      loading: false,
      ready: true,
    };

    const second = renderHook(() => useProductHome(), { wrapper });

    await waitFor(() => {
      expect(second.result.current.loading).toBe(false);
    });

    expect(getLaunchPosture).toHaveBeenCalledTimes(2);
  });

  it("refreshes home posture when a launch-slice mutation is emitted for the active tenant", async () => {
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    getLaunchPosture
      .mockResolvedValueOnce(createLaunchPosture())
      .mockResolvedValueOnce(createBlockedTruthPosture());

    const { result } = renderHook(() => useProductHome(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.truthRuntime.ready).toBe(true);

    emitLaunchSliceRefresh({
      tenantKey: "acme",
      reason: "launch-mutation",
    });

    await waitFor(() => {
      expect(getLaunchPosture).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(result.current.truthRuntime.ready).toBe(false);
    });
  });

  it("ignores launch refresh signals for a different tenant", async () => {
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    getLaunchPosture.mockResolvedValueOnce(createLaunchPosture());

    const { result } = renderHook(() => useProductHome(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    emitLaunchSliceRefresh({
      tenantKey: "globex",
      reason: "other-tenant-mutation",
    });

    await new Promise((resolve) => window.setTimeout(resolve, 25));

    expect(getLaunchPosture).toHaveBeenCalledTimes(1);
    expect(result.current.truthRuntime.ready).toBe(true);
  });

  it("keeps live launch posture fail-closed when only a partial setup draft exists", async () => {
    getLaunchPosture.mockResolvedValue(createBlockedTruthPosture());

    getCurrentSetupAssistantSession.mockResolvedValue({
      session: {
        id: "session-partial",
        draftVersion: 3,
      },
      setup: {
        draft: {
          businessProfile: {
            websiteUrl: "https://partial.example",
          },
          services: [{ key: "svc-1", title: "Consultation" }],
          contacts: [],
          hours: [],
          version: 3,
        },
        summary: {
          hasAnyDraft: true,
          blockerCount: 3,
          sectionStatus: {
            profile: { status: "needs_review" },
            services: { status: "needs_review" },
          },
        },
        review: {
          message: "Weak website extraction still needs confirmation before approval.",
        },
        websitePrefill: {
          websiteUrl: "https://partial.example",
        },
      },
    });

    const { result } = renderHook(() => useProductHome(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.launchReady).toBe(false);
    expect(result.current.truthRuntime.truthReady).toBe(false);
    expect(result.current.assistant.launchPosture).toBe("setup_needed");
    expect(result.current.nextStep?.id).toBe("truth");
  });

  it("does not demote a healthy launch path just because a fresh rescan draft exists", async () => {
    getCurrentSetupAssistantSession.mockResolvedValue({
      session: {
        id: "session-rescan",
        draftVersion: 6,
      },
      setup: {
        draft: {
          businessProfile: {
            websiteUrl: "https://live.example",
            companyName: "Live Example",
          },
          services: [{ key: "svc-1", title: "Consultation" }],
          contacts: [{ key: "contact-1", label: "Phone" }],
          hours: [{ key: "hours-1", label: "Mon-Fri" }],
          version: 6,
        },
        summary: {
          hasAnyDraft: true,
          blockerCount: 2,
          sectionStatus: {
            profile: { status: "needs_review" },
          },
        },
        review: {
          message: "Fresh rescan draft still needs review, but approved truth remains live.",
        },
      },
    });

    const { result } = renderHook(() => useProductHome(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.truthRuntime.ready).toBe(true);
    expect(result.current.launchReady).toBe(true);
    expect(result.current.assistant.launchPosture).toBe("normal_operation");
  });

  it("keeps Home fail-closed when launch posture is unavailable", async () => {
    getLaunchPosture.mockRejectedValue(new Error("launch posture unavailable"));

    const { result } = renderHook(() => useProductHome(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("launch posture unavailable");
    expect(result.current.launchReady).toBe(false);
    expect(result.current.truthRuntime.truthReady).toBe(false);
    expect(result.current.truthRuntime.ready).toBe(false);
    expect(result.current.launchChannel.deliveryReady).toBe(false);
    expect(result.current.inboxState.status).toBe("unavailable");
    expect(result.current.availabilityNote?.description).toMatch(/launch posture/i);
  });
});
