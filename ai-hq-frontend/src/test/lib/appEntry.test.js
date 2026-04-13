import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __test__,
  areInternalRoutesEnabled,
  CORE_APP_ROUTES,
  INTERNAL_ONLY_APP_ROUTES,
  isForcedWorkspaceEntryEnabled,
  isInternalOnlyPath,
  SETUP_WIDGET_ROUTE,
  resolveAuthenticatedLanding,
} from "../../lib/appEntry.js";

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

    expect(target).toBe("/home");
  });

  it("routes completed workspaces into the bounded launch slice", () => {
    const target = resolveAuthenticatedLanding({
      bootstrap: {
        workspace: {
          setupCompleted: true,
          workspaceReady: true,
          routeHint: "/workspace",
          destination: { path: "/workspace" },
        },
      },
    });

    expect(target).toBe("/home");
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

    expect(target).toBe("/home");
  });

  it("falls back to home when completed workspace points at non-product root", () => {
    const target = resolveAuthenticatedLanding({
      bootstrap: {
        workspace: {
          setupCompleted: true,
          workspaceReady: true,
          routeHint: "/",
        },
      },
    });

    expect(target).toBe("/home");
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

    expect(target).toBe("/home");
  });

  it("defines a bounded production route list and a separate internal-only route list", () => {
    expect(CORE_APP_ROUTES).toEqual([
      "/home",
      "/truth",
      "/inbox",
      "/channels",
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

  it("falls back to home when backend points a completed workspace at hidden legacy surfaces", () => {
    const target = resolveAuthenticatedLanding({
      bootstrap: {
        workspace: {
          setupCompleted: true,
          workspaceReady: true,
          routeHint: "/incidents",
        },
      },
    });

    expect(target).toBe("/home");
  });

  it("promotes home as the default completed landing when no better core route is provided", () => {
    const target = resolveAuthenticatedLanding({
      bootstrap: {
        workspace: {
          tenantKey: "acme",
          setupCompleted: true,
          workspaceReady: true,
        },
      },
    });

    expect(target).toBe("/home");
  });

  it("normalizes legacy workspace routes back into home for the launch slice", () => {
    const target = resolveAuthenticatedLanding({
      bootstrap: {
        workspace: {
          setupCompleted: true,
          workspaceReady: true,
          routeHint: "/workspace",
        },
      },
    });

    expect(target).toBe("/home");
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

    expect(target).toBe("/home");
  });

  it("normalizes legacy setup routes into the home widget entry", () => {
    expect(__test__.normalizeLegacyAppRoute("/setup")).toBe(SETUP_WIDGET_ROUTE);
    expect(__test__.normalizeLegacyAppRoute("/setup/business")).toBe(
      SETUP_WIDGET_ROUTE
    );
  });
});