import { arr, obj, s } from "./shared.js";

export function buildProjectionExecutionPolicy(projection = {}, runtime = {}) {
  const metadata = obj(projection.metadata_json);
  const approvalPolicy = obj(
    metadata.approvalPolicy || metadata.approval_policy
  );
  const policyControls = obj(runtime.policyControls || runtime.policy_controls);

  return {
    approvalPolicy,
    policyControls,
    posture: {
      authorityAvailable: obj(runtime.authority).available === true,
      projectionHealthStatus: s(obj(runtime.projectionHealth).status),
      truthApprovalOutcome: s(
        approvalPolicy.strictestOutcome ||
          approvalPolicy.strictest_outcome ||
          approvalPolicy.outcome
      ),
      truthRiskLevel: s(
        obj(approvalPolicy.risk).level || approvalPolicy.riskLevel
      ),
      affectedSurfaces: arr(
        approvalPolicy.affectedSurfaces ||
          approvalPolicy.affected_surfaces ||
          obj(approvalPolicy.signals).affectedSurfaces
      ),
      policyControlMode: s(
        obj(
          policyControls.tenantDefault || policyControls.tenant_default
        ).controlMode
      ),
    },
  };
}
