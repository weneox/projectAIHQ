import { appendVoiceCallEvent } from "../../db/helpers/voice.js";
import { emitRealtimeEvent } from "../../realtime/events.js";
import { s } from "./shared.js";

export async function runVoiceMutationTransaction(db, work) {
  if (!db?.query) {
    throw new Error("voice_db_unavailable");
  }

  const client = typeof db.connect === "function" ? await db.connect() : db;
  let began = false;

  try {
    await client.query("BEGIN");
    began = true;
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    if (began) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }
    throw error;
  } finally {
    if (client !== db && typeof client?.release === "function") {
      client.release();
    }
  }
}

export async function appendVoiceEventStrict(db, payload = {}) {
  const event = await appendVoiceCallEvent(db, payload);
  if (!event?.id) {
    throw new Error("voice_event_record_failed");
  }
  return event;
}

export function emitVoiceMutationRealtime({
  wsHub,
  logger = null,
  call = null,
  session = null,
  event = null,
  mutationOutcome = "applied",
} = {}) {
  const tenantKey = s(
    call?.tenantKey ||
      call?.tenant_key ||
      session?.tenantKey ||
      session?.tenant_key ||
      event?.tenantKey ||
      event?.tenant_key
  );
  const tenantId = s(
    call?.tenantId ||
      call?.tenant_id ||
      session?.tenantId ||
      session?.tenant_id ||
      event?.tenantId ||
      event?.tenant_id
  );

  const callUpdated = emitRealtimeEvent(
    wsHub,
    {
      type: "voice.call.updated",
      audience: "operator",
      tenantKey,
      tenantId,
      call,
      session,
      event,
      mutationOutcome: s(mutationOutcome || "applied"),
    },
    { logger }
  );

  const eventCreated = event
    ? emitRealtimeEvent(
        wsHub,
        {
          type: "voice.event.created",
          audience: "operator",
          tenantKey,
          tenantId,
          event,
          call,
          session,
          mutationOutcome: s(mutationOutcome || "applied"),
        },
        { logger }
      )
    : false;

  return {
    callUpdated,
    eventCreated,
  };
}
