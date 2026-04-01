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

async function loadAppSessionContext() {
  const [auth, bootstrap] = await Promise.all([
    getAuthMe().catch(() => ({})),
    getAppBootstrap().catch(() => ({})),
  ]);

  return {
    tenantKey: pickTenantKey(auth, bootstrap),
    actorName: pickActorName(auth, bootstrap),
    viewerRole: pickViewerRole(auth, bootstrap),
    auth,
    bootstrap,
  };
}

let sessionContextPromise = null;

export function clearAppSessionContext() {
  sessionContextPromise = null;
}

export async function getAppSessionContext({ force = false } = {}) {
  if (!sessionContextPromise || force) {
    sessionContextPromise = loadAppSessionContext().catch((error) => {
      sessionContextPromise = null;
      throw error;
    });
  }

  return sessionContextPromise;
}
