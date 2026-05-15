import test from "node:test";
import assert from "node:assert/strict";

import {
  appendVoiceLabEvaluation,
  listVoiceLabEvaluationsFromSettings,
  normalizeVoiceLabEvaluation,
} from "../src/modules/voice/labEvaluation.js";

test("voice lab evaluation normalizes readiness and score", () => {
  const evaluation = normalizeVoiceLabEvaluation({
    scenarioId: "restaurant_order",
    scenarioTitle: "Restaurant order",
    model: "gpt-4o-realtime-preview",
    voice: "alloy",
    evaluation: {
      language: "good",
      naturalness: 5,
      brevity: 4,
      taskCompletion: 5,
      truthfulness: 5,
      handoffSense: 4,
      notes: "Good enough for pilot",
    },
  });

  assert.equal(evaluation.averageScore, 4.6);
  assert.equal(evaluation.readiness, "ready_for_pilot");
  assert.equal(evaluation.scenarioId, "restaurant_order");
});

test("voice lab evaluation appends latest first and caps history", () => {
  const settings = {
    enabled: true,
    provider: "twilio",
    meta: {
      voiceLabEvaluations: Array.from({ length: 25 }, (_, index) => ({
        id: `old_${index}`,
      })),
    },
  };

  const result = appendVoiceLabEvaluation(settings, {
    scenarioId: "appointment_booking",
    evaluation: {
      language: "good",
      naturalness: 4,
      brevity: 4,
      taskCompletion: 4,
      truthfulness: 4,
      handoffSense: 4,
    },
  });

  assert.equal(result.evaluations.length, 20);
  assert.equal(result.evaluations[0].scenarioId, "appointment_booking");
  assert.equal(listVoiceLabEvaluationsFromSettings(result.settingsInput).length, 20);
});
