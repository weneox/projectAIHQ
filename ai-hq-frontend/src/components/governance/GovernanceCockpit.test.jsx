import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import GovernanceCockpit from "./GovernanceCockpit.jsx";

afterEach(() => {
  cleanup();
});

describe("GovernanceCockpit", () => {
  it("renders safe defaults when truth and runtime telemetry are sparse", () => {
    render(<GovernanceCockpit truth={{}} trust={{}} />);

    expect(screen.getByText(/governance cockpit/i)).toBeInTheDocument();
    expect(screen.getByText(/runtime telemetry unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/autonomy unknown/i)).toBeInTheDocument();
    expect(screen.getByText(/no canonical area summary was returned/i)).toBeInTheDocument();
  });

  it("renders runtime health details and dispatches the primary repair action", () => {
    const onRunAction = vi.fn();

    render(
      <GovernanceCockpit
        truth={{
          finalizeImpact: {
            canonicalAreas: ["profile"],
            runtimeAreas: ["voice"],
            affectedSurfaces: ["voice", "inbox"],
          },
          governance: {
            freshness: { bucket: "review" },
            support: { evidenceCount: 2, strongEvidenceCount: 1 },
          },
        }}
        trust={{
          summary: {
            truth: {
              latestVersionId: "truth-v2",
              approvedAt: "2026-03-25T10:00:00.000Z",
            },
            reviewQueue: {
              pending: 3,
              conflicts: 1,
            },
            runtimeProjection: {
              status: "stale",
              health: {
                status: "stale",
                reasonCodes: ["projection_stale", "truth_version_drift"],
                autonomousAllowed: false,
                affectedSurfaces: ["voice", "meta"],
                nextRecommendedRepair: {
                  id: "refresh_projection",
                  action: "refresh_projection",
                },
                lastKnownGood: {
                  runtimeProjectionId: "projection-1",
                  lastGoodAt: "2026-03-24T09:00:00.000Z",
                },
                lastFailure: {
                  errorCode: "projection_build_failed",
                  finishedAt: "2026-03-25T09:00:00.000Z",
                },
              },
              repair: {
                action: {
                  id: "open_setup_route",
                  kind: "route",
                  label: "Open runtime setup",
                  target: { path: "/setup/runtime" },
                },
              },
            },
          },
        }}
        onRunAction={onRunAction}
      />
    );

    expect(screen.getByText(/projection authority and repair/i)).toBeInTheDocument();
    expect(screen.getByText(/projection stale/i)).toBeInTheDocument();
    expect(screen.getByText(/truth version drift/i)).toBeInTheDocument();
    expect(screen.getByText(/voice/i)).toBeInTheDocument();
    expect(screen.getByText(/projection-1/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open runtime setup/i }));
    expect(onRunAction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "open_setup_route",
      })
    );
  });
});
