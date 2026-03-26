import { describe, expect, it } from "vitest";

import { resolveAuthenticatedLanding } from "./appEntry.js";

describe("resolveAuthenticatedLanding", () => {
it("routes incomplete workspaces into setup studio", () => {
  const target = resolveAuthenticatedLanding({
    workspace: {
      progress: {
        setupCompleted: false,
        nextSetupRoute: "/setup/studio",
      },
    },
  });

  expect(target).toBe("/setup/studio");
});

it("routes completed workspaces into backend-provided core route", () => {
  const target = resolveAuthenticatedLanding({
    workspace: {
      progress: {
        setupCompleted: true,
        nextRoute: "/settings",
      },
    },
  });

  expect(target).toBe("/settings");
});

it("falls back to truth when completed workspace points at non-product root", () => {
  const target = resolveAuthenticatedLanding({
    workspace: {
      progress: {
        setupCompleted: true,
        nextRoute: "/",
      },
    },
  });

  expect(target).toBe("/truth");
});
});
