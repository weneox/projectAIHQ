import { getActiveSetupReviewSession } from "../../db/helpers/tenantSetupReview.js";
import { getWorkspaceReadiness } from "./readiness.js";
import { arr, obj, s } from "./shared.js";

export function buildPostAuthDestination(readiness = {}) {
  const setupCompleted = !!readiness?.setupCompleted;
  const setupPath = s(readiness?.nextSetupRoute || "/setup/studio") || "/setup/studio";

  return setupCompleted
    ? {
        kind: "workspace",
        path: "/workspace",
      }
    : {
        kind: "setup",
        path: setupPath.startsWith("/setup/") ? setupPath : "/setup/studio",
      };
}

export function buildPostAuthWorkspaceStateFromReadiness({
  readiness = {},
  tenant = {},
  tenantId = "",
  tenantKey = "",
  membershipId = "",
  role = "",
  activeSetupSessionId = "",
} = {}) {
  const safeTenant = obj(tenant);
  const destination = buildPostAuthDestination(readiness);
  const tenantProfile = obj(readiness?.tenantProfile);

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
    role: s(role || "member").toLowerCase(),
    setupCompleted: !!readiness?.setupCompleted,
    setupRequired: !readiness?.setupCompleted,
    workspaceReady: !!readiness?.setupCompleted,
    activeSetupSessionId: s(activeSetupSessionId),
    routeHint: s(destination.path),
    destination,
    readinessScore: Number(readiness?.readinessScore || 0),
    readinessLabel: s(readiness?.readinessLabel),
    missingSteps: arr(readiness?.missingSteps),
    primaryMissingStep: s(readiness?.primaryMissingStep),
    nextSetupRoute: s(readiness?.nextSetupRoute),
    nextStudioStage: s(readiness?.nextStudioStage),
    checks: obj(readiness?.checks),
  };
}

export async function loadPostAuthWorkspaceState({
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

  return buildPostAuthWorkspaceStateFromReadiness({
    readiness,
    tenant,
    tenantId,
    tenantKey,
    membershipId,
    role,
    activeSetupSessionId,
  });
}
