function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function splitRoute(value = "") {
  const raw = s(value);
  if (!raw) return { pathname: "", search: "" };
  const [pathname, search = ""] = raw.split("?");
  return {
    pathname: s(pathname),
    search: s(search),
  };
}

function normalizePhaseKey(value = "") {
  const raw = s(value).toLowerCase();
  if (!raw) return "";

  if (
    raw === "business" ||
    raw === "business_truth" ||
    raw === "truth" ||
    raw === "facts"
  ) {
    return "business_truth";
  }

  if (
    raw === "behavior" ||
    raw === "conversation" ||
    raw === "conversation_policy" ||
    raw === "policy"
  ) {
    return "conversation_policy";
  }

  if (
    raw === "review" ||
    raw === "launch" ||
    raw === "review_and_launch" ||
    raw === "final"
  ) {
    return "review_and_launch";
  }

  return "";
}

export const PRODUCT_HOME_ROUTE = "/home";
export const SETUP_WIDGET_ROUTE = `${PRODUCT_HOME_ROUTE}?assistant=setup`;
export const SETUP_BUSINESS_TRUTH_ROUTE = `${SETUP_WIDGET_ROUTE}&phase=business_truth`;
export const SETUP_CONVERSATION_POLICY_ROUTE = `${SETUP_WIDGET_ROUTE}&phase=conversation_policy`;
export const SETUP_REVIEW_AND_LAUNCH_ROUTE = `${SETUP_WIDGET_ROUTE}&phase=review_and_launch`;
export const WORKSPACE_SELECTION_ROUTE = "/select-workspace";

const LEGACY_PRODUCT_HOME_ROUTES = Object.freeze([
  "/workspace",
  "/comments",
  "/voice",
  "/publish",
  "/proposals",
  "/executions",
  "/incidents",
]);

function buildSetupRouteForPhase(phase = "") {
  const normalizedPhase = normalizePhaseKey(phase);

  if (normalizedPhase === "business_truth") {
    return SETUP_BUSINESS_TRUTH_ROUTE;
  }

  if (normalizedPhase === "conversation_policy") {
    return SETUP_CONVERSATION_POLICY_ROUTE;
  }

  if (normalizedPhase === "review_and_launch") {
    return SETUP_REVIEW_AND_LAUNCH_ROUTE;
  }

  return SETUP_WIDGET_ROUTE;
}

function normalizeSetupRoute(target = "") {
  const raw = s(target);
  if (!raw) return SETUP_WIDGET_ROUTE;

  const { pathname, search } = splitRoute(raw);
  const normalizedPath = pathname.toLowerCase();
  const params = new URLSearchParams(search || "");

  const explicitPhase = normalizePhaseKey(
    params.get("phase") ||
      params.get("step") ||
      params.get("section") ||
      params.get("mode")
  );

  if (explicitPhase) {
    return buildSetupRouteForPhase(explicitPhase);
  }

  if (
    normalizedPath === "/setup" ||
    normalizedPath === "/setup/" ||
    normalizedPath === "/home"
  ) {
    if (s(params.get("assistant")).toLowerCase() === "setup") {
      return SETUP_WIDGET_ROUTE;
    }
  }

  if (
    normalizedPath === "/setup/business" ||
    normalizedPath === "/setup/business-truth" ||
    normalizedPath === "/setup/truth" ||
    normalizedPath === "/setup/facts"
  ) {
    return SETUP_BUSINESS_TRUTH_ROUTE;
  }

  if (
    normalizedPath === "/setup/behavior" ||
    normalizedPath === "/setup/conversation" ||
    normalizedPath === "/setup/policy"
  ) {
    return SETUP_CONVERSATION_POLICY_ROUTE;
  }

  if (
    normalizedPath === "/setup/review" ||
    normalizedPath === "/setup/launch" ||
    normalizedPath === "/setup/final"
  ) {
    return SETUP_REVIEW_AND_LAUNCH_ROUTE;
  }

  if (normalizedPath === "/setup" || normalizedPath.startsWith("/setup/")) {
    return SETUP_WIDGET_ROUTE;
  }

  return SETUP_WIDGET_ROUTE;
}

function normalizeLegacyAppRoute(target = "") {
  const raw = s(target);
  if (!raw) return "";

  const { pathname } = splitRoute(raw);
  const normalizedPath = pathname.toLowerCase();

  if (!normalizedPath) return "";

  if (normalizedPath === "/setup" || normalizedPath.startsWith("/setup/")) {
    return normalizeSetupRoute(raw);
  }

  for (const legacyPath of LEGACY_PRODUCT_HOME_ROUTES) {
    if (
      normalizedPath === legacyPath ||
      normalizedPath.startsWith(`${legacyPath}/`)
    ) {
      return PRODUCT_HOME_ROUTE;
    }
  }

  return raw;
}

function normalizeRoute(target = "", fallback = PRODUCT_HOME_ROUTE) {
  const value = normalizeLegacyAppRoute(target);
  if (!value) return fallback;
  if (value.startsWith("/")) return value;
  return `/${value}`;
}

function getComparablePath(path = "") {
  const value = normalizeLegacyAppRoute(path);
  const { pathname } = splitRoute(value);
  return pathname;
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
  PRODUCT_HOME_ROUTE,
  "/truth",
  "/inbox",
  "/channels",
  "/customers",
  "/leads",
  "/knowledge",
  "/reports",
  "/voice-lab",
  "/team",
  "/launch",
  "/settings",
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
    (s(import.meta.env?.VITE_FORCE_WORKSPACE_ENTRY) === "1" ||
      s(import.meta.env?.VITE_APP_DESIGN_MODE) === "1")
  );
}

export function isForcedWorkspaceEntryEnabled() {
  return isLocalWorkspaceEntryEnabled();
}

export function isSetupPath(path = "") {
  return normalizeLegacyAppRoute(path) === SETUP_WIDGET_ROUTE;
}

export function isWorkspaceSelectionPath(path = "") {
  return getComparablePath(path) === WORKSPACE_SELECTION_ROUTE;
}

export function isCoreAppPath(path = "") {
  const next = getComparablePath(path);
  return CORE_APP_ROUTE_SET.has(next);
}

export function isInternalOnlyPath(path = "") {
  const next = getComparablePath(path);
  return INTERNAL_ONLY_ROUTE_SET.has(next);
}

export function getCanonicalWorkspaceContract(payload = {}) {
  const root = obj(payload);
  const workspace = obj(root.workspace);
  const source = hasWorkspaceSignal(workspace) ? workspace : root;
  const destination = obj(root.destination || source.destination);

  return {
    setupCompleted: !!(source.setupCompleted ?? source.workspaceReady ?? false),
    setupRequired: !!(source.setupRequired ?? !source.workspaceReady),
    workspaceReady: !!(source.workspaceReady ?? source.setupCompleted ?? false),
    destination,
    routeHint: normalizeRoute(source.routeHint || destination.path, ""),
    nextRoute: normalizeRoute(
      destination.path || source.routeHint || source.nextRoute || PRODUCT_HOME_ROUTE
    ),
    nextSetupRoute: normalizeSetupRoute(
      source.nextSetupRoute || destination.path || source.routeHint || SETUP_WIDGET_ROUTE
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
  const nextRoute = normalizeRoute(workspace.nextRoute || PRODUCT_HOME_ROUTE);
  const nextSetupRoute = normalizeSetupRoute(workspace.nextSetupRoute);

  if (!setupCompleted) {
    return nextSetupRoute;
  }

  if (isCoreAppPath(nextRoute) && !isInternalOnlyPath(nextRoute)) {
    return nextRoute;
  }

  return PRODUCT_HOME_ROUTE;
}

export function resolveAuthenticatedLanding({
  auth = {},
  bootstrap: _bootstrap = {},
} = {}) {
  if (hasMultipleWorkspaceChoices(auth)) {
    return WORKSPACE_SELECTION_ROUTE;
  }

  return PRODUCT_HOME_ROUTE;
}

export const __test__ = {
  splitRoute,
  getComparablePath,
  normalizeLegacyAppRoute,
  normalizeRoute,
  normalizeSetupRoute,
  normalizePhaseKey,
  buildSetupRouteForPhase,
};
