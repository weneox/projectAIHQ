import {
  buildVoiceConfigFromProjectedRuntime,
  upsertCallAndSession,
  appendVoiceEventStrict,
  emitVoiceMutationRealtime,
  runVoiceMutationTransaction,
  s,
  b,
  isObj,
  normalizeTranscriptItem,
  buildVoiceInternalErrorResult,
  buildVoiceInternalOkResult,
  buildVoiceInternalPayloadResult,
  obj,
  arr,
  firstNonEmpty,
  pickBoolean,
  pickArray,
  lower,
  buildTranscriptFingerprint,
  isDuplicateTranscriptFrame,
  buildTranscriptLine,
  isTerminalSessionStatus,
  buildSessionStateConflict,
  buildProjectionContact,
  buildServiceProjectionEntry,
  buildVoiceAuthorityDetails,
  normalizeRuntimeTenantRow,
  normalizedRuntimeTenantId,
  buildStableTenantScope,
  normalizeProjectedRuntimeForVoice,
  buildVoiceProjectedRuntime,
  loadTenantRowDirect,
  resolveVoiceTenantContext,
  processVoiceTenantConfig,
  appendVoiceConflictEvent,
  processVoiceSessionUpsert,
} from "../modules/voice/internal/index.js";

import {
  getVoiceCallByProviderSid,
  updateVoiceCall,
  getVoiceCallSessionByProviderCallSid,
  updateVoiceCallSession,
} from "../db/helpers/voice.js";

import {
  getTenantBrainRuntime,
  isRuntimeAuthorityError,
} from "./businessBrain/getTenantBrainRuntime.js";
import { buildOperationalChannels } from "./operationalChannels.js";
import { buildVoiceReplayPayload } from "./voiceReplayTrace.js";

export { processVoiceTenantConfig, processVoiceSessionUpsert };

export async function processVoiceTranscript({
  db,
  wsHub = null,
  logger = null,
  providerCallSid,
  text,
  role,
  ts,
  getRuntime = getTenantBrainRuntime,
}) {
  const committed = await runVoiceMutationTransaction(db, async (tx) => {
    const session = await getVoiceCallSessionByProviderCallSid(
      tx,
      providerCallSid
    );
    if (!session) {
      return buildVoiceInternalErrorResult({
        statusCode: 404,
        error: "voice_session_not_found",
      });
    }

    const transcriptLive = Array.isArray(session.transcriptLive)
      ? [...session.transcriptLive]
      : [];

    const nextItem = normalizeTranscriptItem({ ts, role, text });
    if (isDuplicateTranscriptFrame(transcriptLive, nextItem)) {
      const call = await getVoiceCallByProviderSid(tx, providerCallSid);
      const event = call?.id
        ? await appendVoiceEventStrict(tx, {
            callId: call.id,
            tenantId: call.tenantId,
            tenantKey: call.tenantKey,
            eventType: "transcript_ignored",
            actor: "voice_backend",
            payload: await buildVoiceReplayPayload({
              db: tx,
              tenantId: call.tenantId || session.tenantId,
              tenantKey: call.tenantKey || session.tenantKey,
              eventType: "transcript_ignored",
              getRuntime,
              payload: {
                reasonCode: "duplicate_transcript_frame",
                role: nextItem.role,
                text: nextItem.text,
                ts: nextItem.ts,
                mutationOutcome: "ignored",
              },
            }),
          })
        : null;

      return buildVoiceInternalOkResult(
        {
          ok: true,
          call,
          session,
          event,
          appliedGuards: ["duplicate_transcript_ignored"],
        },
        {
          __voiceRealtime: {
            call,
            session,
            event,
            mutationOutcome: "ignored",
          },
        }
      );
    }

    transcriptLive.push(nextItem);
    while (transcriptLive.length > 100) transcriptLive.shift();

    const updatedSession = await updateVoiceCallSession(tx, session.id, {
      transcriptLive,
    });

    const call = await getVoiceCallByProviderSid(tx, providerCallSid);
    let updatedCall = call;
    let event = null;

    if (call) {
      const prev = s(call.transcript);
      const nextLine = buildTranscriptLine(role, text);
      const nextTranscript =
        prev.split("\n").at(-1) === nextLine ? prev : prev ? `${prev}\n${nextLine}` : nextLine;

      updatedCall = await updateVoiceCall(tx, call.id, {
        transcript: nextTranscript.slice(-30000),
      });

      event = await appendVoiceEventStrict(tx, {
        callId: call.id,
        tenantId: call.tenantId,
        tenantKey: call.tenantKey,
        eventType: "transcript_appended",
        actor: "voice_backend",
        payload: await buildVoiceReplayPayload({
          db: tx,
          tenantId: call.tenantId || updatedSession.tenantId,
          tenantKey: call.tenantKey || updatedSession.tenantKey,
          eventType: "transcript_appended",
          getRuntime,
          payload: {
            role,
            text,
            ts,
            mutationOutcome: "applied",
          },
        }),
      });
    }

    return buildVoiceInternalOkResult(
      {
        ok: true,
        call: updatedCall,
        session: updatedSession,
        event,
      },
      {
        __voiceRealtime: {
          call: updatedCall,
          session: updatedSession,
          event,
          mutationOutcome: "applied",
        },
      }
    );
  });

  if (!committed?.ok) {
    return committed;
  }

  emitVoiceMutationRealtime({
    wsHub,
    logger,
    ...obj(committed.__voiceRealtime),
  });

  return buildVoiceInternalPayloadResult(committed);
}

export async function processVoiceSessionState({
  db,
  wsHub = null,
  logger = null,
  providerCallSid,
  body = {},
  getRuntime = getTenantBrainRuntime,
}) {
  const committed = await runVoiceMutationTransaction(db, async (tx) => {
    const session = await getVoiceCallSessionByProviderCallSid(
      tx,
      providerCallSid
    );
    if (!session) {
      return buildVoiceInternalErrorResult({
        statusCode: 404,
        error: "voice_session_not_found",
      });
    }

    const requestedStatus = s(body?.status);
    if (isTerminalSessionStatus(session.status)) {
      const normalizedRequestedStatus = lower(requestedStatus);
      if (normalizedRequestedStatus && normalizedRequestedStatus !== lower(session.status)) {
      const conflict = buildSessionStateConflict({
        currentStatus: session.status,
        requestedStatus,
        eventType: body?.eventType,
      });

      const realtime = await appendVoiceConflictEvent({
        db: tx,
        providerCallSid,
        eventType: "session_state_rejected",
        payload: conflict.details,
        mutationOutcome: "rejected",
        getRuntime,
      });

      return {
        ...conflict,
        __voiceRealtime: realtime || null,
      };
    }
  }

    const patch = {
      status: s(requestedStatus || session.status),
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

    if (isTerminalSessionStatus(patch.status)) {
      patch.botActive = false;
      patch.endedAt = patch.endedAt || new Date().toISOString();
    }

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

    const updatedSession = await updateVoiceCallSession(tx, session.id, patch);

    const call = await getVoiceCallByProviderSid(tx, providerCallSid);
    let updatedCall = call;
    let event = null;

    if (call) {
      updatedCall = await updateVoiceCall(tx, call.id, {
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

      event = await appendVoiceEventStrict(tx, {
        callId: call.id,
        tenantId: call.tenantId,
        tenantKey: call.tenantKey,
        eventType: s(body?.eventType || "session_state_updated"),
        actor: "voice_backend",
        payload: await buildVoiceReplayPayload({
          db: tx,
          tenantId: call.tenantId || updatedSession.tenantId,
          tenantKey: call.tenantKey || updatedSession.tenantKey,
          eventType: s(body?.eventType || "session_state_updated"),
          getRuntime,
          payload: {
            sessionStatus: updatedSession.status,
            callStatus: updatedCall?.status,
            requestedDepartment: updatedSession.requestedDepartment,
            resolvedDepartment: updatedSession.resolvedDepartment,
            operatorJoinRequested: updatedSession.operatorJoinRequested,
            operatorJoined: updatedSession.operatorJoined,
            whisperActive: updatedSession.whisperActive,
            takeoverActive: updatedSession.takeoverActive,
            mutationOutcome: "applied",
          },
        }),
      });
    }

    return buildVoiceInternalOkResult(
      {
        ok: true,
        call: updatedCall,
        session: updatedSession,
        event,
        appliedGuards: [],
      },
      {
        __voiceRealtime: {
          call: updatedCall,
          session: updatedSession,
          event,
          mutationOutcome: "applied",
        },
      }
    );
  });

  if (!committed?.ok) {
    if (committed?.__voiceRealtime) {
      emitVoiceMutationRealtime({
        wsHub,
        logger,
        ...obj(committed.__voiceRealtime),
      });
    }
    return committed;
  }

  emitVoiceMutationRealtime({
    wsHub,
    logger,
    ...obj(committed.__voiceRealtime),
  });

  return buildVoiceInternalPayloadResult(committed);
}

export async function processVoiceOperatorJoin({
  db,
  wsHub = null,
  logger = null,
  providerCallSid,
  body = {},
  getRuntime = getTenantBrainRuntime,
}) {
  const committed = await runVoiceMutationTransaction(db, async (tx) => {
    const session = await getVoiceCallSessionByProviderCallSid(
      tx,
      providerCallSid
    );
    if (!session) {
      return buildVoiceInternalErrorResult({
        statusCode: 404,
        error: "voice_session_not_found",
      });
    }

    if (isTerminalSessionStatus(session.status)) {
      const conflict = buildSessionStateConflict({
        currentStatus: session.status,
        requestedStatus: "agent_live",
        eventType: "operator_joined",
      });

      const realtime = await appendVoiceConflictEvent({
        db: tx,
        providerCallSid,
        eventType: "operator_join_rejected",
        payload: {
          ...conflict.details,
          joinMode: lower(body?.operatorJoinMode || body?.joinMode || "live"),
        },
        mutationOutcome: "rejected",
        getRuntime,
      });

      return {
        ...conflict,
        __voiceRealtime: realtime || null,
      };
    }

    const joinMode = s(
      body?.operatorJoinMode || body?.joinMode || "live"
    ).toLowerCase();

    const updatedSession = await updateVoiceCallSession(tx, session.id, {
      status: joinMode === "whisper" ? "agent_whisper" : "agent_live",
      operatorUserId: s(body?.operatorUserId || session.operatorUserId) || null,
      operatorName: s(body?.operatorName || session.operatorName) || null,
      operatorJoinMode: joinMode,
      operatorJoinRequested: true,
      operatorJoined: true,
      whisperActive: joinMode === "whisper",
      takeoverActive:
        joinMode === "live" ? b(body?.takeoverActive, false) : false,
      botActive: b(body?.botActive, joinMode !== "live" ? true : false),
      operatorJoinedAt: body?.operatorJoinedAt || new Date().toISOString(),
    });

    const call = await getVoiceCallByProviderSid(tx, providerCallSid);
    let updatedCall = call;
    let event = null;

    if (call) {
      updatedCall = await updateVoiceCall(tx, call.id, {
        handoffRequested: true,
        handoffCompleted: true,
        handoffTarget:
          updatedSession.resolvedDepartment ||
          updatedSession.requestedDepartment ||
          call.handoffTarget ||
          null,
        agentMode: joinMode === "live" ? "human" : "hybrid",
      });

      event = await appendVoiceEventStrict(tx, {
        callId: call.id,
        tenantId: call.tenantId,
        tenantKey: call.tenantKey,
        eventType: "operator_joined",
        actor: "operator",
        payload: await buildVoiceReplayPayload({
          db: tx,
          tenantId: call.tenantId || updatedSession.tenantId,
          tenantKey: call.tenantKey || updatedSession.tenantKey,
          eventType: "operator_joined",
          getRuntime,
          payload: {
            operatorUserId: updatedSession.operatorUserId,
            operatorName: updatedSession.operatorName,
            operatorJoinMode: updatedSession.operatorJoinMode,
            takeoverActive: updatedSession.takeoverActive,
            sessionStatus: updatedSession.status,
            callStatus: updatedCall?.status,
            mutationOutcome: "applied",
          },
        }),
      });
    }

    return buildVoiceInternalOkResult(
      {
        ok: true,
        call: updatedCall,
        session: updatedSession,
        event,
      },
      {
        __voiceRealtime: {
          call: updatedCall,
          session: updatedSession,
          event,
          mutationOutcome: "applied",
        },
      }
    );
  });

  if (!committed?.ok) {
    if (committed?.__voiceRealtime) {
      emitVoiceMutationRealtime({
        wsHub,
        logger,
        ...obj(committed.__voiceRealtime),
      });
    }
    return committed;
  }

  emitVoiceMutationRealtime({
    wsHub,
    logger,
    ...obj(committed.__voiceRealtime),
  });

  return buildVoiceInternalPayloadResult(committed);
}

export async function processVoiceReportPing() {
  return buildVoiceInternalOkResult({
    ok: true,
    accepted: true,
  });
}
