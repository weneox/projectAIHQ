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
import { b, isObj, s } from "../shared.js";
import { appendVoiceConflictEvent } from "./conflictEvent.js";
import { obj } from "./primitives.js";
import {
  buildVoiceInternalErrorResult,
  buildVoiceInternalOkResult,
  buildVoiceInternalPayloadResult,
} from "./response.js";
import {
  buildSessionStateConflict,
  isTerminalSessionStatus,
} from "./sessionState.js";
import { lower } from "./primitives.js";

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


