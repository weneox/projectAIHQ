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
        authContextValue = value;
        lastAuthContextValue = value;
        authContextAt = Date.now();
        return value;
      })
      .catch((error) => {
        authContextPromise = null;
        authContextValue = null;
        authContextAt = 0;
        throw error;
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
        bootstrapContextPromise = null;
        bootstrapContextValue = null;
        bootstrapContextAt = 0;
        throw error;
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
          try {
            bootstrap = await getAppBootstrapContext({ force });
          } catch {
            bootstrap = {};
          }
        }

        const value = buildSessionContext(auth, bootstrap);
        sessionContextValue = value;
        lastSessionContextValue = value;
        sessionContextAt = Date.now();
        return value;
      })
      .catch((error) => {
        sessionContextPromise = null;
        sessionContextValue = null;
        sessionContextAt = 0;
        throw error;
      })
      .finally(() => {
        sessionContextPromise = null;
      });
  }

  return sessionContextPromise;
}
