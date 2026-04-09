import { getActiveSetupReviewSession } from "../../db/helpers/tenantSetupReview.js";
import { getWorkspaceReadiness } from "./readiness.js";
import { arr, obj, s } from "./shared.js";

const SETUP_WIDGET_ROUTE = "/home?assistant=setup";

export function buildActiveWorkspaceDestination(readiness = {}) {
  const setupCompleted = !!readiness?.setupCompleted;
  const setupPath = s(readiness?.nextSetupRoute || SETUP_WIDGET_ROUTE) || SETUP_WIDGET_ROUTE;

  return setupCompleted
    ? {
        kind: "workspace",
        path: "/workspace",
      }
    : {
        kind: "setup",
        path: setupPath,
      };
}

export function buildActiveWorkspaceContract({
  readiness = {},
  tenant = {},
  tenantId = "",
  tenantKey = "",
  membershipId = "",
  role = "",
  activeSetupSessionId = "",
} = {}) {
  const safeTenant = obj(tenant);
  const destination = buildActiveWorkspaceDestination(readiness);
  const tenantProfile = obj(readiness?.tenantProfile);
  const normalizedRole = s(role || "member").toLowerCase();
  const setupCompleted = !!readiness?.setupCompleted;

  return {
    tenantId: s(safeTenant.id || tenantId),
    tenantKey: s(safeTenant.tenant_key || safeTenant.key || tenantKey).toLowerCase(),
    companyName: s(
      tenantProfile.companyName ||
        safeTenant.company_name ||
        safeTenant.display_name ||
        safeTenant.name
    ),
    membershipId: s(membershipId),
    role: normalizedRole,

    // destination/routeHint are the canonical route truth.
    setupCompleted,
    setupRequired: !setupCompleted,
    workspaceReady: setupCompleted,
    routeHint: s(destination.path),
    destination,
    activeSetupSessionId: s(activeSetupSessionId),

    readinessScore: Number(readiness?.readinessScore || 0),
    readinessLabel: s(readiness?.readinessLabel),
    missingSteps: arr(readiness?.missingSteps),
    primaryMissingStep: s(readiness?.primaryMissingStep),

    // Readiness details still surface the next setup target for shared consumers.
    nextRoute: s(destination.path),
    nextSetupRoute: s(readiness?.nextSetupRoute),
    nextStudioStage: s(readiness?.nextStudioStage),
    checks: obj(readiness?.checks),
  };
}

export async function resolveAuthenticatedWorkspaceState({
  db,
  tenantId = "",
  tenantKey = "",
  membershipId = "",
  role = "",
  tenant = null,
} = {}) {
  const readiness = await getWorkspaceReadiness({
    db,
    tenantId,
    tenantKey,
    role,
    tenant,
  });

  let activeSetupSessionId = "";
  if (!readiness?.setupCompleted) {
    const activeSetupSession = await getActiveSetupReviewSession(
      s(tenantId || tenant?.id)
    );
    activeSetupSessionId = s(activeSetupSession?.id);
  }

  const workspace = buildActiveWorkspaceContract({
    readiness,
    tenant,
    tenantId,
    tenantKey,
    membershipId,
    role,
    activeSetupSessionId,
  });

  return {
    workspace,
    readiness,
  };
}

export async function loadActiveWorkspaceContract(params = {}) {
  const resolved = await resolveAuthenticatedWorkspaceState(params);
  return resolved.workspace;
}

export function buildWorkspaceAccessSummary({
  workspace = {},
  membershipId = "",
  tenantId = "",
  tenantKey = "",
  companyName = "",
  role = "",
  active = false,
  selectionToken = "",
  switchToken = "",
} = {}) {
  const contract = obj(workspace);
  const summary = {
    membershipId: s(contract.membershipId || membershipId),
    tenantId: s(contract.tenantId || tenantId),
    tenantKey: s(contract.tenantKey || tenantKey).toLowerCase(),
    companyName: s(contract.companyName || companyName),
    role: s(contract.role || role || "member").toLowerCase(),
    setupCompleted: !!contract.setupCompleted,
    setupRequired: !!contract.setupRequired,
    workspaceReady: !!contract.workspaceReady,
    routeHint: s(contract.routeHint),
    destination: contract.destination || null,
    readinessScore: Number(contract.readinessScore || 0),
    readinessLabel: s(contract.readinessLabel),
    activeSetupSessionId: s(contract.activeSetupSessionId),
    active: !!active,
  };

  if (s(selectionToken)) {
    summary.selectionToken = s(selectionToken);
  }

  if (s(switchToken)) {
    summary.switchToken = s(switchToken);
  }

  return summary;
}
