export const VOICE_QA_DATASET_VERSION = "voice-qa-dataset-v1";

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

function bool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const raw = s(value).toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(raw);
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function countBy(items = [], picker = () => "") {
  const counts = {};

  for (const item of arr(items)) {
    const key = s(picker(item), "unknown");
    counts[key] = Number(counts[key] || 0) + 1;
  }

  return counts;
}

function uniqueStrings(value = []) {
  return [
    ...new Set(
      arr(value)
        .map((item) => s(item))
        .filter(Boolean)
    ),
  ];
}

function clip(value = "", max = 1200) {
  const text = s(value);
  const limit = Math.max(0, n(max, 1200));
  return text.length > limit ? text.slice(0, limit) : text;
}

function includesAny(values = [], candidates = []) {
  const set = new Set(arr(values).map((item) => s(item)));
  return arr(candidates).some((item) => set.has(s(item)));
}

function deriveDatasetLabel({ inspector = {} } = {}) {
  const flags = obj(inspector.flags);
  const qa = obj(inspector.qa || inspector.annotations);
  const runtime = obj(inspector.runtime);
  const tools = obj(inspector.tools);

  if (qa.badCall === true || flags.qaBadCall === true) return "bad_call";
  if (qa.needsFix === true || flags.qaNeedsFix === true) return "needs_fix";
  if (qa.latestVerdict === "pass" || flags.qaPassed === true) return "pass";
  if (runtime.blocked === true || flags.blocked === true) return "runtime_blocked";
  if (tools.hasMissingRequired === true || flags.hasMissingRequired === true) return "missing_required";
  if (tools.hasRequestRecorded === true || flags.requestRecorded === true) return "request_recorded";

  return "review";
}

function deriveDatasetUse({ row = {} } = {}) {
  const issueLabels = arr(row.issueLabels);
  const label = s(row.label);

  if (label === "runtime_blocked" || includesAny(issueLabels, ["runtime_blocked"])) {
    return "runtime_debug";
  }

  if (
    arr(row.naturalnessLabels).length > 0 ||
    Number(row.naturalnessScore || 0) > 0 ||
    includesAny(issueLabels, ["robotic_voice", "unnatural_az", "interruption_issue", "silence_issue", "latency_issue"])
  ) {
    return "naturalness_eval";
  }

  if (includesAny(issueLabels, ["wrong_tool", "fake_confirmation", "booking_error", "handoff_error", "hallucination"])) {
    return "tool_policy_eval";
  }

  if (includesAny(issueLabels, ["missing_slot", "wrong_slot"]) || arr(row.slotLabels).length > 0) {
    return "slot_extraction_eval";
  }

  if (label === "pass") return "golden_sample";

  return "operator_review";
}

function readQa(inspector = {}) {
  return obj(inspector.qa || inspector.annotations);
}

function readLatestTool(inspector = {}) {
  return obj(obj(inspector.tools).latest);
}

function buildDatasetTextFields({ call = {}, includeText = false, maxText = 1200 } = {}) {
  const transcript = s(call.transcript);
  const summary = s(call.summary);

  const fields = {
    hasTranscript: !!transcript,
    hasSummary: !!summary,
    transcriptSnippet: clip(transcript, maxText),
    summarySnippet: clip(summary, Math.min(maxText, 800)),
  };

  if (includeText) {
    fields.transcript = transcript;
    fields.summary = summary;
  }

  return fields;
}

export function buildVoiceQaDatasetRow({
  call = {},
  inspector = {},
  includeText = false,
  maxText = 1200,
} = {}) {
  const qa = readQa(inspector);
  const flags = obj(inspector.flags);
  const runtime = obj(inspector.runtime);
  const tools = obj(inspector.tools);
  const latestTool = readLatestTool(inspector);
  const callSummary = obj(inspector.call || call);
  const label = deriveDatasetLabel({ inspector });
  const issueLabels = uniqueStrings([
    ...arr(qa.issueLabels),
    ...arr(qa.latestIssueLabels),
  ]);
  const slotLabels = uniqueStrings([
    ...arr(qa.slotLabels),
    ...arr(qa.latestSlotLabels),
    ...arr(tools.missingRequired),
  ]);
  const lastAnnotation = obj(qa.lastAnnotation);
  const naturalnessLabels = uniqueStrings([
    ...arr(qa.naturalnessLabels),
    ...arr(qa.latestNaturalnessLabels),
    ...arr(lastAnnotation.naturalnessLabels),
  ]);
  const naturalnessScore = n(
    qa.latestNaturalnessScore || lastAnnotation.naturalnessScore,
    0
  );

  const row = {
    version: VOICE_QA_DATASET_VERSION,
    id: s(callSummary.id || call.id || call.callId),
    callId: s(callSummary.id || call.id || call.callId),
    tenantId: s(callSummary.tenantId || call.tenantId),
    tenantKey: s(callSummary.tenantKey || call.tenantKey),
    provider: s(callSummary.provider || call.provider),
    direction: s(callSummary.direction || call.direction),
    status: s(callSummary.status || call.status),
    outcome: s(callSummary.outcome || call.outcome),
    language: s(callSummary.language || call.language || call.lang),
    agentMode: s(callSummary.agentMode || call.agentMode),

    label,
    use: "",
    operatorAction: s(flags.operatorAction),
    needsHumanReview: flags.needsHumanReview === true,

    qaVerdict: s(qa.latestVerdict),
    qaSeverity: s(qa.latestSeverity),
    qaAnnotationCount: n(qa.annotationCount, 0),
    issueLabels,
    slotLabels,
    naturalnessLabels,
    naturalnessScore,
    naturalnessIssue: s(lastAnnotation.naturalnessIssue),
    lastAnnotation,

    runtimeBlocked: runtime.blocked === true,
    runtimeReasonCode: s(runtime.reasonCode),
    realtimeProvider: s(obj(runtime.providerContract).provider || obj(runtime.readiness).provider),
    speechMode: s(obj(runtime.speechPipeline).mode),
    asrProvider: s(obj(obj(runtime.speechPipeline).asr).provider),
    ttsProvider: s(obj(obj(runtime.speechPipeline).tts).provider),

    toolStatus: s(latestTool.status || latestTool.resultStatus),
    toolName: s(latestTool.toolName),
    toolMissingRequired: arr(tools.missingRequired),
    toolOutcomeCount: n(tools.total, 0),
    hasRequestRecorded: tools.hasRequestRecorded === true,

    ...buildDatasetTextFields({ call, includeText, maxText }),
  };

  row.use = deriveDatasetUse({ row });

  return row;
}

function rowMatches(row = {}, filters = {}) {
  const verdict = s(filters.verdict);
  const label = s(filters.label);
  const issueLabel = s(filters.issueLabel);
  const slotLabel = s(filters.slotLabel);
  const naturalnessLabel = s(filters.naturalnessLabel);
  const operatorAction = s(filters.operatorAction);

  if (verdict && s(row.qaVerdict) !== verdict) return false;
  if (label && s(row.label) !== label) return false;
  if (issueLabel && !arr(row.issueLabels).includes(issueLabel)) return false;
  if (slotLabel && !arr(row.slotLabels).includes(slotLabel)) return false;
  if (naturalnessLabel && !arr(row.naturalnessLabels).includes(naturalnessLabel)) return false;
  if (operatorAction && s(row.operatorAction) !== operatorAction) return false;
  if (bool(filters.onlyAnnotated) && n(row.qaAnnotationCount, 0) <= 0) return false;
  if (bool(filters.onlyNeedsFix) && !["needs_fix", "bad_call", "runtime_blocked", "missing_required"].includes(s(row.label))) return false;

  return true;
}

function summarizeRows(rows = []) {
  const normalized = arr(rows);

  return {
    total: normalized.length,
    byLabel: countBy(normalized, (row) => row.label),
    byUse: countBy(normalized, (row) => row.use),
    byVerdict: countBy(normalized, (row) => row.qaVerdict || "unlabeled"),
    byOperatorAction: countBy(normalized, (row) => row.operatorAction || "review_optional"),
    byIssueLabel: countBy(
      normalized.flatMap((row) => arr(row.issueLabels)),
      (label) => label
    ),
    bySlotLabel: countBy(
      normalized.flatMap((row) => arr(row.slotLabels)),
      (label) => label
    ),
    byNaturalnessLabel: countBy(
      normalized.flatMap((row) => arr(row.naturalnessLabels)),
      (label) => label
    ),
    naturalnessSamples: normalized.filter((row) => arr(row.naturalnessLabels).length > 0).length,
    annotated: normalized.filter((row) => n(row.qaAnnotationCount, 0) > 0).length,
    needsFix: normalized.filter((row) =>
      ["needs_fix", "bad_call", "runtime_blocked", "missing_required"].includes(s(row.label))
    ).length,
    pass: normalized.filter((row) => row.label === "pass").length,
  };
}

export function buildVoiceQaDataset({
  items = [],
  filters = {},
  includeText = false,
  maxText = 1200,
} = {}) {
  const rows = arr(items)
    .map((item) =>
      buildVoiceQaDatasetRow({
        call: obj(item.call),
        inspector: obj(item.inspector || item.qaInspector),
        includeText,
        maxText,
      })
    )
    .filter((row) => !!s(row.callId))
    .filter((row) => rowMatches(row, filters));

  return {
    version: VOICE_QA_DATASET_VERSION,
    filters: obj(filters),
    includeText: includeText === true,
    summary: summarizeRows(rows),
    rows,
  };
}
