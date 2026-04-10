import { buildAgentReplayTrace } from "./agentReplayTrace.js";
import {
  getTenantBrainRuntime,
  isRuntimeAuthorityError,
} from "./businessBrain/getTenantBrainRuntime.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function compactRecord(input = {}) {
  const out = {};
  for (const [key, value] of Object.entries(obj(input))) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && !s(value)) continue;
    if (Array.isArray(value) && !value.length) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const next = compactRecord(value);
      if (!Object.keys(next).length) continue;
      out[key] = next;
      continue;
    }
    out[key] = value;
  }
  return out;
}

function buildUnavailableRuntime({
  tenantId = "",
  tenantKey = "",
  reasonCode = "runtime_authority_unavailable",
} = {}) {
  const normalizedTenantId = s(tenantId);
  const normalizedTenantKey = s(tenantKey);
  const normalizedReasonCode = s(reasonCode || "runtime_authority_unavailable");

  return {
    tenant: {
      tenantId: normalizedTenantId,
      tenant_id: normalizedTenantId,
      tenantKey: normalizedTenantKey,
      tenant_key: normalizedTenantKey,
    },
    authority: {
      mode: "strict",
      source: "approved_runtime_projection",
      available: false,
      unavailable: true,
      stale: true,
      tenantId: normalizedTenantId || null,
      tenant_id: normalizedTenantId || null,
      tenantKey: normalizedTenantKey,
      tenant_key: normalizedTenantKey,
      reasonCode: normalizedReasonCode,
      reason_code: normalizedReasonCode,
    },
  };
}

async function resolveVoiceReplayRuntime({
  db,
  tenantId = "",
  tenantKey = "",
  getRuntime = getTenantBrainRuntime,
} = {}) {
  const normalizedTenantId = s(tenantId);
  const normalizedTenantKey = s(tenantKey);

  if (!normalizedTenantId && !normalizedTenantKey) {
    return buildUnavailableRuntime({
      tenantId: normalizedTenantId,
      tenantKey: normalizedTenantKey,
      reasonCode: "runtime_tenant_unresolved",
    });
  }

  if (typeof getRuntime !== "function") {
    return buildUnavailableRuntime({
      tenantId: normalizedTenantId,
      tenantKey: normalizedTenantKey,
      reasonCode: "runtime_loader_unavailable",
    });
  }

  try {
    const runtime = await getRuntime({
      db,
      tenantId: normalizedTenantId,
      tenantKey: normalizedTenantKey,
      authorityMode: "strict",
    });
    return runtime && typeof runtime === "object"
      ? runtime
      : buildUnavailableRuntime({
          tenantId: normalizedTenantId,
          tenantKey: normalizedTenantKey,
        });
  } catch (error) {
    return buildUnavailableRuntime({
      tenantId: normalizedTenantId,
      tenantKey: normalizedTenantKey,
      reasonCode: s(
        error?.reasonCode ||
          error?.reason_code ||
          error?.code ||
          (isRuntimeAuthorityError(error)
            ? "runtime_authority_unavailable"
            : "runtime_resolution_failed")
      ),
    });
  }
}

function isApprovedRuntime(runtime = {}) {
  const authority = obj(runtime.authority);
  return (
    lower(authority.source) === "approved_runtime_projection" &&
    authority.available !== false
  );
}

function normalizeVoiceUsecase(eventType = "") {
  const safeEventType = lower(eventType);
  if (
    safeEventType.includes("handoff") ||
    safeEventType.includes("operator_join") ||
    safeEventType.includes("takeover")
  ) {
    return "voice.operator_control";
  }
  if (safeEventType.startsWith("transcript_")) return "voice.transcript.sync";
  if (safeEventType.includes("session")) return "voice.session.control";
  return "voice.live";
}

function deriveVoiceReplayDecisionPath({
  eventType = "",
  payload = {},
  runtime = {},
} = {}) {
  const value = obj(payload);
  const safeEventType = lower(eventType);
  const safeReasonCode = s(
    value.reasonCode ||
      value.reason_code ||
      value.code ||
      value.errorCode ||
      value.error_code
  );
  const handoffRequested =
    safeEventType.includes("handoff") ||
    safeEventType.includes("join") ||
    safeEventType.includes("takeover") ||
    value.operatorJoinRequested === true ||
    value.operatorJoined === true ||
    value.takeoverActive === true;
  const rejected =
    safeEventType.endsWith("_rejected") ||
    lower(value.mutationOutcome) === "rejected";
  const ignored =
    safeEventType.endsWith("_ignored") ||
    lower(value.mutationOutcome) === "ignored";
  const completed =
    safeEventType === "session_completed" ||
    lower(value.sessionStatus) === "completed" ||
    lower(value.callStatus) === "completed";

  if (rejected) {
    return {
      status: "refused",
      reasonCode: safeReasonCode || safeEventType || "voice_action_rejected",
      detail: s(
        value.currentStatus || value.requestedStatus || value.operatorJoinMode
      ),
    };
  }

  if (ignored) {
    return {
      status: "no_reply",
      reasonCode: safeReasonCode || safeEventType || "voice_action_ignored",
      detail: s(
        value.currentStatus || value.requestedStatus || value.text || value.role
      ),
    };
  }

  if (handoffRequested) {
    return {
      status: "escalated_to_operator",
      reasonCode: safeReasonCode || safeEventType || "voice_operator_handoff",
      detail: s(
        value.resolvedDepartment ||
          value.requestedDepartment ||
          value.operatorJoinMode ||
          value.operatorName
      ),
    };
  }

  if (completed) {
    return {
      status: "answered",
      reasonCode: safeReasonCode || safeEventType || "voice_session_completed",
      detail: s(value.sessionStatus || value.callStatus),
    };
  }

  if (!isApprovedRuntime(runtime)) {
    const authority = obj(runtime.authority);
    return {
      status: "runtime_unavailable",
      reasonCode: s(
        authority.reasonCode || authority.reason_code || "runtime_authority_unavailable"
      ),
      detail: s(value.sessionStatus || value.callStatus),
    };
  }

  return {
    status: "no_reply",
    reasonCode: safeReasonCode || safeEventType || "voice_state_synced",
    detail: s(value.sessionStatus || value.callStatus || value.role),
  };
}

function mapVoiceEvaluationOutcome(status = "") {
  const safeStatus = lower(status);
  if (safeStatus === "escalated_to_operator") return "handoff_recommended";
  if (safeStatus === "answered") return "reply_generated";
  if (safeStatus === "refused") return "blocked";
  if (safeStatus === "runtime_unavailable") return "blocked";
  if (safeStatus === "fallback_safe_response") return "fallback";
  return "no_reply_recommended";
}

function buildVoiceDecisionInputs({ eventType = "", payload = {} } = {}) {
  const value = obj(payload);
  const safeEventType = lower(eventType);
  const trigger = s(
    value.requestedDepartment ||
      value.resolvedDepartment ||
      value.operatorJoinMode ||
      (safeEventType.includes("takeover") ? "takeover" : "")
  );
  const handoffReason = s(
    value.reasonCode ||
      value.reason_code ||
      value.operatorName ||
      safeEventType
  );

  return compactRecord({
    handoff:
      safeEventType.includes("handoff") ||
      safeEventType.includes("join") ||
      safeEventType.includes("takeover") ||
      value.operatorJoinRequested === true ||
      value.operatorJoined === true ||
      value.takeoverActive === true
        ? {
            trigger,
            reason: handoffReason,
            priority: value.takeoverActive === true ? "high" : "normal",
          }
        : {},
  });
}

export async function buildVoiceEventReplayTrace({
  db,
  tenantId = "",
  tenantKey = "",
  eventType = "",
  payload = {},
  getRuntime = getTenantBrainRuntime,
} = {}) {
  const runtime = await resolveVoiceReplayRuntime({
    db,
    tenantId,
    tenantKey,
    getRuntime,
  });
  const decisionPath = deriveVoiceReplayDecisionPath({
    eventType,
    payload,
    runtime,
  });
  const decisions = buildVoiceDecisionInputs({ eventType, payload });
  const handoff = obj(decisions.handoff);

  return buildAgentReplayTrace({
    runtime,
    channel: "voice",
    usecase: normalizeVoiceUsecase(eventType),
    decisions,
    evaluation: compactRecord({
      outcome: mapVoiceEvaluationOutcome(decisionPath.status),
      handoff: Object.keys(handoff).length
        ? {
            status: "recommended",
            trigger: s(handoff.trigger),
            reason: s(handoff.reason),
            priority: s(handoff.priority),
          }
        : {},
    }),
    decisionPath,
  });
}

export async function buildVoiceReplayPayload({
  db,
  tenantId = "",
  tenantKey = "",
  eventType = "",
  payload = {},
  getRuntime = getTenantBrainRuntime,
} = {}) {
  return {
    ...obj(payload),
    replayTrace: await buildVoiceEventReplayTrace({
      db,
      tenantId,
      tenantKey,
      eventType,
      payload,
      getRuntime,
    }),
  };
}

export { deriveVoiceReplayDecisionPath };

export const __test__ = {
  normalizeVoiceUsecase,
  deriveVoiceReplayDecisionPath,
  mapVoiceEvaluationOutcome,
};
