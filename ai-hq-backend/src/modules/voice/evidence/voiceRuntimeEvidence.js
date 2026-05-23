export const VOICE_RUNTIME_EVIDENCE_VERSION = "voice-runtime-evidence-v1";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function readFirstReason({ readiness = {}, providerContract = {}, speechPipeline = {}, runtimeReasonCode = "" } = {}) {
  const speechCompatibility = obj(speechPipeline.compatibility);
  const speechReasonCodes = arr(speechCompatibility.reasonCodes);

  return s(
    runtimeReasonCode ||
      readiness.reasonCode ||
      providerContract.reasonCode ||
      speechReasonCodes[0] ||
      ""
  );
}

function summarizeReadiness(readiness = {}) {
  const value = obj(readiness);

  return {
    ready: value.ready === true,
    status: s(value.status),
    reasonCode: s(value.reasonCode),
    provider: s(value.provider),
    transport: s(value.transport),
    blockingReasons: arr(value.blockingReasons).map((reason) => ({
      scope: s(reason?.scope),
      reasonCode: s(reason?.reasonCode),
      provider: s(reason?.provider),
    })),
  };
}

function summarizeProviderContract(providerContract = {}, readiness = {}) {
  const contract = obj(providerContract);

  return {
    provider: s(contract.provider || readiness.provider),
    supported: contract.supported === true,
    status: s(contract.status),
    reasonCode: s(contract.reasonCode),
    capabilities: obj(contract.capabilities),
    requirements: obj(contract.requirements),
  };
}

function summarizeSpeechPipeline(speechPipeline = {}) {
  const speech = obj(speechPipeline);

  return {
    version: s(speech.version),
    mode: s(speech.mode),
    asr: obj(speech.asr),
    tts: obj(speech.tts),
    realtime: obj(speech.realtime),
    compatibility: obj(speech.compatibility),
  };
}

function summarizeOutcome(outcome = {}) {
  const value = obj(outcome);

  return {
    status: s(value.status),
    resultStatus: s(value.resultStatus),
    missingRequired: arr(value.missingRequired),
    nextMissing: obj(value.nextMissing),
    nextPromptHint: obj(value.nextPromptHint),
    requestOnly: value.requestOnly === true,
    confirmed: value.confirmed === true,
  };
}

export function buildVoiceRuntimeEvidence({
  source = "",
  phase = "",
  runtimeApplied = false,
  runtimeReasonCode = "",
  readiness = {},
  providerContract = {},
  speechPipeline = {},
  outcome = {},
} = {}) {
  const readinessSummary = summarizeReadiness(readiness);
  const providerSummary = summarizeProviderContract(providerContract, readinessSummary);
  const speechSummary = summarizeSpeechPipeline(speechPipeline);
  const outcomeSummary = summarizeOutcome(outcome);
  const reasonCode = readFirstReason({
    runtimeReasonCode,
    readiness: readinessSummary,
    providerContract: providerSummary,
    speechPipeline: speechSummary,
  });

  const blocked =
    readinessSummary.ready === false ||
    providerSummary.supported === false ||
    speechSummary.compatibility?.browserRealtimeSupported === false;

  return {
    version: VOICE_RUNTIME_EVIDENCE_VERSION,
    source: s(source),
    phase: s(phase),
    runtimeApplied: runtimeApplied === true,
    runtimeReasonCode: s(runtimeReasonCode),
    blocked,
    reasonCode,
    readiness: readinessSummary,
    providerContract: providerSummary,
    speechPipeline: speechSummary,
    outcome: outcomeSummary,
  };
}

export function buildBrowserSessionVoiceEvidence({
  sessionPlan = {},
  runtimeApplied = false,
  runtimeReasonCode = "",
  phase = "browser_session",
  outcome = {},
} = {}) {
  const plan = obj(sessionPlan);

  return buildVoiceRuntimeEvidence({
    source: "browser_realtime_session",
    phase,
    runtimeApplied,
    runtimeReasonCode,
    readiness: obj(plan.readiness),
    providerContract: obj(plan.providerContract),
    speechPipeline: obj(plan.speechPipeline),
    outcome,
  });
}
