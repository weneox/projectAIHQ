import { getTenantBrainRuntime } from "../../../services/businessBrain/getTenantBrainRuntime.js";
import { buildVoiceReplayPayload } from "../../../services/voiceReplayTrace.js";
import { upsertCallAndSession } from "../mutations.js";
import {
  appendVoiceEventStrict,
  emitVoiceMutationRealtime,
  runVoiceMutationTransaction,
} from "../runtime.js";
import { buildVoiceInternalOkResult } from "./response.js";

export async function processVoiceSessionUpsert({
  db,
  wsHub = null,
  logger = null,
  body,
  getRuntime = getTenantBrainRuntime,
}) {
  const committed = await runVoiceMutationTransaction(db, async (tx) => {
    const { call, session, appliedGuards = [] } = await upsertCallAndSession(tx, body);
    const event = await appendVoiceEventStrict(tx, {
      callId: call.id,
      tenantId: call.tenantId,
      tenantKey: call.tenantKey,
      eventType: "session_upserted",
      actor: "voice_backend",
      payload: await buildVoiceReplayPayload({
        db: tx,
        tenantId: call.tenantId || session.tenantId,
        tenantKey: call.tenantKey || session.tenantKey,
        eventType: "session_upserted",
        getRuntime,
        payload: {
          callStatus: call.status,
          sessionStatus: session.status,
          conferenceName: session.conferenceName,
          appliedGuards,
          mutationOutcome: "applied",
        },
      }),
    });

    return { call, session, event, appliedGuards };
  });

  emitVoiceMutationRealtime({
    wsHub,
    logger,
    call: committed.call,
    session: committed.session,
    event: committed.event,
    mutationOutcome: "applied",
  });

  return buildVoiceInternalOkResult({
    ok: true,
    call: committed.call,
    session: committed.session,
    event: committed.event,
    appliedGuards: committed.appliedGuards,
  });
}


