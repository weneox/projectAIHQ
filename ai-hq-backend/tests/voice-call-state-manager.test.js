import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeVoiceActionState,
  buildVoiceStateInstruction,
} from "../src/modules/voice/callState.js";
import {
  executeVoiceAction,
} from "../src/modules/voice/actions/voiceActionRuntime.js";

test("voice call state manager asks one natural Azerbaijani next question", () => {
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
  assert.equal(state.nextQuestion, "Sizə hansı gün və ya saat daha uyğundur?");
});

test("voice call state instruction blocks multi-field request creation", () => {
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

  assert.match(instruction, /Ask exactly this one question next/);
  assert.match(instruction, /Əlaqə nömrənizi qeyd edə bilərəm/);
  assert.match(instruction, /Do not ask multiple missing fields/);
});

test("voice action runtime returns nextQuestion when required fields are missing", async () => {
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
  assert.equal(result.nextQuestion, "Sizə hansı gün və ya saat daha uyğundur?");
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
  assert.equal(state.nextQuestion, "");
});
