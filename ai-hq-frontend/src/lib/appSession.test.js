import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthMe = vi.fn();
const getAppBootstrap = vi.fn();

vi.mock("../api/auth.js", () => ({
  getAuthMe: (...args) => getAuthMe(...args),
}));

vi.mock("../api/app.js", () => ({
  getAppBootstrap: (...args) => getAppBootstrap(...args),
}));

import {
  clearAppAuthContext,
  clearAppBootstrapContext,
  clearAppSessionContext,
  getAppAuthContext,
  getAppBootstrapContext,
  getAppSessionContext,
} from "./appSession.js";

describe("appSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAppSessionContext();
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
    const auth = await getAppAuthContext();

    expect(auth.authenticated).toBe(true);
    expect(getAuthMe).toHaveBeenCalledTimes(1);
    expect(getAppBootstrap).not.toHaveBeenCalled();
  });

  it("loads bootstrap context without fetching auth", async () => {
    const bootstrap = await getAppBootstrapContext();

    expect(bootstrap.workspace.tenantKey).toBe("acme");
    expect(getAppBootstrap).toHaveBeenCalledTimes(1);
    expect(getAuthMe).not.toHaveBeenCalled();
  });

  it("treats unauthenticated auth responses as valid non-error state", async () => {
    getAuthMe.mockResolvedValueOnce({ authenticated: false, user: null });

    const auth = await getAppAuthContext();

    expect(auth.authenticated).toBe(false);
  });

  it("composes session context from shared auth and bootstrap caches", async () => {
    const session = await getAppSessionContext();

    expect(session.tenantKey).toBe("acme");
    expect(session.actorName).toBe("Owner");
    expect(getAuthMe).toHaveBeenCalledTimes(1);
    expect(getAppBootstrap).toHaveBeenCalledTimes(1);

    await getAppSessionContext();
    expect(getAuthMe).toHaveBeenCalledTimes(1);
    expect(getAppBootstrap).toHaveBeenCalledTimes(1);
  });

  it("clears auth and bootstrap caches explicitly", async () => {
    await getAppAuthContext();
    await getAppBootstrapContext();

    clearAppAuthContext();
    clearAppBootstrapContext();

    await getAppAuthContext();
    await getAppBootstrapContext();

    expect(getAuthMe).toHaveBeenCalledTimes(2);
    expect(getAppBootstrap).toHaveBeenCalledTimes(2);
  });

  it("does not swallow auth loader failures as empty objects", async () => {
    getAuthMe.mockRejectedValueOnce(new Error("auth offline"));

    await expect(getAppAuthContext()).rejects.toThrow("auth offline");
  });

  it("does not swallow bootstrap loader failures as empty objects", async () => {
    getAppBootstrap.mockRejectedValueOnce(new Error("bootstrap offline"));

    await expect(getAppBootstrapContext()).rejects.toThrow("bootstrap offline");
  });
});
