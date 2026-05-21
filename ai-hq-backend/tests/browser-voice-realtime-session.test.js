import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBrowserRealtimeSessionPlan,
  normalizeBrowserVoiceModel,
  normalizeBrowserVoiceName,
} from "../src/modules/voice/engine/browserRealtimeSession.js";

test("browser voice session plan builds live runtime without scenario bias", () => {
  const plan = buildBrowserRealtimeSessionPlan({
    requestedModel: "gpt-realtime-2",
    requestedVoice: "alloy",
    baseInstructions: "Base receptionist prompt.",
    runtimeApplied: true,
    runtimeConfig: {
      companyName: "Dental Prime",
      defaultLanguage: "az",
      voiceProfile: {
        assistantName: "Ayla",
        roleLabel: "clinic receptionist",
        businessSummary: "Dental Prime is a dental clinic in Baku.",
        allowedTopics: ["appointments", "services", "working hours"],
        forbiddenTopics: ["medical diagnosis"],
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

  assert.equal(plan.model, "gpt-realtime-1.5");
  assert.equal(plan.voice, "coral");

  assert.match(plan.instructions, /Dental Prime/);
  assert.match(plan.instructions, /Live voice assistant brain/);
  assert.match(plan.instructions, /Do not assume booking/);
  assert.match(plan.instructions, /Approved business context/);
  assert.match(plan.instructions, /Human handoff triggers/);
  assert.match(plan.instructions, /medical diagnosis/);

  assert.doesNotMatch(plan.instructions, /Voice Lab canonical scenario/);
  assert.doesNotMatch(plan.instructions, /Caller roleplay script/);
  assert.doesNotMatch(plan.instructions, /Appointment booking/);

  assert.equal(plan.clientSecretRequest.session.type, "realtime");
  assert.equal(plan.clientSecretRequest.session.model, "gpt-realtime-1.5");
  assert.equal(plan.clientSecretRequest.session.audio.output.voice, "coral");
  assert.equal(
    plan.clientSecretRequest.session.audio.input.turn_detection.create_response,
    true
  );
  assert.equal(
    plan.clientSecretRequest.session.audio.input.turn_detection.interrupt_response,
    false
  );

  assert.equal(plan.openingResponse.enabled, true);
  assert.match(plan.openingResponse.instructions, /Approved business name: Dental Prime/);
});

test("browser voice normalizers keep safe realtime defaults", () => {
  assert.equal(normalizeBrowserVoiceModel("gpt-realtime-2"), "gpt-realtime-1.5");
  assert.equal(normalizeBrowserVoiceModel("bad-model"), "gpt-realtime-1.5");

  assert.equal(normalizeBrowserVoiceName("alloy"), "coral");
  assert.equal(normalizeBrowserVoiceName("verse"), "coral");
  assert.equal(normalizeBrowserVoiceName("sage"), "sage");
  assert.equal(normalizeBrowserVoiceName("unknown"), "coral");
});
