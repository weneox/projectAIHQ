import { s, b, isObj, n } from "./shared.js";
import {
  getVoiceCallByProviderSid,
  createVoiceCall,
  updateVoiceCall,
  getVoiceCallSessionByProviderCallSid,
  createVoiceCallSession,
  updateVoiceCallSession,
} from "./repository.js";

export function buildConferenceName({ tenantKey, providerCallSid }) {
  return `${s(tenantKey, "default")}:${s(providerCallSid, "call")}`;
}

const TERMINAL_CALL_STATUSES = new Set([
  "completed",
  "failed",
  "busy",
  "no_answer",
  "canceled",
]);

const TERMINAL_SESSION_STATUSES = new Set(["completed", "failed"]);

function lower(v) {
  return s(v).toLowerCase();
}

function isTerminalCallStatus(status = "") {
  return TERMINAL_CALL_STATUSES.has(lower(status));
}

function isTerminalSessionStatus(status = "") {
  return TERMINAL_SESSION_STATUSES.has(lower(status));
}

function preserveCallStatus(currentStatus = "", requestedStatus = "", appliedGuards = []) {
  const current = lower(currentStatus);
  const requested = lower(requestedStatus) || current;
  if (isTerminalCallStatus(current) && requested !== current) {
    appliedGuards.push("call_terminal_status_preserved");
    return current;
  }
  return requested;
}

function preserveSessionStatus(currentStatus = "", requestedStatus = "", appliedGuards = []) {
  const current = lower(currentStatus);
  const requested = lower(requestedStatus) || current;
  if (isTerminalSessionStatus(current) && requested !== current) {
    appliedGuards.push("session_terminal_status_preserved");
    return current;
  }
  return requested;
}

function ensureTerminalEndedAt(status = "", endedAt = null) {
  if (isTerminalCallStatus(status) || isTerminalSessionStatus(status)) {
    return endedAt || new Date().toISOString();
  }
  return endedAt || null;
}

export async function upsertCallAndSession(db, body = {}) {
  const providerCallSid = s(body.providerCallSid || body.callSid);
  if (!providerCallSid) {
    throw new Error("provider_call_sid_required");
  }

  const appliedGuards = [];

  let call = await getVoiceCallByProviderSid(db, providerCallSid);

  if (!call) {
    const initialCallStatus = preserveCallStatus(
      "",
      s(body.callStatus || body.status || "in_progress"),
      appliedGuards
    );
    call = await createVoiceCall(db, {
      tenantId: s(body.tenantId) || null,
      tenantKey: s(body.tenantKey),
      provider: s(body.provider, "twilio"),
      providerCallSid,
      providerStreamSid: s(body.providerStreamSid || body.streamSid) || null,
      direction: s(body.direction, "outbound"),
      status: initialCallStatus,
      fromNumber: s(body.fromNumber || body.from) || null,
      toNumber: s(body.toNumber || body.to) || null,
      callerName: s(body.customerName || body.callerName) || null,
      startedAt: body.startedAt || new Date().toISOString(),
      endedAt: ensureTerminalEndedAt(initialCallStatus, body.endedAt || null),
      language: s(body.language, "en"),
      agentMode: s(body.agentMode, "assistant"),
      handoffRequested: b(body.handoffRequested, false),
      handoffCompleted: b(body.handoffCompleted, false),
      handoffTarget: s(body.handoffTarget) || null,
      callbackRequested: b(body.callbackRequested, false),
      callbackPhone: s(body.callbackPhone) || null,
      leadId: s(body.leadId) || null,
      inboxThreadId: s(body.inboxThreadId) || null,
      transcript: s(body.transcript),
      summary: s(body.summary),
      outcome: s(body.outcome, "unknown"),
      intent: s(body.intent) || null,
      sentiment: s(body.sentiment) || null,
      metrics: isObj(body.metrics) ? body.metrics : {},
      extraction: isObj(body.extraction) ? body.extraction : {},
      meta: isObj(body.meta) ? body.meta : {},
    });
  } else {
    const nextCallStatus = preserveCallStatus(
      call.status,
      s(body.callStatus || body.status || call.status),
      appliedGuards
    );
    call = await updateVoiceCall(db, call.id, {
      tenantId: s(body.tenantId) || call.tenantId || null,
      tenantKey: s(body.tenantKey || call.tenantKey),
      providerStreamSid:
        s(body.providerStreamSid || body.streamSid) || call.providerStreamSid || null,
      status: nextCallStatus,
      fromNumber: s(body.fromNumber || body.from || call.fromNumber) || null,
      toNumber: s(body.toNumber || body.to || call.toNumber) || null,
      callerName: s(body.customerName || body.callerName || call.callerName) || null,
      answeredAt: body.answeredAt || call.answeredAt || null,
      endedAt: ensureTerminalEndedAt(
        nextCallStatus,
        body.endedAt || call.endedAt || null
      ),
      durationSeconds: n(body.durationSeconds, call.durationSeconds || 0),
      language: s(body.language || call.language, "en"),
      agentMode: s(body.agentMode || call.agentMode, "assistant"),
      handoffRequested: b(body.handoffRequested, call.handoffRequested),
      handoffCompleted: b(body.handoffCompleted, call.handoffCompleted),
      handoffTarget: s(body.handoffTarget || call.handoffTarget) || null,
      callbackRequested: b(body.callbackRequested, call.callbackRequested),
      callbackPhone: s(body.callbackPhone || call.callbackPhone) || null,
      leadId: s(body.leadId || call.leadId) || null,
      inboxThreadId: s(body.inboxThreadId || call.inboxThreadId) || null,
      transcript: s(body.transcript || call.transcript),
      summary: s(body.summary || call.summary),
      outcome: s(body.outcome || call.outcome, "unknown"),
      intent: s(body.intent || call.intent) || null,
      sentiment: s(body.sentiment || call.sentiment) || null,
      metrics: isObj(body.metrics) ? body.metrics : call.metrics,
      extraction: isObj(body.extraction) ? body.extraction : call.extraction,
      meta: isObj(body.meta) ? body.meta : call.meta,
    });
  }

  let session = await getVoiceCallSessionByProviderCallSid(db, providerCallSid);

  if (!session) {
    const initialSessionStatus = preserveSessionStatus(
      "",
      s(body.sessionStatus || "bot_active"),
      appliedGuards
    );
    session = await createVoiceCallSession(db, {
      tenantId: s(body.tenantId) || null,
      tenantKey: s(body.tenantKey),
      voiceCallId: call.id,
      provider: s(body.provider, "twilio"),
      providerCallSid,
      providerConferenceSid: s(body.providerConferenceSid || body.conferenceSid) || null,
      conferenceName:
        s(body.conferenceName) ||
        buildConferenceName({ tenantKey: body.tenantKey, providerCallSid }),
      customerNumber: s(body.customerNumber || body.fromNumber || body.from) || null,
      customerName: s(body.customerName || body.callerName) || null,
      direction: s(body.sessionDirection || "outbound_callback"),
      status: initialSessionStatus,
      requestedDepartment: s(body.requestedDepartment) || null,
      resolvedDepartment: s(body.resolvedDepartment) || null,
      operatorUserId: s(body.operatorUserId) || null,
      operatorName: s(body.operatorName) || null,
      operatorJoinMode: s(body.operatorJoinMode || "live"),
      botActive: isTerminalSessionStatus(initialSessionStatus)
        ? false
        : b(body.botActive, true),
      operatorJoinRequested: b(body.operatorJoinRequested, false),
      operatorJoined: b(body.operatorJoined, false),
      whisperActive: b(body.whisperActive, false),
      takeoverActive: b(body.takeoverActive, false),
      leadPayload: isObj(body.leadPayload) ? body.leadPayload : {},
      transcriptLive: Array.isArray(body.transcriptLive) ? body.transcriptLive : [],
      summary: s(body.summary),
      meta: isObj(body.sessionMeta) ? body.sessionMeta : {},
      startedAt: body.startedAt || new Date().toISOString(),
      operatorRequestedAt: body.operatorRequestedAt || null,
      operatorJoinedAt: body.operatorJoinedAt || null,
      endedAt: ensureTerminalEndedAt(initialSessionStatus, body.endedAt || null),
    });
  } else {
    const nextSessionStatus = preserveSessionStatus(
      session.status,
      s(body.sessionStatus || session.status || "bot_active"),
      appliedGuards
    );
    session = await updateVoiceCallSession(db, session.id, {
      tenantId: s(body.tenantId) || session.tenantId || null,
      tenantKey: s(body.tenantKey || session.tenantKey),
      voiceCallId: call.id,
      providerConferenceSid:
        s(body.providerConferenceSid || body.conferenceSid || session.providerConferenceSid) ||
        null,
      conferenceName:
        s(body.conferenceName || session.conferenceName) ||
        buildConferenceName({
          tenantKey: body.tenantKey || session.tenantKey,
          providerCallSid,
        }),
      customerNumber:
        s(body.customerNumber || body.fromNumber || body.from || session.customerNumber) ||
        null,
      customerName: s(body.customerName || body.callerName || session.customerName) || null,
      direction: s(body.sessionDirection || session.direction || "outbound_callback"),
      status: nextSessionStatus,
      requestedDepartment: s(body.requestedDepartment || session.requestedDepartment) || null,
      resolvedDepartment: s(body.resolvedDepartment || session.resolvedDepartment) || null,
      operatorUserId: s(body.operatorUserId || session.operatorUserId) || null,
      operatorName: s(body.operatorName || session.operatorName) || null,
      operatorJoinMode: s(body.operatorJoinMode || session.operatorJoinMode || "live"),
      botActive: isTerminalSessionStatus(nextSessionStatus)
        ? false
        : b(body.botActive, session.botActive),
      operatorJoinRequested: b(body.operatorJoinRequested, session.operatorJoinRequested),
      operatorJoined: b(body.operatorJoined, session.operatorJoined),
      whisperActive: b(body.whisperActive, session.whisperActive),
      takeoverActive: b(body.takeoverActive, session.takeoverActive),
      leadPayload: isObj(body.leadPayload) ? body.leadPayload : session.leadPayload,
      transcriptLive: Array.isArray(body.transcriptLive)
        ? body.transcriptLive
        : session.transcriptLive,
      summary: s(body.summary || session.summary),
      meta: isObj(body.sessionMeta) ? body.sessionMeta : session.meta,
      operatorRequestedAt: body.operatorRequestedAt || session.operatorRequestedAt || null,
      operatorJoinedAt: body.operatorJoinedAt || session.operatorJoinedAt || null,
      endedAt: ensureTerminalEndedAt(
        nextSessionStatus,
        body.endedAt || session.endedAt || null
      ),
    });
  }

  return { call, session, appliedGuards };
}
