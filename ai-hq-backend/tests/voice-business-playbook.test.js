import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVoiceBusinessPlaybook,
  buildVoiceBusinessScopeGuard,
  normalizeVoiceBusinessFamily,
} from "../src/modules/voice/businessPlaybooks.js";
import {
  analyzeVoiceActionState,
} from "../src/modules/voice/callState.js";
import {
  buildLiveVoiceInstructions,
} from "../src/modules/voice/engine/browserRealtimeSession.js";

test("voice business playbook normalizes clinic and restaurant families", () => {
  assert.equal(normalizeVoiceBusinessFamily("stomatology clinic"), "clinic");
  assert.equal(normalizeVoiceBusinessFamily("premium restaurant"), "restaurant");
});

test("clinic playbook is available through live voice instructions", () => {
  const instructions = buildLiveVoiceInstructions({
    runtimeApplied: true,
    runtimeConfig: {
      companyName: "Demo Clinic",
      businessType: "clinic",
      defaultLanguage: "az",
    },
  });

  assert.match(instructions, /Clinic \/ dental \/ aesthetic receptionist playbook/);
  assert.match(instructions, /Do not give medical diagnosis/);
});

test("restaurant playbook avoids fake confirmed order behavior", () => {
  const playbook = buildVoiceBusinessPlaybook({
    businessType: "restaurant",
  }).join("\n");

  assert.match(playbook, /order request capture/);
  assert.match(playbook, /Do not claim an order is confirmed/);
});

test("business scope guard is owned by business playbooks", () => {
  const guard = buildVoiceBusinessScopeGuard().join("\n");

  assert.match(guard, /Business scope guard/);
  assert.match(guard, /approved business type, supported intents, and approved services/);
  assert.match(guard, /If the business is a restaurant and the caller asks for a hotel room/);
});

test("voice call state ignores browser_lab as a real phone number", () => {
  const state = analyzeVoiceActionState({
    actionName: "create_handoff_request",
    args: {
      reason: "price confirmation",
      summary: "Caller wants price confirmation.",
    },
    call: {
      fromNumber: "browser_lab",
    },
    runtimeConfig: {
      defaultLanguage: "az",
    },
  });

  assert.equal(state.ok, false);
  assert.equal(state.nextMissing.field, "phone");
  assert.equal(state.nextPromptHint.field, "phone");
  assert.equal("nextQuestion" in state, false);
});
