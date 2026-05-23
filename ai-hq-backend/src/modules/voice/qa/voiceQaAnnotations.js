export const VOICE_QA_ANNOTATION_VERSION = "voice-qa-annotation-v1";

const VERDICTS = new Set(["reviewed", "pass", "needs_fix", "bad_call"]);
const SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const ISSUE_LABELS = new Set([
  "runtime_blocked",
  "missing_slot",
  "wrong_slot",
  "wrong_tool",
  "bad_transcript",
  "robotic_voice",
  "unnatural_az",
  "interruption_issue",
  "silence_issue",
  "latency_issue",
  "hallucination",
  "fake_confirmation",
  "booking_error",
  "handoff_error",
  "other",
]);

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

function normalizeList(value = []) {
  return [
    ...new Set(
      arr(value)
        .map((item) => s(item).toLowerCase())
        .filter(Boolean)
    ),
  ];
}

export function normalizeVoiceQaVerdict(value = "", issueLabels = []) {
  const raw = s(value).toLowerCase();

  if (VERDICTS.has(raw)) return raw;
  if (normalizeList(issueLabels).length > 0) return "needs_fix";

  return "reviewed";
}

export function normalizeVoiceQaSeverity(value = "", verdict = "") {
  const raw = s(value).toLowerCase();
  if (SEVERITIES.has(raw)) return raw;
  if (verdict === "bad_call") return "high";
  if (verdict === "needs_fix") return "medium";
  return "low";
}

export function normalizeVoiceQaIssueLabels(value = []) {
  const labels = normalizeList(value).map((label) =>
    ISSUE_LABELS.has(label) ? label : "other"
  );

  return [...new Set(labels)];
}

export function buildVoiceQaAnnotationRecord({
  input = {},
  call = {},
  actor = "",
  id = "",
  now = new Date().toISOString(),
} = {}) {
  const payload = obj(input);
  const issueLabels = normalizeVoiceQaIssueLabels(
    payload.issueLabels || payload.issues || payload.labels
  );
  const verdict = normalizeVoiceQaVerdict(payload.verdict, issueLabels);
  const severity = normalizeVoiceQaSeverity(payload.severity, verdict);

  const annotation = compact({
    version: VOICE_QA_ANNOTATION_VERSION,
    id: s(id || payload.id),
    callId: s(call.id || call.callId || payload.callId),
    actor: s(actor || payload.actor || "operator"),
    verdict,
    severity,
    issueLabels,
    slotLabels: normalizeList(payload.slotLabels || payload.slots || payload.missingSlots),
    expectedOutcome: s(payload.expectedOutcome || payload.expected || payload.outcome),
    correctionText: s(payload.correctionText || payload.correction || payload.fixedText),
    operatorNote: s(payload.operatorNote || payload.note || payload.notes),
    naturalnessIssue: s(payload.naturalnessIssue || payload.naturalness || payload.voiceIssue),
    createdAt: s(now),
  });

  const hasSignal =
    annotation.verdict !== "reviewed" ||
    annotation.issueLabels?.length > 0 ||
    annotation.slotLabels?.length > 0 ||
    !!annotation.expectedOutcome ||
    !!annotation.correctionText ||
    !!annotation.operatorNote ||
    !!annotation.naturalnessIssue;

  if (!hasSignal) {
    return {
      ok: false,
      reasonCode: "voice_qa_annotation_empty",
      annotation,
    };
  }

  return {
    ok: true,
    reasonCode: "",
    annotation,
  };
}

export function buildVoiceQaAnnotationEventPayload({
  annotation = {},
  call = {},
} = {}) {
  return {
    version: VOICE_QA_ANNOTATION_VERSION,
    annotation: obj(annotation),
    qaAnnotation: obj(annotation),
    callId: s(call.id || call.callId || annotation.callId),
    verdict: s(annotation.verdict),
    severity: s(annotation.severity),
    issueLabels: arr(annotation.issueLabels),
    slotLabels: arr(annotation.slotLabels),
  };
}

export function buildVoiceQaAnnotationCallPatch({
  call = {},
  annotation = {},
  maxAnnotations = 20,
} = {}) {
  const previousMeta = obj(call.meta);
  const previousQa = obj(previousMeta.qa);
  const previousAnnotations = arr(previousQa.annotations);
  const nextAnnotations = [
    ...previousAnnotations,
    obj(annotation),
  ].slice(-Math.max(1, Number(maxAnnotations || 20)));

  const summary = {
    version: VOICE_QA_ANNOTATION_VERSION,
    annotationCount: nextAnnotations.length,
    latestVerdict: s(annotation.verdict),
    latestSeverity: s(annotation.severity),
    latestIssueLabels: arr(annotation.issueLabels),
    latestSlotLabels: arr(annotation.slotLabels),
    latestAnnotatedAt: s(annotation.createdAt),
    needsFix: ["needs_fix", "bad_call"].includes(s(annotation.verdict)),
    badCall: s(annotation.verdict) === "bad_call",
  };

  return {
    meta: {
      ...previousMeta,
      qa: {
        ...previousQa,
        annotations: nextAnnotations,
        lastAnnotation: obj(annotation),
        summary,
      },
    },
  };
}
