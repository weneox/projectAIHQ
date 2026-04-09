import { describe, expect, it } from "vitest";

import {
  buildChannelTruthLaunchReadiness,
  buildWebsiteLaunchChannelState,
  buildTruthOperationalState,
  createReadinessViewModel,
} from "../../lib/readinessViewModel.js";

describe("createReadinessViewModel", () => {
  it("normalizes array and nested blocker shapes into one stable model", () => {
    const model = createReadinessViewModel({
      status: "blocked",
      blockers: {
        items: [
          {
            blocked: true,
            category: "runtime",
            dependencyType: "runtime_projection",
            reasonCode: "runtime_projection_missing",
            title: "Runtime projection blocker",
            missing: ["runtime_projection"],
            nextAction: {
              id: "open_setup_route",
              kind: "route",
              label: "Open runtime setup",
              requiredRole: "operator",
              allowed: true,
              target: {
                path: "/truth",
              },
            },
          },
        ],
      },
    });

    expect(model.status).toBe("blocked");
    expect(model.blockedItems).toHaveLength(1);
    expect(model.blockedItems[0].reasonCode).toBe("runtime_projection_missing");
    expect(model.blockedItems[0].action.kind).toBe("route");
  });

  it("treats enabled website chat as a connected channel even when delivery hardening is still blocked", () => {
    const channel = buildWebsiteLaunchChannelState({
      state: "blocked",
      widget: {
        enabled: true,
      },
      readiness: {
        status: "blocked",
        message: "Website chat is enabled, but installation hardening is still incomplete.",
      },
    });

    expect(channel.connected).toBe(true);
    expect(channel.deliveryReady).toBe(false);
    expect(channel.status).toBe("attention");
    expect(channel.action.path).toBe("/channels?channel=website");
  });

  it("treats website chat as a real launch path when it is the only ready channel", () => {
    const website = buildWebsiteLaunchChannelState({
      state: "connected",
      widget: {
        enabled: true,
        publicWidgetId: "widget_public_123",
      },
      readiness: {
        status: "ready",
        message:
          "Website chat is configured with a publishable install ID and trusted origin controls.",
      },
    });
    const truth = buildTruthOperationalState({
      summary: {
        truth: {
          latestVersionId: "truth-1",
          readiness: {
            status: "ready",
            blockers: [],
          },
        },
        runtimeProjection: {
          health: {
            usable: true,
            autonomousAllowed: true,
          },
          authority: {
            available: true,
          },
          readiness: {
            status: "ready",
            blockers: [],
          },
        },
      },
    });

    const readiness = buildChannelTruthLaunchReadiness({
      channels: [website],
      truthState: truth,
      surface: {
        unavailable: false,
        error: "",
      },
      copy: {
        channelsPath: "/channels",
        truthPath: "/truth",
      },
    });

    expect(readiness.status).toBe("ready");
    expect(readiness.action.path).toBe("/channels?channel=website");
    expect(readiness.title).toBe("Launch posture is healthy.");
  });
});
