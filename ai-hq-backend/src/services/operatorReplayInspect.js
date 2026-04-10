import { deriveVoiceReplayDecisionPath } from "./voiceReplayTrace.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function iso(v) {
  if (!v) return "";
  try {
    const date = new Date(v);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  } catch {
    return "";
  }
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

function normalizeAuthority(replayTrace = {}) {
  const trace = obj(replayTrace);
  const runtimeRef = obj(trace.runtimeRef);

  return compactRecord({
    approvedRuntime: runtimeRef.approvedRuntime === true,
    source: s(runtimeRef.source),
    runtimeProjectionId: s(runtimeRef.runtimeProjectionId),
    projectionHash: s(runtimeRef.projectionHash),
    truthVersionId: s(runtimeRef.truthVersionId),
    runtimeVersion: s(trace.runtimeVersion),
  });
}

function normalizePolicy(replayTrace = {}) {
  const trace = obj(replayTrace);
  const policy = obj(trace.policy);

  return compactRecord({
    language: s(policy.language),
    autoReplyEnabled:
      typeof policy.autoReplyEnabled === "boolean"
        ? policy.autoReplyEnabled
        : undefined,
    createLeadEnabled:
      typeof policy.createLeadEnabled === "boolean"
        ? policy.createLeadEnabled
        : undefined,
    handoffEnabled:
      typeof policy.handoffEnabled === "boolean"
        ? policy.handoffEnabled
        : undefined,
    qualificationMode: s(policy.qualificationMode),
    handoffBias: s(policy.handoffBias),
    tonePolicyPresent:
      typeof policy.tonePolicyPresent === "boolean"
        ? policy.tonePolicyPresent
        : undefined,
  });
}

function normalizeBehavior(replayTrace = {}) {
  const trace = obj(replayTrace);
  const behavior = obj(trace.behavior);

  return compactRecord({
    niche: s(behavior.niche),
    conversionGoal: s(behavior.conversionGoal),
    primaryCta: s(behavior.primaryCta),
    toneProfile: s(behavior.toneProfile),
    qualificationQuestionCount: Number.isFinite(
      Number(behavior.qualificationQuestionCount)
    )
      ? Number(behavior.qualificationQuestionCount)
      : undefined,
    handoffBias: s(obj(behavior.channelBehavior).handoffBias),
    qualificationDepth: s(obj(behavior.channelBehavior).qualificationDepth),
  });
}

function buildDecisionFlags({ decision = {}, authority = {} } = {}) {
  const status = lower(decision.status);
  return compactRecord({
    approvedRuntime: authority.approvedRuntime === true,
    operatorHandoff: status === "escalated_to_operator",
    safeFallback:
      status === "fallback_safe_response" || status === "insufficient_runtime_context",
    refused: status === "refused",
    runtimeUnavailable:
      status === "runtime_unavailable" || authority.approvedRuntime !== true,
  });
}

export function buildOperatorInspectFromReplayTrace({
  channel = "",
  surface = "",
  sourceType = "live_action",
  sourceId = "",
  actionType = "",
  eventType = "",
  actor = "",
  timestamp = "",
  replayTrace = {},
  summary = {},
  fallbackDecision = {},
} = {}) {
  const trace = obj(replayTrace);
  const decisionPath = obj(trace.decisionPath);
  const decision = compactRecord({
    status: s(decisionPath.status || fallbackDecision.status),
    reasonCode: s(
      decisionPath.reasonCode ||
        decisionPath.reason_code ||
        fallbackDecision.reasonCode ||
        fallbackDecision.reason_code
    ),
    detail: s(decisionPath.detail || fallbackDecision.detail),
  });
  const authority = normalizeAuthority(trace);

  return compactRecord({
    schema: "operator_replay_inspect.v1",
    channel: s(channel || trace.channel),
    surface: s(surface || trace.channel),
    sourceType: s(sourceType || "live_action"),
    sourceId: s(sourceId),
    actionType: s(actionType || trace.usecase || eventType),
    eventType: s(eventType),
    actor: s(actor || "system"),
    occurredAt: iso(timestamp),
    authority,
    decision,
    policy: normalizePolicy(trace),
    behavior: normalizeBehavior(trace),
    summary: compactRecord(summary),
    flags: buildDecisionFlags({ decision, authority }),
  });
}

export function buildVoiceEventInspect(event = {}) {
  const payload = obj(event.payload);
  const replayTrace = obj(payload.replayTrace);
  const fallbackDecision = deriveVoiceReplayDecisionPath({
    eventType: s(event.eventType || event.event),
    payload,
    runtime: {
      authority: {
        source: s(obj(replayTrace.runtimeRef).source),
        available: obj(replayTrace.runtimeRef).approvedRuntime === true,
        reasonCode: s(obj(replayTrace.runtimeRef).reasonCode),
      },
    },
  });

  return buildOperatorInspectFromReplayTrace({
    channel: "voice",
    surface: "voice",
    sourceType: "voice_call_event",
    sourceId: s(event.id),
    actionType: `voice.${s(event.eventType || event.event)}`,
    eventType: s(event.eventType || event.event),
    actor: s(event.actor || "system"),
    timestamp: event.createdAt || event.timestamp,
    replayTrace,
    summary: {
      mutationOutcome: s(payload.mutationOutcome),
      callStatus: s(payload.callStatus),
      sessionStatus: s(payload.sessionStatus),
      requestedDepartment: s(payload.requestedDepartment),
      resolvedDepartment: s(payload.resolvedDepartment),
      operatorJoinMode: s(payload.operatorJoinMode),
      operatorName: s(payload.operatorName),
      takeoverActive:
        typeof payload.takeoverActive === "boolean"
          ? payload.takeoverActive
          : undefined,
    },
    fallbackDecision,
  });
}
