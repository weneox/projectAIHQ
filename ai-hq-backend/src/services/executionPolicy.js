function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function bool(v, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}

function uniq(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

export const EXECUTION_POLICY_OUTCOMES = [
  "allowed",
  "allowed_with_logging",
  "allowed_with_human_review",
  "handoff_required",
  "operator_only",
  "blocked",
  "blocked_until_repair",
];

export const POLICY_CONTROL_MODES = [
  "autonomy_enabled",
  "handoff_preferred",
  "human_review_required",
  "operator_only_mode",
  "handoff_required",
  "blocked_until_repair",
  "emergency_stop",
];

const OUTCOME_RANK = {
  allowed: 0,
  allowed_with_logging: 1,
  allowed_with_human_review: 2,
  handoff_required: 3,
  operator_only: 4,
  blocked: 5,
  blocked_until_repair: 6,
};

function getActionType(action = {}) {
  return lower(action?.type || action?.actionType);
}

function getActionIntent(action = {}) {
  return lower(
    action?.intent ||
      action?.intentKey ||
      action?.meta?.intent ||
      action?.meta?.intentKey
  );
}

function getActionRiskHint(action = {}) {
  return lower(
    action?.riskLevel ||
      action?.risk_level ||
      action?.meta?.riskLevel ||
      action?.meta?.risk_level ||
      action?.meta?.intentRisk ||
      action?.meta?.intent_risk
  );
}

function normalizeApprovalPolicy(input = {}) {
  const value = obj(input);
  const signals = obj(value.signals);
  const risk = obj(value.risk);

  return {
    strictestOutcome: s(
      value.strictestOutcome || value.strictest_outcome || value.outcome
    ),
    requiredRole: s(value.requiredRole || value.required_role),
    reasonCodes: uniq(value.reasonCodes || value.reason_codes),
    affectedSurfaces: uniq(
      value.affectedSurfaces ||
        value.affected_surfaces ||
        signals.affectedSurfaces ||
        signals.affected_surfaces
    ).map((item) => lower(item)),
    risk: {
      level: lower(risk.level || value.riskLevel),
      operational: bool(risk.operational, false),
    },
  };
}

function normalizePolicyControl(input = {}) {
  const value = obj(input);
  const metadata = obj(value.metadata);
  return {
    scopeType: lower(value.scopeType || value.scope_type || "tenant_default"),
    surface: lower(value.surface || value.surface_key || "tenant"),
    autonomyEnabled:
      typeof value.autonomyEnabled === "boolean"
        ? value.autonomyEnabled
        : typeof value.autonomy_enabled === "boolean"
        ? value.autonomy_enabled
        : true,
    operatorOnlyMode: bool(
      value.operatorOnlyMode ?? value.operator_only_mode,
      false
    ),
    humanReviewRequired: bool(
      value.humanReviewRequired ?? value.human_review_required,
      false
    ),
    handoffPreferred: bool(
      value.handoffPreferred ?? value.handoff_preferred,
      false
    ),
    handoffRequired: bool(
      value.handoffRequired ?? value.handoff_required,
      false
    ),
    blockedUntilRepair: bool(
      value.blockedUntilRepair ?? value.blocked_until_repair,
      false
    ),
    emergencyStop: bool(value.emergencyStop ?? value.emergency_stop, false),
    policyReason: s(value.policyReason || value.policy_reason),
    operatorNote: s(value.operatorNote || value.operator_note),
    changedBy: s(value.changedBy || value.changed_by),
    changedAt: s(value.changedAt || value.changed_at),
    metadata,
  };
}

function derivePolicyControlMode(control = {}) {
  const value = normalizePolicyControl(control);
  if (value.emergencyStop) return "emergency_stop";
  if (value.blockedUntilRepair) return "blocked_until_repair";
  if (value.handoffRequired) return "handoff_required";
  if (value.operatorOnlyMode || value.autonomyEnabled === false) {
    return "operator_only_mode";
  }
  if (value.humanReviewRequired) return "human_review_required";
  if (value.handoffPreferred) return "handoff_preferred";
  return "autonomy_enabled";
}

function normalizePolicyControls(input = {}) {
  const value = obj(input);
  const items = arr(value.items).map(normalizePolicyControl);
  const tenantDefault =
    normalizePolicyControl(value.tenantDefault || value.tenant_default);

  return {
    tenantDefault,
    items,
  };
}

function extractPolicyControls(runtime = {}) {
  const value = obj(runtime);
  const tenant = obj(value.tenant);
  const raw = obj(value.raw);
  const projection = obj(raw.projection);
  return normalizePolicyControls(
    value.policyControls ||
      value.policy_controls ||
      tenant.policy_controls ||
      projection.policy_controls_json
  );
}

function extractApprovalPolicy(runtime = {}) {
  const value = obj(runtime);
  const raw = obj(value.raw);
  const projection = obj(raw.projection);
  const metadata = obj(projection.metadata_json);

  return normalizeApprovalPolicy(
    value.approvalPolicy ||
      value.approval_policy ||
      metadata.approvalPolicy ||
      metadata.approval_policy
  );
}

function extractProjectionHealth(runtime = {}) {
  const value = obj(runtime);
  const authority = obj(value.authority);
  const raw = obj(value.raw);
  const projection = obj(raw.projection);

  return obj(
    value.projectionHealth ||
      value.projection_health ||
      authority.health ||
      raw.projectionHealth ||
      projection.health ||
      projection.health_json
  );
}

function extractTenantPolicies(runtime = {}, surface = "") {
  const value = obj(runtime);
  const tenant = obj(value.tenant);
  const aiPolicy = obj(value.aiPolicy || value.ai_policy || tenant.ai_policy);
  const inboxPolicy = obj(
    value.inboxPolicy || value.inbox_policy || tenant.inbox_policy
  );
  const commentPolicy = obj(
    value.commentPolicy || value.comment_policy || tenant.comment_policy
  );
  const raw = obj(value.raw);
  const projection = obj(raw.projection);
  const capabilities = obj(projection.capabilities_json);
  const voice = obj(obj(value.channels).voice);

  const selectedPolicy =
    lower(surface) === "comments"
      ? commentPolicy
      : lower(surface) === "inbox"
      ? inboxPolicy
      : {};

  return {
    aiPolicy,
    selectedPolicy,
    capabilities,
    voice,
    riskRules: obj(aiPolicy.risk_rules || aiPolicy.riskRules),
    policyControls: extractPolicyControls(runtime),
  };
}

function pickChannelEnabled({ surface = "", policies = {} } = {}) {
  const selectedPolicy = obj(policies.selectedPolicy);
  const voice = obj(policies.voice);

  if (lower(surface) === "voice") {
    return typeof voice.enabled === "boolean" ? voice.enabled : true;
  }

  if (typeof selectedPolicy.enabled === "boolean") {
    return selectedPolicy.enabled;
  }

  return true;
}

function classifyIntentRisk(intent = "") {
  const safeIntent = lower(intent);

  if (
    [
      "ack",
      "greeting",
      "general",
      "knowledge_answer",
      "faq",
      "informational",
    ].includes(safeIntent)
  ) {
    return "low";
  }

  if (
    [
      "pricing",
      "service_interest",
      "support",
      "booking",
      "scheduling",
      "schedule_callback",
      "callback_offer",
      "lead_capture",
      "unsupported_service",
    ].includes(safeIntent)
  ) {
    return "medium";
  }

  if (
    [
      "handoff_request",
      "urgent_interest",
      "escalation",
      "transfer_decision",
      "policy_claim",
      "operational_commitment",
      "autonomy_change",
    ].includes(safeIntent)
  ) {
    return "high";
  }

  return "";
}

export function classifyExecutionActionRisk(action = {}) {
  const actionType = getActionType(action);
  const intent = getActionIntent(action);
  const explicitRisk = getActionRiskHint(action);

  let level = explicitRisk || classifyIntentRisk(intent) || "medium";
  let label = "customer_facing_action";
  const reasonCodes = [];

  if (["typing_on", "typing_off", "mark_seen", "no_reply"].includes(actionType)) {
    level = "low";
    label = "control_action";
    reasonCodes.push("control_plane_action");
  } else if (actionType === "send_message") {
    label = "reply";
    reasonCodes.push(`intent_${intent || "general"}`);
  } else if (actionType === "create_lead") {
    level = explicitRisk || "medium";
    label = "lead_capture";
    reasonCodes.push("lead_capture_action");
  } else if (actionType === "handoff") {
    level = "high";
    label = "handoff";
    reasonCodes.push("handoff_action");
  } else if (actionType === "reply_comment") {
    level = explicitRisk || classifyIntentRisk(intent) || "medium";
    label = "comment_reply";
    reasonCodes.push("comment_execution");
  } else {
    reasonCodes.push("unclassified_action");
  }

  if (level === "high") {
    reasonCodes.push("high_risk_action");
  } else if (level === "medium") {
    reasonCodes.push("medium_risk_action");
  } else {
    reasonCodes.push("low_risk_action");
  }

  return {
    actionType,
    intent,
    level,
    label,
    reasonCodes: uniq(reasonCodes),
  };
}

function outcomeFromHealthStatus({
  healthStatus = "",
  riskLevel = "medium",
  handoffEnabled = true,
} = {}) {
  if (["missing", "stale", "blocked", "invalid"].includes(healthStatus)) {
    return "blocked_until_repair";
  }

  if (healthStatus === "degraded") {
    if (riskLevel === "low") return "allowed_with_logging";
    if (riskLevel === "medium") return "allowed_with_human_review";
    return handoffEnabled ? "handoff_required" : "operator_only";
  }

  return "";
}

function outcomeFromTruthPosture({
  approvalOutcome = "",
  truthRiskLevel = "",
  riskLevel = "medium",
  handoffEnabled = true,
} = {}) {
  if (["blocked", "quarantined"].includes(approvalOutcome)) {
    return "blocked";
  }

  const strict =
    ["review_required", "admin_approval_required", "owner_approval_required", "dual_approval_required"].includes(
      approvalOutcome
    ) || truthRiskLevel === "high";

  if (!strict) return "";
  if (riskLevel === "low") return "allowed_with_logging";
  if (riskLevel === "medium") return "allowed_with_human_review";
  return handoffEnabled ? "handoff_required" : "operator_only";
}

function outcomeFromAutonomyControls({
  actionType = "",
  surface = "",
  policies = {},
  handoffActive = false,
} = {}) {
  const aiPolicy = obj(policies.aiPolicy);
  const selectedPolicy = obj(policies.selectedPolicy);
  const capabilities = obj(policies.capabilities);

  if (pickChannelEnabled({ surface, policies }) === false) {
    return "operator_only";
  }

  if (
    handoffActive &&
    actionType === "send_message" &&
    bool(
      selectedPolicy.suppress_ai_during_handoff ??
        aiPolicy.suppress_ai_during_handoff,
      true
    )
  ) {
    return "handoff_required";
  }

  if (
    actionType === "send_message" &&
    typeof aiPolicy.auto_reply_enabled === "boolean" &&
    aiPolicy.auto_reply_enabled === false
  ) {
    return "operator_only";
  }

  if (
    actionType === "create_lead" &&
    typeof aiPolicy.create_lead_enabled === "boolean" &&
    aiPolicy.create_lead_enabled === false
  ) {
    return "operator_only";
  }

  if (
    actionType === "handoff" &&
    typeof capabilities.handoff_enabled === "boolean" &&
    capabilities.handoff_enabled === false
  ) {
    return "operator_only";
  }

  return "";
}

function getStrictestOutcomeFromList(outcomes = []) {
  const safe = arr(outcomes).filter(Boolean);
  if (!safe.length) return "";
  return safe.sort((a, b) => (OUTCOME_RANK[b] ?? 0) - (OUTCOME_RANK[a] ?? 0))[0];
}

function getEffectivePolicyControl({
  controls = {},
  surface = "",
} = {}) {
  const normalized = normalizePolicyControls(controls);
  const tenantDefault = normalizePolicyControl(normalized.tenantDefault);
  const scopedRaw =
    normalized.items.find((item) => lower(item.surface) === lower(surface)) || null;
  const scoped = scopedRaw ? normalizePolicyControl(scopedRaw) : null;
  const merged = {
    ...tenantDefault,
    ...(scoped || {}),
    surface: lower(surface || scoped?.surface || "tenant"),
  };
  return {
    ...merged,
    controlMode: derivePolicyControlMode(merged),
  };
}

function outcomeFromPolicyControls({
  control = {},
  riskLevel = "medium",
} = {}) {
  const mode = derivePolicyControlMode(control);
  if (mode === "emergency_stop") return "operator_only";
  if (mode === "blocked_until_repair") return "blocked_until_repair";
  if (mode === "handoff_required") return "handoff_required";
  if (mode === "operator_only_mode") return "operator_only";
  if (mode === "human_review_required") return "allowed_with_human_review";
  if (mode === "handoff_preferred") {
    if (riskLevel === "high") return "handoff_required";
    return "allowed_with_human_review";
  }
  return "";
}

function buildDecision({
  outcome = "allowed",
  risk = {},
  authority = {},
  health = {},
  approvalPolicy = {},
  policyControl = {},
  surface = "",
  channelType = "",
  actorType = "system",
  reasonCodes = [],
} = {}) {
  const safeOutcome = EXECUTION_POLICY_OUTCOMES.includes(outcome)
    ? outcome
    : "blocked";
  const operatorActor = ["operator", "human", "admin", "owner"].includes(
    lower(actorType)
  );
  const autonomousAllowed = ["allowed", "allowed_with_logging"].includes(
    safeOutcome
  );
  const operatorPermitted =
    operatorActor ||
    !["blocked", "blocked_until_repair"].includes(safeOutcome);

  return {
    outcome: safeOutcome,
    requiredExecutionLevel: safeOutcome,
    allowed: autonomousAllowed || operatorPermitted,
    autonomousAllowed,
    operatorPermitted,
    loggingRequired: ["allowed_with_logging", "allowed_with_human_review"].includes(
      safeOutcome
    ),
    humanReviewRequired: safeOutcome === "allowed_with_human_review",
    handoffRequired: safeOutcome === "handoff_required",
    operatorOnly: safeOutcome === "operator_only",
    blocked: safeOutcome === "blocked",
    blockedUntilRepair: safeOutcome === "blocked_until_repair",
    reasonCodes: uniq(reasonCodes),
    risk: {
      actionType: s(risk.actionType),
      intent: s(risk.intent),
      level: s(risk.level),
      label: s(risk.label),
      reasonCodes: uniq(risk.reasonCodes),
    },
    signals: {
      surface: s(surface),
      channelType: s(channelType),
      actorType: s(actorType || "system"),
      runtimeAuthorityAvailable: authority.available === true,
      runtimeAuthorityMode: s(authority.mode),
      runtimeProjectionId: s(authority.runtimeProjectionId),
      projectionHealthStatus: s(health.status),
      projectionHealthReasonCode: s(
        health.primaryReasonCode || health.reasonCode
      ),
      truthApprovalOutcome: s(
        approvalPolicy.strictestOutcome || approvalPolicy.outcome
      ),
      truthRiskLevel: s(approvalPolicy.risk?.level),
      affectedSurfaces: arr(approvalPolicy.affectedSurfaces),
      policyControlMode: s(policyControl.controlMode),
      policyControlChangedBy: s(policyControl.changedBy),
      policyControlChangedAt: s(policyControl.changedAt),
    },
    policyControl: {
      controlMode: s(policyControl.controlMode),
      policyReason: s(policyControl.policyReason),
      operatorNote: s(policyControl.operatorNote),
      changedBy: s(policyControl.changedBy),
      changedAt: s(policyControl.changedAt),
    },
  };
}

export function evaluateExecutionPolicy({
  runtime = {},
  action = {},
  surface = "",
  channelType = "",
  actorType = "system",
  currentState = {},
} = {}) {
  const authority = obj(obj(runtime).authority);
  const health = extractProjectionHealth(runtime);
  const approvalPolicy = extractApprovalPolicy(runtime);
  const policies = extractTenantPolicies(runtime, surface);
  const risk = classifyExecutionActionRisk(action);
  const actionType = risk.actionType;
  const healthStatus = lower(health.status);
  const approvalOutcome = lower(approvalPolicy.strictestOutcome);
  const truthRiskLevel = lower(approvalPolicy.risk?.level);
  const handoffEnabled =
    typeof policies.capabilities.handoff_enabled === "boolean"
      ? policies.capabilities.handoff_enabled
      : true;
  const handoffActive = bool(
    currentState.handoffActive ??
      currentState.handoff_active ??
      action?.meta?.handoffActive,
    false
  );
  const effectivePolicyControl = getEffectivePolicyControl({
    controls: policies.policyControls,
    surface,
  });

  if (actionType === "no_reply") {
    return buildDecision({
      outcome: "allowed_with_logging",
      risk,
      authority,
      health,
      approvalPolicy,
      policyControl: effectivePolicyControl,
      surface,
      channelType,
      actorType,
      reasonCodes: ["no_reply_control_action"],
    });
  }

  if (actionType === "handoff" && handoffEnabled) {
    return buildDecision({
      outcome: "allowed_with_logging",
      risk,
      authority,
      health,
      approvalPolicy,
      policyControl: effectivePolicyControl,
      surface,
      channelType,
      actorType,
      reasonCodes: ["handoff_path_allowed"],
    });
  }

  const authorityUnavailable =
    authority.mode !== "strict" ||
    authority.required !== true ||
    authority.available !== true ||
    lower(authority.source) !== "approved_runtime_projection" ||
    authority.stale === true ||
    !s(authority.runtimeProjectionId);

  if (authorityUnavailable) {
    return buildDecision({
      outcome: "blocked_until_repair",
      risk,
      authority,
      health,
      approvalPolicy,
      policyControl: effectivePolicyControl,
      surface,
      channelType,
      actorType,
      reasonCodes: ["runtime_authority_unavailable"],
    });
  }

  const autonomyOutcome = outcomeFromAutonomyControls({
    actionType,
    surface,
    policies,
    handoffActive,
  });
  const policyControlOutcome = outcomeFromPolicyControls({
    control: effectivePolicyControl,
    riskLevel: risk.level,
  });

  const healthOutcome = outcomeFromHealthStatus({
    healthStatus,
    riskLevel: risk.level,
    handoffEnabled,
  });
  const truthOutcome = outcomeFromTruthPosture({
    approvalOutcome,
    truthRiskLevel,
    riskLevel: risk.level,
    handoffEnabled,
  });
  const riskOutcome =
    risk.level === "medium"
      ? "allowed_with_logging"
      : risk.level === "high"
      ? handoffEnabled
        ? "handoff_required"
        : "operator_only"
      : "allowed";
  const finalOutcome = getStrictestOutcomeFromList([
    autonomyOutcome,
    policyControlOutcome,
    healthOutcome,
    truthOutcome,
    riskOutcome,
  ]) || "allowed";
  const reasonCodes = [
    autonomyOutcome ? "tenant_autonomy_controls" : "",
    policyControlOutcome ? "policy_control_override" : "",
    healthOutcome ? "runtime_health_restriction" : "",
    healthOutcome ? s(health.primaryReasonCode) : "",
    truthOutcome ? "truth_governance_restriction" : "",
    truthOutcome ? approvalOutcome || "truth_review_required" : "",
    !autonomyOutcome && !policyControlOutcome && !healthOutcome && !truthOutcome && risk.level === "medium"
      ? "medium_risk_logged"
      : "",
    !autonomyOutcome && !policyControlOutcome && !healthOutcome && !truthOutcome && risk.level === "high"
      ? "high_risk_autonomy_restricted"
      : "",
    !autonomyOutcome &&
    !policyControlOutcome &&
    !healthOutcome &&
    !truthOutcome &&
    risk.level === "low"
      ? "healthy_low_risk_action"
      : "",
    effectivePolicyControl.controlMode &&
    effectivePolicyControl.controlMode !== "autonomy_enabled"
      ? effectivePolicyControl.controlMode
      : "",
  ];

  return buildDecision({
    outcome: finalOutcome,
    risk,
    authority,
    health,
    approvalPolicy,
    policyControl: effectivePolicyControl,
    surface,
    channelType,
    actorType,
    reasonCodes,
  });
}

function attachDecision(action = {}, decision = {}) {
  return {
    ...action,
    meta: {
      ...obj(action.meta),
      executionPolicy: decision,
    },
  };
}

function shouldAllowAutonomousAction(decision = {}) {
  return decision?.autonomousAllowed === true;
}

function getStrictestOutcome(decisions = []) {
  return arr(decisions)
    .map((item) => s(item?.outcome))
    .sort((a, b) => (OUTCOME_RANK[b] ?? 0) - (OUTCOME_RANK[a] ?? 0))[0] || "allowed";
}

export function applyExecutionPolicyToActions({
  runtime = {},
  actions = [],
  surface = "",
  channelType = "",
  actorType = "system",
  currentState = {},
} = {}) {
  const evaluated = arr(actions).map((action) => {
    const decision = evaluateExecutionPolicy({
      runtime,
      action,
      surface,
      channelType,
      actorType,
      currentState,
    });

    return {
      action: attachDecision(action, decision),
      decision,
      allowed: shouldAllowAutonomousAction(decision),
    };
  });

  const allowedActions = evaluated
    .filter((item) => item.allowed)
    .map((item) => item.action);
  const filteredActions = evaluated
    .filter((item) => !item.allowed)
    .map((item) => item.action);
  const decisions = evaluated.map((item) => item.decision);
  const strictestOutcome = getStrictestOutcome(decisions);

  return {
    actions: allowedActions,
    filteredActions,
    decisions,
    summary: {
      surface: s(surface),
      channelType: s(channelType),
      strictestOutcome,
      requiredExecutionLevel: strictestOutcome,
      allowedActionCount: allowedActions.length,
      filteredActionCount: filteredActions.length,
      humanReviewRequired: decisions.some((item) => item.humanReviewRequired),
      handoffRequired: decisions.some((item) => item.handoffRequired),
      operatorOnly: decisions.some((item) => item.operatorOnly),
      blocked: decisions.some((item) => item.blocked),
      blockedUntilRepair: decisions.some((item) => item.blockedUntilRepair),
      reasonCodes: uniq(decisions.flatMap((item) => item.reasonCodes)),
      outcomes: uniq(decisions.map((item) => item.outcome)),
      policyControlModes: uniq(
        decisions.map((item) => item.policyControl?.controlMode).filter(Boolean)
      ),
    },
  };
}

export function buildExecutionPolicySurfaceSummary({
  runtime = {},
  surface = "",
  channelType = "",
  currentState = {},
} = {}) {
  const lowRisk = evaluateExecutionPolicy({
    runtime,
    action: {
      type: "send_message",
      meta: { intent: "knowledge_answer" },
    },
    surface,
    channelType,
    currentState,
  });
  const mediumRisk = evaluateExecutionPolicy({
    runtime,
    action: {
      type: "send_message",
      meta: { intent: "service_interest" },
    },
    surface,
    channelType,
    currentState,
  });
  const highRisk = evaluateExecutionPolicy({
    runtime,
    action: {
      type: "send_message",
      meta: { intent: "policy_claim" },
    },
    surface,
    channelType,
    currentState,
  });

  return {
    surface: s(surface),
    channelType: s(channelType),
    lowRiskOutcome: lowRisk.outcome,
    mediumRiskOutcome: mediumRisk.outcome,
    highRiskOutcome: highRisk.outcome,
    blocked: [lowRisk, mediumRisk, highRisk].some((item) => item.blocked),
    blockedUntilRepair: [lowRisk, mediumRisk, highRisk].some(
      (item) => item.blockedUntilRepair
    ),
    humanReviewRequired: [lowRisk, mediumRisk, highRisk].some(
      (item) => item.humanReviewRequired
    ),
    handoffRequired: [lowRisk, mediumRisk, highRisk].some(
      (item) => item.handoffRequired
    ),
    reasonCodes: uniq([
      ...lowRisk.reasonCodes,
      ...mediumRisk.reasonCodes,
      ...highRisk.reasonCodes,
    ]),
    signals: {
      authorityAvailable: lowRisk.signals.runtimeAuthorityAvailable,
      projectionHealthStatus: lowRisk.signals.projectionHealthStatus,
      truthApprovalOutcome: lowRisk.signals.truthApprovalOutcome,
      truthRiskLevel: lowRisk.signals.truthRiskLevel,
      policyControlMode: lowRisk.signals.policyControlMode,
    },
    policyControl: lowRisk.policyControl,
  };
}

export function mapExecutionOutcomeToDecisionEventType(outcome = "") {
  const value = lower(outcome);
  if (value === "blocked" || value === "blocked_until_repair") {
    return "blocked_action_outcome";
  }
  if (value === "handoff_required") return "handoff_required_action_outcome";
  if (value === "allowed_with_human_review") {
    return "review_required_action_outcome";
  }
  return "execution_policy_decision";
}

export function buildExecutionPolicyDecisionAuditShape({
  tenantId = "",
  tenantKey = "",
  source = "",
  actor = "system",
  surface = "",
  channelType = "",
  runtime = {},
  decision = {},
  summary = {},
  action = {},
  actions = [],
  currentState = {},
} = {}) {
  const resolvedDecision = Object.keys(obj(decision)).length ? obj(decision) : obj(summary);
  const reasonCodes = uniq(
    resolvedDecision.reasonCodes || resolvedDecision.reason_codes
  ).map((item) => lower(item));
  const policyOutcome = lower(
    resolvedDecision.outcome || resolvedDecision.strictestOutcome
  );
  const signals = obj(resolvedDecision.signals);
  const risk = obj(resolvedDecision.risk);
  const policyControl = obj(resolvedDecision.policyControl || summary.policyControl);
  const authority = obj(obj(runtime).authority);
  const health = extractProjectionHealth(runtime);
  const approvalPolicy = extractApprovalPolicy(runtime);

  return {
    tenantId: s(tenantId),
    tenantKey: lower(tenantKey),
    eventType: mapExecutionOutcomeToDecisionEventType(policyOutcome),
    actor: s(actor || "system"),
    source: s(source),
    surface: lower(surface),
    channelType: lower(channelType),
    policyOutcome,
    reasonCodes,
    healthState: {
      status: lower(
        signals.projectionHealthStatus ||
          resolvedDecision.projectionHealthStatus ||
          health.status ||
          ""
      ),
      primaryReasonCode: lower(
        signals.projectionHealthReasonCode || health.primaryReasonCode || health.reasonCode
      ),
      runtimeAuthorityAvailable:
        signals.runtimeAuthorityAvailable === true || authority.available === true,
    },
    approvalPosture: {
      outcome: lower(
        signals.truthApprovalOutcome || approvalPolicy.strictestOutcome
      ),
      riskLevel: lower(signals.truthRiskLevel || approvalPolicy.risk?.level),
      affectedSurfaces: arr(
        signals.affectedSurfaces || approvalPolicy.affectedSurfaces
      ),
    },
    executionPosture: {
      outcome: policyOutcome,
      requiredExecutionLevel: s(
        resolvedDecision.requiredExecutionLevel ||
          resolvedDecision.required_execution_level ||
          policyOutcome
      ),
      humanReviewRequired: resolvedDecision.humanReviewRequired === true,
      handoffRequired: resolvedDecision.handoffRequired === true,
      blockedUntilRepair: resolvedDecision.blockedUntilRepair === true,
      operatorOnly: resolvedDecision.operatorOnly === true,
    },
    controlState: {
      mode: lower(policyControl.controlMode),
      changedBy: s(policyControl.changedBy),
      changedAt: s(policyControl.changedAt),
      policyReason: s(policyControl.policyReason),
    },
    runtimeProjectionId: s(
      signals.runtimeProjectionId ||
        resolvedDecision.runtimeProjectionId ||
        authority.runtimeProjectionId
    ),
    affectedSurfaces: uniq(
      signals.affectedSurfaces ||
        resolvedDecision.affectedSurfaces ||
        summary.affectedSurfaces
    ).map((item) => lower(item)),
    decisionContext: {
      actionType: s(risk.actionType || action?.type),
      actionIntent: s(risk.intent || action?.intent || obj(action?.meta).intent),
      actionRisk: lower(risk.level),
      proposedActionTypes: uniq(arr(actions).map((item) => s(item?.type))),
      currentState: {
        handoffActive: bool(
          currentState.handoffActive ?? currentState.handoff_active,
          false
        ),
      },
    },
  };
}

export const __test__ = {
  buildExecutionPolicyDecisionAuditShape,
  derivePolicyControlMode,
  extractApprovalPolicy,
  extractPolicyControls,
  extractProjectionHealth,
  getEffectivePolicyControl,
  mapExecutionOutcomeToDecisionEventType,
  getStrictestOutcome,
  outcomeFromAutonomyControls,
  outcomeFromHealthStatus,
  outcomeFromPolicyControls,
  outcomeFromTruthPosture,
};
