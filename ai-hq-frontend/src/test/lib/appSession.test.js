import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthMe = vi.fn();
const getAppBootstrap = vi.fn();

async function loadAppSessionModule() {
  vi.resetModules();
  vi.doMock("../../api/auth.js", () => ({
    getAuthMe: (...args) => getAuthMe(...args),
  }));
  vi.doMock("../../api/app.js", () => ({
    getAppBootstrap: (...args) => getAppBootstrap(...args),
  }));
  return import("../../lib/appSession.js");
}

describe("appSession", () => {
  let appSession;

  beforeEach(async () => {
    vi.clearAllMocks();
    appSession = await loadAppSessionModule();
    appSession.clearAppSessionContext();
    getAuthMe.mockResolvedValue({
      authenticated: true,
      user: { tenantKey: "acme", full_name: "Owner", role: "owner" },
    });
    getAppBootstrap.mockResolvedValue({
      workspace: { tenantKey: "acme", setupCompleted: true, nextRoute: "/workspace" },
      viewerRole: "owner",
    });
  });

  it("loads auth context without fetching bootstrap", async () => {
    const auth = await appSession.getAppAuthContext();

    expect(auth.authenticated).toBe(true);
    expect(auth.resolved).toBe(true);
    expect(auth.unavailable).toBe(false);
    expect(getAuthMe).toHaveBeenCalledTimes(1);
    expect(getAppBootstrap).not.toHaveBeenCalled();
  });

  it("loads bootstrap context without fetching auth", async () => {
    const bootstrap = await appSession.getAppBootstrapContext();

    expect(bootstrap.workspace.tenantKey).toBe("acme");
    expect(getAppBootstrap).toHaveBeenCalledTimes(1);
    expect(getAuthMe).not.toHaveBeenCalled();
  });

  it("treats unauthenticated auth responses as valid non-error state", async () => {
    getAuthMe.mockResolvedValueOnce({ authenticated: false, user: null });

    const auth = await appSession.getAppAuthContext();

    expect(auth.authenticated).toBe(false);
    expect(auth.resolved).toBe(true);
    expect(auth.unavailable).toBe(false);
    expect(auth.error).toBeNull();
  });

  it("composes session context from shared auth and bootstrap caches", async () => {
    const session = await appSession.getAppSessionContext();

    expect(session.tenantKey).toBe("acme");
    expect(session.actorName).toBe("Owner");
    expect(session.viewerRole).toBe("owner");
    expect(session.bootstrapAvailable).toBe(true);
    expect(getAuthMe).toHaveBeenCalledTimes(1);
    expect(getAppBootstrap).toHaveBeenCalledTimes(1);

    await appSession.getAppSessionContext();
    expect(getAuthMe).toHaveBeenCalledTimes(1);
    expect(getAppBootstrap).toHaveBeenCalledTimes(1);
  });

  it("clears auth and bootstrap caches explicitly", async () => {
    await appSession.getAppAuthContext();
    await appSession.getAppBootstrapContext();

    appSession.clearAppAuthContext();
    appSession.clearAppBootstrapContext();

    await appSession.getAppAuthContext();
    await appSession.getAppBootstrapContext();

    expect(getAuthMe).toHaveBeenCalledTimes(2);
    expect(getAppBootstrap).toHaveBeenCalledTimes(2);
  });

  it("returns a safe auth fallback when auth loading fails", async () => {
    getAuthMe.mockRejectedValueOnce(new Error("auth offline"));

    const auth = await appSession.getAppAuthContext();

    expect(auth.authenticated).toBe(false);
    expect(auth.unavailable).toBe(true);
    expect(auth.transientFailure).toBe(true);
    expect(auth.error).toBe("Auth session unavailable");
    expect(auth.reason).toBe("auth offline");
  });

  it("returns a safe bootstrap fallback when bootstrap loading fails", async () => {
    getAppBootstrap.mockRejectedValueOnce(new Error("bootstrap offline"));

    const bootstrap = await appSession.getAppBootstrapContext();

    expect(bootstrap.ok).toBe(false);
    expect(bootstrap.error).toBe("bootstrap offline");
    expect(bootstrap.viewerRole).toBe("");
  });

  it("keeps authenticated session context available when bootstrap loading fails", async () => {
    getAppBootstrap.mockRejectedValueOnce(new Error("bootstrap offline"));

    const session = await appSession.getAppSessionContext();

    expect(session.auth.authenticated).toBe(true);
    expect(session.viewerRole).toBe("owner");
    expect(session.bootstrapAvailable).toBe(true);
    expect(session.bootstrap.ok).toBe(false);
    expect(session.bootstrap.error).toBe("bootstrap offline");
    expect(getAuthMe).toHaveBeenCalledTimes(1);
    expect(getAppBootstrap).toHaveBeenCalledTimes(1);
  });

  it("keeps the last composed session visible while a forced auth refresh falls back", async () => {
    const session = await appSession.getAppSessionContext();

    expect(session.viewerRole).toBe("owner");
    expect(appSession.peekAppAuthContext()?.authenticated).toBe(true);
    expect(appSession.peekAppBootstrapContext()?.workspace?.tenantKey).toBe("acme");
    expect(appSession.peekAppSessionContext()?.viewerRole).toBe("owner");

    getAuthMe.mockRejectedValueOnce(new Error("auth offline"));

    const fallbackAuth = await appSession.getAppAuthContext({ force: true });

    expect(fallbackAuth.authenticated).toBe(false);
    expect(fallbackAuth.unavailable).toBe(true);
    expect(appSession.peekAppAuthContext()?.authenticated).toBe(false);
    expect(appSession.peekAppBootstrapContext()?.workspace?.tenantKey).toBe("acme");
    expect(appSession.peekAppSessionContext()?.viewerRole).toBe("owner");
  });
});
