import { apiGet, apiPost } from "./client.js";
import { createReadinessViewModel } from "../lib/readinessViewModel.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function bool(v, d = false) {
  return typeof v === "boolean" ? v : d;
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    const next = s(value);
    if (!next) continue;
    query.set(key, next);
  }

  const text = query.toString();
  return text ? `?${text}` : "";
}

function normalizeRecentRuns(items = []) {
  return arr(items).map((item) => ({
    id: s(item.id),
    sourceDisplayName: s(item.sourceDisplayName || item.source_display_name || item.sourceType),
    status: s(item.status || item.sync_status).toLowerCase(),
    startedAt: s(item.startedAt || item.started_at || item.createdAt || item.created_at),
    finishedAt: s(item.finishedAt || item.finished_at),
    reviewRequired: item.reviewRequired === true,
    errorMessage: s(item.errorMessage || item.error_message),
  }));
}

function normalizeAudit(items = []) {
  return arr(items).map((item) => ({
    id: s(item.id),
    action: s(item.action),
    actor: s(item.actor),
    createdAt: s(item.createdAt || item.created_at),
  }));
}

function normalizeStringList(items = []) {
  return arr(items).map((item) => s(item)).filter(Boolean);
}

function normalizeImpactSummary(input = {}) {
  const source = obj(input);
  return {
    canonicalAreas: normalizeStringList(source.canonicalAreas || source.canonical_areas),
    runtimeAreas: normalizeStringList(source.runtimeAreas || source.runtime_areas),
    canonicalPaths: normalizeStringList(source.canonicalPaths || source.canonical_paths),
    runtimePaths: normalizeStringList(source.runtimePaths || source.runtime_paths),
    affectedSurfaces: normalizeStringList(source.affectedSurfaces || source.affected_surfaces),
  };
}

function normalizeGovernanceSummary(input = {}) {
  const source = obj(input);
  const trust = obj(source.trust);
  const freshness = obj(source.freshness);
  const support = obj(source.support);
  const conflict = obj(source.conflict);
  const quarantinedClaims = arr(source.quarantinedClaims || source.quarantined_claims);

  return {
    disposition: s(source.disposition).toLowerCase(),
    promotable: bool(source.promotable),
    quarantine: bool(source.quarantine),
    quarantineReasons: normalizeStringList(
      source.quarantineReasons || source.quarantine_reasons
    ),
    quarantinedClaims,
    quarantinedClaimCount:
      n(source.quarantinedClaimCount || source.quarantined_claim_count) ||
      quarantinedClaims.length,
    trust: {
      strongestTier: s(trust.strongestTier || trust.strongest_tier).toLowerCase(),
      strongestSourceType: s(
        trust.strongestSourceType || trust.strongest_source_type
      ).toLowerCase(),
      strongestTrustScore: n(
        trust.strongestTrustScore || trust.strongest_trust_score
      ),
      strongestAuthorityRank: n(
        trust.strongestAuthorityRank || trust.strongest_authority_rank
      ),
      weakOnly: bool(trust.weakOnly || trust.weak_only),
      sourceTypes: normalizeStringList(trust.sourceTypes || trust.source_types),
    },
    freshness: {
      bucket: s(freshness.bucket).toLowerCase(),
      stale: bool(freshness.stale),
      reviewRequired: bool(
        freshness.reviewRequired || freshness.review_required
      ),
      freshestObservedAt: s(
        freshness.freshestObservedAt || freshness.freshest_observed_at
      ),
      stalestObservedAt: s(
        freshness.stalestObservedAt || freshness.stalest_observed_at
      ),
    },
    support: {
      evidenceCount: n(support.evidenceCount || support.evidence_count),
      uniqueSourceCount: n(
        support.uniqueSourceCount || support.unique_source_count
      ),
      strongEvidenceCount: n(
        support.strongEvidenceCount || support.strong_evidence_count
      ),
      staleEvidenceCount: n(
        support.staleEvidenceCount || support.stale_evidence_count
      ),
    },
    conflict: {
      classification: s(conflict.classification).toLowerCase(),
      resolution: s(conflict.resolution).toLowerCase(),
      reviewRequired: bool(
        conflict.reviewRequired || conflict.review_required
      ),
    },
  };
}

function normalizeProjectionRepair(input = {}) {
  const source = obj(input);
  const action = source.action ? obj(source.action) : source.repairAction ? obj(source.repairAction) : {};
  const latestRun = obj(source.latestRun || source.lastRun);
  return {
    canRepair: source.canRepair === true,
    action: Object.keys(action).length ? action : null,
    latestRun: {
      id: s(latestRun.id),
      status: s(latestRun.status).toLowerCase(),
      triggerType: s(latestRun.triggerType || latestRun.trigger_type),
      requestedBy: s(latestRun.requestedBy || latestRun.requested_by),
      startedAt: s(latestRun.startedAt || latestRun.started_at),
      finishedAt: s(latestRun.finishedAt || latestRun.finished_at),
      errorCode: s(latestRun.errorCode || latestRun.error_code),
      errorMessage: s(latestRun.errorMessage || latestRun.error_message),
      reasonCode: s(latestRun.reasonCode || latestRun.reason_code),
    },
  };
}

function normalizeProjectionHealth(input = {}) {
  const source = obj(input);
  const lastKnownGood = obj(source.lastKnownGood || source.last_known_good);
  const lastSuccess = obj(source.lastSuccess || source.last_success);
  const lastFailure = obj(source.lastFailure || source.last_failure);
  const nextRecommendedRepair = obj(
    source.nextRecommendedRepair || source.next_recommended_repair
  );
  return {
    present: bool(source.present),
    usable: source.usable === true || bool(source.autonomousAllowed),
    stale: bool(source.stale),
    status: s(source.status).toLowerCase(),
    reasonCode: s(
      source.primaryReasonCode ||
        source.primary_reason_code ||
        source.reasonCode ||
        source.reason_code
    ).toLowerCase(),
    reasons: normalizeStringList(
      source.reasonCodes ||
        source.reason_codes ||
        source.reasons
    ),
    canRepair:
      bool(source.canRepair) ||
      arr(source.repairActions || source.repair_actions).length > 0,
    repairAction: Object.keys(obj(source.repairAction || source.repair_action)).length
      ? obj(source.repairAction || source.repair_action)
      : Object.keys(nextRecommendedRepair).length
        ? nextRecommendedRepair
        : null,
    latestRepair: normalizeProjectionRepair({
      latestRun: source.latestRepair || source.latest_repair,
    }).latestRun,
    degraded: bool(source.degraded),
    blocked: bool(source.blocked),
    invalid: bool(source.invalid),
    missing: bool(source.missing),
    healthy: bool(source.healthy),
    autonomousAllowed: bool(source.autonomousAllowed || source.autonomous_allowed),
    autonomousOperation: s(
      source.autonomousOperation || source.autonomous_operation
    ).toLowerCase(),
    affectedSurfaces: normalizeStringList(
      source.affectedSurfaces || source.affected_surfaces
    ),
    repairActions: arr(source.repairActions || source.repair_actions)
      .map((item) => obj(item))
      .filter((item) => Object.keys(item).length > 0),
    nextRecommendedRepair:
      Object.keys(nextRecommendedRepair).length > 0 ? nextRecommendedRepair : null,
    lastKnownGood: {
      runtimeProjectionId: s(
        lastKnownGood.runtimeProjectionId || lastKnownGood.runtime_projection_id
      ),
      projectionHash: s(
        lastKnownGood.projectionHash || lastKnownGood.projection_hash
      ),
      lastGoodAt: s(lastKnownGood.lastGoodAt || lastKnownGood.last_good_at),
      diagnosticOnly: bool(
        lastKnownGood.diagnosticOnly || lastKnownGood.diagnostic_only
      ),
      usableAsAuthority: bool(
        lastKnownGood.usableAsAuthority || lastKnownGood.usable_as_authority
      ),
    },
    lastSuccess: {
      runId: s(lastSuccess.runId || lastSuccess.run_id),
      finishedAt: s(lastSuccess.finishedAt || lastSuccess.finished_at),
      runtimeProjectionId: s(
        lastSuccess.runtimeProjectionId || lastSuccess.runtime_projection_id
      ),
    },
    lastFailure: {
      runId: s(lastFailure.runId || lastFailure.run_id),
      finishedAt: s(lastFailure.finishedAt || lastFailure.finished_at),
      errorCode: s(lastFailure.errorCode || lastFailure.error_code),
      errorMessage: s(lastFailure.errorMessage || lastFailure.error_message),
    },
    reasonHistory: arr(source.reasonHistory || source.reason_history)
      .map((item) => ({
        kind: s(item.kind),
        reasonCode: s(item.reasonCode || item.reason_code).toLowerCase(),
        observedAt: s(item.observedAt || item.observed_at),
        details: obj(item.details),
      }))
      .filter((item) => item.reasonCode || item.observedAt),
  };
}

function normalizeAction(input = {}) {
  const source = obj(input);
  if (!Object.keys(source).length) return null;
  return {
    id: s(source.id),
    kind: s(source.kind).toLowerCase(),
    label: s(source.label),
    requiredRole: s(source.requiredRole || source.required_role).toLowerCase(),
    allowed: source.allowed === true,
    target: obj(source.target),
  };
}

function normalizePostureSummary(input = {}, fallbackLabel = "Unknown posture") {
  const source = obj(input);
  return {
    label: s(source.label),
    primary: s(source.primary).toLowerCase(),
    primaryLabel: s(source.primaryLabel || fallbackLabel),
    detail: s(source.detail),
    raw: obj(source.raw),
  };
}

function normalizeDecisionContextSnapshot(input = {}) {
  const source = obj(input);
  return {
    actor: s(source.actor),
    objectVersion: s(source.objectVersion || source.object_version),
    projectionStatus: s(
      source.projectionStatus || source.projection_status
    ).toLowerCase(),
    controlScope: s(source.controlScope || source.control_scope).toLowerCase(),
    eventCategory: s(source.eventCategory || source.event_category).toLowerCase(),
    channelSurface: s(
      source.channelSurface || source.channel_surface
    ).toLowerCase(),
    channelType: s(source.channelType || source.channel_type).toLowerCase(),
    triggerType: s(source.triggerType || source.trigger_type).toLowerCase(),
    reviewSessionId: s(source.reviewSessionId || source.review_session_id),
    repairRunId: s(source.repairRunId || source.repair_run_id),
    summary: s(source.summary),
    metadata: obj(source.metadata),
  };
}

function normalizeEventRemediation(input = {}) {
  const source = obj(input);
  return {
    blocked: bool(source.blocked),
    reviewRequired: bool(source.reviewRequired || source.review_required),
    repairRequired: bool(source.repairRequired || source.repair_required),
    handoffRequired: bool(source.handoffRequired || source.handoff_required),
    approvalRequired: bool(source.approvalRequired || source.approval_required),
    operatorOnly: bool(source.operatorOnly || source.operator_only),
    headline: s(source.headline || "No operator action is currently required."),
    review: s(source.review),
    repair: s(source.repair),
    approval: s(source.approval),
    operator: s(source.operator),
    nextActionLabel: s(source.nextActionLabel || source.next_action_label),
    requiredRole: s(source.requiredRole || source.required_role || "operator").toLowerCase(),
  };
}

function normalizeApprovalPolicy(input = {}) {
  const source = obj(input);
  const risk = obj(source.risk);
  return {
    strictestOutcome: s(
      source.strictestOutcome || source.strictest_outcome || source.outcome || "unknown"
    ).toLowerCase(),
    requiredRole: s(source.requiredRole || source.required_role || "operator").toLowerCase(),
    reasonCodes: normalizeStringList(source.reasonCodes || source.reason_codes),
    affectedSurfaces: normalizeStringList(
      source.affectedSurfaces || source.affected_surfaces
    ),
    risk: {
      level: s(risk.level || source.riskLevel || "unknown").toLowerCase(),
      operational: bool(risk.operational),
    },
  };
}

function normalizePolicyPosture(input = {}) {
  const source = obj(input);
  return {
    truthPublicationPosture: s(
      source.truthPublicationPosture || source.truth_publication_posture || "unknown"
    ).toLowerCase(),
    executionPosture: s(
      source.executionPosture || source.execution_posture || "unknown"
    ).toLowerCase(),
    reviewRequired: bool(source.reviewRequired || source.review_required),
    handoffRequired: bool(source.handoffRequired || source.handoff_required),
    blocked: bool(source.blocked),
    blockedUntilRepair: bool(
      source.blockedUntilRepair || source.blocked_until_repair
    ),
    requiredRole: s(source.requiredRole || source.required_role || "operator").toLowerCase(),
    requiredAction: s(source.requiredAction || source.required_action),
    requiredActionKind: s(
      source.requiredActionKind || source.required_action_kind || "unknown"
    ).toLowerCase(),
    nextAction: normalizeAction(source.nextAction || source.next_action),
    reasons: normalizeStringList(source.reasons),
    affectedSurfaces: normalizeStringList(
      source.affectedSurfaces || source.affected_surfaces
    ),
    explanation: s(source.explanation || "Policy telemetry is unavailable."),
  };
}

function normalizeChannelAutonomyItem(input = {}) {
  const source = obj(input);
  return {
    surface: s(source.surface || "unknown").toLowerCase(),
    channelType: s(source.channelType || source.channel_type || "unknown").toLowerCase(),
    autonomyStatus: s(source.autonomyStatus || source.autonomy_status || "unknown").toLowerCase(),
    policyOutcome: s(source.policyOutcome || source.policy_outcome || "unknown").toLowerCase(),
    explanation: s(source.explanation || "Telemetry unavailable."),
    why: normalizeStringList(source.why),
    reasonCodes: normalizeStringList(source.reasonCodes || source.reason_codes),
    reviewRequired: bool(source.reviewRequired || source.review_required),
    handoffRequired: bool(source.handoffRequired || source.handoff_required),
    repairRequired: bool(source.repairRequired || source.repair_required),
    approvalRequired: bool(source.approvalRequired || source.approval_required),
    requiredRole: s(source.requiredRole || source.required_role || "operator").toLowerCase(),
    requiredAction: s(source.requiredAction || source.required_action),
    requiredActionKind: s(
      source.requiredActionKind || source.required_action_kind || "unknown"
    ).toLowerCase(),
    nextAction: normalizeAction(source.nextAction || source.next_action),
    affectedSurfaces: normalizeStringList(
      source.affectedSurfaces || source.affected_surfaces
    ),
    telemetryAvailable: bool(
      source.telemetryAvailable || source.telemetry_available,
      true
    ),
    lowRiskOutcome: s(source.lowRiskOutcome || source.low_risk_outcome).toLowerCase(),
    mediumRiskOutcome: s(
      source.mediumRiskOutcome || source.medium_risk_outcome
    ).toLowerCase(),
    highRiskOutcome: s(source.highRiskOutcome || source.high_risk_outcome).toLowerCase(),
  };
}

function normalizeChannelAutonomy(input = {}) {
  const source = obj(input);
  return {
    items: arr(source.items).map(normalizeChannelAutonomyItem),
  };
}

function normalizePolicyControlScope(input = {}) {
  const source = obj(input);
  return {
    scopeType: s(source.scopeType || source.scope_type || "channel").toLowerCase(),
    surface: s(source.surface || "tenant").toLowerCase(),
    controlMode: s(source.controlMode || source.control_mode || "autonomy_enabled").toLowerCase(),
    policyReason: s(source.policyReason || source.policy_reason),
    operatorNote: s(source.operatorNote || source.operator_note),
    changedBy: s(source.changedBy || source.changed_by),
    changedAt: s(source.changedAt || source.changed_at),
    isOverride: bool(source.isOverride || source.is_override),
    availableModes: arr(source.availableModes || source.available_modes).map((item) => ({
      mode: s(item.mode || "autonomy_enabled").toLowerCase(),
      label: s(item.label || "Autonomy Enabled"),
      requiredRole: s(item.requiredRole || item.required_role || "operator").toLowerCase(),
      allowed: item.allowed === true,
      unavailableReason: s(item.unavailableReason || item.unavailable_reason),
    })),
  };
}

function normalizePolicyControls(input = {}) {
  const source = obj(input);
  return {
    viewerRole: s(source.viewerRole || source.viewer_role || "member").toLowerCase(),
    cannotLoosenAutonomy: bool(
      source.cannotLoosenAutonomy || source.cannot_loosen_autonomy
    ),
    tenantDefault: normalizePolicyControlScope(
      source.tenantDefault || source.tenant_default
    ),
    items: arr(source.items).map(normalizePolicyControlScope),
  };
}

function normalizeDecisionAuditEvent(input = {}) {
  const source = obj(input);
  return {
    id: s(source.id),
    eventType: s(source.eventType || source.event_type || "unknown").toLowerCase(),
    eventLabel: s(source.eventLabel || source.event_label || "Unknown event"),
    group: s(source.group || "execution").toLowerCase(),
    groupLabel: s(source.groupLabel || source.group_label || "Execution decisions"),
    eventCategory: s(source.eventCategory || source.event_category || source.group || "execution").toLowerCase(),
    timestamp: s(source.timestamp || source.createdAt || source.created_at),
    source: s(source.source),
    actor: s(source.actor),
    surface: s(source.surface || "unknown").toLowerCase(),
    channelType: s(source.channelType || source.channel_type || "unknown").toLowerCase(),
    policyOutcome: s(source.policyOutcome || source.policy_outcome || "unknown").toLowerCase(),
    policyOutcomeLabel: s(
      source.policyOutcomeLabel || source.policy_outcome_label || "Unknown"
    ),
    reasonCodes: normalizeStringList(source.reasonCodes || source.reason_codes),
    truthVersionId: s(source.truthVersionId || source.truth_version_id),
    runtimeProjectionId: s(source.runtimeProjectionId || source.runtime_projection_id),
    affectedSurfaces: normalizeStringList(
      source.affectedSurfaces || source.affected_surfaces
    ),
    healthState: obj(source.healthState || source.health_state),
    approvalPosture: obj(source.approvalPosture || source.approval_posture),
    approvalPostureSummary: normalizePostureSummary(
      source.approvalPostureSummary || source.approval_posture_summary,
      "Unknown approval posture"
    ),
    executionPosture: obj(source.executionPosture || source.execution_posture),
    executionPostureSummary: normalizePostureSummary(
      source.executionPostureSummary || source.execution_posture_summary,
      "Unknown execution posture"
    ),
    runtimeHealthPosture: normalizePostureSummary(
      source.runtimeHealthPosture || source.runtime_health_posture,
      "Unknown runtime health"
    ),
    controlState: obj(source.controlState || source.control_state),
    decisionContext: obj(source.decisionContext || source.decision_context),
    decisionContextSnapshot: normalizeDecisionContextSnapshot(
      source.decisionContextSnapshot || source.decision_context_snapshot
    ),
    remediation: normalizeEventRemediation(source.remediation),
    links: {
      truthVersionId: s(
        obj(source.links).truthVersionId || obj(source.links).truth_version_id
      ),
      runtimeProjectionId: s(
        obj(source.links).runtimeProjectionId ||
          obj(source.links).runtime_projection_id
      ),
      surface: s(obj(source.links).surface || source.surface || "unknown").toLowerCase(),
      channelType: s(
        obj(source.links).channelType || obj(source.links).channel_type || source.channelType || "unknown"
      ).toLowerCase(),
      controlScope: s(
        obj(source.links).controlScope || obj(source.links).control_scope
      ).toLowerCase(),
      eventCategory: s(
        obj(source.links).eventCategory || obj(source.links).event_category || source.group || "execution"
      ).toLowerCase(),
    },
    recommendedNextAction: normalizeAction(
      source.recommendedNextAction || source.recommended_next_action
    ),
  };
}

function normalizeDecisionAudit(input = {}) {
  const source = obj(input);
  return {
    items: arr(source.items).map(normalizeDecisionAuditEvent),
    availableFilters: arr(source.availableFilters || source.available_filters).map(
      (item) => ({
        key: s(item.key || "all").toLowerCase(),
        label: s(item.label || "All events"),
        count: n(item.count),
      })
    ),
    latestImportant: arr(source.latestImportant || source.latest_important).map(
      normalizeDecisionAuditEvent
    ),
    recentAutonomyChanges: arr(
      source.recentAutonomyChanges || source.recent_autonomy_changes
    ).map(normalizeDecisionAuditEvent),
    recentRestrictedOutcomes: arr(
      source.recentRestrictedOutcomes || source.recent_restricted_outcomes
    ).map(normalizeDecisionAuditEvent),
    recentRuntimeTransitions: arr(
      source.recentRuntimeTransitions || source.recent_runtime_transitions
    ).map(normalizeDecisionAuditEvent),
  };
}

export function normalizeTrustViewResponse(payload = {}) {
  const root = obj(payload);
  const summary = obj(root.summary);
  const runtimeProjection = obj(summary.runtimeProjection);
  const truth = obj(summary.truth);
  const setupReview = obj(summary.setupReview);
  const sources = obj(summary.sources);
  const reviewQueue = obj(summary.reviewQueue);

  return {
    tenantId: s(root.tenantId || root.tenant_id),
    tenantKey: s(root.tenantKey || root.tenant_key).toLowerCase(),
    viewerRole: s(root.viewerRole || root.viewer_role || "member").toLowerCase(),
    permissions: obj(root.permissions),
    status: root ? "ready" : "unavailable",
    summary: {
      readiness: createReadinessViewModel(summary.readiness),
      sources: {
        total: n(sources.total),
        enabled: n(sources.enabled),
        connected: n(sources.connected),
        running: n(sources.running),
        failed: n(sources.failed),
        reviewRequired: n(sources.reviewRequired || sources.review_required),
        lastRunAt: s(sources.lastRunAt || sources.last_run_at),
        lastRunStatus: s(sources.lastRunStatus || sources.last_run_status).toLowerCase(),
        lastSuccessAt: s(sources.lastSuccessAt || sources.last_success_at),
        lastFailureAt: s(sources.lastFailureAt || sources.last_failure_at),
      },
      runtimeProjection: {
        id: s(runtimeProjection.id),
        status: s(runtimeProjection.status).toLowerCase(),
        projectionHash: s(runtimeProjection.projectionHash || runtimeProjection.projection_hash),
        updatedAt: s(runtimeProjection.updatedAt || runtimeProjection.updated_at),
        stale: runtimeProjection.stale === true,
        reasons: arr(runtimeProjection.reasons).map((item) => s(item)).filter(Boolean),
        health: normalizeProjectionHealth(runtimeProjection.health),
        repair: normalizeProjectionRepair(runtimeProjection.repair),
        readiness: createReadinessViewModel(runtimeProjection.readiness),
      },
      truth: {
        latestVersionId: s(truth.latestVersionId || truth.latest_version_id),
        approvedAt: s(truth.approvedAt || truth.approved_at),
        approvedBy: s(truth.approvedBy || truth.approved_by),
        reviewSessionId: s(truth.reviewSessionId || truth.review_session_id),
        sourceSummary: obj(truth.sourceSummary || truth.source_summary),
        metadata: obj(truth.metadata),
        approvalPolicy: normalizeApprovalPolicy(
          truth.approvalPolicy || truth.approval_policy
        ),
        governance: normalizeGovernanceSummary(
          truth.governance ||
            obj(truth.sourceSummary || truth.source_summary).governance ||
            obj(truth.metadata).governance
        ),
        finalizeImpact: normalizeImpactSummary(
          truth.finalizeImpact ||
            obj(truth.sourceSummary || truth.source_summary).finalizeImpact ||
            obj(truth.metadata).finalizeImpact
        ),
        readiness: createReadinessViewModel(truth.readiness),
      },
      setupReview: {
        active: setupReview.active === true,
        sessionId: s(setupReview.sessionId || setupReview.session_id),
        status: s(setupReview.status).toLowerCase(),
        currentStep: s(setupReview.currentStep || setupReview.current_step),
        updatedAt: s(setupReview.updatedAt || setupReview.updated_at),
        readiness: createReadinessViewModel(setupReview.readiness),
      },
      reviewQueue: {
        pending: n(reviewQueue.pending),
        conflicts: n(reviewQueue.conflicts),
        latestCandidateAt: s(reviewQueue.latestCandidateAt || reviewQueue.latest_candidate_at),
      },
      policyPosture: normalizePolicyPosture(summary.policyPosture || summary.policy_posture),
      channelAutonomy: normalizeChannelAutonomy(
        summary.channelAutonomy || summary.channel_autonomy
      ),
      policyControls: normalizePolicyControls(
        summary.policyControls || summary.policy_controls
      ),
      decisionAudit: normalizeDecisionAudit(
        summary.decisionAudit || summary.decision_audit
      ),
    },
    recentRuns: normalizeRecentRuns(root.recentRuns || root.recent_runs),
    audit: normalizeAudit(root.audit),
  };
}

export const __test__ = {
  normalizeTrustViewResponse,
};

export async function getSettingsTrustView(params = {}) {
  const suffix = buildQuery({
    tenantId: params.tenantId,
    tenantKey: params.tenantKey,
    limit: params.limit,
  });

  const payload = await apiGet(`/api/settings/trust${suffix}`);
  if (!payload?.ok) {
    throw new Error(payload?.error || "Failed to load settings trust summary");
  }
  return normalizeTrustViewResponse(payload);
}

export async function saveSettingsTrustPolicyControl(payload = {}) {
  const response = await apiPost("/api/settings/trust/policy-controls", payload);
  if (!response?.ok) {
    throw new Error(response?.error || "Failed to save policy control");
  }
  return response;
}
