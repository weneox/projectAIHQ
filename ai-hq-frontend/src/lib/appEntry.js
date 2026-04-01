function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export const CORE_APP_ROUTES = Object.freeze([
  "/workspace",
  "/truth",
  "/publish",
  "/expert",
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

export function isLocalWorkspaceEntryEnabled() {
  return (
    !!import.meta.env?.DEV &&
    s(import.meta.env?.VITE_FORCE_WORKSPACE_ENTRY) === "1"
  );
}

export function isForcedWorkspaceEntryEnabled() {
  return isLocalWorkspaceEntryEnabled();
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
  if (isLocalWorkspaceEntryEnabled()) {
    return "/workspace";
  }

  const root = obj(bootstrap);
  const workspace = obj(root.workspace);
  const setup = obj(root.setup);
  const progress = obj(setup.progress || workspace.progress || workspace);
  const destination = obj(root.destination || workspace.destination);

  const setupCompleted = !!(
    progress.setupCompleted ??
    workspace.setupCompleted ??
    false
  );

  const nextRoute = s(
    destination.path || progress.nextRoute || workspace.nextRoute || "/"
  );
  const nextSetupRoute = s(
    progress.nextSetupRoute || workspace.nextSetupRoute || "/setup/studio"
  );

  if (!setupCompleted) {
    return isSetupPath(nextSetupRoute) ? nextSetupRoute : "/setup/studio";
  }

  if (nextRoute === "/settings") {
    return "/expert";
  }

  if (nextRoute === "/expert") {
    return "/expert";
  }

  if (nextRoute === "/workspace") {
    return "/workspace";
  }

  if (isCoreAppPath(nextRoute) && !isInternalOnlyPath(nextRoute)) {
    return nextRoute;
  }

  return "/workspace";
}
