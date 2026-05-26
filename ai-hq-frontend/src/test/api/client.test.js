import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __test__, apiRequest, apiUrl } from "../../api/client.js";
import {
  __test__ as clientAuthStateTest,
} from "../../lib/clientAuthState.js";

describe("api client local dev origin handling", () => {
  beforeEach(() => {
    clientAuthStateTest.resetStaleAuthRedirect();
    window.history.replaceState({}, "", "/login");
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("uses the local proxy when the browser origin is 127.0.0.1 and the configured api base is localhost", () => {
    expect(
      __test__.shouldUseDevProxyBase("http://localhost:8080", {
        dev: true,
        browserOrigin: "http://127.0.0.1:5173",
      })
    ).toBe(true);
  });

  it("does not force the local proxy when browser and api origin already match", () => {
    expect(
      __test__.shouldUseDevProxyBase("http://localhost:8080", {
        dev: true,
        browserOrigin: "http://localhost:8080",
      })
    ).toBe(false);
  });

  it("does not double-prefix api paths when local proxy mode is active", () => {
    expect(apiUrl("/api/auth/me")).toBe("/api/auth/me");
  });

  it("clears stale auth storage when a protected API request returns 401", async () => {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      storage.setItem("token", "token-value");
      storage.setItem("user", "user-value");
      storage.setItem("auth", "auth-value");
      storage.setItem("authUser", "auth-user-value");
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: false,
            reason: "missing session cookie",
          }),
          {
            status: 401,
            headers: {
              "content-type": "application/json",
            },
          }
        )
      )
    );

    await expect(
      apiRequest("/api/voice/pionero/livekit/token", {
        body: {
          roomName: "pionero-browser-test",
        },
        method: "POST",
      })
    ).rejects.toMatchObject({
      status: 401,
    });

    for (const storage of [window.localStorage, window.sessionStorage]) {
      expect(storage.getItem("token")).toBeNull();
      expect(storage.getItem("user")).toBeNull();
      expect(storage.getItem("auth")).toBeNull();
      expect(storage.getItem("authUser")).toBeNull();
    }
  });

  it("only redirects once when parallel protected API requests return 401", async () => {
    window.history.replaceState({}, "", "/voice-assistant");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: false,
            reason: "missing session cookie",
          }),
          {
            status: 401,
            headers: {
              "content-type": "application/json",
            },
          }
        )
      )
    );

    try {
      const results = await Promise.allSettled([
        apiRequest("/api/voice/pionero/livekit/token", {
          body: {
            roomName: "pionero-browser-test",
          },
          method: "POST",
        }),
        apiRequest("/api/leads", {
          method: "GET",
        }),
      ]);

      expect(results).toEqual([
        expect.objectContaining({ status: "rejected" }),
        expect.objectContaining({ status: "rejected" }),
      ]);
      expect(window[clientAuthStateTest.STALE_SESSION_REDIRECT_FLAG]).toBe(true);

      const fetchCallsAfterParallel401 = fetch.mock.calls.length;
      await expect(
        apiRequest("/api/leads", {
          method: "GET",
        })
      ).rejects.toMatchObject({
        code: "STALE_AUTH_REDIRECTING",
        status: 401,
      });
      expect(fetch).toHaveBeenCalledTimes(fetchCallsAfterParallel401);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("does not redirect-loop when a protected API request returns 401 on login", async () => {
    window.history.replaceState({}, "", "/login");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: false,
            reason: "missing session cookie",
          }),
          {
            status: 401,
            headers: {
              "content-type": "application/json",
            },
          }
        )
      )
    );

    await expect(
      apiRequest("/api/voice/pionero/livekit/token", {
        body: {
          roomName: "pionero-browser-test",
        },
        method: "POST",
      })
    ).rejects.toMatchObject({
      status: 401,
    });

    expect(window[clientAuthStateTest.STALE_SESSION_REDIRECT_FLAG]).not.toBe(
      true
    );
  });

  it("does not redirect-loop when an auth status endpoint returns 401", async () => {
    window.history.replaceState({}, "", "/home");
    window.localStorage.setItem("auth", "keep-auth");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            authenticated: false,
            ok: false,
            reason: "missing session cookie",
          }),
          {
            status: 401,
            headers: {
              "content-type": "application/json",
            },
          }
        )
      )
    );

    await expect(
      apiRequest("/api/auth/me", {
        method: "GET",
      })
    ).rejects.toMatchObject({
      status: 401,
    });

    expect(window[clientAuthStateTest.STALE_SESSION_REDIRECT_FLAG]).not.toBe(
      true
    );
    expect(window.localStorage.getItem("auth")).toBe("keep-auth");
  });

  it("does not clear auth storage for explicitly public auth API 401 responses", async () => {
    window.localStorage.setItem("auth", "keep-auth");
    window.sessionStorage.setItem("auth", "keep-session-auth");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: false,
            reason: "invalid credentials",
          }),
          {
            status: 401,
            headers: {
              "content-type": "application/json",
            },
          }
        )
      )
    );

    await expect(
      apiRequest("/api/auth/login", {
        authProtected: false,
        body: {
          email: "operator@example.test",
          password: "wrong",
        },
        method: "POST",
      })
    ).rejects.toMatchObject({
      status: 401,
    });

    expect(window.localStorage.getItem("auth")).toBe("keep-auth");
    expect(window.sessionStorage.getItem("auth")).toBe("keep-session-auth");
  });
});
