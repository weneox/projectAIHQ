import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAppSessionContext = vi.fn();
const getSetupOverview = vi.fn();
const getSettingsTrustView = vi.fn();
const getTruthReviewWorkbench = vi.fn();
const listInboxThreads = vi.fn();
const getOutboundSummary = vi.fn();
const getTelegramChannelStatus = vi.fn();
const getCurrentOnboardingSession = vi.fn();

vi.mock("../../lib/appSession.js", () => ({
  getAppSessionContext: (...args) => getAppSessionContext(...args),
}));

vi.mock("../../api/setup.js", () => ({
  getSetupOverview: (...args) => getSetupOverview(...args),
}));

vi.mock("../../api/trust.js", () => ({
  getSettingsTrustView: (...args) => getSettingsTrustView(...args),
}));

vi.mock("../../api/truth.js", () => ({
  getTruthReviewWorkbench: (...args) => getTruthReviewWorkbench(...args),
}));

vi.mock("../../api/inbox.js", () => ({
  listInboxThreads: (...args) => listInboxThreads(...args),
  getOutboundSummary: (...args) => getOutboundSummary(...args),
}));

vi.mock("../../api/channelConnect.js", () => ({
  getTelegramChannelStatus: (...args) => getTelegramChannelStatus(...args),
}));

vi.mock("../../api/onboarding.js", () => ({
  getCurrentOnboardingSession: (...args) => getCurrentOnboardingSession(...args),
}));

import useProductHome from "../../view-models/useProductHome.js";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
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

    getAppSessionContext.mockResolvedValue({
      actorName: "Owner",
      bootstrap: {
        workspace: {
          companyName: "Acme Clinic",
        },
      },
      auth: {
        tenant: {
          company_name: "Acme Clinic",
        },
      },
    });
    getSetupOverview.mockResolvedValue({});
    getSettingsTrustView.mockResolvedValue(createTrustView());
    getTruthReviewWorkbench.mockResolvedValue({ items: [] });
    listInboxThreads.mockResolvedValue({ threads: [] });
    getOutboundSummary.mockResolvedValue({ pendingCount: 0 });
    getTelegramChannelStatus.mockResolvedValue(createTelegramStatus());
    getCurrentOnboardingSession.mockResolvedValue(null);
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
    expect(result.current.onboardingNeeded).toBe(false);
    expect(result.current.onboardingState.launchPosture).toBe("connect_channel");
    expect(result.current.currentStatus.action.path).toBe("/channels?channel=telegram");
  });

  it("switches to onboarding-needed posture when Telegram is connected but truth/runtime is not ready", async () => {
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

    getCurrentOnboardingSession.mockResolvedValue({
      session: {
        id: "session-1",
        draftVersion: 2,
      },
      onboarding: {
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
    expect(result.current.onboardingNeeded).toBe(true);
    expect(result.current.onboardingState.launchPosture).toBe("onboarding_needed");
    expect(result.current.currentStatus.action.path).toBe("/home?assistant=setup");
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
    expect(result.current.onboardingNeeded).toBe(true);
    expect(result.current.truthRuntime.summary).toMatch(/strict runtime projection/i);
    expect(result.current.currentStatus.title).not.toMatch(/aligned|ready/i);
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
    expect(result.current.onboardingNeeded).toBe(false);
    expect(result.current.onboardingState.launchPosture).toBe("normal_operation");
    expect(result.current.currentStatus.action.path).toBe("/inbox");
  });
});
