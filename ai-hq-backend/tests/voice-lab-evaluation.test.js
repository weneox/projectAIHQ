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
    runtimeApplied: true,
    capturedSlots: {
      items: "2 pizza",
      fulfillment: "delivery",
      customer_name: "Emil",
      customer_phone: "+994501112233",
    },
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
  assert.equal(evaluation.report.gate, "ready_for_pilot");
  assert.equal(evaluation.report.blockerCount, 0);
  assert.equal(evaluation.captureSummary.complete, true);
  assert.equal(evaluation.capturedSlots.items, "2 pizza");
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
    runtimeApplied: true,
    capturedSlots: {
      service_type: "consultation",
      preferred_date: "tomorrow",
      preferred_time: "14:00",
      customer_name: "Emil",
      customer_phone: "+994501112233",
    },
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
  assert.equal(result.evaluations[0].captureSummary.complete, true);
  assert.equal(listVoiceLabEvaluationsFromSettings(result.settingsInput).length, 20);
});

test("voice lab evaluation blocks real rollout without tenant runtime", () => {
  const evaluation = normalizeVoiceLabEvaluation({
    scenarioId: "business_faq",
    runtimeApplied: false,
    capturedSlots: {
      question_topic: "working hours",
    },
    evaluation: {
      language: "good",
      naturalness: 5,
      brevity: 5,
      taskCompletion: 5,
      truthfulness: 5,
      handoffSense: 5,
    },
  });

  assert.equal(evaluation.averageScore, 5);
  assert.equal(evaluation.readiness, "not_ready");
  assert.equal(evaluation.report.gate, "not_ready");
  assert.ok(evaluation.report.blockers.some((item) => item.includes("Tenant runtime")));
});

test("voice lab evaluation reports missing captured required slots", () => {
  const evaluation = normalizeVoiceLabEvaluation({
    scenarioId: "restaurant_order",
    runtimeApplied: true,
    capturedSlots: {
      items: "pizza",
    },
    evaluation: {
      language: "good",
      naturalness: 5,
      brevity: 5,
      taskCompletion: 5,
      truthfulness: 5,
      handoffSense: 5,
    },
  });

  assert.equal(evaluation.readiness, "needs_tuning");
  assert.equal(evaluation.captureSummary.complete, false);
  assert.ok(evaluation.captureSummary.missingRequired.some((slot) => slot.key === "customer_phone"));
  assert.ok(evaluation.report.blockers.some((item) => item.includes("Required captured fields")));
});
