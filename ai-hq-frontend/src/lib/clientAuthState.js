const STALE_SESSION_REDIRECT_FLAG = "__AIHQ_STALE_SESSION_REDIRECTING__";
const CLIENT_AUTH_STORAGE_KEYS = [
  "token",
  "user",
  "auth",
  "authUser",
  "aihq.auth",
  "aihq.user",
  "aihq.session",
  "aihq.token",
];

let staleAuthRedirectInFlight = false;

function storageList(targetWindow = null) {
  const sourceWindow =
    targetWindow || (typeof window !== "undefined" ? window : null);

  if (!sourceWindow) return [];

  const storages = [];

  for (const key of ["localStorage", "sessionStorage"]) {
    try {
      if (sourceWindow[key]) {
        storages.push(sourceWindow[key]);
      }
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
    }
  }

  return storages;
}

function safeRemoveItem(storage, key) {
  try {
    storage?.removeItem?.(key);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

export function clearClientAuthState({ targetWindow = null } = {}) {
  for (const storage of storageList(targetWindow)) {
    for (const key of CLIENT_AUTH_STORAGE_KEYS) {
      safeRemoveItem(storage, key);
    }
  }
}

function normalizePathname(pathname = "") {
  const normalized = String(pathname || "").replace(/\/+$/, "");
  return normalized || "/";
}

export function isLoginPath(pathname = "") {
  return normalizePathname(pathname) === "/login";
}

export function isAuthEntryPath(pathname = "") {
  const path = normalizePathname(pathname);
  return path === "/login" || path === "/signup";
}

export function isPublicWidgetPath(pathname = "") {
  const path = normalizePathname(pathname);
  return (
    path === "/widget" ||
    path.startsWith("/widget/") ||
    path === "/public/widget" ||
    path.startsWith("/public/widget/")
  );
}

export function shouldSuppressStaleAuthRedirect(pathname = "") {
  return isAuthEntryPath(pathname) || isPublicWidgetPath(pathname);
}

function readGlobalRedirectFlag(sourceWindow = null) {
  try {
    return sourceWindow?.[STALE_SESSION_REDIRECT_FLAG] === true;
  } catch {
    return false;
  }
}

function writeGlobalRedirectFlag(sourceWindow = null, value = false) {
  try {
    if (sourceWindow) {
      sourceWindow[STALE_SESSION_REDIRECT_FLAG] = value === true;
    }
  } catch {
    // Some browser test contexts expose read-only window-like objects.
  }
}

export function isStaleSessionRedirecting({ targetWindow = null } = {}) {
  const sourceWindow =
    targetWindow || (typeof window !== "undefined" ? window : null);

  return staleAuthRedirectInFlight || readGlobalRedirectFlag(sourceWindow);
}

export function resetStaleAuthRedirect({ targetWindow = null } = {}) {
  const sourceWindow =
    targetWindow || (typeof window !== "undefined" ? window : null);

  staleAuthRedirectInFlight = false;
  writeGlobalRedirectFlag(sourceWindow, false);
}

export function redirectToLoginForStaleAuth({ targetWindow = null } = {}) {
  const sourceWindow =
    targetWindow || (typeof window !== "undefined" ? window : null);

  clearClientAuthState({ targetWindow: sourceWindow });

  if (
    !sourceWindow?.location ||
    shouldSuppressStaleAuthRedirect(sourceWindow.location.pathname)
  ) {
    return false;
  }

  if (isStaleSessionRedirecting({ targetWindow: sourceWindow })) {
    return false;
  }

  staleAuthRedirectInFlight = true;
  writeGlobalRedirectFlag(sourceWindow, true);

  try {
    sourceWindow.location.replace?.("/login");
  } catch {
    // Navigation may be unavailable in restricted test/browser contexts.
  }

  return true;
}

export const __test__ = {
  CLIENT_AUTH_STORAGE_KEYS,
  STALE_SESSION_REDIRECT_FLAG,
  resetStaleAuthRedirect() {
    resetStaleAuthRedirect();
  },
};
