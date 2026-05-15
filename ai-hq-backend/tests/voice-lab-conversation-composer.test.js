import test from "node:test";
import assert from "node:assert/strict";

import { buildVoiceLabConversationInstructions } from "../src/modules/voice/conversationComposer.js";

test("voice lab conversation composer combines scenario and tenant runtime guardrails", () => {
  const instructions = buildVoiceLabConversationInstructions({
    baseInstructions: "Base receptionist prompt.",
    scenarioId: "appointment_booking",
    runtimeApplied: true,
    runtimeConfig: {
      companyName: "Dental Prime",
      defaultLanguage: "az",
      realtime: {
        instructions: "Tenant realtime instruction.",
      },
      voiceProfile: {
        assistantName: "Ayla",
        roleLabel: "clinic receptionist",
        businessSummary: "Dental Prime is a dental clinic in Baku.",
        allowedTopics: ["appointments", "services", "working hours"],
        forbiddenTopics: ["medical diagnosis", "guaranteed treatment results"],
        answerStyle: "short_clear",
        askStyle: "single_question",
      },
      voiceBehavior: {
        qualificationQuestions: ["Which service do you need?", "Which day is better?"],
        handoffTriggers: ["angry caller", "medical advice"],
        disallowedClaims: ["guaranteed treatment results"],
        toneProfile: "professional_warm",
      },
      contact: {
        phoneIntl: "+994501112233",
        website: "https://example.test",
      },
      activeVoiceChannel: {
        id: "browser_lab",
        provider: "browser_lab",
      },
    },
  });

  assert.match(instructions, /Dental Prime/);
  assert.match(instructions, /Appointment booking/);
  assert.match(instructions, /Approved business context/);
  assert.match(instructions, /Do not invent prices/);
  assert.match(instructions, /Human handoff triggers/);
  assert.match(instructions, /medical diagnosis/);
  assert.match(instructions, /Stay in character/);
});

test("voice lab conversation composer stays safe without runtime", () => {
  const instructions = buildVoiceLabConversationInstructions({
    baseInstructions: "Manual lab prompt.",
    scenarioId: "business_faq",
    runtimeApplied: false,
  });

  assert.match(instructions, /Manual lab prompt/);
  assert.match(instructions, /Business info/);
  assert.match(instructions, /manual\/lab fallback/i);
  assert.match(instructions, /extra careful not to invent business facts/i);
});
