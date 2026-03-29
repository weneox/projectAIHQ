function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function titleize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function valueFrom(source = {}, keys = []) {
  for (const key of arr(keys)) {
    if (source?.[key] != null) return source[key];
  }
  return undefined;
}

function collectObjects(candidates = []) {
  return candidates
    .map((item) => obj(item, null))
    .filter((item) => item && Object.keys(item).length > 0);
}

function firstNonEmptyString(candidates = [], keys = []) {
  for (const source of collectObjects(candidates)) {
    const value = s(valueFrom(source, keys));
    if (value) return value;
  }
  return "";
}

function firstArray(candidates = [], keys = []) {
  for (const source of collectObjects(candidates)) {
    const value = valueFrom(source, keys);
    if (Array.isArray(value) && value.length) return value;
  }
  return [];
}

function normalizeDecision(value) {
  if (typeof value === "string") return s(value);
  const source = obj(value);
  return (
    s(source.summary) ||
    s(source.label) ||
    s(source.decision) ||
    s(source.outcome) ||
    s(source.value) ||
    ""
  );
}

function firstDecision(candidates = [], keys = []) {
  for (const source of collectObjects(candidates)) {
    const decision = normalizeDecision(valueFrom(source, keys));
    if (decision) return decision;
  }
  return "";
}

function normalizePromptLayer(item) {
  if (typeof item === "string") return s(item);
  const source = obj(item);
  const label =
    s(source.label) ||
    s(source.name) ||
    s(source.layer) ||
    s(source.id) ||
    s(source.key);
  const version = s(source.version) || s(source.revision);
  if (!label) return "";
  return version ? `${label} (${version})` : label;
}

function normalizeReference(value) {
  if (typeof value === "string") return s(value);
  const source = obj(value);
  const ref =
    s(source.reference) ||
    s(source.ref) ||
    s(source.runtimeReference) ||
    s(source.runtime_reference) ||
    s(source.id);
  const version =
    s(source.version) ||
    s(source.runtimeVersion) ||
    s(source.runtime_version) ||
    s(source.label);
  if (ref && version) return `${ref} (${version})`;
  return ref || version;
}

function normalizeQualification(candidates = []) {
  const decision =
    firstDecision(candidates, ["qualificationDecision", "qualification_decision"]) ||
    firstNonEmptyString(candidates, [
      "qualificationDecision",
      "qualification_decision",
    ]);
  const reference = firstNonEmptyString(candidates, [
    "qualificationReference",
    "qualification_reference",
    "qualificationDecisionReference",
    "qualification_decision_reference",
    "qualificationRef",
  ]);
  if (decision && reference) return `${decision} (${reference})`;
  return decision || reference;
}

function normalizeHandoff(candidates = []) {
  const trigger = firstNonEmptyString(candidates, [
    "handoffTrigger",
    "handoff_trigger",
    "handoffDecision",
    "handoff_decision",
  ]);
  const reason = firstNonEmptyString(candidates, [
    "handoffReason",
    "handoff_reason",
    "handoffTriggerReason",
    "handoff_trigger_reason",
  ]);
  if (trigger && reason) return `${titleize(trigger)} (${reason})`;
  return titleize(trigger || reason);
}

export function normalizeReplayTrace(source = {}) {
  const root = obj(source);
  const meta = obj(root.meta);
  const messageMeta = obj(root.messageMeta || root.message_meta);
  const trace = obj(root.replayTrace || root.replay_trace);
  const inspect = obj(root.inspectTrace || root.inspect_trace);
  const decision = obj(root.lastDecisionMeta || root.last_decision_meta);
  const detail = obj(root.detail);
  const candidates = collectObjects([
    trace,
    inspect,
    decision,
    meta.replayTrace,
    meta.replay_trace,
    meta.trace,
    meta.traceMeta,
    meta.trace_meta,
    meta.inspect,
    meta.inspect_trace,
    messageMeta,
    meta,
    detail,
    root,
  ]);

  const promptLayers = firstArray(candidates, [
    "promptLayers",
    "prompt_layers",
    "layers",
    "promptBundleLayers",
    "prompt_bundle_layers",
  ])
    .map((item) => normalizePromptLayer(item))
    .filter(Boolean);

  const runtimeValue = normalizeReference(
    valueFrom(candidates[0] || {}, [
      "runtimeReference",
      "runtime_reference",
      "runtime",
    ])
  );
  const runtimeRefText = firstNonEmptyString(candidates, [
    "runtimeReference",
    "runtime_reference",
    "runtimeRef",
  ]);
  const runtimeVersion = firstNonEmptyString(candidates, [
    "runtimeVersion",
    "runtime_version",
  ]);
  const runtimeReference =
    runtimeValue ||
    (runtimeRefText && runtimeVersion
      ? `${runtimeRefText} (${runtimeVersion})`
      : runtimeRefText || runtimeVersion);

  const normalized = {
    runtimeReference,
    behaviorSummary: firstNonEmptyString(candidates, [
      "behaviorSummary",
      "behavior_summary",
      "summary",
      "decisionSummary",
      "decision_summary",
    ]),
    promptLayers,
    channel: firstNonEmptyString(candidates, [
      "channel",
      "channelType",
      "channel_type",
    ]),
    usecase: firstNonEmptyString(candidates, ["usecase", "useCase", "use_case"]),
    ctaDecision:
      firstDecision(candidates, ["ctaDecision", "cta_decision"]) ||
      firstNonEmptyString(candidates, ["ctaDecision", "cta_decision", "cta"]),
    qualificationDecision: normalizeQualification(candidates),
    handoffDecision: normalizeHandoff(candidates),
    disallowedClaimReason: firstNonEmptyString(candidates, [
      "disallowedClaimBlockReason",
      "disallowed_claim_block_reason",
      "disallowedClaimReason",
      "disallowed_claim_reason",
      "blockReason",
      "block_reason",
    ]),
  };

  const rows = [
    ["Runtime", normalized.runtimeReference],
    ["Behavior", normalized.behaviorSummary],
    ["Prompt layers", normalized.promptLayers.join(" | ")],
    ["Channel", titleize(normalized.channel)],
    ["Use case", titleize(normalized.usecase)],
    ["CTA decision", normalized.ctaDecision],
    ["Qualification", normalized.qualificationDecision],
    ["Handoff", normalized.handoffDecision],
    ["Claim block", normalized.disallowedClaimReason],
  ]
    .filter(([, value]) => s(value))
    .map(([label, value]) => ({ label, value: s(value) }));

  return {
    ...normalized,
    rows,
    hasTrace: rows.length > 0,
  };
}
