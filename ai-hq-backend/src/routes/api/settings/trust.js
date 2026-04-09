import express from "express";
import { getAuthTenantId, getAuthTenantKey } from "../../../utils/auth.js";
import { dbListAuditEntries } from "../../../db/helpers/audit.js";
import { createTenantSourcesHelpers } from "../../../db/helpers/tenantSources.js";
import { createTenantKnowledgeHelpers } from "../../../db/helpers/tenantKnowledge.js";
import { createTenantTruthVersionHelpers } from "../../../db/helpers/tenantTruthVersions.js";
import { createTenantExecutionPolicyControlHelpers } from "../../../db/helpers/tenantExecutionPolicyControls.js";
import {
  listDecisionEvents,
  safeAppendDecisionEvent,
} from "../../../db/helpers/decisionEvents.js";
import {
  getCurrentTenantRuntimeProjection,
  getTenantRuntimeProjectionFreshness,
  getTenantRuntimeProjectionHealth,
  getLatestTenantRuntimeProjectionRun,
  refreshTenantRuntimeProjectionStrict,
} from "../../../db/helpers/tenantRuntimeProjection.js";
import { getActiveSetupReviewSession } from "../../../db/helpers/tenantSetupReview.js";
import {
  buildOperationalRepairGuidance,
  buildReadinessSurface,
} from "../../../services/operationalReadiness.js";
import {
  POLICY_CONTROL_MODES,
  buildExecutionPolicySurfaceSummary,
} from "../../../services/executionPolicy.js";
import {
  requireDb,
  requireTenant,
  requireOperationalManager,
  requireMutationRole,
  requireOwnerOrAdminMutation,
  canReadControlPlaneAuditHistoryRole,
  ok,
  bad,
  serverErr,
  getActor,
  getUserRole,
  isInternalServiceRequest,
  auditSafe,
} from "./utils.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

const SETUP_WIDGET_ROUTE = "/home?assistant=setup";
const TRUTH_ROUTE = "/truth";

function iso(v) {
  if (!v) return "";
  try {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  } catch {
    return "";
  }
}

function hasDb(db) {
  return Boolean(db && typeof db.query === "function");
}

function uniqStrings(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

function hasApprovedTruthVersion(latestTruthVersion = {}) {
  return Boolean(s(latestTruthVersion?.id));
}

function normalizeTruthGovernance(latestTruthVersion = {}) {
  const sourceSummary = obj(latestTruthVersion?.source_summary_json);
  const metadata = obj(latestTruthVersion?.metadata_json);
  const sourceGovernance = obj(
    sourceSummary.governance || sourceSummary.governanceSummary
  );
  const metadataGovernance = obj(
    metadata.governance || metadata.governanceSummary
  );
  const merged = {
    ...metadataGovernance,
    ...sourceGovernance,
  };

  if (!Object.keys(merged).length && !hasApprovedTruthVersion(latestTruthVersion)) {
    return {};
  }

  const quarantinedClaimCount = n(
    merged.quarantinedClaimCount ?? merged.quarantined_claim_count,
    0
  );

  return {
    ...merged,
    disposition: s(
      merged.disposition ||
        merged.status ||
        (hasApprovedTruthVersion(latestTruthVersion) ? "quarantined" : "")
    ),
    quarantinedClaimCount,
  };
}

function normalizeTruthFinalizeImpact(latestTruthVersion = {}) {
  const sourceSummary = obj(latestTruthVersion?.source_summary_json);
  const metadata = obj(latestTruthVersion?.metadata_json);
  const sourceImpact = obj(
    sourceSummary.finalizeImpact || sourceSummary.finalize_impact
  );
  const metadataImpact = obj(
    metadata.finalizeImpact || metadata.finalize_impact
  );

  const canonicalAreas = uniqStrings([
    ...arr(metadataImpact.canonicalAreas || metadataImpact.canonical_areas),
    ...arr(sourceImpact.canonicalAreas || sourceImpact.canonical_areas),
  ]);

  const runtimeAreas = uniqStrings([
    ...arr(metadataImpact.runtimeAreas || metadataImpact.runtime_areas),
    ...arr(sourceImpact.runtimeAreas || sourceImpact.runtime_areas),
  ]);

  const affectedSurfaces = uniqStrings([
    ...arr(metadataImpact.affectedSurfaces || metadataImpact.affected_surfaces),
    ...arr(sourceImpact.affectedSurfaces || sourceImpact.affected_surfaces),
    ...runtimeAreas,
  ]);

  const merged = {
    ...metadataImpact,
    ...sourceImpact,
  };

  if (!Object.keys(merged).length && !hasApprovedTruthVersion(latestTruthVersion)) {
    return {};
  }

  return {
    ...merged,
    canonicalAreas: canonicalAreas.length
      ? canonicalAreas
      : hasApprovedTruthVersion(latestTruthVersion)
      ? ["profile"]
      : [],
    runtimeAreas: runtimeAreas.length
      ? runtimeAreas
      : hasApprovedTruthVersion(latestTruthVersion)
      ? ["voice"]
      : [],
    affectedSurfaces: affectedSurfaces.length
      ? affectedSurfaces
      : hasApprovedTruthVersion(latestTruthVersion)
      ? ["voice"]
      : [],
  };
}

function normalizeApprovalPolicyPosture(latestTruthVersion = {}, activeReviewSession = {}) {
  const sourceSummary = obj(latestTruthVersion?.source_summary_json);
  const metadata = obj(latestTruthVersion?.metadata_json);
  const sourcePolicy = obj(
    sourceSummary.approvalPolicy || sourceSummary.approval_policy
  );
  const metadataPolicy = obj(
    metadata.approvalPolicy || metadata.approval_policy
  );
  const risk = obj(metadataPolicy.risk || sourcePolicy.risk);
  const strictestOutcome = lower(
    metadataPolicy.strictestOutcome ||
      metadataPolicy.strictest_outcome ||
      sourcePolicy.strictestOutcome ||
      sourcePolicy.strictest_outcome ||
      metadataPolicy.outcome ||
      sourcePolicy.outcome
  );
  const reasonCodes = uniqStrings([
    ...arr(metadataPolicy.reasonCodes || metadataPolicy.reason_codes),
    ...arr(sourcePolicy.reasonCodes || sourcePolicy.reason_codes),
  ]).map((item) => lower(item));
  const affectedSurfaces = uniqStrings([
    ...arr(metadataPolicy.affectedSurfaces || metadataPolicy.affected_surfaces),
    ...arr(sourcePolicy.affectedSurfaces || sourcePolicy.affected_surfaces),
    ...arr(obj(metadataPolicy.signals).affectedSurfaces || obj(metadataPolicy.signals).affected_surfaces),
    ...arr(obj(sourcePolicy.signals).affectedSurfaces || obj(sourcePolicy.signals).affected_surfaces),
  ]).map((item) => lower(item));

  let posture = strictestOutcome;
  if (!posture) {
    if (!s(latestTruthVersion?.id)) posture = "approval_required";
    else if (activeReviewSession?.id) posture = "review_required";
    else posture = "approved";
  }

  return {
    strictestOutcome: posture,
    requiredRole: lower(
      metadataPolicy.requiredRole ||
        metadataPolicy.required_role ||
        sourcePolicy.requiredRole ||
        sourcePolicy.required_role
    ),
    reasonCodes,
    affectedSurfaces,
    risk: {
      level: lower(risk.level || metadataPolicy.riskLevel || sourcePolicy.riskLevel),
      operational: !!risk.operational,
    },
  };
}

function buildPolicyRuntimeShape({
  runtimeProjection = {},
  runtimeProjectionHealth = {},
  approvalPolicy = {},
} = {}) {
  const projection = obj(runtimeProjection);
  const health = obj(runtimeProjectionHealth);
  const projectionId = s(projection?.id);
  const capabilities = obj(projection.capabilities_json);
  const inboxPolicy = obj(projection.inbox_json);
  const commentPolicy = obj(projection.comments_json);
  const voiceChannel = obj(projection.voice_json);
  const aiPolicy = obj(projection.policies_json);
  const healthStatus = lower(health.status);
  const authorityAvailable =
    !!projectionId &&
    lower(projection.status) === "ready" &&
    !health.stale &&
    !["missing", "stale", "blocked", "invalid"].includes(healthStatus);

  return {
    authority: {
      required: true,
      mode: "strict",
      available: authorityAvailable,
      source: "approved_runtime_projection",
      stale: !!health.stale || healthStatus === "stale",
      runtimeProjectionId: projectionId,
    },
    projectionHealth: health,
    approvalPolicy,
    aiPolicy,
    inboxPolicy,
    commentPolicy,
    channels: {
      voice: voiceChannel,
    },
    raw: {
      projection: {
        metadata_json: {
          approvalPolicy,
        },
        capabilities_json: capabilities,
      },
    },
  };
}

function pickPolicyOutcome(summary = {}) {
  if (summary.blockedUntilRepair) return "blocked_until_repair";
  if (summary.blocked) return "blocked";
  if (summary.handoffRequired) return "handoff_required";
  if (summary.humanReviewRequired) return "allowed_with_human_review";
  if (lower(summary.highRiskOutcome) === "operator_only") return "operator_only";
  if (lower(summary.mediumRiskOutcome) === "allowed_with_logging") {
    return "allowed_with_logging";
  }
  if (lower(summary.lowRiskOutcome) === "allowed") return "allowed";
  return "unknown";
}

function explainPolicyOutcome({
  surface = "",
  outcome = "",
  truthPosture = "",
  runtimeHealthStatus = "",
} = {}) {
  const label = s(surface || "channel");
  if (outcome === "blocked_until_repair") {
    return `${titleize(label)} autonomy is blocked until runtime authority or projection health is repaired.`;
  }
  if (outcome === "blocked") {
    return `${titleize(label)} autonomy is blocked by truth approval or publication posture.`;
  }
  if (outcome === "handoff_required") {
    return `${titleize(label)} autonomy requires a human handoff before sensitive actions can continue.`;
  }
  if (outcome === "allowed_with_human_review") {
    return `${titleize(label)} can continue only with human review for medium or higher risk actions.`;
  }
  if (outcome === "operator_only") {
    return `${titleize(label)} is restricted to operator-controlled execution under current autonomy controls.`;
  }
  if (outcome === "allowed_with_logging") {
    return `${titleize(label)} is allowed for low or medium risk work, but the action path stays audit-visible.`;
  }
  if (outcome === "allowed") {
    return `${titleize(label)} is allowed for healthy low-risk autonomous actions.`;
  }
  if (!truthPosture && !runtimeHealthStatus) {
    return `${titleize(label)} policy telemetry is unavailable, so the control plane shows an explicit unknown posture instead of inferring authority.`;
  }
  return `${titleize(label)} posture is not fully available yet. Check runtime health and truth governance telemetry.`;
}

function titleize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const POLICY_CONTROL_ROLE_REQUIREMENTS = {
  autonomy_enabled: "admin",
  handoff_preferred: "operator",
  human_review_required: "operator",
  operator_only_mode: "admin",
  handoff_required: "admin",
  blocked_until_repair: "owner",
  emergency_stop: "owner",
};

function roleRank(role = "") {
  const value = lower(role);
  if (value === "internal") return 4;
  if (value === "owner") return 3;
  if (value === "admin") return 2;
  if (value === "operator") return 1;
  return 0;
}

function getRequiredRoleForControlMode(mode = "") {
  return POLICY_CONTROL_ROLE_REQUIREMENTS[lower(mode)] || "owner";
}

function canChangeControlMode({ viewerRole = "", mode = "" } = {}) {
  const requiredRole = getRequiredRoleForControlMode(mode);
  return roleRank(viewerRole) >= roleRank(requiredRole);
}

function deriveControlMode(control = {}) {
  const source = obj(control);
  if (source.emergencyStop || source.emergency_stop) return "emergency_stop";
  if (source.blockedUntilRepair || source.blocked_until_repair) {
    return "blocked_until_repair";
  }
  if (source.handoffRequired || source.handoff_required) return "handoff_required";
  if (source.operatorOnlyMode || source.operator_only_mode) return "operator_only_mode";
  if (source.humanReviewRequired || source.human_review_required) {
    return "human_review_required";
  }
  if (source.handoffPreferred || source.handoff_preferred) return "handoff_preferred";
  return "autonomy_enabled";
}

function buildStoredControlFromMode({
  mode = "",
  policyReason = "",
  operatorNote = "",
  changedBy = "",
} = {}) {
  const normalizedMode = lower(mode || "autonomy_enabled");
  return {
    autonomyEnabled: normalizedMode === "autonomy_enabled",
    operatorOnlyMode: normalizedMode === "operator_only_mode",
    humanReviewRequired: normalizedMode === "human_review_required",
    handoffPreferred: normalizedMode === "handoff_preferred",
    handoffRequired: normalizedMode === "handoff_required",
    blockedUntilRepair: normalizedMode === "blocked_until_repair",
    emergencyStop: normalizedMode === "emergency_stop",
    policyReason: s(policyReason || normalizedMode),
    operatorNote: s(operatorNote),
    changedBy: s(changedBy),
    controlMode: normalizedMode,
  };
}

function buildEffectivePolicyControls({
  controls = [],
} = {}) {
  const rows = arr(controls).map((item) => ({
    ...obj(item),
    scopeType: lower(item.scopeType || item.scope_type || ""),
    surface: lower(item.surface || item.surface_key || "tenant"),
    controlMode: lower(item.controlMode || deriveControlMode(item)),
  }));
  const tenantDefault =
    rows.find((item) => item.surface === "tenant" || item.scopeType === "tenant_default") ||
    {
      surface: "tenant",
      scopeType: "tenant_default",
      controlMode: "autonomy_enabled",
      autonomyEnabled: true,
    };
  const items = ["inbox", "comments", "voice", "meta"].map((surface) => {
    const override = rows.find((item) => item.surface === surface) || {};
    const merged = {
      ...tenantDefault,
      ...override,
      surface,
      tenantDefault: tenantDefault.surface || "tenant",
    };
    return {
      ...merged,
      controlMode: lower(deriveControlMode(merged)),
      isOverride: !!override.surface,
    };
  });

  return {
    tenantDefault: {
      ...tenantDefault,
      controlMode: lower(tenantDefault.controlMode || deriveControlMode(tenantDefault)),
      surface: "tenant",
    },
    items,
  };
}

function buildPolicyControlSurface({
  controls = [],
  viewerRole = "operator",
  policyPosture = {},
} = {}) {
  const effective = buildEffectivePolicyControls({ controls });
  const posture = obj(policyPosture);
  const cannotLoosen =
    lower(posture.executionPosture) === "blocked_until_repair" ||
    lower(posture.executionPosture) === "blocked" ||
    lower(posture.truthPublicationPosture) === "quarantined" ||
    lower(posture.truthPublicationPosture) === "review_required" ||
    lower(posture.truthPublicationPosture) === "approval_required";

  function mapScope(item = {}) {
    return {
      scopeType: lower(item.scopeType || "channel"),
      surface: lower(item.surface || "tenant"),
      controlMode: lower(item.controlMode || deriveControlMode(item)),
      policyReason: s(item.policyReason || item.policy_reason),
      operatorNote: s(item.operatorNote || item.operator_note),
      changedBy: s(item.changedBy || item.changed_by),
      changedAt: s(item.changedAt || item.changed_at),
      isOverride: item.isOverride === true,
      availableModes: POLICY_CONTROL_MODES.map((mode) => {
        const requiredRole = getRequiredRoleForControlMode(mode);
        const roleAllowed = canChangeControlMode({ viewerRole, mode });
        const disabledBySafety = mode === "autonomy_enabled" && cannotLoosen;
        return {
          mode,
          label: titleize(mode),
          requiredRole,
          allowed: roleAllowed && !disabledBySafety,
          unavailableReason: !roleAllowed
            ? `Requires ${titleize(requiredRole)} role`
            : disabledBySafety
            ? "Truth or runtime safety posture currently forbids loosening autonomy."
            : "",
        };
      }),
    };
  }

  return {
    viewerRole: lower(viewerRole),
    tenantDefault: mapScope({
      ...effective.tenantDefault,
      scopeType: "tenant_default",
      surface: "tenant",
    }),
    items: effective.items.map((item) => mapScope(item)),
    cannotLoosenAutonomy: cannotLoosen,
  };
}

function deriveRequiredAction({
  outcome = "",
  repairAction = null,
  truthPosture = "",
  activeReviewSession = {},
} = {}) {
  if (outcome === "blocked_until_repair") {
    return {
      label: s(repairAction?.label || "Repair runtime authority"),
      kind: "repair",
      requiredRole: lower(repairAction?.requiredRole || "operator"),
      action: repairAction || null,
    };
  }
  if (["blocked", "allowed_with_human_review"].includes(outcome)) {
    const reviewPath = activeReviewSession?.id
      ? {
          path: "/settings?tab=knowledge-review",
          section: "review",
          reviewSessionId: s(activeReviewSession.id),
        }
      : {
          path: SETUP_WIDGET_ROUTE,
          section: "truth",
        };
    return {
      label:
        truthPosture === "review_required"
          ? "Complete protected review"
          : "Review truth approval posture",
      kind: truthPosture === "review_required" ? "review" : "approval",
      requiredRole: "operator",
      action: {
        id: truthPosture === "review_required" ? "open_review_workspace" : "open_truth_setup",
        kind: "route",
        label:
          truthPosture === "review_required"
            ? "Open review workspace"
            : "Open truth setup",
        requiredRole: "operator",
        allowed: true,
        target: reviewPath,
      },
    };
  }
  if (outcome === "handoff_required") {
    return {
      label: "Complete operator handoff",
      kind: "handoff",
      requiredRole: "operator",
      action: null,
    };
  }
  if (outcome === "operator_only") {
    return {
      label: "Keep operator in the loop",
      kind: "operator",
      requiredRole: "operator",
      action: null,
    };
  }
  if (outcome === "allowed_with_logging") {
    return {
      label: "Monitor audit trail",
      kind: "observe",
      requiredRole: "operator",
      action: null,
    };
  }
  return {
    label: outcome === "allowed" ? "No operator step required" : "Telemetry unavailable",
    kind: outcome === "allowed" ? "none" : "unknown",
    requiredRole: "operator",
    action: null,
  };
}

function buildChannelAutonomySummary({
  runtimeProjection = {},
  runtimeProjectionHealth = {},
  approvalPolicy = {},
  activeReviewSession = {},
  repairAction = null,
  truthFinalizeImpact = {},
  controls = [],
} = {}) {
  const runtime = buildPolicyRuntimeShape({
    runtimeProjection,
    runtimeProjectionHealth,
    approvalPolicy,
  });
  const surfaces = [
    { key: "inbox", channelType: "inbox" },
    { key: "comments", channelType: "comments" },
    { key: "voice", channelType: "voice" },
    { key: "meta", channelType: "meta" },
  ];
  const truthPosture = lower(approvalPolicy.strictestOutcome);
  const healthStatus = lower(runtimeProjectionHealth.status);
  const finalizeAffected = arr(truthFinalizeImpact.affectedSurfaces).map((item) =>
    lower(item)
  );
  const effectiveControls = buildEffectivePolicyControls({ controls });

  return surfaces.map((surface) => {
    const isNativeExecutionSurface = ["inbox", "comments", "voice"].includes(
      surface.key
    );
    const summary = isNativeExecutionSurface
      ? buildExecutionPolicySurfaceSummary({
          runtime,
          surface: surface.key,
          channelType: surface.channelType,
        })
      : {};
    const outcome = isNativeExecutionSurface ? pickPolicyOutcome(summary) : "unknown";
    const repairRequired =
      outcome === "blocked_until_repair" ||
      ["missing", "stale", "blocked", "invalid"].includes(healthStatus);
    const approvalRequired = ["approval_required", "review_required"].includes(
      truthPosture
    );
    const autonomyStatus =
      outcome === "allowed"
        ? "autonomous"
        : outcome === "allowed_with_logging"
        ? "autonomous_with_logging"
        : outcome === "allowed_with_human_review"
        ? "review_required"
        : outcome === "handoff_required"
        ? "handoff_required"
        : outcome === "operator_only"
        ? "operator_only"
        : outcome === "blocked_until_repair"
        ? "blocked_until_repair"
        : outcome === "blocked"
        ? "blocked"
        : "unknown";
    const requiredAction = deriveRequiredAction({
      outcome,
      repairAction,
      truthPosture,
      activeReviewSession,
    });
    const controlState =
      surface.key === "tenant"
        ? effectiveControls.tenantDefault
        : effectiveControls.items.find((item) => item.surface === surface.key) || {};
    const affectedSurfaces = uniqStrings([
      ...arr(summary?.reasonCodes).filter(Boolean).map(() => surface.key),
      ...finalizeAffected.filter((item) => item === surface.key),
      ...arr(approvalPolicy.affectedSurfaces),
    ]).map((item) => lower(item));

    return {
      surface: surface.key,
      channelType: surface.channelType,
      autonomyStatus,
      policyOutcome: outcome,
      explanation: explainPolicyOutcome({
        surface: surface.key,
        outcome,
        truthPosture,
        runtimeHealthStatus: healthStatus,
      }),
      why: uniqStrings([
        healthStatus ? `runtime:${healthStatus}` : "",
        truthPosture ? `truth:${truthPosture}` : "",
        lower(controlState.controlMode) &&
        lower(controlState.controlMode) !== "autonomy_enabled"
          ? `control:${lower(controlState.controlMode)}`
          : "",
        lower(summary?.signals?.truthRiskLevel)
          ? `truth_risk:${lower(summary.signals.truthRiskLevel)}`
          : "",
        ...arr(summary?.reasonCodes || summary?.signals?.affectedSurfaces).map((item) =>
          s(item)
        ),
      ]).map((item) => lower(item)),
      reasonCodes: uniqStrings([
        ...arr(summary?.reasonCodes),
        ...arr(approvalPolicy.reasonCodes),
      ]).map((item) => lower(item)),
      reviewRequired: outcome === "allowed_with_human_review" || approvalRequired,
      handoffRequired: outcome === "handoff_required",
      repairRequired,
      approvalRequired,
      requiredRole: s(requiredAction.requiredRole || approvalPolicy.requiredRole || "operator"),
      requiredAction: requiredAction.label,
      requiredActionKind: requiredAction.kind,
      nextAction: requiredAction.action,
      affectedSurfaces: affectedSurfaces.length ? affectedSurfaces : [surface.key],
      telemetryAvailable: isNativeExecutionSurface,
      controlMode: lower(controlState.controlMode || "autonomy_enabled"),
      controlChangedBy: s(controlState.changedBy || ""),
      controlChangedAt: s(controlState.changedAt || ""),
      lowRiskOutcome: s(summary?.lowRiskOutcome),
      mediumRiskOutcome: s(summary?.mediumRiskOutcome),
      highRiskOutcome: s(summary?.highRiskOutcome),
    };
  });
}

function buildOperatorPolicyPosture({
  latestTruthVersion = {},
  truthGovernance = {},
  runtimeProjectionHealth = {},
  approvalPolicy = {},
  channelAutonomy = [],
  repairAction = null,
  activeReviewSession = {},
} = {}) {
  const truthVersionPresent = !!s(latestTruthVersion?.id);
  const truthOutcome = lower(approvalPolicy.strictestOutcome);
  const runtimeHealthStatus = lower(runtimeProjectionHealth.status);
  const channelItems = arr(channelAutonomy);
  const blockedUntilRepair = channelItems.some((item) => item.repairRequired);
  const handoffRequired = channelItems.some((item) => item.handoffRequired);
  const reviewRequired = channelItems.some((item) => item.reviewRequired);
  const operatorOnly = channelItems.some((item) => item.policyOutcome === "operator_only");
  const truthPublicationPosture = !truthVersionPresent
    ? "approval_required"
    : activeReviewSession?.id
    ? "review_required"
    : truthOutcome || (truthGovernance.quarantine ? "quarantined" : "approved");
  const executionPosture = blockedUntilRepair
    ? "blocked_until_repair"
    : handoffRequired
    ? "handoff_required"
    : reviewRequired
    ? "allowed_with_human_review"
    : operatorOnly
    ? "operator_only"
    : channelItems.every((item) => item.policyOutcome === "allowed")
    ? "allowed"
    : channelItems.some((item) => item.policyOutcome === "allowed_with_logging")
    ? "allowed_with_logging"
    : "unknown";
  const requiredAction = deriveRequiredAction({
    outcome: executionPosture,
    repairAction,
    truthPosture: truthPublicationPosture,
    activeReviewSession,
  });

  return {
    truthPublicationPosture,
    executionPosture,
    reviewRequired,
    handoffRequired,
    blocked: executionPosture === "blocked",
    blockedUntilRepair: executionPosture === "blocked_until_repair",
    requiredRole: s(requiredAction.requiredRole || approvalPolicy.requiredRole || "operator"),
    requiredAction: requiredAction.label,
    requiredActionKind: requiredAction.kind,
    nextAction: requiredAction.action,
    reasons: uniqStrings([
      truthPublicationPosture ? `truth:${truthPublicationPosture}` : "",
      runtimeHealthStatus ? `runtime:${runtimeHealthStatus}` : "",
      ...channelItems.flatMap((item) => arr(item.reasonCodes)),
    ]).map((item) => lower(item)),
    affectedSurfaces: uniqStrings(channelItems.flatMap((item) => arr(item.affectedSurfaces))).map(
      (item) => lower(item)
    ),
    explanation:
      executionPosture === "blocked_until_repair"
        ? "Autonomous execution is fail-closed until runtime projection or strict authority is repaired."
        : executionPosture === "blocked"
        ? "Autonomous execution is blocked by truth publication posture."
        : executionPosture === "handoff_required"
        ? "Sensitive execution paths require human handoff before the channel can continue autonomously."
        : executionPosture === "allowed_with_human_review"
        ? "Autonomy is constrained by review requirements even though low-risk work may still proceed."
        : executionPosture === "allowed_with_logging"
        ? "Autonomy is available, but medium-risk work stays in the logged execution lane."
        : executionPosture === "allowed"
        ? "Healthy runtime authority and approved truth currently support low-risk autonomous execution."
        : "Policy telemetry is partially unavailable, so the operator view stays explicit instead of guessing.",
  };
}

function summarizeDecisionEvents(events = []) {
  const items = arr(events);
  const safeLabel = (value = "", fallback = "Unknown") => {
    const normalized = s(value);
    return normalized ? titleize(normalized) : fallback;
  };
  const compact = (event = {}) => ({
    id: s(event.id),
    eventType: lower(event.eventType),
    eventLabel: safeLabel(event.eventType),
    timestamp: s(event.timestamp),
    source: s(event.source),
    surface: lower(event.surface),
    channelType: lower(event.channelType),
    policyOutcome: lower(event.policyOutcome),
    policyOutcomeLabel: safeLabel(event.policyOutcome),
    reasonCodes: arr(event.reasonCodes).map((item) => lower(item)),
    truthVersionId: s(event.truthVersionId),
    runtimeProjectionId: s(event.runtimeProjectionId),
    actor: s(event.actor),
    recommendedNextAction: obj(event.recommendedNextAction),
  });
  const classify = (event = {}) => {
    const eventType = lower(event.eventType);
    if (
      ["truth_publication_decision", "approval_policy_decision"].includes(eventType)
    ) {
      return {
        key: "truth",
        label: "Truth events",
      };
    }
    if (
      ["runtime_health_transition", "repair_state_change"].includes(eventType)
    ) {
      return {
        key: "runtime",
        label: "Runtime and health",
      };
    }
    if (
      ["policy_control_change", "autonomy_posture_change"].includes(eventType)
    ) {
      return {
        key: "controls",
        label: "Control changes",
      };
    }
    if (
      [
        "blocked_action_outcome",
        "handoff_required_action_outcome",
        "review_required_action_outcome",
      ].includes(eventType)
    ) {
      return {
        key: "restricted",
        label: "Restricted outcomes",
      };
    }
    return {
      key: "execution",
      label: "Execution decisions",
    };
  };
  const buildQueryPath = (path = "", params = {}) => {
    const base = s(path);
    if (!base) return "";
    const query = new URLSearchParams();
    Object.entries(obj(params)).forEach(([key, value]) => {
      const next = s(value);
      if (!next) return;
      query.set(key, next);
    });
    const text = query.toString();
    return text ? `${base}?${text}` : base;
  };
  const createRouteAction = ({
    actionType = "",
    label = "",
    path = "",
    params = {},
    reason = "",
  } = {}) => {
    const resolvedPath = buildQueryPath(path, params);
    if (!resolvedPath) return null;
    return {
      id: lower(actionType),
      actionType: lower(actionType),
      kind: "route",
      label: s(label || safeLabel(actionType)),
      allowed: true,
      reason: s(reason),
      target: {
        path: resolvedPath,
      },
    };
  };
  const buildPostureSummary = ({
    label = "",
    posture = {},
    primaryKeys = [],
    extraKeys = [],
    fallback = "",
  } = {}) => {
    const source = obj(posture);
    const primary = primaryKeys.map((key) => s(source[key])).find(Boolean);
    const extras = uniqStrings(
      extraKeys
        .map((key) => source[key])
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
    );
    return {
      label,
      primary: lower(primary),
      primaryLabel: safeLabel(primary, fallback || `Unknown ${label}`),
      detail: extras.length ? extras.map((item) => safeLabel(item)).join(" · ") : "",
      raw: source,
    };
  };
  const buildDecisionContextSnapshot = (event = {}, group = {}) => {
    const context = obj(event.decisionContext);
    const truthVersionId = s(event.truthVersionId);
    const runtimeProjectionId = s(event.runtimeProjectionId);
    const control = obj(event.controlState);
    const health = obj(event.healthState);
    const actor = s(event.actor || event.source || "system");
    const controlScope =
      lower(context.scopeType) ||
      (lower(event.surface) === "tenant" ? "tenant_default" : lower(event.surface) ? "channel" : "");
    const objectVersion =
      s(context.objectVersion) ||
      s(context.version) ||
      truthVersionId ||
      runtimeProjectionId;
    const projectionStatus =
      lower(context.projectionStatus || context.runtimeProjectionStatus || health.status);

    return {
      actor,
      objectVersion,
      projectionStatus,
      controlScope,
      eventCategory: group.key,
      channelSurface: lower(event.surface),
      channelType: lower(event.channelType),
      triggerType: lower(context.triggerType),
      reviewSessionId: s(context.reviewSessionId || context.review_session_id),
      repairRunId: s(context.repairRunId || context.repair_run_id),
      summary:
        s(context.summary) ||
        uniqStrings([
          truthVersionId ? `Truth ${truthVersionId}` : "",
          runtimeProjectionId ? `Projection ${runtimeProjectionId}` : "",
          control.controlMode ? `Control ${safeLabel(control.controlMode)}` : "",
          projectionStatus ? `Runtime ${safeLabel(projectionStatus)}` : "",
        ]).join(" · "),
      metadata: context,
    };
  };
  const buildRemediation = (event = {}, group = {}) => {
    const outcome = lower(event.policyOutcome);
    const health = obj(event.healthState);
    const approval = obj(event.approvalPosture);
    const execution = obj(event.executionPosture);
    const control = obj(event.controlState);
    const nextAction = obj(event.recommendedNextAction);
    const reasonCodes = arr(event.reasonCodes).map((item) => lower(item));
    const blocked =
      [
        "blocked",
        "blocked_until_repair",
        "handoff_required",
        "review_required",
        "allowed_with_human_review",
      ].includes(outcome) ||
      lower(execution.outcome) === "blocked_until_repair" ||
      lower(health.status) === "blocked";
    const reviewRequired =
      ["review_required", "allowed_with_human_review"].includes(outcome) ||
      lower(approval.strictestOutcome || approval.outcome) === "review_required" ||
      execution.reviewRequired === true;
    const repairRequired =
      outcome === "blocked_until_repair" ||
      lower(health.status) === "stale" ||
      lower(health.status) === "missing" ||
      lower(health.status) === "invalid" ||
      reasonCodes.includes("repair_failed");
    const handoffRequired =
      outcome === "handoff_required" ||
      lower(execution.outcome) === "handoff_required" ||
      execution.handoffRequired === true;
    const approvalRequired =
      lower(approval.strictestOutcome || approval.outcome) === "approval_required" ||
      outcome === "blocked";
    const operatorOnly =
      outcome === "operator_only" ||
      lower(control.controlMode) === "operator_only_mode";

    let headline = "No operator action is currently required.";
    if (repairRequired) {
      headline = "Repair strict runtime authority before autonomous execution can resume.";
    } else if (reviewRequired) {
      headline = "Protected review is likely needed before this decision path can clear.";
    } else if (approvalRequired) {
      headline = "Truth approval posture needs operator approval before execution can loosen.";
    } else if (handoffRequired) {
      headline = "A human handoff is required before the affected channel can proceed.";
    } else if (operatorOnly) {
      headline = "This path is intentionally restricted to operator-only execution.";
    } else if (group.key === "controls") {
      headline = "Control state changed; confirm the safer mode is the intended operating posture.";
    }

    return {
      blocked,
      reviewRequired,
      repairRequired,
      handoffRequired,
      approvalRequired,
      operatorOnly,
      headline,
      review: reviewRequired
        ? "Inspect protected review inputs, reason codes, and the latest truth evidence before retrying."
        : "",
      repair: repairRequired
        ? "Check projection health, repair status, and rebuild runtime authority from approved truth."
        : "",
      approval: approvalRequired
        ? "Confirm the latest truth version can be approved or published under current policy."
        : "",
      operator: handoffRequired
        ? "Route the affected action to an operator handoff lane."
        : operatorOnly
        ? "Keep this surface in an operator-only lane until controls are deliberately changed."
        : "",
      nextActionLabel: s(nextAction.label || "Unavailable"),
      requiredRole: lower(
        nextAction.requiredRole ||
          approval.requiredRole ||
          execution.requiredRole ||
          "operator"
      ),
    };
  };
  const buildRemediationActions = ({
    event = {},
    group = {},
    remediation = {},
    decisionContextSnapshot = {},
  } = {}) => {
    const context = obj(event.decisionContext);
    const actionCandidates = [];
    const eventId = s(event.id);
    const surface = lower(event.surface);
    const historyFilter = lower(group.key || "all");
    const truthVersionId = s(event.truthVersionId);
    const runtimeProjectionId = s(event.runtimeProjectionId);
    const threadId = s(
      context.threadId || context.thread_id || context.inboxThreadId || context.inbox_thread_id
    );

    if (remediation.reviewRequired || remediation.approvalRequired) {
      actionCandidates.push(
        createRouteAction({
          actionType: "open_truth_review",
          label: remediation.reviewRequired ? "Review truth now" : "Open truth review",
          path: "/settings",
          params: {
            section: "knowledge_review",
            reviewSessionId: s(decisionContextSnapshot.reviewSessionId),
            historyFilter,
            eventId,
          },
          reason: "Protected review and approval workflow",
        })
      );
    }

    if (truthVersionId) {
      actionCandidates.push(
        createRouteAction({
          actionType: "open_truth_version",
          label: "Open truth version",
          path: "/truth",
          params: {
            versionId: truthVersionId,
            focus: "history",
            eventId,
          },
          reason: "Inspect approved truth context",
        })
      );
    }

    if (remediation.repairRequired) {
      actionCandidates.push(
        createRouteAction({
          actionType: "open_repair_flow",
          label: "Open repair controls",
          path: "/settings",
          params: {
            section: "sources",
            trustFocus: "repair_hub",
            historyFilter: "runtime",
            runtimeProjectionId,
            eventId,
          },
          reason: "Open repair workflow without executing it directly",
        })
      );
      actionCandidates.push(
        createRouteAction({
          actionType: "open_runtime_health",
          label: "Inspect runtime health",
          path: "/settings",
          params: {
            section: "sources",
            trustFocus: "runtime_health",
            historyFilter: "runtime",
            runtimeProjectionId,
            eventId,
          },
          reason: "Review projection health posture",
        })
      );
    }

    if (runtimeProjectionId) {
      actionCandidates.push(
        createRouteAction({
          actionType: "open_projection_reference",
          label: "Open projection reference",
          path: "/settings",
          params: {
            section: "sources",
            trustFocus: "runtime_projection",
            runtimeProjectionId,
            eventId,
          },
          reason: "Inspect runtime projection reference",
        })
      );
    }

    if (remediation.operatorOnly || group.key === "controls") {
      actionCandidates.push(
        createRouteAction({
          actionType: "open_control_settings",
          label: "Open control settings",
          path: "/settings",
          params: {
            section: "sources",
            trustFocus: "policy_controls",
            surface,
            historyFilter: "controls",
            eventId,
          },
          reason: "Inspect channel or tenant control state",
        })
      );
    }

    if (surface && surface !== "tenant") {
      actionCandidates.push(
        threadId && surface === "inbox"
          ? createRouteAction({
              actionType: "open_channel_surface",
              label: "Open affected thread",
              path: "/inbox",
              params: {
                threadId,
                eventId,
              },
              reason: "Open affected inbox thread context",
            })
          : createRouteAction({
              actionType: "open_channel_surface",
              label: "View channel restrictions",
              path: "/settings",
              params: {
                section: ["voice", "inbox", "comments"].includes(surface)
                  ? "operational"
                  : "sources",
                channel: surface,
                trustFocus: "channel_surface",
                eventId,
              },
              reason: "Inspect affected channel surface",
            })
      );
    }

    if (historyFilter && historyFilter !== "all") {
      actionCandidates.push(
        createRouteAction({
          actionType: "open_history_filter",
          label: "Filter similar events",
          path: "/settings",
          params: {
            section: "sources",
            historyFilter,
            eventId,
          },
          reason: "Reopen governance history with the relevant filter applied",
        })
      );
    }

    const seen = new Set();
    return actionCandidates.filter((item) => {
      if (!item?.target?.path) return false;
      const key = `${item.actionType}:${item.target.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const detailed = (event = {}) => {
    const group = classify(event);
    const approvalPosture = buildPostureSummary({
      label: "approval",
      posture: event.approvalPosture,
      primaryKeys: ["strictestOutcome", "outcome", "truthPublicationPosture"],
      extraKeys: ["reasonCodes", "affectedSurfaces"],
      fallback: "Unknown approval posture",
    });
    const executionPosture = buildPostureSummary({
      label: "execution",
      posture: event.executionPosture,
      primaryKeys: ["outcome", "executionPosture"],
      extraKeys: ["controlMode", "requiredAction", "reasons"],
      fallback: "Unknown execution posture",
    });
    const runtimeHealthPosture = buildPostureSummary({
      label: "runtime health",
      posture: event.healthState,
      primaryKeys: ["status", "primaryReasonCode", "reasonCode"],
      extraKeys: ["reasonCodes", "affectedSurfaces"],
      fallback: "Unknown runtime health",
    });
    const decisionContextSnapshot = buildDecisionContextSnapshot(event, group);
    const remediation = buildRemediation(event, group);
    const remediationActions = buildRemediationActions({
      event,
      group,
      remediation,
      decisionContextSnapshot,
    });
    return {
      ...compact(event),
      group: group.key,
      groupLabel: group.label,
      eventCategory: group.key,
      healthState: obj(event.healthState),
      approvalPosture: obj(event.approvalPosture),
      approvalPostureSummary: approvalPosture,
      executionPosture: obj(event.executionPosture),
      executionPostureSummary: executionPosture,
      runtimeHealthPosture,
      controlState: obj(event.controlState),
      affectedSurfaces: arr(event.affectedSurfaces).map((item) => lower(item)),
      decisionContext: obj(event.decisionContext),
      decisionContextSnapshot,
      remediation: {
        ...remediation,
        actions: remediationActions,
      },
      remediationActions,
      links: {
        truthVersionId: s(event.truthVersionId),
        runtimeProjectionId: s(event.runtimeProjectionId),
        surface: lower(event.surface),
        channelType: lower(event.channelType),
        controlScope: s(decisionContextSnapshot.controlScope),
        eventCategory: group.key,
        threadId: s(
          obj(event.decisionContext).threadId ||
            obj(event.decisionContext).thread_id ||
            obj(event.decisionContext).inboxThreadId ||
            obj(event.decisionContext).inbox_thread_id
        ),
      },
    };
  };
  const groupedItems = items.map(detailed);

  return {
    items: groupedItems,
    availableFilters: [
      {
        key: "all",
        label: "All events",
        count: groupedItems.length,
      },
      {
        key: "truth",
        label: "Truth events",
        count: groupedItems.filter((item) => item.group === "truth").length,
      },
      {
        key: "runtime",
        label: "Runtime/health",
        count: groupedItems.filter((item) => item.group === "runtime").length,
      },
      {
        key: "controls",
        label: "Control changes",
        count: groupedItems.filter((item) => item.group === "controls").length,
      },
      {
        key: "restricted",
        label: "Restricted outcomes",
        count: groupedItems.filter((item) => item.group === "restricted").length,
      },
    ],
    latestImportant: items.slice(0, 8).map(compact),
    recentAutonomyChanges: items
      .filter((item) =>
        ["policy_control_change", "autonomy_posture_change"].includes(
          lower(item.eventType)
        )
      )
      .slice(0, 6)
      .map(compact),
    recentRestrictedOutcomes: items
      .filter((item) =>
        [
          "blocked_action_outcome",
          "handoff_required_action_outcome",
          "review_required_action_outcome",
        ].includes(lower(item.eventType))
      )
      .slice(0, 6)
      .map(compact),
    recentRuntimeTransitions: items
      .filter((item) =>
        ["runtime_health_transition", "repair_state_change"].includes(
          lower(item.eventType)
        )
      )
      .slice(0, 6)
      .map(compact),
  };
}

function buildSourceReviewRequired(item = {}) {
  const metadata = obj(item.metadata_json);
  return (
    !!s(
      item.review_session_id ||
        item.reviewSessionId ||
        metadata.reviewSessionId ||
        metadata.review_session_id
    ) ||
    lower(item.projection_status || metadata.projection_status) ===
      "review_required" ||
    n(item.candidate_draft_count, 0) > 0 ||
    n(item.candidate_created_count, 0) > 0 ||
    !!item.review_required ||
    !!metadata.reviewRequired
  );
}

function pickLatest(items = [], predicate = () => true) {
  return arr(items).find((item) => predicate(item)) || null;
}

function canRepairRuntimeProjection({
  latestTruthVersion = {},
  viewerRole = "operator",
} = {}) {
  return Boolean(
    s(latestTruthVersion?.id) &&
      ["internal", "owner", "admin"].includes(lower(viewerRole))
  );
}

function buildRuntimeProjectionRepairAction({
  latestTruthVersion = {},
  viewerRole = "operator",
  label = "Rebuild runtime projection",
} = {}) {
  if (!canRepairRuntimeProjection({ latestTruthVersion, viewerRole })) {
    return null;
  }

  return {
    id: "rebuild_runtime_projection",
    kind: "api",
    label: s(label),
    requiredRole: "admin",
    allowed: true,
    target: {
      path: "/api/settings/trust/runtime-projection/repair",
      method: "POST",
      section: "runtime",
      refreshSurface: "trust",
    },
  };
}

function getRepairLogger(req, tenant = {}, viewerRole = "") {
  return req.log?.child?.({
    flow: "runtime_projection_repair",
    tenantId: s(tenant?.tenant_id || tenant?.id),
    tenantKey: s(tenant?.tenant_key),
    viewerRole: s(viewerRole),
  });
}

function buildTrustReadiness({
  runtimeProjectionHealth = {},
  latestTruthVersion = {},
  activeReviewSession = {},
  viewerRole = "operator",
} = {}) {
  const runtimeHealth = obj(runtimeProjectionHealth);
  const runtimeStatus = lower(runtimeHealth.status || "");
  const runtimeBlocked = ["missing", "stale", "blocked", "invalid"].includes(
    runtimeStatus
  );
  const reviewActive = !!activeReviewSession?.id;
  const blockers = [];
  const runtimeRepairAction = buildRuntimeProjectionRepairAction({
    latestTruthVersion,
    viewerRole,
  });

  if (runtimeStatus === "missing" || !runtimeStatus) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: s(runtimeHealth.primaryReasonCode || "projection_missing"),
        viewerRole: "operator",
        missingFields: ["runtime_projection"],
        title: "Runtime projection blocker",
        subtitle:
          "No approved runtime projection is currently available for trust-controlled runtime surfaces.",
        action: runtimeRepairAction || {
          id: "open_setup_route",
          kind: "route",
          label: "Open runtime setup",
          requiredRole: "operator",
        },
        target: runtimeRepairAction
          ? obj(runtimeRepairAction.target)
          : {
              path: TRUTH_ROUTE,
              section: "runtime",
            },
      })
    );
  } else if (runtimeStatus === "stale") {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: s(runtimeHealth.primaryReasonCode || "projection_stale"),
        viewerRole: "operator",
        missingFields: arr(runtimeHealth.reasonCodes),
        title: "Runtime projection stale",
        subtitle:
          "The approved runtime projection is stale and may not reflect the latest review-protected setup state.",
        action: runtimeRepairAction || {
          id: "open_setup_route",
          kind: "route",
          label: "Review runtime setup",
          requiredRole: "operator",
        },
        target: runtimeRepairAction
          ? obj(runtimeRepairAction.target)
          : {
              path: TRUTH_ROUTE,
              section: "runtime",
            },
      })
    );
  } else if (runtimeBlocked) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: s(runtimeHealth.primaryReasonCode || "authority_invalid"),
        viewerRole: "operator",
        missingFields: arr(runtimeHealth.reasonCodes),
        title: "Runtime projection blocked",
        subtitle:
          "Runtime projection health is blocking autonomous runtime use until the listed repair path is completed.",
        action: runtimeRepairAction || {
          id: "open_setup_route",
          kind: "route",
          label: "Open runtime setup",
          requiredRole: "operator",
        },
        target: runtimeRepairAction
          ? obj(runtimeRepairAction.target)
          : {
              path: TRUTH_ROUTE,
              section: "runtime",
            },
      })
    );
  }

  if (!s(latestTruthVersion?.id)) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: "approved_truth_unavailable",
        viewerRole: "operator",
        missingFields: ["approved_truth"],
        title: "Approved truth blocker",
        subtitle:
          "Trust-controlled approved truth is unavailable. No fallback profile data is being substituted here.",
        action: {
          id: "open_setup_route",
          kind: "route",
          label: "Open truth setup",
          requiredRole: "operator",
        },
        target: {
          path: SETUP_WIDGET_ROUTE,
          section: "truth",
        },
      })
    );
  }

  if (reviewActive) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: "review_required",
        viewerRole: "operator",
        missingFields: [
          s(activeReviewSession?.currentStep || activeReviewSession?.current_step),
        ],
        title: "Review session active",
        subtitle:
          "A setup review is still active. Approved truth and runtime projection remain protected until review is completed.",
        action: {
          id: "open_review_workspace",
          kind: "route",
          label: "Open review workspace",
          requiredRole: "operator",
        },
        target: {
          path: "/settings?tab=knowledge-review",
          section: "review",
          reviewSessionId: s(activeReviewSession?.id),
        },
      })
    );
  }

  return {
    runtimeProjection: buildReadinessSurface({
      status: runtimeBlocked || !runtimeStatus ? "blocked" : "ready",
      message:
        runtimeStatus === "missing" || !runtimeStatus
          ? "Runtime projection is unavailable."
          : runtimeStatus === "stale"
          ? "Runtime projection is stale."
          : runtimeBlocked
          ? "Runtime projection is blocked."
          : "Runtime projection is ready.",
      blockers: blockers.filter((item) => item.category === "runtime"),
      repairActions: runtimeRepairAction ? [runtimeRepairAction] : [],
    }),
    truth: buildReadinessSurface({
      status: !s(latestTruthVersion?.id) ? "blocked" : "ready",
      message: !s(latestTruthVersion?.id)
        ? "Approved truth is unavailable."
        : "Approved truth is available.",
      blockers: blockers.filter((item) => item.category === "truth"),
    }),
    review: buildReadinessSurface({
      status: reviewActive ? "blocked" : "ready",
      message: reviewActive
        ? "A protected review is still active."
        : "No active protected review session is blocking trust maintenance.",
      blockers: blockers.filter((item) => item.category === "review"),
    }),
    overall: buildReadinessSurface({
      status: blockers.some((item) => item.blocked) ? "blocked" : "ready",
      message: blockers.some((item) => item.blocked)
        ? "Trust maintenance remains blocked until the listed runtime/truth prerequisites are repaired."
        : "Trust maintenance prerequisites are aligned.",
      blockers,
      repairActions: runtimeRepairAction ? [runtimeRepairAction] : [],
    }),
  };
}

export function settingsTrustRoutes({ db }) {
  const router = express.Router();

  router.get("/settings/trust", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      if (!hasDb(db)) return bad(res, 503, "db disabled", { dbDisabled: true });

      const tenantId = s(getAuthTenantId(req));
      const requestedTenantKey = s(
        getAuthTenantKey(req) || tenantKey
      ).toLowerCase();
      const sources = createTenantSourcesHelpers({ db });
      const knowledge = createTenantKnowledgeHelpers({ db });
      const truthVersions = createTenantTruthVersionHelpers({ db });
      const executionPolicyControls = createTenantExecutionPolicyControlHelpers({ db });

      const tenant = await sources.resolveTenantIdentity({
        tenantId,
        tenantKey: requestedTenantKey,
      });
      if (!tenant?.tenant_id) {
        return res.status(404).json({ ok: false, error: "tenant not found" });
      }

      const viewerRole = isInternalServiceRequest(req)
        ? "internal"
        : getUserRole(req);
      const canReadAuditHistory = canReadControlPlaneAuditHistoryRole(viewerRole);

      const [
        sourceItems,
        reviewQueue,
        recentRuns,
        runtimeProjection,
        runtimeFreshness,
        latestTruthVersion,
        activeReviewSession,
        latestRepairRun,
        policyControls,
        audit,
      ] = await Promise.all([
        sources.listSources({
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
          limit: 250,
          offset: 0,
        }),
        knowledge.listReviewQueue({
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
          limit: 250,
          offset: 0,
        }),
        sources.listSyncRuns({
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
          limit: 12,
          offset: 0,
        }),
        getCurrentTenantRuntimeProjection(
          {
            tenantId: tenant.tenant_id,
            tenantKey: tenant.tenant_key,
          },
          db
        ).catch(() => null),
        getTenantRuntimeProjectionFreshness(
          {
            tenantId: tenant.tenant_id,
            tenantKey: tenant.tenant_key,
            markStale: false,
          },
          db
        ).catch(() => null),
        truthVersions
          .getLatestVersion({
            tenantId: tenant.tenant_id,
            tenantKey: tenant.tenant_key,
          })
          .catch(() => null),
        getActiveSetupReviewSession(tenant.tenant_id, db).catch(() => null),
        getLatestTenantRuntimeProjectionRun(
          {
            tenantId: tenant.tenant_id,
            tenantKey: tenant.tenant_key,
          },
          db
        ).catch(() => null),
        executionPolicyControls
          .listControls({
            tenantId: tenant.tenant_id,
            tenantKey: tenant.tenant_key,
          })
          .catch(() => []),
        dbListAuditEntries(db, {
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
          actions: [
            "settings.workspace.updated",
            "settings.secret.updated",
            "settings.secret.deleted",
            "settings.operational.voice.updated",
            "settings.operational.channel.updated",
            "settings.source.created",
            "settings.source.updated",
            "settings.source.sync.requested",
            "settings.knowledge.approved",
            "settings.knowledge.rejected",
            "settings.trust.runtime_projection.repair",
            "settings.trust.runtime_projection.repaired",
            "team.user.created",
            "team.user.updated",
            "team.user.status.updated",
            "team.user.password.updated",
            "team.user.deleted",
            "setup.review.updated",
            "setup.review.discarded",
            "setup.review.finalized",
            "truth.version.created",
          ],
          limit: 20,
          offset: 0,
        }),
      ]);

      const sourceMap = new Map(arr(sourceItems).map((item) => [s(item.id), item]));
      const reviewRequiredCount = arr(sourceItems).filter((item) =>
        buildSourceReviewRequired(item)
      ).length;
      const latestRun = pickLatest(recentRuns, () => true);
      const lastSuccess = pickLatest(recentRuns, (item) => {
        const status = lower(item.status);
        return status === "success" || status === "completed";
      });
      const lastFailure = pickLatest(recentRuns, (item) => {
        const status = lower(item.status);
        return status === "failed" || status === "error";
      });
      const conflictCount = arr(reviewQueue).filter(
        (item) => lower(item.status) === "conflict"
      ).length;
      const projectionHealth = await getTenantRuntimeProjectionHealth(
        {
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
          runtimeProjection,
          freshness: runtimeFreshness,
          latestTruthVersion,
          activeReviewSession,
        },
        db
      ).catch(() => null);
      const readiness = buildTrustReadiness({
        runtimeProjectionHealth: projectionHealth,
        latestTruthVersion,
        activeReviewSession,
        viewerRole,
      });
      const repairAction = buildRuntimeProjectionRepairAction({
        latestTruthVersion,
        viewerRole,
      });
      const truthGovernance = normalizeTruthGovernance(latestTruthVersion);
      const truthFinalizeImpact = normalizeTruthFinalizeImpact(latestTruthVersion);
      const truthApprovalPolicy = normalizeApprovalPolicyPosture(
        latestTruthVersion,
        activeReviewSession
      );
      const channelAutonomy = buildChannelAutonomySummary({
        runtimeProjection,
        runtimeProjectionHealth: projectionHealth,
        approvalPolicy: truthApprovalPolicy,
        activeReviewSession,
        repairAction,
        truthFinalizeImpact,
        controls: policyControls,
      });
      const policyPosture = buildOperatorPolicyPosture({
        latestTruthVersion,
        truthGovernance,
        runtimeProjectionHealth: projectionHealth,
        approvalPolicy: truthApprovalPolicy,
        channelAutonomy,
        repairAction,
        activeReviewSession,
      });
      const policyControlsSurface = buildPolicyControlSurface({
        controls: policyControls,
        viewerRole,
        policyPosture,
      });
      const recentDecisionEvents = await listDecisionEvents(db, {
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        limit: 24,
      }).catch(() => []);

      return ok(res, {
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        viewerRole,
        capabilities: {
          canRepairRuntimeProjection: !!repairAction,
          runtimeProjectionRepair: {
            allowed: !!repairAction,
            requiredRoles: ["owner", "admin"],
            message: "Only owner/admin can rebuild runtime projection.",
          },
        },
        summary: {
          sources: {
            total: arr(sourceItems).length,
            enabled: arr(sourceItems).filter((item) => !!item.is_enabled).length,
            connected: arr(sourceItems).filter(
              (item) => lower(item.status) === "connected"
            ).length,
            running: arr(sourceItems).filter((item) =>
              ["running", "queued", "pending"].includes(lower(item.sync_status))
            ).length,
            failed: arr(sourceItems).filter((item) =>
              ["failed", "error"].includes(lower(item.sync_status))
            ).length,
            reviewRequired: reviewRequiredCount,
            lastRunAt: iso(
              latestRun?.finished_at || latestRun?.started_at || latestRun?.created_at
            ),
            lastRunStatus: lower(latestRun?.status || latestRun?.sync_status || ""),
            lastSuccessAt: iso(
              lastSuccess?.finished_at ||
                lastSuccess?.started_at ||
                lastSuccess?.created_at
            ),
            lastFailureAt: iso(
              lastFailure?.finished_at ||
                lastFailure?.started_at ||
                lastFailure?.created_at
            ),
          },
          reviewQueue: {
            pending: arr(reviewQueue).length,
            conflicts: conflictCount,
            latestCandidateAt: iso(
              arr(reviewQueue)[0]?.created_at || arr(reviewQueue)[0]?.updated_at
            ),
          },
          runtimeProjection: {
            id: s(runtimeProjection?.id),
            status: lower(runtimeProjection?.status || ""),
            projectionHash: s(runtimeProjection?.projection_hash),
            updatedAt: iso(
              runtimeProjection?.updated_at || runtimeProjection?.created_at
            ),
            stale: !!runtimeFreshness?.stale,
            reasons: arr(runtimeFreshness?.reasons),
            health: projectionHealth,
            repair: {
              canRepair: !!repairAction,
              action: repairAction,
              latestRun: {
                id: s(latestRepairRun?.id),
                status: lower(latestRepairRun?.status || ""),
                triggerType: s(latestRepairRun?.trigger_type),
                requestedBy: s(latestRepairRun?.requested_by),
                startedAt: iso(latestRepairRun?.started_at),
                finishedAt: iso(latestRepairRun?.finished_at),
                durationMs: n(latestRepairRun?.duration_ms, 0),
                errorCode: s(latestRepairRun?.error_code),
                errorMessage: s(latestRepairRun?.error_message),
                runtimeProjectionId: s(latestRepairRun?.runtime_projection_id),
                outputSummary: obj(latestRepairRun?.output_summary_json),
              },
            },
            readiness: readiness.runtimeProjection,
          },
          truth: {
            latestVersionId: s(latestTruthVersion?.id),
            approvedAt: iso(
              latestTruthVersion?.approved_at || latestTruthVersion?.created_at
            ),
            approvedBy: s(latestTruthVersion?.approved_by),
            reviewSessionId: s(latestTruthVersion?.review_session_id),
            sourceSummary: obj(latestTruthVersion?.source_summary_json),
            metadata: obj(latestTruthVersion?.metadata_json),
            governance: truthGovernance,
            approvalPolicy: truthApprovalPolicy,
            finalizeImpact: truthFinalizeImpact,
            readiness: readiness.truth,
          },
          setupReview: {
            active: !!activeReviewSession?.id,
            sessionId: s(activeReviewSession?.id),
            status: lower(activeReviewSession?.status || ""),
            currentStep: s(
              activeReviewSession?.currentStep || activeReviewSession?.current_step
            ),
            updatedAt: iso(
              activeReviewSession?.updatedAt || activeReviewSession?.updated_at
            ),
            readiness: readiness.review,
          },
          policyPosture,
          channelAutonomy: {
            items: channelAutonomy,
          },
          policyControls: policyControlsSurface,
          decisionAudit: summarizeDecisionEvents(recentDecisionEvents),
          readiness: readiness.overall,
        },
        recentRuns: arr(recentRuns)
          .slice(0, 6)
          .map((run) => {
            const source = sourceMap.get(s(run.source_id));
            return {
              ...run,
              sourceDisplayName: s(
                source?.display_name || source?.source_key || source?.source_url
              ),
            };
          }),
        audit: canReadAuditHistory ? audit : [],
        permissions: {
          auditHistoryRead: {
            allowed: canReadAuditHistory,
            requiredRoles: ["owner", "admin", "analyst"],
            message: canReadAuditHistory
              ? ""
              : "Only owner/admin/analyst can read control-plane audit history.",
          },
        },
      });
    } catch (err) {
      return bad(res, 500, err?.message || "failed to load trust summary");
    }
  });

  router.post("/settings/trust/policy-controls", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      if (!hasDb(db)) return bad(res, 503, "db disabled", { dbDisabled: true });

      const tenantId = s(getAuthTenantId(req));
      const requestedTenantKey = s(
        getAuthTenantKey(req) || tenantKey
      ).toLowerCase();
      const sources = createTenantSourcesHelpers({ db });
      const truthVersions = createTenantTruthVersionHelpers({ db });
      const executionPolicyControls = createTenantExecutionPolicyControlHelpers({ db });

      const tenant = await sources.resolveTenantIdentity({
        tenantId,
        tenantKey: requestedTenantKey,
      });
      if (!tenant?.tenant_id) {
        return res.status(404).json({ ok: false, error: "tenant not found" });
      }

      const requestedMode = lower(req.body?.controlMode || req.body?.control_mode);
      if (!POLICY_CONTROL_MODES.includes(requestedMode)) {
        return bad(res, "invalid_control_mode", {
          reasonCode: "invalid_control_mode",
          allowedModes: POLICY_CONTROL_MODES,
        });
      }

      const targetSurface = lower(req.body?.surface || "tenant");
      if (!["tenant", "inbox", "comments", "voice", "meta"].includes(targetSurface)) {
        return bad(res, "invalid_control_surface", {
          reasonCode: "invalid_control_surface",
        });
      }

      const requiredRole = getRequiredRoleForControlMode(requestedMode);
      const viewerRole = await requireMutationRole(req, res, {
        db,
        tenant: { id: tenant.tenant_id, tenant_key: tenant.tenant_key },
        allowedRoles:
          requiredRole === "owner"
            ? ["owner"]
            : requiredRole === "admin"
            ? ["owner", "admin"]
            : ["owner", "admin", "operator"],
        message: `Only ${requiredRole}${requiredRole === "owner" ? "" : "/owner"} can change this policy control`,
        reasonCode: "insufficient_role",
        auditAction: "settings.trust.policy_control.updated",
        objectType: "tenant_execution_policy_control",
        objectId: `${tenant.tenant_id}:${targetSurface}`,
        targetArea: "policy_control",
        auditMeta: {
          attemptedMode: requestedMode,
          surface: targetSurface,
        },
      });
      if (!viewerRole) return;

      const latestTruthVersion = await truthVersions
        .getLatestVersion({
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
        })
        .catch(() => null);
      const runtimeProjection = await getCurrentTenantRuntimeProjection(
        {
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
        },
        db
      ).catch(() => null);
      const runtimeFreshness = await getTenantRuntimeProjectionFreshness(
        {
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
          markStale: false,
          runtimeProjection,
        },
        db
      ).catch(() => null);
      const activeReviewSession = await getActiveSetupReviewSession(tenant.tenant_id, db).catch(
        () => null
      );
      const projectionHealth = await getTenantRuntimeProjectionHealth(
        {
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
          runtimeProjection,
          freshness: runtimeFreshness,
          latestTruthVersion,
          activeReviewSession,
        },
        db
      ).catch(() => null);
      const truthGovernance = normalizeTruthGovernance(latestTruthVersion);
      const truthApprovalPolicy = normalizeApprovalPolicyPosture(
        latestTruthVersion,
        activeReviewSession
      );
      const policyPosture = buildOperatorPolicyPosture({
        latestTruthVersion,
        truthGovernance,
        runtimeProjectionHealth: projectionHealth,
        approvalPolicy: truthApprovalPolicy,
        channelAutonomy: [],
        repairAction: null,
        activeReviewSession,
      });

      if (
        requestedMode === "autonomy_enabled" &&
        (
          lower(policyPosture.executionPosture) === "blocked_until_repair" ||
          lower(policyPosture.executionPosture) === "blocked" ||
          lower(policyPosture.truthPublicationPosture) === "review_required" ||
          lower(policyPosture.truthPublicationPosture) === "approval_required" ||
          lower(policyPosture.truthPublicationPosture) === "quarantined"
        )
      ) {
        await auditSafe(
          db,
          req,
          { id: tenant.tenant_id, tenant_key: tenant.tenant_key },
          "settings.trust.policy_control.updated",
          "tenant_execution_policy_control",
          `${tenant.tenant_id}:${targetSurface}`,
          {
            outcome: "blocked",
            reasonCode: "core_safety_invariant",
            targetArea: "policy_control",
            requestedMode,
            surface: targetSurface,
          }
        );
        await safeAppendDecisionEvent(db, {
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
          eventType: "policy_control_change",
          actor: getActor(req),
          source: "settings.trust.policy-controls",
          surface: targetSurface,
          policyOutcome: "blocked_until_repair",
          reasonCodes: ["core_safety_invariant", "policy_control_blocked"],
          healthState: {
            status: lower(projectionHealth?.status),
            primaryReasonCode: lower(
              projectionHealth?.primaryReasonCode || projectionHealth?.reasonCode
            ),
          },
          approvalPosture: truthApprovalPolicy,
          executionPosture: policyPosture,
          controlState: {
            requestedMode,
            viewerRole,
            blocked: true,
          },
          truthVersionId: s(latestTruthVersion?.id),
          runtimeProjectionId: s(runtimeProjection?.id),
          affectedSurfaces: [targetSurface],
          recommendedNextAction: {
            label: "Repair runtime or complete truth approval first",
            kind: "repair",
          },
          decisionContext: {
            policyReason: s(
              req.body?.policyReason || req.body?.policy_reason || requestedMode
            ),
            operatorNote: s(req.body?.operatorNote || req.body?.operator_note),
          },
        });
        return res.status(409).json({
          ok: false,
          error: "core_safety_invariant",
          reasonCode: "core_safety_invariant",
          details: {
            message:
              "Autonomy cannot be loosened while runtime or truth safety posture still forbids autonomous execution.",
          },
        });
      }

      const record = buildStoredControlFromMode({
        mode: requestedMode,
        policyReason: s(req.body?.policyReason || req.body?.policy_reason || requestedMode),
        operatorNote: s(req.body?.operatorNote || req.body?.operator_note),
        changedBy: getActor(req),
      });
      const saved = await executionPolicyControls.upsertControl({
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        scopeType: targetSurface === "tenant" ? "tenant_default" : "channel",
        surface: targetSurface,
        ...record,
        metadata: {
          changedByRole: viewerRole,
          requestedMode,
        },
      });

      await auditSafe(
        db,
        req,
        { id: tenant.tenant_id, tenant_key: tenant.tenant_key },
        "settings.trust.policy_control.updated",
        "tenant_execution_policy_control",
        `${tenant.tenant_id}:${targetSurface}`,
        {
          outcome: "succeeded",
          targetArea: "policy_control",
          requestedMode,
          surface: targetSurface,
          changedByRole: viewerRole,
          policyReason: saved.policyReason,
        }
      );

      await safeAppendDecisionEvent(db, {
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        eventType: "policy_control_change",
        actor: getActor(req),
        source: "settings.trust.policy-controls",
        surface: targetSurface,
        policyOutcome: lower(policyPosture.executionPosture),
        reasonCodes: ["policy_control_updated", requestedMode],
        healthState: {
          status: lower(projectionHealth?.status),
          primaryReasonCode: lower(
            projectionHealth?.primaryReasonCode || projectionHealth?.reasonCode
          ),
        },
        approvalPosture: truthApprovalPolicy,
        executionPosture: policyPosture,
        controlState: {
          ...saved,
          viewerRole,
        },
        truthVersionId: s(latestTruthVersion?.id),
        runtimeProjectionId: s(runtimeProjection?.id),
        affectedSurfaces: [targetSurface],
        recommendedNextAction: {
          label: requestedMode === "autonomy_enabled" ? "Monitor autonomy posture" : "Operate in safer mode",
          kind: requestedMode === "autonomy_enabled" ? "observe" : "control",
        },
        decisionContext: {
          requestedMode,
          policyReason: s(saved.policyReason),
          operatorNote: s(saved.operatorNote),
        },
      });

      await safeAppendDecisionEvent(db, {
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        eventType: "autonomy_posture_change",
        actor: getActor(req),
        source: "settings.trust.policy-controls",
        surface: targetSurface,
        policyOutcome: requestedMode === "autonomy_enabled" ? "allowed" : lower(policyPosture.executionPosture),
        reasonCodes: ["policy_control_applied", requestedMode],
        executionPosture: {
          previous: lower(policyPosture.executionPosture),
          controlMode: lower(saved.controlMode),
        },
        controlState: {
          ...saved,
          viewerRole,
        },
        truthVersionId: s(latestTruthVersion?.id),
        runtimeProjectionId: s(runtimeProjection?.id),
        affectedSurfaces: [targetSurface],
        decisionContext: {
          requestedMode,
          scopeType: targetSurface === "tenant" ? "tenant_default" : "channel",
        },
      });

      return ok(res, {
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        viewerRole,
        control: saved,
      });
    } catch (err) {
      return bad(res, 500, err?.message || "failed to save policy control");
    }
  });

  router.post("/settings/trust/runtime-projection/repair", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const tenantId = s(getAuthTenantId(req));
      const requestedTenantKey = s(
        getAuthTenantKey(req) || tenantKey
      ).toLowerCase();
      const sources = createTenantSourcesHelpers({ db });
      const truthVersions = createTenantTruthVersionHelpers({ db });

      const tenant = await sources.resolveTenantIdentity({
        tenantId,
        tenantKey: requestedTenantKey,
      });
      if (!tenant?.tenant_id) {
        return res.status(404).json({ ok: false, error: "tenant not found" });
      }

      const viewerRole = await requireOwnerOrAdminMutation(req, res, {
        db,
        tenant: { id: tenant.tenant_id, tenant_key: tenant.tenant_key },
        message: "Only owner/admin can repair runtime projection",
        auditAction: "settings.trust.runtime_projection.repair",
        objectType: "tenant_business_runtime_projection",
        objectId: tenant.tenant_id,
        targetArea: "trust_runtime_projection",
      });
      if (!viewerRole) return;
      const repairLogger = getRepairLogger(req, tenant, viewerRole);

      const latestTruthVersion = await truthVersions
        .getLatestVersion({
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
        })
        .catch(() => null);

      repairLogger?.info("runtime_projection.repair.requested", {
        latestTruthVersionId: s(latestTruthVersion?.id),
      });

      if (!s(latestTruthVersion?.id)) {
        await auditSafe(
          db,
          req,
          { id: tenant.tenant_id, tenant_key: tenant.tenant_key },
          "settings.trust.runtime_projection.repair",
          "tenant_business_runtime_projection",
          tenant.tenant_id,
          {
            outcome: "blocked",
            reasonCode: "approved_truth_unavailable",
            targetArea: "trust_runtime_projection",
          }
        );
        await safeAppendDecisionEvent(db, {
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
          eventType: "repair_state_change",
          actor: getActor(req),
          source: "settings.trust.runtime-projection.repair",
          surface: "tenant",
          policyOutcome: "blocked_until_repair",
          reasonCodes: ["approved_truth_unavailable", "repair_blocked"],
          approvalPosture: {
            outcome: "approval_required",
          },
          executionPosture: {
            outcome: "blocked_until_repair",
          },
          recommendedNextAction: {
            label: "Approve truth before repairing runtime",
            kind: "approval",
          },
          decisionContext: {
            triggerType: "manual_repair",
            viewerRole,
          },
        });
        repairLogger?.warn("runtime_projection.repair.blocked", {
          reasonCode: "approved_truth_unavailable",
        });
        return res.status(409).json({
          ok: false,
          error: "approved_truth_unavailable",
          reasonCode: "approved_truth_unavailable",
          details: {
            tenantKey: tenant.tenant_key,
            canRepair: false,
            message: "Runtime projection rebuild requires approved truth.",
          },
        });
      }

      let refreshed = null;
      try {
        refreshed = await refreshTenantRuntimeProjectionStrict(
          {
            tenantId: tenant.tenant_id,
            tenantKey: tenant.tenant_key,
            triggerType: "manual_repair",
            requestedBy: getActor(req),
            runnerKey: "settings.trust.runtime_projection.repair",
            generatedBy: getActor(req),
            approvedBy: s(latestTruthVersion?.approved_by),
            metadata: {
              source: "settingsTrustRoutes.runtimeProjectionRepair",
              initiatedByRole: viewerRole,
            },
          },
          db
        );
      } catch (error) {
        await auditSafe(
          db,
          req,
          { id: tenant.tenant_id, tenant_key: tenant.tenant_key },
          "settings.trust.runtime_projection.repair",
          "tenant_business_runtime_projection",
          tenant.tenant_id,
          {
            outcome: "failed",
            reasonCode:
              s(error?.freshness?.reasons?.[0]) ||
              s(error?.code || "runtime_projection_repair_failed").toLowerCase(),
            targetArea: "trust_runtime_projection",
            freshness: obj(error?.freshness),
          }
        );
        await safeAppendDecisionEvent(db, {
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
          eventType: "repair_state_change",
          actor: getActor(req),
          source: "settings.trust.runtime-projection.repair",
          surface: "tenant",
          policyOutcome: "blocked_until_repair",
          reasonCodes: [
            s(error?.freshness?.reasons?.[0]) ||
              s(error?.code || "runtime_projection_repair_failed").toLowerCase(),
            "repair_failed",
          ],
          healthState: obj(error?.freshness),
          executionPosture: {
            outcome: "blocked_until_repair",
          },
          truthVersionId: s(latestTruthVersion?.id),
          runtimeProjectionId: s(error?.runtimeProjectionId),
          recommendedNextAction: {
            label: "Review runtime repair failure",
            kind: "repair",
          },
          decisionContext: {
            triggerType: "manual_repair",
            viewerRole,
          },
        });
        repairLogger?.warn("runtime_projection.repair.failed", {
          reasonCode:
            s(error?.freshness?.reasons?.[0]) ||
            s(error?.code || "runtime_projection_repair_failed").toLowerCase(),
          runtimeProjectionId: s(error?.runtimeProjectionId),
        });
        return res.status(409).json({
          ok: false,
          error: "runtime_projection_repair_failed",
          reasonCode:
            s(error?.freshness?.reasons?.[0]) ||
            s(error?.code || "runtime_projection_repair_failed").toLowerCase(),
          details: {
            tenantKey: tenant.tenant_key,
            message: s(error?.message || "runtime projection repair failed"),
            freshness: obj(error?.freshness),
          },
        });
      }

      await auditSafe(
        db,
        req,
        { id: tenant.tenant_id, tenant_key: tenant.tenant_key },
        "settings.trust.runtime_projection.repaired",
        "tenant_business_runtime_projection",
        s(refreshed?.projection?.id),
        {
          outcome: "succeeded",
          targetArea: "trust_runtime_projection",
          triggerType: "manual_repair",
          runtimeProjectionId: s(refreshed?.projection?.id),
          freshnessReasons: arr(refreshed?.freshness?.reasons),
        }
      );

      await safeAppendDecisionEvent(db, {
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        eventType: "repair_state_change",
        actor: getActor(req),
        source: "settings.trust.runtime-projection.repair",
        surface: "tenant",
        policyOutcome: "allowed",
        reasonCodes: ["runtime_projection_repaired", "manual_repair"],
        healthState: obj(refreshed?.freshness),
        executionPosture: {
          outcome: "allowed",
        },
        truthVersionId: s(latestTruthVersion?.id),
        runtimeProjectionId: s(refreshed?.projection?.id),
        recommendedNextAction: {
          label: "Monitor repaired runtime",
          kind: "observe",
        },
        decisionContext: {
          triggerType: "manual_repair",
          viewerRole,
          repairRunId: s(refreshed?.runId),
        },
      });

      await safeAppendDecisionEvent(db, {
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        eventType: "runtime_health_transition",
        actor: getActor(req),
        source: "settings.trust.runtime-projection.repair",
        surface: "tenant",
        policyOutcome: "allowed",
        reasonCodes: arr(refreshed?.freshness?.reasons).length
          ? arr(refreshed?.freshness?.reasons)
          : ["runtime_projection_ready"],
        healthState: {
          ...obj(refreshed?.freshness),
          status: "ready",
        },
        executionPosture: {
          outcome: "allowed",
        },
        truthVersionId: s(latestTruthVersion?.id),
        runtimeProjectionId: s(refreshed?.projection?.id),
        decisionContext: {
          triggerType: "manual_repair",
          repairRunId: s(refreshed?.runId),
          projectionStatus: s(refreshed?.projection?.status).toLowerCase(),
        },
      });

      repairLogger?.info("runtime_projection.repair.completed", {
        repairRunId: s(refreshed?.runId),
        runtimeProjectionId: s(refreshed?.projection?.id),
        projectionStatus: s(refreshed?.projection?.status).toLowerCase(),
        reasonCode: s(refreshed?.freshness?.reasons?.[0] || ""),
      });

      return ok(res, {
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        repaired: true,
        projection: {
          id: s(refreshed?.projection?.id),
          status: s(refreshed?.projection?.status).toLowerCase(),
          projectionHash: s(refreshed?.projection?.projection_hash),
          updatedAt: iso(
            refreshed?.projection?.updated_at || refreshed?.projection?.created_at
          ),
        },
        freshness: obj(refreshed?.freshness),
        repairRunId: s(refreshed?.runId),
      });
    } catch (err) {
      req.log?.error("runtime_projection.repair.unhandled_failed", err);
      return serverErr(res, err?.message || "failed to repair runtime projection");
    }
  });

  return router;
}
