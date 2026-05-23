import {
  buildVoiceQaOutcomeScore,
} from "./voiceQaOutcomeScore.js";

export const VOICE_OPERATOR_QUEUE_READ_MODEL_VERSION = "voice-operator-queue-read-model-v1";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function b(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const raw = s(value).toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "y", "on"].includes(raw)) return true;
  if (["0", "false", "no", "n", "off"].includes(raw)) return false;
  return fallback;
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function compact(value = {}) {
  const output = {};

  for (const [key, nextValue] of Object.entries(obj(value))) {
    if (nextValue === undefined || nextValue === null) continue;
    if (typeof nextValue === "string" && !s(nextValue)) continue;
    if (Array.isArray(nextValue) && nextValue.length === 0) continue;
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

function severityRank(value = "") {
  const raw = s(value).toLowerCase();
  if (raw === "critical") return 4;
  if (raw === "high") return 3;
  if (raw === "medium") return 2;
  if (raw === "low") return 1;
  return 0;
}

function toTimestamp(value = "") {
  const raw = s(value);
  if (!raw) return 0;
  const time = Date.parse(raw);
  return Number.isFinite(time) ? time : 0;
}

function readQa(call = {}) {
  const metaQa = obj(obj(call.meta).qa);
  const score = obj(metaQa.outcomeScore || metaQa.score);

  return {
    ...metaQa,
    ...(score.status && !metaQa.latestVerdict ? { latestVerdict: score.status } : {}),
  };
}

function readRuntime(call = {}) {
  const meta = obj(call.meta);
  const realtime = obj(meta.realtime);
  const runtimeEvidence = obj(meta.runtimeEvidence || realtime.runtimeEvidence || meta.evidence);

  return {
    hasEvidence: Object.keys(runtimeEvidence).length > 0,
    blocked:
      runtimeEvidence.blocked === true ||
      obj(runtimeEvidence.readiness).ready === false ||
      obj(runtimeEvidence.providerContract).supported === false,
    reasonCode: s(
      runtimeEvidence.reasonCode ||
        obj(runtimeEvidence.readiness).reasonCode ||
        obj(runtimeEvidence.providerContract).reasonCode
    ),
  };
}

function readToolSignals(call = {}) {
  const meta = obj(call.meta);
  const extraction = obj(call.extraction);
  const outcome = obj(extraction.voiceOutcome || meta.voiceOutcome);
  const request = obj(
    meta.universalBusinessRequest ||
      extraction.universalBusinessRequest ||
      meta.operationRequest ||
      extraction.operationRequest
  );

  const requestId = s(
    call.operationRequestId ||
      meta.operationRequestId ||
      extraction.operationRequestId ||
      request.id ||
      outcome.requestId
  );

  const status = s(outcome.status || request.status);

  return {
    total: status || requestId ? 1 : 0,
    hasMissingRequired: status === "missing_required_fields",
    hasRequestRecorded:
      status === "request_recorded" ||
      !!requestId ||
      Object.keys(request).length > 0,
  };
}

function buildCallSummary(call = {}) {
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
    handoffRequested: call.handoffRequested === true,
    handoffCompleted: call.handoffCompleted === true,
  };
}

function looksLikeOutcomeScore(value = {}) {
  const item = obj(value);
  return !!(
    s(item.status) ||
    s(item.outcome) ||
    s(item.operatorAction) ||
    item.needsHumanReview === true ||
    Number.isFinite(Number(item.score))
  );
}

function readExistingScore(call = {}) {
  const metaQa = obj(obj(call.meta).qa);
  const candidates = [
    call.outcomeScore,
    obj(call.qaInspector).outcomeScore,
    obj(call.inspector).outcomeScore,
    metaQa.outcomeScore,
    metaQa.score,
    call.score,
  ];

  for (const candidate of candidates) {
    const item = obj(candidate);
    if (looksLikeOutcomeScore(item)) return item;
  }

  return {};
}

export function buildVoiceOperatorQueueRow(call = {}) {
  const existingScore = readExistingScore(call);
  const callSummary = buildCallSummary(call);
  const qa = readQa(call);
  const runtime = readRuntime(call);
  const tools = readToolSignals(call);

  const score = Object.keys(existingScore).length
    ? existingScore
    : buildVoiceQaOutcomeScore({
        callSummary,
        runtime,
        tools,
        timeline: { total: 0 },
        qa,
        flags: {},
      });

  const phone = s(call.fromNumber || call.from || call.caller || call.phone || call.callbackPhone);
  const customerName = s(call.callerName || call.name || call.customerName);

  return compact({
    version: VOICE_OPERATOR_QUEUE_READ_MODEL_VERSION,
    callId: callSummary.id,
    tenantId: callSummary.tenantId,
    tenantKey: callSummary.tenantKey,
    status: callSummary.status,
    callOutcome: callSummary.outcome,
    scoreStatus: s(score.status),
    outcome: s(score.outcome),
    score: n(score.score, 0),
    severity: s(score.severity, "none"),
    needsHumanReview: score.needsHumanReview === true,
    operatorAction: s(score.operatorAction, "review_optional"),
    reasonCodes: arr(score.reasonCodes),
    startedAt: callSummary.startedAt,
    answeredAt: callSummary.answeredAt,
    endedAt: callSummary.endedAt,
    provider: callSummary.provider,
    providerCallSid: callSummary.providerCallSid,
    direction: callSummary.direction,
    language: callSummary.language,
    intent: callSummary.intent,
    agentMode: callSummary.agentMode,
    customerName,
    phone,
    summary: s(call.summary),
    hasTranscript: !!s(call.transcript),
    handoffRequested: callSummary.handoffRequested,
    handoffCompleted: callSummary.handoffCompleted,
    scoreSignals: obj(score.signals),
    outcomeScore: score,
  });
}

function normalizeFilterList(value = "") {
  return [
    ...new Set(
      s(value)
        .split(",")
        .map((item) => s(item).toLowerCase())
        .filter(Boolean)
    ),
  ];
}

function rowMatchesFilters(row = {}, filters = {}) {
  const scoreStatuses = normalizeFilterList(filters.scoreStatus || filters.outcomeStatus || filters.status);
  const operatorActions = normalizeFilterList(filters.operatorAction);
  const severities = normalizeFilterList(filters.severity);

  if (scoreStatuses.length && !scoreStatuses.includes(s(row.scoreStatus).toLowerCase())) return false;
  if (operatorActions.length && !operatorActions.includes(s(row.operatorAction).toLowerCase())) return false;
  if (severities.length && !severities.includes(s(row.severity).toLowerCase())) return false;

  if (filters.needsHumanReview !== undefined && filters.needsHumanReview !== null && s(filters.needsHumanReview) !== "") {
    if (row.needsHumanReview !== b(filters.needsHumanReview)) return false;
  }

  return true;
}

function compareRows(sort = "priority") {
  const mode = s(sort, "priority").toLowerCase();

  return (a, b) => {
    if (mode === "score_asc") return n(a.score, 0) - n(b.score, 0);
    if (mode === "score_desc") return n(b.score, 0) - n(a.score, 0);
    if (mode === "oldest") return toTimestamp(a.startedAt) - toTimestamp(b.startedAt);
    if (mode === "newest") return toTimestamp(b.startedAt) - toTimestamp(a.startedAt);

    const humanDelta = Number(b.needsHumanReview === true) - Number(a.needsHumanReview === true);
    if (humanDelta) return humanDelta;

    const severityDelta = severityRank(b.severity) - severityRank(a.severity);
    if (severityDelta) return severityDelta;

    const scoreDelta = n(a.score, 0) - n(b.score, 0);
    if (scoreDelta) return scoreDelta;

    return toTimestamp(b.startedAt) - toTimestamp(a.startedAt);
  };
}

export function buildVoiceOperatorQueueReadModel({
  calls = [],
  filters = {},
  sort = "priority",
  limit = 50,
} = {}) {
  const max = Math.max(1, Math.min(200, n(limit, 50)));

  const allRows = arr(calls).map(buildVoiceOperatorQueueRow);
  const filteredRows = allRows
    .filter((row) => rowMatchesFilters(row, filters))
    .sort(compareRows(sort));
  const rows = filteredRows.slice(0, max);
  const scores = rows.map((row) => n(row.score, 0)).filter((score) => score > 0);

  return {
    version: VOICE_OPERATOR_QUEUE_READ_MODEL_VERSION,
    total: allRows.length,
    filteredTotal: filteredRows.length,
    returned: rows.length,
    sort: s(sort, "priority"),
    filters: compact({
      scoreStatus: s(filters.scoreStatus || filters.outcomeStatus || filters.status),
      operatorAction: s(filters.operatorAction),
      severity: s(filters.severity),
      needsHumanReview:
        filters.needsHumanReview === undefined || filters.needsHumanReview === null
          ? undefined
          : b(filters.needsHumanReview),
    }),
    summary: {
      total: allRows.length,
      filteredTotal: filteredRows.length,
      needsHumanReview: allRows.filter((row) => row.needsHumanReview === true).length,
      returnedNeedsHumanReview: rows.filter((row) => row.needsHumanReview === true).length,
      byScoreStatus: countBy(allRows, (row) => row.scoreStatus || "unknown"),
      byOperatorAction: countBy(allRows, (row) => row.operatorAction || "review_optional"),
      bySeverity: countBy(allRows, (row) => row.severity || "none"),
      averageScore: scores.length
        ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
        : 0,
      worstScore: scores.length ? Math.min(...scores) : 0,
    },
    rows,
  };
}
