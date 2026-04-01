import { getAppBootstrap } from "../api/app.js";
import { getAuthMe } from "../api/auth.js";

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
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
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

  return pickFirst(
    bootstrap?.viewerRole,
    bootstrap?.role,
    authUser?.role,
    auth?.role
  ).toLowerCase();
}

function buildSessionContext(auth = {}, bootstrap = {}) {
  return {
    tenantKey: pickTenantKey(auth, bootstrap),
    actorName: pickActorName(auth, bootstrap),
    viewerRole: pickViewerRole(auth, bootstrap),
    auth,
    bootstrap,
  };
}

let authContextPromise = null;
let bootstrapContextPromise = null;
let sessionContextPromise = null;

function resetSessionCompositionCache() {
  sessionContextPromise = null;
}

async function loadAppAuthContext() {
  return getAuthMe();
}

async function loadAppBootstrapContext() {
  return getAppBootstrap();
}

export function clearAppAuthContext() {
  authContextPromise = null;
  resetSessionCompositionCache();
}

export function clearAppBootstrapContext() {
  bootstrapContextPromise = null;
  resetSessionCompositionCache();
}

export function clearAppSessionContext() {
  authContextPromise = null;
  bootstrapContextPromise = null;
  sessionContextPromise = null;
}

export async function getAppAuthContext({ force = false } = {}) {
  if (!authContextPromise || force) {
    if (force) {
      resetSessionCompositionCache();
    }

    authContextPromise = loadAppAuthContext().catch((error) => {
      authContextPromise = null;
      throw error;
    });
  }

  return authContextPromise;
}

export async function getAppBootstrapContext({ force = false } = {}) {
  if (!bootstrapContextPromise || force) {
    if (force) {
      resetSessionCompositionCache();
    }

    bootstrapContextPromise = loadAppBootstrapContext().catch((error) => {
      bootstrapContextPromise = null;
      throw error;
    });
  }

  return bootstrapContextPromise;
}

export async function getAppSessionContext({ force = false } = {}) {
  if (!sessionContextPromise || force) {
    if (force) {
      authContextPromise = null;
      bootstrapContextPromise = null;
    }

    sessionContextPromise = Promise.all([
      getAppAuthContext({ force }),
      getAppBootstrapContext({ force }),
    ])
      .then(([auth, bootstrap]) => buildSessionContext(auth, bootstrap))
      .catch((error) => {
        sessionContextPromise = null;
        throw error;
      });
  }

  return sessionContextPromise;
}
