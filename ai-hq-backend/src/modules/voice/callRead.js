import {
  listVoiceCallEvents,
  listVoiceCallSessions,
} from "../../db/helpers/voice.js";
import { buildVoiceEventInspect } from "../../services/operatorReplayInspect.js";
import { n, s } from "./shared.js";

export async function readVoiceCallDetails({ db, call } = {}) {
  const events = (await listVoiceCallEvents(db, call.id)).map((event) => ({
    ...event,
    inspect: buildVoiceEventInspect(event),
  }));

  return {
    call,
    events,
    inspect: events.at(-1)?.inspect || null,
  };
}

export async function readVoiceCallEvents({ db, call } = {}) {
  const events = (await listVoiceCallEvents(db, call.id)).map((event) => ({
    ...event,
    inspect: buildVoiceEventInspect(event),
  }));

  return {
    events,
    inspect: events.at(-1)?.inspect || null,
  };
}

export async function listVoiceCallSessionsForCall({
  db,
  tenantId,
  call,
  status = "",
  limit = 100,
} = {}) {
  const allSessions = await listVoiceCallSessions(db, {
    tenantId,
    status: s(status),
    limit: Math.max(1, Math.min(200, n(limit, 100))),
  });

  const callId = s(call?.id);

  return allSessions.filter((x) => {
    return (
      s(x?.callId) === callId ||
      s(x?.call_id) === callId ||
      s(x?.voiceCallId) === callId ||
      s(x?.voice_call_id) === callId
    );
  });
}
