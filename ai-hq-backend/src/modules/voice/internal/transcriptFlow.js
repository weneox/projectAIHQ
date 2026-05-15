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
import { normalizeTranscriptItem, s } from "../shared.js";
import { buildTranscriptLine, isDuplicateTranscriptFrame } from "./transcript.js";
import {
  buildVoiceInternalErrorResult,
  buildVoiceInternalOkResult,
  buildVoiceInternalPayloadResult,
} from "./response.js";
import { obj } from "./primitives.js";

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


