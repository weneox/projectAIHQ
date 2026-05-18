import { describe, expect, it } from "vitest";

import * as readinessViewModel from "../../lib/readinessViewModel.js";
import {
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
});

describe("buildTruthOperationalState", () => {
  it("keeps truth management fail-closed when approved truth is missing", () => {
    const state = buildTruthOperationalState({
      summary: {
        truth: {
          latestVersionId: "",
          readiness: {
            status: "blocked",
            reasonCode: "approved_truth_unavailable",
            message: "Approved truth is not ready yet.",
            blockers: [],
          },
        },
        runtimeProjection: {
          health: {
            usable: false,
          },
          authority: {
            available: false,
          },
          readiness: {
            status: "blocked",
            blockers: [],
          },
        },
      },
    });

    expect(state.truthReady).toBe(false);
    expect(state.runtimeReady).toBe(false);
    expect(state.status).toBe("blocked");
    expect(state.action.path).toBe("/setup");
    expect(state.reasonCode).toBe("approved_truth_unavailable");
  });

  it("keeps truth management in repair posture when runtime is unhealthy", () => {
    const state = buildTruthOperationalState({
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
            usable: false,
            autonomousAllowed: false,
            repairAction: {
              id: "repair_runtime",
              kind: "route",
              label: "Repair runtime",
              target: {
                path: "/truth?panel=runtime",
              },
            },
          },
          authority: {
            available: false,
          },
          readiness: {
            status: "blocked",
            reasonCode: "runtime_repair_required",
            message: "Runtime projection still needs repair.",
            blockers: [],
          },
        },
      },
    });

    expect(state.truthReady).toBe(true);
    expect(state.runtimeReady).toBe(false);
    expect(state.status).toBe("attention");
    expect(state.action.path).toBe("/truth?panel=runtime");
    expect(state.reasonCode).toBe("runtime_repair_required");
  });

  it("keeps truth management healthy when approved truth and runtime align", () => {
    const state = buildTruthOperationalState({
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

    expect(state.truthReady).toBe(true);
    expect(state.runtimeReady).toBe(true);
    expect(state.status).toBe("ready");
    expect(state.action).toBeNull();
  });
});

describe("readinessViewModel launch posture boundary", () => {
  it("does not export obsolete launch decision helpers", () => {
    expect(readinessViewModel).not.toHaveProperty("buildLaunchChannelState");
    expect(readinessViewModel).not.toHaveProperty("buildMetaLaunchChannelState");
    expect(readinessViewModel).not.toHaveProperty(
      "buildTelegramLaunchChannelState"
    );
    expect(readinessViewModel).not.toHaveProperty(
      "buildWebsiteLaunchChannelState"
    );
    expect(readinessViewModel).not.toHaveProperty(
      "buildChannelTruthLaunchReadiness"
    );
  });
});
