import {
  getVoiceCallById,
  getVoiceCallSessionById,
  listVoiceCallSessions,
} from "../../db/helpers/voice.js";
import { getSessionCallId, sessionMatchesCall } from "./publicRead.js";
import { s, sameTenant } from "./shared.js";

export async function findVoiceSessionByCallId(db, tenantId, callId) {
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

export async function resolveScopedVoiceCall({ db, scope, callId } = {}) {
  const call = await getVoiceCallById(db, s(callId));
  if (!call) {
    return { ok: false, statusCode: 404, error: "voice_call_not_found" };
  }

  if (!sameTenant(call.tenantId ?? call.tenant_id, scope?.tenantId)) {
    return { ok: false, statusCode: 403, error: "forbidden" };
  }

  return { ok: true, call };
}

export async function resolveScopedVoiceSession({ db, scope, sessionId } = {}) {
  const session = await getVoiceCallSessionById(db, s(sessionId));
  if (!session) {
    return { ok: false, statusCode: 404, error: "voice_session_not_found" };
  }

  if (!sameTenant(session.tenantId ?? session.tenant_id, scope?.tenantId)) {
    return { ok: false, statusCode: 403, error: "forbidden" };
  }

  return { ok: true, session };
}

export async function resolveVoiceCallSessionForOperator({
  db,
  scope,
  callId,
  sessionId,
} = {}) {
  const callResult = await resolveScopedVoiceCall({ db, scope, callId });
  if (!callResult.ok) return callResult;

  const call = callResult.call;
  const providedSessionId = s(sessionId);

  let session = null;
  if (providedSessionId) {
    const sessionResult = await resolveScopedVoiceSession({
      db,
      scope,
      sessionId: providedSessionId,
    });
    if (!sessionResult.ok) return sessionResult;
    session = sessionResult.session;
  } else {
    session = await findVoiceSessionByCallId(db, scope?.tenantId, callId);
  }

  if (!session || !getSessionCallId(session)) {
    return { ok: false, statusCode: 404, error: "voice_session_not_found" };
  }

  if (!sessionMatchesCall(session, call.id)) {
    return { ok: false, statusCode: 404, error: "voice_session_not_found" };
  }

  return { ok: true, call, session };
}
