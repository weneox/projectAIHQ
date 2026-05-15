import {
  getVoiceLabScenario,
  normalizeVoiceLabScenarioId,
  requireVoiceLabScenario,
} from "./labScenarios.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function clampScore(value) {
  return Math.max(1, Math.min(5, n(value, 3)));
}

function nowIso() {
  return new Date().toISOString();
}

function averageScore(evaluation = {}) {
  const values = [
    evaluation.naturalness,
    evaluation.brevity,
    evaluation.taskCompletion,
    evaluation.truthfulness,
    evaluation.handoffSense,
  ].map(clampScore);

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function readinessLabel(score = 0, language = "") {
  if (s(language).toLowerCase() !== "good") return "not_ready";
  if (score >= 4.4) return "ready_for_pilot";
  if (score >= 3.8) return "needs_tuning";
  return "not_ready";
}

function buildReadinessReport({
  evaluation = {},
  score = 0,
  language = "",
  input = {},
  scenario = {},
} = {}) {
  const runtimeApplied = input.runtimeApplied === true;
  const blockers = [];
  const nextActions = [];

  const naturalness = clampScore(evaluation.naturalness);
  const brevity = clampScore(evaluation.brevity);
  const taskCompletion = clampScore(evaluation.taskCompletion);
  const truthfulness = clampScore(evaluation.truthfulness);
  const handoffSense = clampScore(evaluation.handoffSense);

  if (s(language).toLowerCase() !== "good") {
    blockers.push("Language quality is not confirmed as good.");
    nextActions.push("Repeat the scenario and verify that the assistant speaks naturally in the target language.");
  }

  if (!runtimeApplied) {
    blockers.push("Tenant runtime was not applied, so this test is not production-like enough for real number rollout.");
    nextActions.push("Connect voice settings and approved business truth so Browser Lab runs with tenant runtime.");
  }

  if (naturalness < 4) {
    blockers.push("Natural speech score is below pilot quality.");
    nextActions.push("Tune tone, voice choice, and opening behavior.");
  }

  if (brevity < 4) {
    blockers.push("Replies are not short enough for a phone call.");
    nextActions.push("Tighten composer rules for short answers and one question at a time.");
  }

  if (taskCompletion < 4) {
    blockers.push("Task completion is below pilot quality.");
    nextActions.push("Improve slot collection and confirmation flow for this scenario.");
  }

  if (truthfulness < 4) {
    blockers.push("Truthfulness/no-hallucination score is below pilot quality.");
    nextActions.push("Strengthen approved-truth grounding and missing-fact handoff behavior.");
  }

  if (handoffSense < 4) {
    blockers.push("Human handoff behavior is below pilot quality.");
    nextActions.push("Tune handoff triggers and operator escalation wording.");
  }

  let gate = readinessLabel(score, language);
  if (!runtimeApplied) {
    gate = "not_ready";
  } else if (blockers.length && score >= 3.8) {
    gate = "needs_tuning";
  } else if (blockers.length) {
    gate = "not_ready";
  }

  if (!nextActions.length) {
    nextActions.push("Run one more different scenario before connecting a real number.");
    nextActions.push("If the second scenario also passes, move to controlled pilot with one number.");
  }

  const title =
    gate === "ready_for_pilot"
      ? "Ready for controlled pilot"
      : gate === "needs_tuning"
        ? "Needs tuning before pilot"
        : "Not ready for real number";

  return {
    gate,
    title,
    summary:
      gate === "ready_for_pilot"
        ? "The lab result is strong enough for a controlled real-number pilot."
        : "Do not connect SIP or a real number until the blockers are fixed and re-tested.",
    blockerCount: blockers.length,
    blockers,
    nextActions,
    signals: {
      scenarioId: s(scenario.id),
      businessType: s(scenario.businessType),
      runtimeApplied,
      language: s(language),
      averageScore: score,
      naturalness,
      brevity,
      taskCompletion,
      truthfulness,
      handoffSense,
    },
  };
}

export function listVoiceLabEvaluationsFromSettings(settings = {}) {
  return arr(obj(settings).meta?.voiceLabEvaluations || obj(settings).meta?.voice_lab_evaluations);
}

export function normalizeVoiceLabEvaluation(input = {}) {
  const evaluation = obj(input.evaluation || input);
  const score = averageScore(evaluation);
  const language = s(evaluation.language || input.language || "unknown").toLowerCase();
  const requestedScenarioId = normalizeVoiceLabScenarioId(
    input.scenarioId || input.scenario_id || "restaurant_order"
  );
  const scenario = requireVoiceLabScenario(requestedScenarioId);
  const report = buildReadinessReport({
    evaluation,
    score,
    language,
    input,
    scenario,
  });

  return {
    id: s(input.id) || `lab_eval_${Date.now()}`,
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    businessType: scenario.businessType,
    model: s(input.model),
    voice: s(input.voice),
    runtimeApplied: input.runtimeApplied === true,
    tenantKey: s(input.tenantKey),
    language,
    naturalness: clampScore(evaluation.naturalness),
    brevity: clampScore(evaluation.brevity),
    taskCompletion: clampScore(evaluation.taskCompletion),
    truthfulness: clampScore(evaluation.truthfulness),
    handoffSense: clampScore(evaluation.handoffSense),
    averageScore: score,
    readiness: report.gate,
    report,
    notes: s(evaluation.notes || input.notes).slice(0, 2000),
    createdAt: s(input.createdAt || input.created_at) || nowIso(),
  };
}

export function appendVoiceLabEvaluation(settings = {}, input = {}) {
  const current = obj(settings);
  const meta = obj(current.meta);
  const nextEvaluation = normalizeVoiceLabEvaluation(input);
  const evaluations = [nextEvaluation, ...listVoiceLabEvaluationsFromSettings(current)].slice(0, 20);

  return {
    evaluation: nextEvaluation,
    evaluations,
    settingsInput: {
      enabled: current.enabled ?? true,
      provider: s(current.provider || "twilio"),
      mode: s(current.mode || "assistant"),
      displayName: s(current.displayName || current.display_name),
      defaultLanguage: s(current.defaultLanguage || current.default_language || "en"),
      supportedLanguages: arr(current.supportedLanguages || current.supported_languages).length
        ? arr(current.supportedLanguages || current.supported_languages)
        : ["en"],
      greeting: obj(current.greeting),
      fallbackGreeting: obj(current.fallbackGreeting || current.fallback_greeting),
      businessContext: s(current.businessContext || current.business_context),
      instructions: s(current.instructions),
      businessHoursEnabled: current.businessHoursEnabled ?? current.business_hours_enabled ?? false,
      businessHours: obj(current.businessHours || current.business_hours),
      operatorEnabled: current.operatorEnabled ?? current.operator_enabled ?? true,
      operatorPhone: s(current.operatorPhone || current.operator_phone),
      operatorLabel: s(current.operatorLabel || current.operator_label),
      transferStrategy: s(current.transferStrategy || current.transfer_strategy || "handoff"),
      callbackEnabled: current.callbackEnabled ?? current.callback_enabled ?? true,
      callbackMode: s(current.callbackMode || current.callback_mode || "lead_only"),
      maxCallSeconds: n(current.maxCallSeconds || current.max_call_seconds || 180, 180),
      silenceHangupSeconds: n(
        current.silenceHangupSeconds || current.silence_hangup_seconds || 12,
        12
      ),
      captureRules: obj(current.captureRules || current.capture_rules),
      leadRules: obj(current.leadRules || current.lead_rules),
      escalationRules: obj(current.escalationRules || current.escalation_rules),
      reportingRules: obj(current.reportingRules || current.reporting_rules),
      twilioPhoneNumber: s(current.twilioPhoneNumber || current.twilio_phone_number),
      twilioPhoneSid: s(current.twilioPhoneSid || current.twilio_phone_sid),
      twilioConfig: obj(current.twilioConfig || current.twilio_config),
      costControl: obj(current.costControl || current.cost_control),
      meta: {
        ...meta,
        voiceLabEvaluations: evaluations,
      },
    },
  };
}
