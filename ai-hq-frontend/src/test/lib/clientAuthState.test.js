import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  __test__,
  clearClientAuthState,
  isAuthEntryPath,
  isLoginPath,
  isPublicWidgetPath,
  isStaleSessionRedirecting,
  redirectToLoginForStaleAuth,
  resetStaleAuthRedirect,
  shouldSuppressStaleAuthRedirect,
} from "../../lib/clientAuthState.js";

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

function createTargetWindow(pathname = "/home") {
  return {
    localStorage: createMemoryStorage(),
    sessionStorage: createMemoryStorage(),
    location: {
      pathname,
      replace: vi.fn(),
    },
  };
}

function seedAuthStorage(targetWindow) {
  for (const storage of [
    targetWindow.localStorage,
    targetWindow.sessionStorage,
  ]) {
    for (const key of __test__.CLIENT_AUTH_STORAGE_KEYS) {
      storage.setItem(key, `${key}-value`);
    }
  }
}

function expectAuthStorageCleared(targetWindow) {
  for (const storage of [
    targetWindow.localStorage,
    targetWindow.sessionStorage,
  ]) {
    for (const key of __test__.CLIENT_AUTH_STORAGE_KEYS) {
      expect(storage.getItem(key)).toBeNull();
    }
  }
}

describe("clientAuthState", () => {
  beforeEach(() => {
    __test__.resetStaleAuthRedirect();
  });

  it("clears local and session auth storage", () => {
    const targetWindow = createTargetWindow();
    seedAuthStorage(targetWindow);

    clearClientAuthState({ targetWindow });

    expectAuthStorageCleared(targetWindow);
    expect(targetWindow.location.replace).not.toHaveBeenCalled();
  });

  it("redirects stale authenticated clients to login once with a global guard", () => {
    const targetWindow = createTargetWindow("/voice-assistant");
    seedAuthStorage(targetWindow);

    expect(redirectToLoginForStaleAuth({ targetWindow })).toBe(true);
    expect(redirectToLoginForStaleAuth({ targetWindow })).toBe(false);

    expect(isStaleSessionRedirecting({ targetWindow })).toBe(true);
    expect(targetWindow[__test__.STALE_SESSION_REDIRECT_FLAG]).toBe(true);
    expectAuthStorageCleared(targetWindow);
    expect(targetWindow.location.replace).toHaveBeenCalledTimes(1);
    expect(targetWindow.location.replace).toHaveBeenCalledWith("/login");

    resetStaleAuthRedirect({ targetWindow });
    expect(isStaleSessionRedirecting({ targetWindow })).toBe(false);
  });

  it("clears auth state without redirecting when already on login", () => {
    const targetWindow = createTargetWindow("/login");
    seedAuthStorage(targetWindow);

    expect(redirectToLoginForStaleAuth({ targetWindow })).toBe(false);

    expectAuthStorageCleared(targetWindow);
    expect(targetWindow.location.replace).not.toHaveBeenCalled();
  });

  it("does not redirect from signup or public widget routes", () => {
    for (const pathname of ["/signup", "/widget/website-chat", "/public/widget/bootstrap"]) {
      const targetWindow = createTargetWindow(pathname);
      seedAuthStorage(targetWindow);

      expect(redirectToLoginForStaleAuth({ targetWindow })).toBe(false);
      expectAuthStorageCleared(targetWindow);
      expect(targetWindow.location.replace).not.toHaveBeenCalled();
      expect(targetWindow[__test__.STALE_SESSION_REDIRECT_FLAG]).not.toBe(true);
    }
  });

  it("tolerates unavailable browser storage", () => {
    const targetWindow = {
      get localStorage() {
        throw new Error("blocked");
      },
      get sessionStorage() {
        throw new Error("blocked");
      },
      location: {
        pathname: "/voice-assistant",
        replace: vi.fn(),
      },
    };

    expect(() => clearClientAuthState({ targetWindow })).not.toThrow();
    expect(redirectToLoginForStaleAuth({ targetWindow })).toBe(true);
    expect(targetWindow.location.replace).toHaveBeenCalledWith("/login");
  });

  it("normalizes login path checks", () => {
    expect(isLoginPath("/login")).toBe(true);
    expect(isLoginPath("/login/")).toBe(true);
    expect(isLoginPath("/signup")).toBe(false);
    expect(isAuthEntryPath("/signup")).toBe(true);
    expect(isPublicWidgetPath("/widget/website-chat")).toBe(true);
    expect(shouldSuppressStaleAuthRedirect("/public/widget/message")).toBe(true);
    expect(shouldSuppressStaleAuthRedirect("/voice-assistant")).toBe(false);
  });
});
