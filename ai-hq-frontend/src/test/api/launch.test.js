// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/designMode.js", () => ({
  getDesignModeApiResponse: vi.fn(),
  shouldMockApiRequest: vi.fn(() => false),
}));

import { getLaunchPosture } from "../../api/launch.js";

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    status: init.status || 200,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

function launchPosturePayload() {
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
      status: "blocked",
      launchReady: false,
      title: "Connect a launch channel",
      message: "One launch channel must be delivery ready.",
      primaryAction: { label: "Open channels", path: "/channels" },
      secondaryAction: { label: "Open setup", path: "/home?assistant=setup" },
    },
    truth: {
      ready: true,
      status: "ready",
      reasonCode: "",
      message: "Approved business info is available.",
      latestVersionId: "truth-v1",
    },
    runtime: {
      ready: true,
      status: "ready",
      reasonCode: "",
      message: "Approved runtime authority is available.",
    },
    channels: {
      website: {
        id: "website",
        label: "Website chat",
        kind: "website_chat",
        status: "needs_connection",
        connected: false,
        deliveryReady: false,
        available: true,
        reasonCode: "website_not_ready",
        account: null,
        readiness: { status: "blocked", blockers: [] },
        blockers: [],
        repairActions: [],
        capabilities: ["website_chat"],
      },
      instagram: {
        id: "instagram",
        label: "Instagram DM",
        kind: "instagram_dm",
        status: "needs_connection",
        connected: false,
        deliveryReady: false,
        available: true,
        reasonCode: "instagram_dm_not_ready",
        account: null,
        readiness: { status: "blocked", blockers: [] },
        blockers: [],
        repairActions: [],
        capabilities: ["instagram_dm"],
      },
      telegram: {
        id: "telegram",
        label: "Telegram private bot chat",
        kind: "telegram_private_bot_chat",
        status: "needs_connection",
        connected: false,
        deliveryReady: false,
        available: true,
        reasonCode: "telegram_private_bot_chat_not_ready",
        account: null,
        readiness: { status: "blocked", blockers: [] },
        blockers: [],
        repairActions: [],
        capabilities: ["telegram_private_bot_chat"],
      },
    },
    channelSummary: {
      readyCount: 0,
      connectedCount: 0,
      deliveryReadyChannelIds: [],
      selectedChannelId: "",
    },
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
    blockers: [],
    repairActions: [],
    unavailable: [],
  };
}

describe("launch api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getLaunchPosture calls the launch posture endpoint with included credentials", async () => {
    const payload = launchPosturePayload();
    const fetchMock = vi.fn(async () => jsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getLaunchPosture();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/launch/posture");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "GET",
      credentials: "include",
    });
    expect(result).toEqual(payload);
  });

  it("returns the posture payload without normalizing away backend fields", async () => {
    const payload = launchPosturePayload();
    payload.overall.status = "attention";
    payload.channelSummary.deliveryReadyChannelIds = ["website"];
    payload.channels.website.deliveryReady = true;
    payload.inbox.unreadCount = 3;
    payload.unavailable = [
      {
        surface: "telegram",
        reasonCode: "telegram_status_unavailable",
        message: "Telegram posture is unavailable.",
      },
    ];
    const fetchMock = vi.fn(async () => jsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getLaunchPosture()).resolves.toEqual(payload);
  });

  it("surfaces API errors through the shared API client behavior", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            ok: false,
            error: "LaunchPostureFailed",
            reason: "failed to load launch posture",
          },
          { status: 500 }
        )
      )
    );

    await expect(getLaunchPosture()).rejects.toMatchObject({
      message: "failed to load launch posture (LaunchPostureFailed)",
      status: 500,
      code: "LaunchPostureFailed",
      payload: {
        ok: false,
        error: "LaunchPostureFailed",
        reason: "failed to load launch posture",
      },
    });
  });
});
