import {
  getVoiceCallByProviderSid,
  getVoiceCallSessionByProviderCallSid,
} from "../../../db/helpers/voice.js";
import { getTenantBrainRuntime } from "../../../services/businessBrain/getTenantBrainRuntime.js";
import { buildVoiceReplayPayload } from "../../../services/voiceReplayTrace.js";
import { appendVoiceEventStrict } from "../runtime.js";
import { s } from "../shared.js";
import { obj } from "./primitives.js";

export async function appendVoiceConflictEvent({
  db,
  providerCallSid,
  eventType,
  payload,
  mutationOutcome = "rejected",
  getRuntime = getTenantBrainRuntime,
}) {
  const call = await getVoiceCallByProviderSid(db, providerCallSid);
  if (!call?.id) return;

  const session = await getVoiceCallSessionByProviderCallSid(db, providerCallSid);
  const event = await appendVoiceEventStrict(db, {
    callId: call.id,
    tenantId: call.tenantId,
    tenantKey: call.tenantKey,
    eventType,
    actor: "voice_backend",
    payload: await buildVoiceReplayPayload({
      db,
      tenantId: call.tenantId || session?.tenantId,
      tenantKey: call.tenantKey || session?.tenantKey,
      eventType,
      getRuntime,
      payload: {
        ...obj(payload),
        mutationOutcome: s(mutationOutcome || "rejected"),
      },
    }),
  });
  return {
    call,
    session,
    event,
    mutationOutcome,
  };
}


