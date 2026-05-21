import { fail, s, sameTenant } from "./shared.js";
import {
  appendVoiceEventStrict,
  emitVoiceMutationRealtime,
  runVoiceMutationTransaction,
} from "../../../modules/voice/index.js";
import {
  normalizeVoiceSettingsInput,
} from "../../../modules/voice/settings.js";
import {
  resolveTenantScope,
  getVoiceCallById,
  getVoiceCallSessionById,
  listVoiceCallSessions,
  appendVoiceCallEvent,
} from "./repository.js";

export {
  appendVoiceEventStrict,
  emitVoiceMutationRealtime,
  runVoiceMutationTransaction,
};

export async function requireTenantScope(req, res, db) {
  const scope = await resolveTenantScope(req, db);

  if (!scope.tenantId) {
    fail(res, 400, "tenant_required");
    return null;
  }

  return scope;
}

export function normalizeSettingsInput(body = {}) {
  return normalizeVoiceSettingsInput(body);
}

export async function getScopedCallOrFail({ db, scope, callId, res }) {
  const call = await getVoiceCallById(db, s(callId));
  if (!call) {
    fail(res, 404, "voice_call_not_found");
    return null;
  }

  if (!sameTenant(call.tenantId ?? call.tenant_id, scope.tenantId)) {
    fail(res, 403, "forbidden");
    return null;
  }

  return call;
}

export async function getScopedSessionOrFail({ db, scope, sessionId, res }) {
  const session = await getVoiceCallSessionById(db, s(sessionId));
  if (!session) {
    fail(res, 404, "voice_session_not_found");
    return null;
  }

  if (!sameTenant(session.tenantId ?? session.tenant_id, scope.tenantId)) {
    fail(res, 403, "forbidden");
    return null;
  }

  return session;
}

export async function findSessionByCallId(db, tenantId, callId) {
  const allSessions = await listVoiceCallSessions(db, {
    tenantId,
    limit: 100,
  });

  const normalizedCallId = s(callId);

  return (
    allSessions.find((x) => s(x?.callId) === normalizedCallId) ||
    allSessions.find((x) => s(x?.call_id) === normalizedCallId) ||
    allSessions.find((x) => s(x?.voiceCallId) === normalizedCallId) ||
    allSessions.find((x) => s(x?.voice_call_id) === normalizedCallId) ||
    null
  );
}

export async function auditSafe(audit, payload) {
  try {
    if (audit?.log) {
      await audit.log(payload);
    }
  } catch {}
}

export async function appendEventSafe(db, payload) {
  try {
    await appendVoiceCallEvent(db, payload);
  } catch {}
}

