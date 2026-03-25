import {
  getVoiceCallByProviderSid,
  updateVoiceCall,
  getVoiceCallSessionByProviderCallSid,
  updateVoiceCallSession,
} from "../db/helpers/voice.js";
import { buildVoiceConfigFromTenantRow } from "../routes/api/voice/config.js";
import { upsertCallAndSession } from "../routes/api/voice/mutations.js";
import { findTenantByKeyOrPhone } from "../routes/api/voice/repository.js";
import { appendEventSafe } from "../routes/api/voice/utils.js";
import { s, b, isObj, normalizePhone, normalizeTranscriptItem } from "../routes/api/voice/shared.js";

export async function processVoiceTenantConfig({ db, tenantKey, toNumber }) {
  const tenant = await findTenantByKeyOrPhone(db, {
    tenantKey,
    toNumber,
    normalizePhone,
  });

  if (!tenant) {
    return {
      ok: false,
      statusCode: 404,
      error: "tenant_not_found",
      tenantKey,
      toNumber,
    };
  }

  return {
    ok: true,
    statusCode: 200,
    payload: buildVoiceConfigFromTenantRow(tenant, { tenantKey, toNumber }),
  };
}

export async function processVoiceSessionUpsert({ db, body }) {
  const { call, session } = await upsertCallAndSession(db, body);

  await appendEventSafe(db, {
    callId: call.id,
    tenantId: call.tenantId,
    tenantKey: call.tenantKey,
    eventType: "session_upserted",
    actor: "voice_backend",
    payload: {
      callStatus: call.status,
      sessionStatus: session.status,
      conferenceName: session.conferenceName,
    },
  });

  return {
    ok: true,
    statusCode: 200,
    payload: {
      ok: true,
      call,
      session,
    },
  };
}

export async function processVoiceTranscript({
  db,
  providerCallSid,
  text,
  role,
  ts,
}) {
  const session = await getVoiceCallSessionByProviderCallSid(db, providerCallSid);
  if (!session) {
    return {
      ok: false,
      statusCode: 404,
      error: "voice_session_not_found",
    };
  }

  const transcriptLive = Array.isArray(session.transcriptLive)
    ? [...session.transcriptLive]
    : [];

  transcriptLive.push(normalizeTranscriptItem({ ts, role, text }));
  while (transcriptLive.length > 100) transcriptLive.shift();

  const updatedSession = await updateVoiceCallSession(db, session.id, {
    transcriptLive,
  });

  const call = await getVoiceCallByProviderSid(db, providerCallSid);
  let updatedCall = call;

  if (call) {
    const prev = s(call.transcript);
    const nextTranscript = prev ? `${prev}\n[${role}] ${text}` : `[${role}] ${text}`;

    updatedCall = await updateVoiceCall(db, call.id, {
      transcript: nextTranscript.slice(-30000),
    });

    await appendEventSafe(db, {
      callId: call.id,
      tenantId: call.tenantId,
      tenantKey: call.tenantKey,
      eventType: "transcript_appended",
      actor: "voice_backend",
      payload: { role, text, ts },
    });
  }

  return {
    ok: true,
    statusCode: 200,
    payload: {
      ok: true,
      call: updatedCall,
      session: updatedSession,
    },
  };
}

export async function processVoiceSessionState({
  db,
  providerCallSid,
  body = {},
}) {
  const session = await getVoiceCallSessionByProviderCallSid(db, providerCallSid);
  if (!session) {
    return {
      ok: false,
      statusCode: 404,
      error: "voice_session_not_found",
    };
  }

  const patch = {
    status: s(body?.status || session.status),
    requestedDepartment:
      s(body?.requestedDepartment || session.requestedDepartment) || null,
    resolvedDepartment:
      s(body?.resolvedDepartment || session.resolvedDepartment) || null,
    operatorUserId:
      s(body?.operatorUserId || session.operatorUserId) || null,
    operatorName: s(body?.operatorName || session.operatorName) || null,
    operatorJoinMode: s(
      body?.operatorJoinMode || session.operatorJoinMode || "live"
    ),
    botActive: b(body?.botActive, session.botActive),
    operatorJoinRequested: b(
      body?.operatorJoinRequested,
      session.operatorJoinRequested
    ),
    operatorJoined: b(body?.operatorJoined, session.operatorJoined),
    whisperActive: b(body?.whisperActive, session.whisperActive),
    takeoverActive: b(body?.takeoverActive, session.takeoverActive),
    summary: s(body?.summary || session.summary),
    endedAt: body?.endedAt || session.endedAt || null,
  };

  if (body?.operatorRequestedAt) {
    patch.operatorRequestedAt = body.operatorRequestedAt;
  }
  if (body?.operatorJoinedAt) {
    patch.operatorJoinedAt = body.operatorJoinedAt;
  }
  if (isObj(body?.leadPayload)) {
    patch.leadPayload = body.leadPayload;
  }
  if (isObj(body?.meta)) {
    patch.meta = body.meta;
  }

  const updatedSession = await updateVoiceCallSession(db, session.id, patch);

  const call = await getVoiceCallByProviderSid(db, providerCallSid);
  let updatedCall = call;

  if (call) {
    updatedCall = await updateVoiceCall(db, call.id, {
      status:
        patch.status === "completed"
          ? "completed"
          : patch.status === "failed"
            ? "failed"
            : call.status,
      handoffRequested: patch.operatorJoinRequested,
      handoffCompleted: patch.operatorJoined || patch.takeoverActive,
      handoffTarget: patch.resolvedDepartment || call.handoffTarget || null,
      summary: patch.summary || call.summary,
      endedAt: patch.endedAt || call.endedAt || null,
      meta: isObj(body?.callMeta) ? body.callMeta : call.meta,
    });

    await appendEventSafe(db, {
      callId: call.id,
      tenantId: call.tenantId,
      tenantKey: call.tenantKey,
      eventType: s(body?.eventType || "session_state_updated"),
      actor: "voice_backend",
      payload: {
        sessionStatus: updatedSession.status,
        requestedDepartment: updatedSession.requestedDepartment,
        resolvedDepartment: updatedSession.resolvedDepartment,
        operatorJoinRequested: updatedSession.operatorJoinRequested,
        operatorJoined: updatedSession.operatorJoined,
        whisperActive: updatedSession.whisperActive,
        takeoverActive: updatedSession.takeoverActive,
      },
    });
  }

  return {
    ok: true,
    statusCode: 200,
    payload: {
      ok: true,
      call: updatedCall,
      session: updatedSession,
    },
  };
}

export async function processVoiceOperatorJoin({
  db,
  providerCallSid,
  body = {},
}) {
  const session = await getVoiceCallSessionByProviderCallSid(db, providerCallSid);
  if (!session) {
    return {
      ok: false,
      statusCode: 404,
      error: "voice_session_not_found",
    };
  }

  const joinMode = s(
    body?.operatorJoinMode || body?.joinMode || "live"
  ).toLowerCase();

  const updatedSession = await updateVoiceCallSession(db, session.id, {
    status: joinMode === "whisper" ? "agent_whisper" : "agent_live",
    operatorUserId: s(body?.operatorUserId || session.operatorUserId) || null,
    operatorName: s(body?.operatorName || session.operatorName) || null,
    operatorJoinMode: joinMode,
    operatorJoinRequested: true,
    operatorJoined: true,
    whisperActive: joinMode === "whisper",
    takeoverActive: joinMode === "live" ? b(body?.takeoverActive, false) : false,
    botActive: b(body?.botActive, joinMode !== "live" ? true : false),
    operatorJoinedAt: body?.operatorJoinedAt || new Date().toISOString(),
  });

  const call = await getVoiceCallByProviderSid(db, providerCallSid);
  let updatedCall = call;

  if (call) {
    updatedCall = await updateVoiceCall(db, call.id, {
      handoffRequested: true,
      handoffCompleted: true,
      handoffTarget:
        updatedSession.resolvedDepartment ||
        updatedSession.requestedDepartment ||
        call.handoffTarget ||
        null,
      agentMode: joinMode === "live" ? "human" : "hybrid",
    });

    await appendEventSafe(db, {
      callId: call.id,
      tenantId: call.tenantId,
      tenantKey: call.tenantKey,
      eventType: "operator_joined",
      actor: "operator",
      payload: {
        operatorUserId: updatedSession.operatorUserId,
        operatorName: updatedSession.operatorName,
        operatorJoinMode: updatedSession.operatorJoinMode,
        takeoverActive: updatedSession.takeoverActive,
      },
    });
  }

  return {
    ok: true,
    statusCode: 200,
    payload: {
      ok: true,
      call: updatedCall,
      session: updatedSession,
    },
  };
}

export async function processVoiceReportPing() {
  return {
    ok: true,
    statusCode: 200,
    payload: {
      ok: true,
      accepted: true,
    },
  };
}
