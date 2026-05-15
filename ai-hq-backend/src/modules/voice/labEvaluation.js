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

export function listVoiceLabEvaluationsFromSettings(settings = {}) {
  return arr(obj(settings).meta?.voiceLabEvaluations || obj(settings).meta?.voice_lab_evaluations);
}

export function normalizeVoiceLabEvaluation(input = {}) {
  const evaluation = obj(input.evaluation || input);
  const score = averageScore(evaluation);
  const language = s(evaluation.language || input.language || "unknown").toLowerCase();

  return {
    id: s(input.id) || `lab_eval_${Date.now()}`,
    scenarioId: s(input.scenarioId || input.scenario_id || "custom"),
    scenarioTitle: s(input.scenarioTitle || input.scenario_title || "Custom scenario"),
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
    readiness: readinessLabel(score, language),
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
