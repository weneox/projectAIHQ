import { dbGetTenantMode } from "../../../../db/helpers/tenants.js";
import { applyExecutionPolicyToActions } from "../../../../services/executionPolicy.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function uniq(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

function normalizeTenantMode(value = "", fallback = "manual") {
  const mode = lower(value || fallback);
  return mode === "auto" ? "auto" : "manual";
}

function getActionType(action = {}) {
  return lower(action?.type || action?.actionType);
}

function summarizeRuntimeAuthority(runtime = {}) {
  const authority = obj(runtime?.authority);
  const health = obj(
    authority.health || runtime?.projectionHealth || runtime?.projection_health
  );

  return {
    mode: s(authority.mode),
    required: typeof authority.required === "boolean" ? authority.required : null,
    available: typeof authority.available === "boolean" ? authority.available : null,
    source: s(authority.source),
    runtimeProjectionId: s(
      authority.runtimeProjectionId || authority.runtime_projection_id
    ),
    runtimeProjectionStatus: s(
      authority.runtimeProjectionStatus || authority.runtime_projection_status
    ),
    projectionHash: s(authority.projectionHash || authority.projection_hash),
    stale: typeof authority.stale === "boolean" ? authority.stale : null,
    reasonCode: s(authority.reasonCode || authority.reason_code),
    healthStatus: s(health.status),
    healthPrimaryReasonCode: s(
      health.primaryReasonCode ||
        health.primary_reason_code ||
        health.reasonCode ||
        health.reason_code
    ),
  };
}

function resolveRuntimeProjectionId(runtime = {}) {
  const authority = obj(runtime?.authority);
  const raw = obj(runtime?.raw);
  const projection = obj(
    raw.projection || raw.runtimeProjection || raw.currentProjection
  );

  return s(
    authority.runtimeProjectionId ||
      authority.runtime_projection_id ||
      projection.id ||
      runtime.runtimeProjectionId ||
      runtime.runtime_projection_id
  );
}

function resolveAutonomousLaunchGate(row = {}) {
  const policy = obj(row?.publish_policy || row?.publishPolicy);
  const launchApproval = obj(policy.launchApproval || policy.launch_approval);
  const launchGate = obj(policy.launchGate || policy.launch_gate);

  const approved =
    policy.launchApproved === true ||
    policy.launch_approved === true ||
    launchApproval.approved === true ||
    launchApproval.status === "approved" ||
    launchGate.approved === true ||
    launchGate.status === "approved";

  return {
    approved,
    reasonCode: approved
      ? "autonomous_launch_gate_approved"
      : "autonomous_launch_gate_required",
    approvedBy: s(
      policy.launchApprovedBy ||
        policy.launch_approved_by ||
        launchApproval.approvedBy ||
        launchApproval.approved_by ||
        launchGate.approvedBy ||
        launchGate.approved_by
    ),
    approvedAt: s(
      policy.launchApprovedAt ||
        policy.launch_approved_at ||
        launchApproval.approvedAt ||
        launchApproval.approved_at ||
        launchGate.approvedAt ||
        launchGate.approved_at
    ),
  };
}
function buildNoReplyAction({
  reasonCode = "",
  tenantMode = "manual",
  meta = {},
} = {}) {
  return {
    type: "no_reply",
    reason: s(reasonCode || "tenant_mode_manual"),
    meta: {
      ...obj(meta),
      tenantMode: normalizeTenantMode(tenantMode),
      autonomyBlocked: true,
      reasonCode: s(reasonCode || "tenant_mode_manual"),
    },
  };
}

export async function resolveTenantAutonomyMode({ db, tenantKey = "" } = {}) {
  try {
    const row = await dbGetTenantMode(db, tenantKey);
    const requestedMode = normalizeTenantMode(row?.mode, "manual");
    const launchGate = resolveAutonomousLaunchGate(row);
    const mode =
      requestedMode === "auto" && launchGate.approved !== true
        ? "manual"
        : requestedMode;

    return {
      mode,
      requestedMode,
      tenantKey: s(row?.tenant_key || tenantKey).toLowerCase(),
      resolved: Boolean(row),
      defaulted: !row,
      launchGate,
      reasonCode: row
        ? mode === "auto"
          ? "tenant_mode_resolved"
          : requestedMode === "auto"
            ? launchGate.reasonCode
            : "tenant_mode_resolved"
        : "tenant_mode_missing_default_manual",
    };
  } catch (error) {
    return {
      mode: "manual",
      tenantKey: s(tenantKey).toLowerCase(),
      resolved: false,
      defaulted: true,
      reasonCode: "tenant_mode_lookup_failed_default_manual",
      error: s(error?.message || error),
    };
  }
}

export function isAutonomousTenantMode(mode = "") {
  return normalizeTenantMode(mode) === "auto";
}

export function buildTenantManualModeBrain({
  runtime = {},
  tenantKey = "",
  tenantMode = "manual",
  reasonCode = "tenant_mode_manual",
} = {}) {
  const safeReasonCode = s(reasonCode || "tenant_mode_manual");

  const action = buildNoReplyAction({
    reasonCode: safeReasonCode,
    tenantMode,
    meta: {
      tenantKey,
      runtimeAuthority: summarizeRuntimeAuthority(runtime),
    },
  });

  return {
    intent: "manual_mode",
    leadScore: 0,
    runtime,
    policy: {
      autoReplyEnabled: false,
      reasonCode: safeReasonCode,
      tenantMode: normalizeTenantMode(tenantMode),
    },
    reply: {
      shouldReply: false,
      text: "",
      mode: "suppressed",
      reasonCode: safeReasonCode,
      language: s(runtime?.languages?.[0] || runtime?.profile?.language || "en") || "en",
      confidence: 0,
      usedRecovery: false,
    },
    control: {
      intent: "manual_mode",
      askCategory: "operator_control",
      stage: "manual_mode",
      leadScore: 0,
      shouldSendMessage: false,
      shouldCreateLead: false,
      shouldStartHandoff: false,
      shouldNoReply: true,
      noReplyReason: safeReasonCode,
    },
    diagnostics: {
      noReplyReason: safeReasonCode,
      tenantMode: normalizeTenantMode(tenantMode),
      autonomyBlocked: true,
      reasonCode: safeReasonCode,
    },
    actions: [action],
    executionPolicy: {
      applied: true,
      manualModeBlocked: true,
      summary: {
        surface: "inbox",
        strictestOutcome: "operator_only",
        requiredExecutionLevel: "operator_only",
        allowedActionCount: 1,
        filteredActionCount: 0,
        operatorOnly: true,
        blocked: false,
        blockedUntilRepair: false,
        reasonCodes: [safeReasonCode],
        outcomes: ["operator_only"],
      },
      actions: [action],
      filteredActions: [],
      decisions: [],
    },
  };
}

export function buildTenantManualModeDecisionEvent({
  tenantId = "",
  tenantKey = "",
  channel = "",
  thread = null,
  message = null,
  runtime = {},
  tenantMode = "manual",
  reasonCode = "tenant_mode_manual",
} = {}) {
  const safeReasonCode = s(reasonCode || "tenant_mode_manual");
  const authority = summarizeRuntimeAuthority(runtime);

  return {
    tenantId: s(tenantId),
    tenantKey: lower(tenantKey),
    eventType: "blocked_action_outcome",
    actor: "system",
    source: "inbox.ingest",
    surface: "inbox",
    channelType: lower(channel),
    policyOutcome: "operator_only",
    reasonCodes: [safeReasonCode, "tenant_autonomy_manual"],
    healthState: {
      runtimeAuthority: authority,
    },
    approvalPosture: {
      runtimeSource: s(authority.source),
      runtimeAvailable: authority.available === true,
      runtimeStale: authority.stale === true,
      runtimeReasonCode: s(authority.reasonCode),
    },
    executionPosture: {
      tenantMode: normalizeTenantMode(tenantMode),
      autonomousAllowed: false,
      operatorPermitted: true,
      actionTypes: [],
      blockedBeforeBrain: true,
    },
    controlState: {
      tenantMode: normalizeTenantMode(tenantMode),
      noReplyReason: safeReasonCode,
      autonomyBlocked: true,
    },
    runtimeProjectionId: resolveRuntimeProjectionId(runtime),
    affectedSurfaces: ["inbox"],
    recommendedNextAction: {
      type: "operator_review",
      reason: safeReasonCode,
    },
    decisionContext: {
      threadId: s(thread?.id),
      messageId: s(message?.id),
      tenantMode: normalizeTenantMode(tenantMode),
      reasonCode: safeReasonCode,
    },
  };
}

export function applyInboxExecutionPolicyGate({
  runtime = {},
  actions = [],
  thread = null,
  channel = "",
} = {}) {
  const originalActions = arr(actions);

  const result = applyExecutionPolicyToActions({
    runtime,
    actions: originalActions,
    surface: "inbox",
    channelType: channel,
    actorType: "system",
    currentState: {
      handoffActive: Boolean(thread?.handoff_active),
      handoffReason: s(thread?.handoff_reason),
      handoffPriority: s(thread?.handoff_priority),
    },
  });

  return {
    ...result,
    applied: true,
    originalActionCount: originalActions.length,
    originalActionTypes: originalActions.map(getActionType).filter(Boolean),
    allowedActionTypes: arr(result.actions).map(getActionType).filter(Boolean),
    filteredActionTypes: arr(result.filteredActions).map(getActionType).filter(Boolean),
  };
}

export function buildExecutionPolicyFilteredDecisionEvent({
  tenantId = "",
  tenantKey = "",
  channel = "",
  thread = null,
  message = null,
  runtime = {},
  executionPolicy = {},
} = {}) {
  const summary = obj(executionPolicy.summary);
  const strictestOutcome = lower(summary.strictestOutcome || "blocked");
  const filteredActionTypes = arr(executionPolicy.filteredActionTypes);
  const authority = summarizeRuntimeAuthority(runtime);

  const reasonCodes = uniq([
    ...arr(summary.reasonCodes),
    strictestOutcome,
    "execution_policy_filtered_action",
  ]);

  return {
    tenantId: s(tenantId),
    tenantKey: lower(tenantKey),
    eventType:
      strictestOutcome === "handoff_required"
        ? "handoff_required_action_outcome"
        : strictestOutcome === "allowed_with_human_review"
          ? "review_required_action_outcome"
          : "blocked_action_outcome",
    actor: "system",
    source: "inbox.ingest.execution_policy",
    surface: "inbox",
    channelType: lower(channel),
    policyOutcome: strictestOutcome || "blocked",
    reasonCodes,
    healthState: {
      runtimeAuthority: authority,
    },
    approvalPosture: {
      runtimeSource: s(authority.source),
      runtimeAvailable: authority.available === true,
      runtimeStale: authority.stale === true,
      runtimeReasonCode: s(authority.reasonCode),
    },
    executionPosture: {
      ...summary,
      originalActionTypes: arr(executionPolicy.originalActionTypes),
      allowedActionTypes: arr(executionPolicy.allowedActionTypes),
      filteredActionTypes,
    },
    controlState: {
      filteredActionCount: Number(
        summary.filteredActionCount || filteredActionTypes.length || 0
      ),
    },
    runtimeProjectionId: resolveRuntimeProjectionId(runtime),
    affectedSurfaces: ["inbox"],
    recommendedNextAction: {
      type: summary.handoffRequired ? "operator_handoff" : "operator_review",
      reason: reasonCodes[0] || "execution_policy_filtered_action",
    },
    decisionContext: {
      threadId: s(thread?.id),
      messageId: s(message?.id),
      filteredActionTypes,
    },
  };
}

export const __test__ = {
  normalizeTenantMode,
  summarizeRuntimeAuthority,
  buildNoReplyAction,
  resolveAutonomousLaunchGate,
};

