function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export const CORE_APP_ROUTES = Object.freeze([
  "/truth",
  "/settings",
  "/inbox",
]);

export const INTERNAL_ONLY_APP_ROUTES = Object.freeze([
  "/command-demo",
  "/analytics",
  "/agents",
  "/threads",
]);

const CORE_APP_ROUTE_SET = new Set(CORE_APP_ROUTES);
const INTERNAL_ONLY_ROUTE_SET = new Set(INTERNAL_ONLY_APP_ROUTES);

export function areInternalRoutesEnabled() {
  return s(import.meta.env?.VITE_ENABLE_INTERNAL_ROUTES) === "1";
}

export function isSetupPath(path = "") {
  const next = s(path);
  return next === "/setup" || next.startsWith("/setup/");
}

export function isCoreAppPath(path = "") {
  const next = s(path);
  return CORE_APP_ROUTE_SET.has(next);
}

export function isInternalOnlyPath(path = "") {
  const next = s(path);
  return INTERNAL_ONLY_ROUTE_SET.has(next);
}

export function resolveAuthenticatedLanding(bootstrap = {}) {
  const root = obj(bootstrap);
  const workspace = obj(root.workspace);
  const setup = obj(root.setup);
  const progress = obj(setup.progress || workspace.progress || workspace);

  const setupCompleted = !!(
    progress.setupCompleted ??
    workspace.setupCompleted ??
    false
  );

  const nextRoute = s(progress.nextRoute || workspace.nextRoute || "/");
  const nextSetupRoute = s(
    progress.nextSetupRoute || workspace.nextSetupRoute || "/setup/studio"
  );

  if (!setupCompleted) {
    return isSetupPath(nextSetupRoute) ? nextSetupRoute : "/setup/studio";
  }

  if (isCoreAppPath(nextRoute) && !isInternalOnlyPath(nextRoute)) {
    return nextRoute;
  }

  return "/truth";
}
