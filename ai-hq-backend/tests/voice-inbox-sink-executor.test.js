import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVoiceBusinessActionInboxInput,
  buildVoiceBusinessActionInboxText,
  createVoiceBusinessActionInboxSinkExecutor,
} from "../src/modules/inbox/voiceBusinessActionSink.js";

const requestRecord = {
  id: "voice_request:hotel-demo:call-1:create_appointment_request:abc",
  tenantId: "11111111-1111-1111-1111-111111111111",
  tenantKey: "hotel-demo",
  callId: "call-1",
  sessionId: "session-1",
  actionName: "create_appointment_request",
  requestType: "appointment_request",
  businessFamily: "hotel",
  priority: "normal",
  summary: "Spa consultation | tomorrow | Nigar | +994501112233",
  customer: {
    name: "Nigar",
    phone: "+994501112233",
  },
  payload: {
    service: "Spa consultation",
    date: "tomorrow",
  },
};

test("voice inbox sink builds operator-readable text", () => {
  const text = buildVoiceBusinessActionInboxText(requestRecord);

  assert.match(text, /Spa consultation/);
  assert.match(text, /appointment_request/);
  assert.match(text, /Nigar/);
  assert.match(text, /\+994501112233/);
  assert.match(text, /voice_request:/);
});

test("voice inbox sink maps request record to inbox ingest input", () => {
  const input = buildVoiceBusinessActionInboxInput({ requestRecord });

  assert.equal(input.tenantId, requestRecord.tenantId);
  assert.equal(input.tenantKey, "hotel-demo");
  assert.equal(input.channel, "voice");
  assert.equal(input.externalThreadId, "voice:call:call-1");
  assert.equal(input.externalUserId, "+994501112233");
  assert.equal(input.externalMessageId, requestRecord.id);
  assert.equal(input.customerName, "Nigar");
  assert.equal(input.meta.source, "voice_business_action_sink");
  assert.equal(input.meta.voice.requestRecord.id, requestRecord.id);
});

test("voice inbox sink executor fails closed without db", async () => {
  const executor = createVoiceBusinessActionInboxSinkExecutor({ db: null });
  const result = await executor({ requestRecord });

  assert.equal(result.ok, false);
  assert.equal(result.sink, "inbox");
  assert.equal(result.status, "not_configured");
  assert.equal(result.reasonCode, "voice_inbox_sink_db_unavailable");
});
