import {
  appendVoiceCallEvent,
  updateVoiceCall,
  updateVoiceCallForTenant,
} from "../../db/helpers/voice.js";

export const VOICE_REALTIME_SIDEBAND_PERSISTENCE_VERSION =
  "voice-realtime-sideband-persistence-v1";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function readCallId(call = {}) {
  return s(call.id || call.callId || call.call_id);
}

async function updateRealtimeSidebandCall(db, callId, callPatch, scope = {}) {
  if (s(scope.tenantId)) {
    return updateVoiceCallForTenant(db, {
      id: callId,
      tenantId: s(scope.tenantId),
      patch: callPatch,
    });
  }

  return updateVoiceCall(db, callId, callPatch);
}

export function hasPatchKeys(value) {
  const patch = obj(value);
  return Object.keys(patch).some((key) => patch[key] !== undefined);
}

export function buildRealtimeSidebandPersistedEventInput({
  normalized = {},
  call = {},
  scope = {},
} = {}) {
  const payload = obj(normalized.payload);

  return {
    callId: readCallId(call),
    tenantId: s(scope.tenantId),
    tenantKey: s(scope.tenantKey),
    eventType: s(normalized.eventType || "voice.sideband.event"),
    actor: s(normalized.actor || "system"),
    payload: {
      ...payload,
      sidebandPersistenceVersion: VOICE_REALTIME_SIDEBAND_PERSISTENCE_VERSION,
      realtimeType: s(normalized.realtimeType || payload.realtimeType),
      providerRealtimeCallId: s(
        normalized.providerRealtimeCallId || payload.providerRealtimeCallId
      ),
      ...(normalized.toolCall ? { toolCall: normalized.toolCall } : {}),
      ...(normalized.transcript ? { transcript: normalized.transcript } : {}),
    },
  };
}

export function buildRealtimeSidebandToolResultEventInput({
  resultTrace = {},
  call = {},
  scope = {},
} = {}) {
  const payload = obj(resultTrace.payload);
  const result = obj(payload.result);

  return {
    callId: readCallId(call),
    tenantId: s(scope.tenantId),
    tenantKey: s(scope.tenantKey),
    eventType: "voice.sideband.tool_result",
    actor: "system",
    payload: {
      ...payload,
      sidebandPersistenceVersion: VOICE_REALTIME_SIDEBAND_PERSISTENCE_VERSION,
      resultStatus: s(
        resultTrace.resultStatus || payload.resultStatus || result.status
      ),
      assistantInstruction: s(
        resultTrace.assistantInstruction ||
          payload.assistantInstruction ||
          result.assistantInstruction ||
          result.nextAssistantInstruction
      ),
      nextQuestion: s(
        resultTrace.nextQuestion || payload.nextQuestion || result.nextQuestion
      ),
      missingRequired: arr(
        resultTrace.missingRequired || payload.missingRequired || result.missingRequired
      ),
    },
  };
}

export async function persistRealtimeSidebandTrace({
  db,
  call = {},
  scope = {},
  normalized = null,
  resultTrace = null,
  callPatch = {},
  appendEvent = appendVoiceCallEvent,
  updateCall = null,
} = {}) {
  if (!db) {
    return {
      ok: false,
      skipped: true,
      reasonCode: "db_unavailable",
    };
  }

  const callId = readCallId(call);
  if (!callId) {
    return {
      ok: false,
      skipped: true,
      reasonCode: "voice_call_id_missing",
    };
  }

  const events = [];

  if (normalized) {
    const event = await appendEvent(
      db,
      buildRealtimeSidebandPersistedEventInput({ normalized, call, scope })
    );
    events.push(event);
  }

  if (resultTrace) {
    const event = await appendEvent(
      db,
      buildRealtimeSidebandToolResultEventInput({ resultTrace, call, scope })
    );
    events.push(event);
  }

  let updatedCall = null;
  let callPatchApplied = false;

  if (hasPatchKeys(callPatch)) {
    updatedCall = updateCall
      ? await updateCall(db, callId, callPatch)
      : await updateRealtimeSidebandCall(db, callId, callPatch, scope);
    callPatchApplied = true;
  }

  return {
    ok: true,
    skipped: false,
    events,
    callPatchApplied,
    updatedCall,
  };
}
