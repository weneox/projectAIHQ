import test from "node:test";
import assert from "node:assert/strict";

import { resolveAuthenticatedLanding } from "./appEntry.js";

test("routes incomplete workspaces into setup studio", () => {
  const target = resolveAuthenticatedLanding({
    workspace: {
      progress: {
        setupCompleted: false,
        nextSetupRoute: "/setup/studio",
      },
    },
  });

  assert.equal(target, "/setup/studio");
});

test("routes completed workspaces into backend-provided core route", () => {
  const target = resolveAuthenticatedLanding({
    workspace: {
      progress: {
        setupCompleted: true,
        nextRoute: "/settings",
      },
    },
  });

  assert.equal(target, "/settings");
});

test("falls back to truth when completed workspace points at non-product root", () => {
  const target = resolveAuthenticatedLanding({
    workspace: {
      progress: {
        setupCompleted: true,
        nextRoute: "/",
      },
    },
  });

  assert.equal(target, "/truth");
});
