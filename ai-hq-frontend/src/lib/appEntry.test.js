import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  areInternalRoutesEnabled,
  CORE_APP_ROUTES,
  INTERNAL_ONLY_APP_ROUTES,
  isForcedWorkspaceEntryEnabled,
  isInternalOnlyPath,
  resolveAuthenticatedLanding,
} from "./appEntry.js";

describe("resolveAuthenticatedLanding", () => {
  const originalForceWorkspaceEntry = import.meta.env?.VITE_FORCE_WORKSPACE_ENTRY;

  beforeEach(() => {
    import.meta.env.VITE_FORCE_WORKSPACE_ENTRY = "";
  });

  afterEach(() => {
    import.meta.env.VITE_FORCE_WORKSPACE_ENTRY = originalForceWorkspaceEntry;
  });

  it("routes incomplete workspaces into setup studio", () => {
    const target = resolveAuthenticatedLanding({
      bootstrap: {
        workspace: {
          setupCompleted: false,
          setupRequired: true,
          workspaceReady: false,
          nextSetupRoute: "/setup",
          destination: { path: "/setup" },
        },
      },
    });

    expect(target).toBe("/setup");
  });

  it("routes completed workspaces into backend-provided core route", () => {
    const target = resolveAuthenticatedLanding({
      bootstrap: {
        workspace: {
          setupCompleted: true,
          workspaceReady: true,
          routeHint: "/settings",
          destination: { path: "/settings" },
        },
      },
    });

    expect(target).toBe("/expert");
  });

  it("prefers explicit workspace destination paths from bootstrap", () => {
    const target = resolveAuthenticatedLanding({
      bootstrap: {
        workspace: {
          setupCompleted: false,
          setupRequired: true,
          workspaceReady: false,
          destination: {
            path: "/setup",
          },
        },
      },
    });

    expect(target).toBe("/setup");
  });

  it("falls back to workspace when completed workspace points at non-product root", () => {
    const target = resolveAuthenticatedLanding({
      bootstrap: {
        workspace: {
          setupCompleted: true,
          workspaceReady: true,
          routeHint: "/",
        },
      },
    });

    expect(target).toBe("/workspace");
  });

  it("refuses internal-only routes as authenticated landing targets", () => {
    const target = resolveAuthenticatedLanding({
      bootstrap: {
        workspace: {
          setupCompleted: true,
          workspaceReady: true,
          routeHint: "/analytics",
        },
      },
    });

    expect(target).toBe("/workspace");
  });

  it("defines a bounded production route list and a separate internal-only route list", () => {
    expect(CORE_APP_ROUTES).toEqual([
      "/workspace",
      "/truth",
      "/publish",
      "/expert",
      "/settings",
      "/inbox",
    ]);

    expect(INTERNAL_ONLY_APP_ROUTES).toEqual([
      "/command-demo",
      "/analytics",
      "/agents",
      "/threads",
    ]);

    expect(isInternalOnlyPath("/agents")).toBe(true);
    expect(isInternalOnlyPath("/truth")).toBe(false);
  });

  it("keeps internal routes disabled by default", () => {
    expect(areInternalRoutesEnabled()).toBe(false);
  });

  it("keeps forced workspace entry disabled by default", () => {
    expect(isForcedWorkspaceEntryEnabled()).toBe(false);
  });

  it("falls back to truth when backend points a completed workspace at operator-only surfaces", () => {
    const target = resolveAuthenticatedLanding({
      bootstrap: {
        workspace: {
          setupCompleted: true,
          workspaceReady: true,
          routeHint: "/incidents",
        },
      },
    });

    expect(target).toBe("/workspace");
  });

  it("promotes workspace as the default completed landing when no better core route is provided", () => {
    const target = resolveAuthenticatedLanding({
      bootstrap: {
        workspace: {
          tenantKey: "acme",
          setupCompleted: true,
          workspaceReady: true,
        },
      },
    });

    expect(target).toBe("/workspace");
  });

  it("accepts expert as a first-class authenticated route", () => {
    const target = resolveAuthenticatedLanding({
      bootstrap: {
        workspace: {
          setupCompleted: true,
          workspaceReady: true,
          routeHint: "/expert",
        },
      },
    });

    expect(target).toBe("/expert");
  });

  it("trusts the canonical backend setup route for incomplete workspaces", () => {
    const target = resolveAuthenticatedLanding({
      bootstrap: {
        workspace: {
          setupCompleted: false,
          setupRequired: true,
          workspaceReady: false,
          routeHint: "/setup",
          nextSetupRoute: "/setup",
        },
      },
    });

    expect(target).toBe("/setup");
  });
});

