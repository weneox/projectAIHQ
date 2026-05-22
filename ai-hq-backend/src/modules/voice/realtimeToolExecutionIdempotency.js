import {
  markExternalSideEffectFailed,
  markExternalSideEffectSent,
  reserveExternalSideEffect,
} from "../../db/helpers/externalIdempotency.js";
import {
  buildStableIdempotencyKey,
} from "../../utils/idempotency.js";

export const VOICE_REALTIME_TOOL_EXECUTION_IDEMPOTENCY_VERSION =
  "voice-realtime-tool-execution-idempotency-v1";

const VOICE_REALTIME_TOOL_EXECUTION_NAMESPACE = "voice_realtime_tool_execution";
const VOICE_REALTIME_TOOL_EXECUTION_PROVIDER = "voice_realtime";
const VOICE_REALTIME_TOOL_EXECUTION_ACTION_TYPE = "tool_execution";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort((a, b) => a.localeCompare(b))
      .reduce((acc, key) => {
        acc[key] = canonicalize(value[key]);
        return acc;
      }, {});
  }

  return value;
}

function canonicalArgsJson(args = {}) {
  try {
    return JSON.stringify(canonicalize(obj(args)));
  } catch {
    return "{}";
  }
}

function buildReservationContext({
  tenantKey = "",
  voiceCallId = "",
  providerRealtimeCallId = "",
  toolCallId = "",
  toolName = "",
  args = {},
  source = "",
} = {}) {
  const canonicalizedArgsJson = canonicalArgsJson(args);
  const idempotencyKey = buildVoiceRealtimeToolExecutionKey({
    tenantKey,
    voiceCallId,
    providerRealtimeCallId,
    toolCallId,
    toolName,
    args,
  });

  return {
    version: VOICE_REALTIME_TOOL_EXECUTION_IDEMPOTENCY_VERSION,
    provider: VOICE_REALTIME_TOOL_EXECUTION_PROVIDER,
    actionType: VOICE_REALTIME_TOOL_EXECUTION_ACTION_TYPE,
    idempotencyKey,
    tenantKey: lower(tenantKey),
    voiceCallId: s(voiceCallId),
    providerRealtimeCallId: s(providerRealtimeCallId),
    toolCallId: s(toolCallId),
    toolName: s(toolName),
    canonicalizedArgsJson,
    source: s(source),
  };
}

function skippedReservationResult(context = {}, reasonCode = "idempotency_unavailable") {
  return {
    ok: false,
    skipped: true,
    acquired: false,
    duplicate: false,
    reasonCode,
    leaseToken: "",
    record: null,
    ...context,
  };
}

function finalizeContext(input = {}) {
  const reservation = obj(input.reservation);
  return {
    tenantKey: lower(input.tenantKey || reservation.tenantKey),
    idempotencyKey: s(input.idempotencyKey || reservation.idempotencyKey),
    leaseToken: s(input.leaseToken || reservation.leaseToken),
  };
}

export function buildVoiceRealtimeToolExecutionKey({
  tenantKey = "",
  voiceCallId = "",
  providerRealtimeCallId = "",
  toolCallId = "",
  toolName = "",
  args = {},
} = {}) {
  return buildStableIdempotencyKey(VOICE_REALTIME_TOOL_EXECUTION_NAMESPACE, {
    tenantKey: lower(tenantKey),
    voiceCallId: s(voiceCallId),
    providerRealtimeCallId: s(providerRealtimeCallId),
    toolCallId: s(toolCallId),
    toolName: s(toolName),
    argsJson: canonicalArgsJson(args),
  });
}

export async function reserveVoiceRealtimeToolExecution({
  db,
  tenantId = "",
  tenantKey = "",
  voiceCallId = "",
  providerRealtimeCallId = "",
  toolCallId = "",
  toolName = "",
  args = {},
  source = "",
  reserveSideEffect = reserveExternalSideEffect,
} = {}) {
  const context = buildReservationContext({
    tenantKey,
    voiceCallId,
    providerRealtimeCallId,
    toolCallId,
    toolName,
    args,
    source,
  });

  if (!db?.query) {
    return skippedReservationResult(context, "db_unavailable");
  }

  if (!context.tenantKey) {
    return skippedReservationResult(context, "tenant_key_required");
  }

  if (!context.voiceCallId) {
    return skippedReservationResult(context, "voice_call_id_required");
  }

  if (!context.toolName) {
    return skippedReservationResult(context, "voice_tool_name_required");
  }

  const reservation = await reserveSideEffect(db, {
    tenantId: s(tenantId),
    tenantKey: context.tenantKey,
    provider: VOICE_REALTIME_TOOL_EXECUTION_PROVIDER,
    actionType: VOICE_REALTIME_TOOL_EXECUTION_ACTION_TYPE,
    idempotencyKey: context.idempotencyKey,
  });

  const acquired = reservation?.acquired === true;
  const reasonCode = acquired ? "" : "voice_realtime_tool_execution_duplicate";

  return {
    ok: true,
    skipped: false,
    acquired,
    duplicate: !acquired,
    reasonCode,
    leaseToken: s(reservation?.leaseToken),
    record: reservation?.record || null,
    recordState: s(reservation?.record?.state),
    ...context,
  };
}

export async function markVoiceRealtimeToolExecutionSent({
  db,
  reservation = {},
  tenantKey = "",
  idempotencyKey = "",
  leaseToken = "",
  providerMessageId = "",
  providerResponse = {},
  markSideEffectSent = markExternalSideEffectSent,
} = {}) {
  const context = finalizeContext({
    reservation,
    tenantKey,
    idempotencyKey,
    leaseToken,
  });

  if (!db?.query || !context.tenantKey || !context.idempotencyKey) {
    return null;
  }

  return markSideEffectSent(db, {
    tenantKey: context.tenantKey,
    provider: VOICE_REALTIME_TOOL_EXECUTION_PROVIDER,
    actionType: VOICE_REALTIME_TOOL_EXECUTION_ACTION_TYPE,
    idempotencyKey: context.idempotencyKey,
    leaseToken: context.leaseToken,
    providerMessageId,
    providerResponse,
  });
}

export async function markVoiceRealtimeToolExecutionFailed({
  db,
  reservation = {},
  tenantKey = "",
  idempotencyKey = "",
  leaseToken = "",
  retryable = false,
  retryDelaySeconds = 120,
  errorCode = "",
  errorMessage = "",
  providerResponse = {},
  markSideEffectFailed = markExternalSideEffectFailed,
} = {}) {
  const context = finalizeContext({
    reservation,
    tenantKey,
    idempotencyKey,
    leaseToken,
  });

  if (!db?.query || !context.tenantKey || !context.idempotencyKey) {
    return null;
  }

  return markSideEffectFailed(db, {
    tenantKey: context.tenantKey,
    provider: VOICE_REALTIME_TOOL_EXECUTION_PROVIDER,
    actionType: VOICE_REALTIME_TOOL_EXECUTION_ACTION_TYPE,
    idempotencyKey: context.idempotencyKey,
    leaseToken: context.leaseToken,
    retryable,
    retryDelaySeconds,
    errorCode,
    errorMessage,
    providerResponse,
  });
}
