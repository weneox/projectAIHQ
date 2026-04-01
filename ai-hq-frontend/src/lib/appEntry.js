function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeSetupRoute(target = "") {
  const value = s(target);

  if (!value) return "/setup/studio";
  if (value === "/setup") return "/setup/studio";
  if (value.startsWith("/setup/")) return "/setup/studio";

  return value;
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

export function getCanonicalWorkspaceContract(payload = {}) {
  const root = obj(payload);
  const workspace = obj(root.workspace);
  const destination = obj(root.destination || workspace.destination);

  return {
    setupCompleted: !!(
      workspace.setupCompleted ??
      workspace.workspaceReady ??
      false
    ),
    setupRequired: !!(workspace.setupRequired ?? !workspace.workspaceReady),
    workspaceReady: !!(
      workspace.workspaceReady ??
      workspace.setupCompleted ??
      false
    ),
    destination,
    routeHint: s(workspace.routeHint || destination.path),
    nextRoute: s(
      destination.path ||
      workspace.routeHint ||
      workspace.nextRoute ||
      "/workspace"
    ),
    nextSetupRoute: normalizeSetupRoute(
      workspace.nextSetupRoute ||
        destination.path ||
        workspace.routeHint ||
        "/setup/studio"
    ),
  };
}

export function resolveAuthenticatedLanding(bootstrap = {}) {
  if (isLocalWorkspaceEntryEnabled()) {
    return "/workspace";
  }

  const workspace = getCanonicalWorkspaceContract(bootstrap);
  const setupCompleted = workspace.workspaceReady;
  const nextRoute = s(workspace.nextRoute || "/workspace");
  const nextSetupRoute = workspace.nextSetupRoute;

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
