export const VOICE_QA_CALL_INSPECTOR_VERSION = "voice-qa-call-inspector-v1";

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

function hasKeys(value) {
  return Object.keys(obj(value)).length > 0;
}

function compact(value = {}) {
  const output = {};

  for (const [key, nextValue] of Object.entries(obj(value))) {
    if (nextValue === undefined || nextValue === null) continue;
    if (typeof nextValue === "string" && !s(nextValue)) continue;
    if (Array.isArray(nextValue) && nextValue.length === 0) continue;

    if (nextValue && typeof nextValue === "object" && !Array.isArray(nextValue)) {
      const cleaned = compact(nextValue);
      if (!Object.keys(cleaned).length) continue;
      output[key] = cleaned;
      continue;
    }

    output[key] = nextValue;
  }

  return output;
}

function countBy(items = [], picker = () => "") {
  const counts = {};

  for (const item of arr(items)) {
    const key = s(picker(item), "unknown");
    counts[key] = Number(counts[key] || 0) + 1;
  }

  return counts;
}

function readEventType(event = {}) {
  return s(event.eventType || event.event || event.type || event.name);
}

function readPayload(event = {}) {
  return obj(event.payload);
}

function readRuntimeEvidenceFromPayload(payload = {}) {
  const value = obj(payload);

  if (hasKeys(value.runtimeEvidence)) return obj(value.runtimeEvidence);
  if (hasKeys(value.evidence)) return obj(value.evidence);
  if (hasKeys(obj(value.result).runtimeEvidence)) return obj(obj(value.result).runtimeEvidence);
  if (hasKeys(obj(value.result).evidence)) return obj(obj(value.result).evidence);

  return {};
}

function readCallRuntimeEvidence(call = {}, events = []) {
  const meta = obj(call.meta);
  const realtime = obj(meta.realtime);

  if (hasKeys(meta.runtimeEvidence)) return obj(meta.runtimeEvidence);
  if (hasKeys(meta.evidence)) return obj(meta.evidence);
  if (hasKeys(realtime.runtimeEvidence)) return obj(realtime.runtimeEvidence);
  if (hasKeys(realtime.evidence)) return obj(realtime.evidence);

  for (const event of arr(events).slice().reverse()) {
    const evidence = readRuntimeEvidenceFromPayload(readPayload(event));
    if (hasKeys(evidence)) return evidence;
  }

  return {};
}

function readProviderContract(call = {}, runtimeEvidence = {}) {
  const meta = obj(call.meta);
  const realtime = obj(meta.realtime);

  return obj(
    runtimeEvidence.providerContract ||
      meta.providerContract ||
      realtime.providerContract
  );
}

function readSpeechPipeline(call = {}, runtimeEvidence = {}) {
  const meta = obj(call.meta);
  const realtime = obj(meta.realtime);

  return obj(
    runtimeEvidence.speechPipeline ||
      meta.speechPipeline ||
      realtime.speechPipeline
  );
}

function readReadiness(call = {}, runtimeEvidence = {}) {
  const meta = obj(call.meta);
  const realtime = obj(meta.realtime);

  return obj(
    runtimeEvidence.readiness ||
      meta.readiness ||
      realtime.readiness
  );
}

function summarizeRuntime({ call = {}, events = [] } = {}) {
  const runtimeEvidence = readCallRuntimeEvidence(call, events);
  const readiness = readReadiness(call, runtimeEvidence);
  const providerContract = readProviderContract(call, runtimeEvidence);
  const speechPipeline = readSpeechPipeline(call, runtimeEvidence);
  const speechCompatibility = obj(speechPipeline.compatibility);

  const blocked =
    runtimeEvidence.blocked === true ||
    readiness.ready === false ||
    providerContract.supported === false ||
    speechCompatibility.browserRealtimeSupported === false;

  return {
    hasEvidence: hasKeys(runtimeEvidence),
    blocked,
    reasonCode: s(
      runtimeEvidence.reasonCode ||
        readiness.reasonCode ||
        providerContract.reasonCode ||
        arr(speechCompatibility.reasonCodes)[0]
    ),
    runtimeEvidence,
    readiness,
    providerContract,
    speechPipeline,
  };
}

function readToolOutcomeFromEvent(event = {}) {
  const payload = readPayload(event);
  const result = obj(payload.result);
  const evidence = readRuntimeEvidenceFromPayload(payload);
  const evidenceOutcome = obj(evidence.outcome);

  const status = s(
    result.status ||
      payload.resultStatus ||
      evidenceOutcome.status ||
      evidenceOutcome.resultStatus
  );

  const missingRequired =
    arr(result.missingRequired).length > 0
      ? arr(result.missingRequired)
      : arr(payload.missingRequired).length > 0
        ? arr(payload.missingRequired)
        : arr(evidenceOutcome.missingRequired);

  return compact({
    eventId: s(event.id),
    eventType: readEventType(event),
    occurredAt: s(event.createdAt || event.timestamp || event.time),
    toolName: s(payload.toolName || payload.name || result.name),
    toolCallId: s(payload.toolCallId || result.toolCallId),
    providerRealtimeCallId: s(payload.providerRealtimeCallId || result.providerRealtimeCallId),
    status,
    resultStatus: s(payload.resultStatus || result.status || evidenceOutcome.resultStatus),
    requestOnly: result.requestOnly === true || evidenceOutcome.requestOnly === true,
    confirmed: result.confirmed === true || evidenceOutcome.confirmed === true,
    missingRequired,
    nextMissing: hasKeys(result.nextMissing) ? obj(result.nextMissing) : obj(evidenceOutcome.nextMissing),
    nextPromptHint: hasKeys(result.nextPromptHint)
      ? obj(result.nextPromptHint)
      : hasKeys(payload.nextPromptHint)
        ? obj(payload.nextPromptHint)
        : obj(evidenceOutcome.nextPromptHint),
    idempotency: obj(payload.idempotency),
  });
}

function isToolEvent(event = {}) {
  const eventType = readEventType(event);
  const payload = readPayload(event);

  return (
    eventType.includes("tool") ||
    !!s(payload.toolName || payload.name) ||
    hasKeys(payload.result)
  );
}

function summarizeTools(events = []) {
  const toolOutcomes = arr(events)
    .filter(isToolEvent)
    .map(readToolOutcomeFromEvent)
    .filter((item) => hasKeys(item));

  const missingRequired = [
    ...new Set(toolOutcomes.flatMap((item) => arr(item.missingRequired)).map((x) => s(x)).filter(Boolean)),
  ];

  const latest = toolOutcomes.at(-1) || {};
  const statuses = countBy(toolOutcomes, (item) => item.status || item.resultStatus || "unknown");

  return {
    total: toolOutcomes.length,
    statuses,
    missingRequired,
    hasMissingRequired: missingRequired.length > 0,
    hasRequestRecorded: toolOutcomes.some((item) => item.status === "request_recorded"),
    hasDuplicateSkipped: toolOutcomes.some((item) => item.status === "duplicate_skipped"),
    latest,
    outcomes: toolOutcomes,
  };
}

function summarizeTimeline(events = []) {
  const normalizedEvents = arr(events);

  return {
    total: normalizedEvents.length,
    byType: countBy(normalizedEvents, readEventType),
    firstEventAt: s(normalizedEvents[0]?.createdAt || normalizedEvents[0]?.timestamp),
    lastEventAt: s(normalizedEvents.at(-1)?.createdAt || normalizedEvents.at(-1)?.timestamp),
    lastEventType: readEventType(normalizedEvents.at(-1) || {}),
  };
}

function summarizeCall(call = {}) {
  return {
    id: s(call.id || call.callId),
    tenantId: s(call.tenantId),
    tenantKey: s(call.tenantKey),
    provider: s(call.provider),
    providerCallSid: s(call.providerCallSid),
    direction: s(call.direction),
    status: s(call.status),
    outcome: s(call.outcome),
    intent: s(call.intent),
    language: s(call.language || call.lang),
    agentMode: s(call.agentMode),
    startedAt: s(call.startedAt),
    answeredAt: s(call.answeredAt),
    endedAt: s(call.endedAt),
    hasTranscript: !!s(call.transcript),
    hasSummary: !!s(call.summary),
    handoffRequested: call.handoffRequested === true,
    handoffCompleted: call.handoffCompleted === true,
  };
}

function decideInspectorFlags({ callSummary = {}, runtime = {}, tools = {} } = {}) {
  const hasMissingRequired = tools.hasMissingRequired === true;
  const requestRecorded = tools.hasRequestRecorded === true;
  const blocked = runtime.blocked === true;

  let operatorAction = "review_optional";
  if (blocked) operatorAction = "fix_runtime";
  else if (hasMissingRequired) operatorAction = "ask_missing_details";
  else if (requestRecorded) operatorAction = "process_request";

  return {
    blocked,
    hasRuntimeEvidence: runtime.hasEvidence === true,
    hasToolOutcome: Number(tools.total || 0) > 0,
    hasMissingRequired,
    requestRecorded,
    needsHumanReview:
      blocked ||
      hasMissingRequired ||
      requestRecorded ||
      callSummary.handoffRequested === true,
    operatorAction,
  };
}

export function buildVoiceQaCallInspector({ call = {}, events = [] } = {}) {
  const callSummary = summarizeCall(call);
  const runtime = summarizeRuntime({ call, events });
  const tools = summarizeTools(events);
  const timeline = summarizeTimeline(events);
  const flags = decideInspectorFlags({ callSummary, runtime, tools });

  return {
    version: VOICE_QA_CALL_INSPECTOR_VERSION,
    callId: callSummary.id,
    call: callSummary,
    runtime,
    tools,
    timeline,
    flags,
  };
}
