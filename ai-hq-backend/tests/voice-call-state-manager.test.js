import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeVoiceActionState,
  buildVoiceStateInstruction,
} from "../src/modules/voice/callState.js";
import {
  executeVoiceAction,
} from "../src/modules/voice/actions/voiceActionRuntime.js";

test("voice call state manager returns one structured next prompt hint", () => {
  const state = analyzeVoiceActionState({
    actionName: "create_appointment_request",
    args: {
      service: "implant consultation",
      phone: "+994501112233",
    },
    runtimeConfig: {
      defaultLanguage: "az",
    },
  });

  assert.equal(state.ok, false);
  assert.equal(state.nextMissing.field, "preferredDateOrTime");
  assert.equal(state.nextPromptHint.field, "preferredDateOrTime");
  assert.equal("nextQuestion" in state, false);
});

test("voice call state instruction stays internal and blocks fake completion", () => {
  const state = analyzeVoiceActionState({
    actionName: "create_handoff_request",
    args: {
      reason: "price confirmation",
    },
    runtimeConfig: {
      defaultLanguage: "az",
    },
  });

  const instruction = buildVoiceStateInstruction(state);

  assert.equal(typeof instruction, "string");
  assert.notEqual(instruction.trim(), "");
  assert.doesNotMatch(instruction, /booking.*confirmed/i);
  assert.doesNotMatch(instruction, /order.*confirmed/i);
});

test("voice action runtime returns structured hint when required fields are missing", async () => {
  const result = await executeVoiceAction({
    name: "create_appointment_request",
    args: {
      service: "implant consultation",
      phone: "+994501112233",
    },
    call: {
      id: "call_1",
      language: "az",
    },
    scope: {
      tenantId: "tenant_1",
      tenantKey: "clinic",
    },
    runtimeConfig: {
      appointmentMode: "request_only",
      defaultLanguage: "az",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "missing_required_fields");
  assert.equal(result.nextMissing.field, "preferredDateOrTime");
  assert.equal(result.nextPromptHint.field, "preferredDateOrTime");
  assert.equal("nextQuestion" in result, false);
  assert.equal(result.voiceState.complete, false);
});

test("voice call state manager accepts complete appointment request", () => {
  const state = analyzeVoiceActionState({
    actionName: "create_appointment_request",
    args: {
      service: "implant consultation",
      date: "sabah",
      customerName: "Nigar",
      phone: "+994501112233",
    },
    runtimeConfig: {
      defaultLanguage: "az",
    },
  });

  assert.equal(state.ok, true);
  assert.equal(state.complete, true);
  assert.equal("nextQuestion" in state, false);
});
