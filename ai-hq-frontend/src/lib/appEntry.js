function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeSetupRoute(target = "") {
  const value = s(target);

  if (!value) return "/home?assistant=setup";
  if (value === "/setup" || value === "/setup/studio") return "/home?assistant=setup";
  if (value.startsWith("/setup/")) return "/home?assistant=setup";

  return "/home?assistant=setup";
}

function normalizeRoute(target = "", fallback = "/workspace") {
  const value = s(target);
  if (!value) return fallback;
  if (value.startsWith("/")) return value;
  return `/${value}`;
}

function hasWorkspaceSignal(workspace = {}) {
  const value = obj(workspace);
  return !!(
    s(value.membershipId || value.membership_id) ||
    s(value.tenantId || value.tenant_id) ||
    s(value.tenantKey || value.tenant_key) ||
    s(value.companyName || value.company_name) ||
    s(value.routeHint) ||
    s(value.nextRoute) ||
    s(value.nextSetupRoute) ||
    s(value.switchToken || value.switch_token)
  );
}

export const CORE_APP_ROUTES = Object.freeze([
  "/home",
  "/workspace",
  "/truth",
  "/publish",
  "/inbox",
  "/comments",
  "/voice",
  "/channels",
]);

export const PRODUCT_HOME_ROUTE = "/home";

export const INTERNAL_ONLY_APP_ROUTES = Object.freeze([
  "/command-demo",
  "/analytics",
  "/agents",
  "/threads",
]);

export const WORKSPACE_SELECTION_ROUTE = "/select-workspace";

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

export function isWorkspaceSelectionPath(path = "") {
  return s(path) === WORKSPACE_SELECTION_ROUTE;
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
  const source = hasWorkspaceSignal(workspace) ? workspace : root;
  const destination = obj(root.destination || source.destination);

  return {
    setupCompleted: !!(
      source.setupCompleted ??
      source.workspaceReady ??
      false
    ),
    setupRequired: !!(source.setupRequired ?? !source.workspaceReady),
    workspaceReady: !!(
      source.workspaceReady ??
      source.setupCompleted ??
      false
    ),
    destination,
    routeHint: normalizeRoute(source.routeHint || destination.path, ""),
    nextRoute: normalizeRoute(
      destination.path ||
        source.routeHint ||
        source.nextRoute ||
        "/workspace"
    ),
    nextSetupRoute: normalizeSetupRoute(
      source.nextSetupRoute ||
        destination.path ||
        source.routeHint ||
        "/setup"
    ),
  };
}

function normalizeWorkspaceChoice(choice = {}) {
  const value = obj(choice);
  const workspace = getCanonicalWorkspaceContract(value);

  return {
    membershipId: s(value.membershipId || value.membership_id),
    tenantId: s(value.tenantId || value.tenant_id),
    tenantKey: s(value.tenantKey || value.tenant_key).toLowerCase(),
    companyName: s(value.companyName || value.company_name),
    role: s(value.role || "member").toLowerCase(),
    readinessScore: Number(value.readinessScore || value.readiness_score || 0),
    readinessLabel: s(value.readinessLabel || value.readiness_label),
    activeSetupSessionId: s(
      value.activeSetupSessionId || value.active_setup_session_id
    ),
    switchToken: s(value.switchToken || value.switch_token),
    selectionToken: s(value.selectionToken || value.selection_token),
    active: !!value.active,
    ...workspace,
  };
}

export function getAuthWorkspaceChoices(auth = {}) {
  return arr(auth?.workspaces)
    .map(normalizeWorkspaceChoice)
    .filter((choice) => hasWorkspaceSignal(choice));
}

export function getActiveAuthWorkspace(auth = {}) {
  const choices = getAuthWorkspaceChoices(auth);
  const active = choices.find((choice) => choice.active);
  if (active) return active;

  const fallback = normalizeWorkspaceChoice(auth?.workspace || {});
  return hasWorkspaceSignal(fallback) ? fallback : null;
}

export function hasMultipleWorkspaceChoices(auth = {}) {
  return getAuthWorkspaceChoices(auth).length > 1;
}

export function resolveWorkspaceContractRoute(payload = {}) {
  const workspace = getCanonicalWorkspaceContract(payload);
  const setupCompleted = workspace.workspaceReady;
  const nextRoute = s(workspace.nextRoute || "/workspace");
  const nextSetupRoute = workspace.nextSetupRoute;

  if (!setupCompleted) {
    return isSetupPath(nextSetupRoute)
      ? normalizeSetupRoute(nextSetupRoute)
      : "/home?assistant=setup";
  }

  if (nextRoute === "/workspace") {
    return "/workspace";
  }

  if (isCoreAppPath(nextRoute) && !isInternalOnlyPath(nextRoute)) {
    return nextRoute;
  }

  return "/workspace";
}

export function resolveAuthenticatedLanding({
  auth = {},
  bootstrap = {},
} = {}) {
  if (hasMultipleWorkspaceChoices(auth)) {
    return WORKSPACE_SELECTION_ROUTE;
  }

  return PRODUCT_HOME_ROUTE;
}
