import {
  getVoiceCallByProviderSid,
  getVoiceCallSessionByProviderCallSid,
  updateVoiceCall,
  updateVoiceCallSession,
} from "../../../db/helpers/voice.js";
import { getTenantBrainRuntime } from "../../../services/businessBrain/getTenantBrainRuntime.js";
import { buildVoiceReplayPayload } from "../../../services/voiceReplayTrace.js";
import {
  appendVoiceEventStrict,
  emitVoiceMutationRealtime,
  runVoiceMutationTransaction,
} from "../runtime.js";
import { b, s } from "../shared.js";
import { appendVoiceConflictEvent } from "./conflictEvent.js";
import { lower, obj } from "./primitives.js";
import {
  buildVoiceInternalErrorResult,
  buildVoiceInternalOkResult,
  buildVoiceInternalPayloadResult,
} from "./response.js";
import {
  buildSessionStateConflict,
  isTerminalSessionStatus,
} from "./sessionState.js";

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


