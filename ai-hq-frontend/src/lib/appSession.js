import { getAppBootstrap } from "../api/app.js";
import { getAuthMe } from "../api/auth.js";

const CONTEXT_CACHE_TTL_MS = 5000;

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function pickFirst(...values) {
  for (const value of values) {
    const text = s(value);
    if (text) return text;
  }
  return "";
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function isFresh(timestamp = 0) {
  return Number(timestamp) > 0 && Date.now() - Number(timestamp) < CONTEXT_CACHE_TTL_MS;
}

function isDefinitiveSignedOutReason(reason = "") {
  const value = s(reason).toLowerCase();
  return (
    value === "invalid_session" ||
    value === "invalid session" ||
    value === "missing session cookie" ||
    value === "session not found" ||
    value === "user inactive" ||
    value === "unauthorized"
  );
}

function looksTransientAuthFailure({ reason = "", error = "" } = {}) {
  const value = `${s(reason)} ${s(error)}`.toLowerCase();
  return (
    value.includes("temporarily unavailable") ||
    value.includes("session unavailable") ||
    value.includes("session_lookup_unavailable") ||
    value.includes("request timeout") ||
    value.includes("request aborted") ||
    value.includes("network error") ||
    value.includes("network request failed") ||
    value.includes("failed to fetch") ||
    value.includes("load failed") ||
    value.includes("unavailable")
  );
}

function normalizeAuthContext(rawValue = {}, sourceError = null) {
  const value = obj(rawValue);
  const authenticated = value.authenticated === true;
  const reason = s(sourceError?.message || value.reason);
  const error = s(value.error);

  const definitiveSignedOut =
    !authenticated &&
    (isDefinitiveSignedOutReason(reason) ||
      (!error && value.authenticated === false && !looksTransientAuthFailure({ reason, error })));

  const transientFailure =
    !authenticated &&
    !definitiveSignedOut &&
    (Boolean(sourceError) ||
      value.ok === false ||
      looksTransientAuthFailure({ reason, error }));

  return {
    ok: value.ok ?? authenticated,
    authenticated,
    error: error || (sourceError ? "Auth session unavailable" : null),
    reason,
    user: value.user || null,
    identity: value.identity || null,
    membership: value.membership || null,
    workspace: value.workspace || null,
    workspaces: Array.isArray(value.workspaces) ? value.workspaces : [],
    destination: value.destination || null,
    runtime: obj(value.runtime),
    transientFailure,
    unavailable: transientFailure,
    resolved: authenticated || definitiveSignedOut,
    raw: value,
  };
}

function buildAuthFallback(error = null) {
  return normalizeAuthContext(
    {
      ok: false,
      authenticated: false,
      error: error ? "Auth session unavailable" : null,
      reason: error ? s(error?.message || error || "auth_context_failed") : "",
      user: null,
      identity: null,
      membership: null,
      workspace: null,
      workspaces: [],
      destination: null,
      runtime: {},
    },
    error
  );
}

function buildBootstrapFallback(error = null) {
  return {
    ok: false,
    error: error ? s(error?.message || error || "bootstrap_context_failed") : "",
    tenant: null,
    workspace: null,
    viewer: null,
    viewerRole: "",
  };
}

function pickTenantKey(auth = {}, bootstrap = {}) {
  const authUser = obj(auth?.user);
  const authTenant = obj(auth?.tenant);
  const workspace = obj(bootstrap?.workspace);
  const bootstrapTenant = obj(bootstrap?.tenant || workspace?.tenant);

  return pickFirst(
    bootstrapTenant?.tenant_key,
    bootstrap?.tenantKey,
    workspace?.tenantKey,
    authTenant?.tenant_key,
    auth?.tenantKey,
    authUser?.tenant_key,
    authUser?.tenantKey
  ).toLowerCase();
}

function pickActorName(auth = {}, bootstrap = {}) {
  const authUser = obj(auth?.user);
  const bootstrapViewer = obj(bootstrap?.viewer);

  return pickFirst(
    authUser?.full_name,
    authUser?.display_name,
    authUser?.name,
    bootstrapViewer?.full_name,
    bootstrapViewer?.display_name,
    bootstrapViewer?.name,
    authUser?.user_email,
    auth?.email,
    bootstrap?.viewerEmail,
    "operator"
  );
}

function pickViewerRole(auth = {}, bootstrap = {}) {
  const authUser = obj(auth?.user);
  const authMembership = obj(auth?.membership);
  const authWorkspace = obj(auth?.workspace);

  return pickFirst(
    bootstrap?.viewerRole,
    bootstrap?.role,
    authMembership?.role,
    authWorkspace?.role,
    authUser?.role,
    auth?.role
  ).toLowerCase();
}

function buildSessionContext(auth = {}, bootstrap = {}) {
  return {
    tenantKey: pickTenantKey(auth, bootstrap),
    actorName: pickActorName(auth, bootstrap),
    viewerRole: pickViewerRole(auth, bootstrap),
    bootstrapAvailable:
      !!(bootstrap && typeof bootstrap === "object" && Object.keys(bootstrap).length),
    auth,
    bootstrap,
    resolved: !!auth?.resolved,
    unavailable: !!auth?.unavailable,
    transientFailure: !!auth?.transientFailure,
  };
}

let authContextPromise = null;
let bootstrapContextPromise = null;
let sessionContextPromise = null;

let authContextValue = null;
let bootstrapContextValue = null;
let sessionContextValue = null;
let lastAuthContextValue = null;
let lastBootstrapContextValue = null;
let lastSessionContextValue = null;

let authContextAt = 0;
let bootstrapContextAt = 0;
let sessionContextAt = 0;

function resetSessionCompositionCache() {
  sessionContextPromise = null;
  sessionContextValue = null;
  sessionContextAt = 0;
}

async function loadAppAuthContext() {
  return getAuthMe();
}

async function loadAppBootstrapContext() {
  return getAppBootstrap();
}

export function clearAppAuthContext() {
  authContextPromise = null;
  authContextValue = null;
  lastAuthContextValue = null;
  authContextAt = 0;
  resetSessionCompositionCache();
}

export function clearAppBootstrapContext() {
  bootstrapContextPromise = null;
  bootstrapContextValue = null;
  lastBootstrapContextValue = null;
  bootstrapContextAt = 0;
  resetSessionCompositionCache();
}

export function clearAppSessionContext() {
  authContextPromise = null;
  bootstrapContextPromise = null;
  sessionContextPromise = null;

  authContextValue = null;
  bootstrapContextValue = null;
  sessionContextValue = null;
  lastAuthContextValue = null;
  lastBootstrapContextValue = null;
  lastSessionContextValue = null;

  authContextAt = 0;
  bootstrapContextAt = 0;
  sessionContextAt = 0;
}

export function peekAppAuthContext() {
  return authContextValue || lastAuthContextValue;
}

export function peekAppBootstrapContext() {
  return bootstrapContextValue || lastBootstrapContextValue;
}

export function peekAppSessionContext() {
  return sessionContextValue || lastSessionContextValue;
}

export async function getAppAuthContext({ force = false } = {}) {
  if (!force && authContextValue && isFresh(authContextAt)) {
    return authContextValue;
  }

  if (!authContextPromise || force) {
    if (force) {
      resetSessionCompositionCache();
      authContextValue = null;
      authContextAt = 0;
    }

    authContextPromise = loadAppAuthContext()
      .then((value) => {
        const normalized = normalizeAuthContext(value);
        authContextValue = normalized;
        lastAuthContextValue = normalized;
        authContextAt = Date.now();
        return normalized;
      })
      .catch((error) => {
        const fallback = buildAuthFallback(error);
        authContextValue = fallback;
        lastAuthContextValue = fallback;
        authContextAt = Date.now();
        return fallback;
      })
      .finally(() => {
        authContextPromise = null;
      });
  }

  return authContextPromise;
}

export async function getAppBootstrapContext({ force = false } = {}) {
  if (!force && bootstrapContextValue && isFresh(bootstrapContextAt)) {
    return bootstrapContextValue;
  }

  if (!bootstrapContextPromise || force) {
    if (force) {
      resetSessionCompositionCache();
      bootstrapContextValue = null;
      bootstrapContextAt = 0;
    }

    bootstrapContextPromise = loadAppBootstrapContext()
      .then((value) => {
        bootstrapContextValue = value;
        lastBootstrapContextValue = value;
        bootstrapContextAt = Date.now();
        return value;
      })
      .catch((error) => {
        const fallback = buildBootstrapFallback(error);
        bootstrapContextValue = fallback;
        lastBootstrapContextValue = fallback;
        bootstrapContextAt = Date.now();
        return fallback;
      })
      .finally(() => {
        bootstrapContextPromise = null;
      });
  }

  return bootstrapContextPromise;
}

export async function getAppSessionContext({ force = false } = {}) {
  if (!force && sessionContextValue && isFresh(sessionContextAt)) {
    return sessionContextValue;
  }

  if (!sessionContextPromise || force) {
    if (force) {
      authContextPromise = null;
      bootstrapContextPromise = null;
      authContextValue = null;
      bootstrapContextValue = null;
      authContextAt = 0;
      bootstrapContextAt = 0;
    }

    sessionContextPromise = getAppAuthContext({ force })
      .then(async (auth) => {
        let bootstrap = {};

        if (auth?.authenticated) {
          bootstrap = await getAppBootstrapContext({ force });
        }

        const value = buildSessionContext(auth, bootstrap);
        sessionContextValue = value;
        lastSessionContextValue = value;
        sessionContextAt = Date.now();
        return value;
      })
      .catch((error) => {
        const value = buildSessionContext(buildAuthFallback(error), {});
        sessionContextValue = value;
        lastSessionContextValue = value;
        sessionContextAt = Date.now();
        return value;
      })
      .finally(() => {
        sessionContextPromise = null;
      });
  }

  return sessionContextPromise;
}