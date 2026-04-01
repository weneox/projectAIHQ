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

    expect(target).toBe("/expert");
  });

  it("prefers explicit workspace destination paths from bootstrap", () => {
    const target = resolveAuthenticatedLanding({
      workspace: {
        setupCompleted: false,
        destination: {
          path: "/setup/studio",
        },
      },
    });

    expect(target).toBe("/setup/studio");
  });

  it("falls back to workspace when completed workspace points at non-product root", () => {
    const target = resolveAuthenticatedLanding({
      workspace: {
        progress: {
          setupCompleted: true,
          nextRoute: "/",
        },
      },
    });

    expect(target).toBe("/workspace");
  });

  it("refuses internal-only routes as authenticated landing targets", () => {
    const target = resolveAuthenticatedLanding({
      workspace: {
        progress: {
          setupCompleted: true,
          nextRoute: "/analytics",
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
      workspace: {
        progress: {
          setupCompleted: true,
          nextRoute: "/incidents",
        },
      },
    });

    expect(target).toBe("/workspace");
  });

  it("promotes workspace as the default completed landing when no better core route is provided", () => {
    const target = resolveAuthenticatedLanding({
      workspace: {
        progress: {
          setupCompleted: true,
        },
      },
    });

    expect(target).toBe("/workspace");
  });

  it("accepts expert as a first-class authenticated route", () => {
    const target = resolveAuthenticatedLanding({
      workspace: {
        progress: {
          setupCompleted: true,
          nextRoute: "/expert",
        },
      },
    });

    expect(target).toBe("/expert");
  });
});
