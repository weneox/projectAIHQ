import test from "node:test";
import assert from "node:assert/strict";

import {
  applyVoiceInboxSinkDeliveryToCallPatch,
  buildVoiceActionCallPatch,
} from "../src/modules/voice/actions/voiceActionRuntime.js";

const requestRecord = {
  id: "voice_request:acme:voice-call-1:create_appointment_request:abc",
  requestType: "appointment_request",
  businessFamily: "clinic",
};

test("voice call patch links delivered inbox sink thread", () => {
  const basePatch = buildVoiceActionCallPatch({
    result: {
      action: "create_appointment_request",
      status: "request_recorded",
      requestId: requestRecord.id,
      requestRecord,
      payload: {
        service: "Dental consultation",
        customerName: "Nigar",
        phone: "+994501112233",
      },
    },
    call: {
      extraction: {
        previous: true,
      },
      meta: {
        existing: true,
      },
    },
  });

  const linkedPatch = applyVoiceInboxSinkDeliveryToCallPatch({
    callPatch: basePatch,
    sinkDelivery: {
      inbox: {
        status: "delivered",
        inboxThreadId: "inbox-thread-1",
      },
    },
    inboxSinkDelivery: {
      sink: "inbox",
      status: "delivered",
      inboxThreadId: "inbox-thread-1",
      inboxMessageId: "inbox-message-1",
    },
  });

  assert.equal(linkedPatch.inboxThreadId, "inbox-thread-1");
  assert.equal(linkedPatch.callbackRequested, true);
  assert.equal(linkedPatch.callbackPhone, "+994501112233");
  assert.equal(linkedPatch.extraction.previous, true);
  assert.equal(linkedPatch.extraction.voiceOutcome.requestRecord.id, requestRecord.id);
  assert.equal(linkedPatch.extraction.voiceOutcome.inboxSinkDelivery.inboxMessageId, "inbox-message-1");
  assert.equal(linkedPatch.meta.existing, true);
  assert.equal(linkedPatch.meta.lastVoiceAction.requestRecordId, requestRecord.id);
  assert.equal(linkedPatch.meta.lastVoiceAction.inboxThreadId, "inbox-thread-1");
});

test("voice call patch ignores inbox sink delivery without thread id", () => {
  const basePatch = {
    summary: "Voice request captured.",
    extraction: {
      voiceOutcome: {
        requestId: requestRecord.id,
      },
    },
    meta: {
      lastVoiceAction: {
        requestRecordId: requestRecord.id,
      },
    },
  };

  const linkedPatch = applyVoiceInboxSinkDeliveryToCallPatch({
    callPatch: basePatch,
    sinkDelivery: {
      inbox: {
        status: "not_configured",
      },
    },
    inboxSinkDelivery: {
      sink: "inbox",
      status: "not_configured",
    },
  });

  assert.deepEqual(linkedPatch, basePatch);
});
