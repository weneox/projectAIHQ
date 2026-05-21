import assert from "node:assert/strict";
import test from "node:test";

import {
  executeVoiceAction,
  VOICE_ACTION_RESULT_STATUS,
} from "../src/modules/voice/actions/voiceActionRuntime.js";

test("voice action runtime returns server-authored next question instructions for missing fields", async () => {
  const result = await executeVoiceAction({
    name: "create_appointment_request",
    args: {
      service: "Dental consultation",
    },
    call: {
      id: "call-1",
      language: "az",
      fromNumber: "browser",
    },
    scope: {
      tenantId: "tenant-1",
      tenantKey: "acme",
    },
    runtimeConfig: {
      defaultLanguage: "az",
      businessFamily: "clinic",
      appointmentMode: "request_only",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, VOICE_ACTION_RESULT_STATUS.MISSING_REQUIRED_FIELDS);
  assert.equal(result.confirmed, false);
  assert.equal(result.nextMissing?.field, "preferredDateOrTime");
  assert.match(result.nextQuestion, /hansı gün və ya saat/i);
  assert.match(result.assistantInstruction, /Ask exactly this one question next/i);
  assert.match(result.assistantInstruction, /Sizə hansı gün və ya saat daha uyğundur/i);
  assert.doesNotMatch(result.assistantInstruction, /booking.*confirmed/i);
});
