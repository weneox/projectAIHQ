import { fail, s, b, isObj, n, sameTenant } from "./shared.js";
import {
  resolveTenantScope,
  getVoiceCallById,
  getVoiceCallSessionById,
  listVoiceCallSessions,
  appendVoiceCallEvent,
} from "./repository.js";

export async function requireTenantScope(req, res, db) {
  const scope = await resolveTenantScope(req, db);

  if (!scope.tenantId) {
    fail(res, 400, "tenant_required");
    return null;
  }

  return scope;
}

export function normalizeSettingsInput(body = {}) {
  return {
    enabled: b(body.enabled, false),
    provider: s(body.provider, "twilio"),
    mode: s(body.mode, "assistant"),

    displayName: s(body.displayName),
    defaultLanguage: s(body.defaultLanguage, "en"),
    supportedLanguages: Array.isArray(body.supportedLanguages)
      ? body.supportedLanguages.map((x) => s(x)).filter(Boolean)
      : ["en"],

    greeting: isObj(body.greeting) ? body.greeting : {},
    fallbackGreeting: isObj(body.fallbackGreeting) ? body.fallbackGreeting : {},
    businessContext: s(body.businessContext),
    instructions: s(body.instructions),

    businessHoursEnabled: b(body.businessHoursEnabled, false),
    businessHours: isObj(body.businessHours) ? body.businessHours : {},

    operatorEnabled: b(body.operatorEnabled, true),
    operatorPhone: s(body.operatorPhone),
    operatorLabel: s(body.operatorLabel),
    transferStrategy: s(body.transferStrategy, "handoff"),

    callbackEnabled: b(body.callbackEnabled, true),
    callbackMode: s(body.callbackMode, "lead_only"),

    maxCallSeconds: Math.max(15, Math.min(3600, n(body.maxCallSeconds, 180))),
    silenceHangupSeconds: Math.max(
      3,
      Math.min(120, n(body.silenceHangupSeconds, 12))
    ),

    captureRules: isObj(body.captureRules) ? body.captureRules : {},
    leadRules: isObj(body.leadRules) ? body.leadRules : {},
    escalationRules: isObj(body.escalationRules) ? body.escalationRules : {},
    reportingRules: isObj(body.reportingRules) ? body.reportingRules : {},

    twilioPhoneNumber: s(body.twilioPhoneNumber),
    twilioPhoneSid: s(body.twilioPhoneSid),
    twilioConfig: isObj(body.twilioConfig) ? body.twilioConfig : {},

    costControl: isObj(body.costControl) ? body.costControl : {},
    meta: isObj(body.meta) ? body.meta : {},
  };
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