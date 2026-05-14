import {
  getVoiceCallById,
  getVoiceCallSessionById,
  updateVoiceCall,
  updateVoiceCallSession,
} from "../../db/helpers/voice.js";
import { getTenantBrainRuntime } from "../../services/businessBrain/getTenantBrainRuntime.js";
import { buildVoiceReplayPayload } from "../../services/voiceReplayTrace.js";
import { s, sameTenant } from "./shared.js";
import { getSessionCallId } from "./publicRead.js";
import {
  buildSessionStateConflict,
  isTerminalSessionStatus,
  lower,
  obj,
} from "./operatorState.js";
import {
  appendVoiceEventStrict,
  emitVoiceMutationRealtime,
  runVoiceMutationTransaction,
} from "./runtime.js";

export async function applyOperatorVoiceMutation({
  db,
  wsHub = null,
  logger = null,
  scope,
  callId = "",
  sessionId = "",
  eventType = "",
  rejectEventType = "",
  ignoredEventType = "",
  eventActor = "operator",
  sessionPatch = {},
  buildCallPatch = null,
  buildEventPayload = null,
  terminalBehavior = "reject",
  getRuntime = getTenantBrainRuntime,
} = {}) {
  const committed = await runVoiceMutationTransaction(db, async (tx) => {
    const currentSession = await getVoiceCallSessionById(tx, sessionId);
    if (!currentSession?.id) {
      return {
        ok: false,
        statusCode: 404,
        error: "voice_session_not_found",
      };
    }

    if (!sameTenant(currentSession.tenantId ?? currentSession.tenant_id, scope?.tenantId)) {
      return {
        ok: false,
        statusCode: 403,
        error: "forbidden",
      };
    }

    const resolvedCallId = s(callId || getSessionCallId(currentSession));
    const currentCall = resolvedCallId ? await getVoiceCallById(tx, resolvedCallId) : null;
    if (!currentCall?.id) {
      return {
        ok: false,
        statusCode: 404,
        error: "voice_call_not_found",
      };
    }

    if (!sameTenant(currentCall.tenantId ?? currentCall.tenant_id, scope?.tenantId)) {
      return {
        ok: false,
        statusCode: 403,
        error: "forbidden",
      };
    }

    const requestedStatus = s(sessionPatch?.status || currentSession.status);
    if (isTerminalSessionStatus(currentSession.status)) {
      if (
        terminalBehavior === "ignore" &&
        lower(requestedStatus) === lower(currentSession.status)
      ) {
        const event = await appendVoiceEventStrict(tx, {
          callId: currentCall.id,
          tenantId: currentCall.tenantId,
          tenantKey: currentCall.tenantKey,
          eventType: s(ignoredEventType || `${eventType}_ignored`),
          actor: eventActor,
          payload: await buildVoiceReplayPayload({
            db: tx,
            tenantId: currentCall.tenantId || currentSession.tenantId,
            tenantKey: currentCall.tenantKey || currentSession.tenantKey,
            eventType: s(ignoredEventType || `${eventType}_ignored`),
            getRuntime,
            payload: {
              ...obj(
                typeof buildEventPayload === "function"
                  ? buildEventPayload({
                      call: currentCall,
                      session: currentSession,
                      previousCall: currentCall,
                      previousSession: currentSession,
                    })
                  : buildEventPayload
              ),
              reasonCode: "already_terminal",
              currentStatus: lower(currentSession.status),
              requestedStatus: lower(requestedStatus),
              mutationOutcome: "ignored",
            },
          }),
        });

        return {
          ok: true,
          statusCode: 200,
          payload: {
            call: currentCall,
            session: currentSession,
            mutationOutcome: "ignored",
          },
          __voiceRealtime: {
            call: currentCall,
            session: currentSession,
            event,
            mutationOutcome: "ignored",
          },
        };
      }

      const conflict = buildSessionStateConflict({
        currentStatus: currentSession.status,
        requestedStatus,
        eventType,
      });
      const event = await appendVoiceEventStrict(tx, {
        callId: currentCall.id,
        tenantId: currentCall.tenantId,
        tenantKey: currentCall.tenantKey,
        eventType: s(rejectEventType || `${eventType}_rejected`),
        actor: eventActor,
        payload: await buildVoiceReplayPayload({
          db: tx,
          tenantId: currentCall.tenantId || currentSession.tenantId,
          tenantKey: currentCall.tenantKey || currentSession.tenantKey,
          eventType: s(rejectEventType || `${eventType}_rejected`),
          getRuntime,
          payload: {
            ...obj(
              typeof buildEventPayload === "function"
                ? buildEventPayload({
                    call: currentCall,
                    session: currentSession,
                    previousCall: currentCall,
                    previousSession: currentSession,
                  })
                : buildEventPayload
            ),
            ...conflict.details,
            mutationOutcome: "rejected",
          },
        }),
      });

      return {
        ...conflict,
        __voiceRealtime: {
          call: currentCall,
          session: currentSession,
          event,
          mutationOutcome: "rejected",
        },
      };
    }

    const updatedSession = await updateVoiceCallSession(tx, currentSession.id, sessionPatch);
    const callPatch =
      typeof buildCallPatch === "function"
        ? buildCallPatch({
            call: currentCall,
            session: updatedSession,
            previousSession: currentSession,
          })
        : buildCallPatch;
    const updatedCall = callPatch
      ? await updateVoiceCall(tx, currentCall.id, callPatch)
      : currentCall;
    const eventPayload =
      typeof buildEventPayload === "function"
        ? buildEventPayload({
            call: updatedCall,
            session: updatedSession,
            previousCall: currentCall,
            previousSession: currentSession,
          })
        : buildEventPayload;
    const event = await appendVoiceEventStrict(tx, {
      callId: currentCall.id,
      tenantId: currentCall.tenantId,
      tenantKey: currentCall.tenantKey,
      eventType,
      actor: eventActor,
      payload: await buildVoiceReplayPayload({
        db: tx,
        tenantId: currentCall.tenantId || updatedSession.tenantId,
        tenantKey: currentCall.tenantKey || updatedSession.tenantKey,
        eventType,
        getRuntime,
        payload: {
          ...obj(eventPayload),
          mutationOutcome: "applied",
        },
      }),
    });

    return {
      ok: true,
      statusCode: 200,
      payload: {
        call: updatedCall,
        session: updatedSession,
        mutationOutcome: "applied",
      },
      __voiceRealtime: {
        call: updatedCall,
        session: updatedSession,
        event,
        mutationOutcome: "applied",
      },
    };
  });

  if (committed?.__voiceRealtime) {
    emitVoiceMutationRealtime({
      wsHub,
      logger,
      ...obj(committed.__voiceRealtime),
    });
  }

  return committed;
}


