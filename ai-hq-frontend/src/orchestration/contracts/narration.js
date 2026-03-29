import { arr, obj, s } from "./helpers.js";
import { createSystemSignal } from "./systemSignals.js";

function titleize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (item) => item.toUpperCase());
}

function buildActionLabel(targetKind = "") {
  switch (s(targetKind).toLowerCase()) {
    case "truth":
      return "Open Truth";
    case "setup":
      return "Open Setup Studio";
    case "source_governance":
      return "Open Source Governance";
    case "policy_controls":
      return "Open Policy Controls";
    case "voice_settings":
      return "Open Voice Settings";
    case "inbox":
      return "Open Inbox";
    case "comments":
      return "Open Comments";
    case "publish":
      return "Open Publishing";
    default:
      return "Open";
  }
}

function buildNarrationCopy(signal = {}) {
  const ctx = obj(signal.context);
  const fallbackTitle =
    ctx.subjectName || titleize(signal.relatedCapability || "workspace");
  const title =
    s(ctx.title) ||
    (signal.kind === "decision"
      ? `Review ${fallbackTitle}`
      : signal.kind === "blocker"
        ? `${fallbackTitle} needs attention`
        : `${fallbackTitle} update`);

  const whatHappened =
    s(ctx.summary) ||
    s(ctx.subjectName)
      ? `${s(ctx.subjectName || fallbackTitle)} is ${titleize(
          ctx.statusLabel || signal.statusCode || "updated"
        )}.`
      : "A new system signal is available.";

  const why = s(ctx.reasonSummary)
    ? ctx.reasonSummary
    : s(signal.reasonCode)
      ? `Reason: ${titleize(signal.reasonCode)}.`
      : "";

  const impact = s(ctx.impactSummary)
    ? ctx.impactSummary
    : s(ctx.impactScope)
      ? `Impact: ${titleize(ctx.impactScope)}.`
      : "";

  return {
    title,
    whatHappened,
    why,
    impact,
  };
}

export function signalToNarrationItem(signalInput = {}) {
  const signal = createSystemSignal(signalInput);
  const copy = buildNarrationCopy(signal);

  return {
    id: signal.id,
    kind: signal.kind,
    title: copy.title,
    whatHappened: copy.whatHappened,
    why: copy.why,
    impact: copy.impact,
    nextAction:
      signal.target?.kind && signal.target.allowed !== false
        ? {
            label: buildActionLabel(signal.target.kind),
            targetKind: signal.target.kind,
            allowed: signal.target.allowed !== false,
          }
        : null,
    requiresHuman: signal.requiresHuman,
    canAutoFix: signal.canAutoFix,
    priority: signal.priority,
    confidence: signal.confidence,
    relatedCapability: signal.relatedCapability,
    sourceSubsystem: signal.sourceSubsystem,
    status: signal.statusCode,
    timestamp: signal.timestamp,
    actor: signal.actor,
    evidenceSummary: signal.evidenceSummary,
    detailRef: signal.detailRef,
    target: signal.target,
  };
}

export function signalsToNarrationItems(items = []) {
  return arr(items)
    .map((item) => signalToNarrationItem(item))
    .filter((item) => s(item.id) && s(item.title));
}

export function dedupeNarrationItems(items = []) {
  const out = [];
  const seen = new Set();

  for (const rawItem of arr(items)) {
    const item = obj(rawItem);
    const key = [
      s(item.id),
      s(item.kind),
      s(item.relatedCapability),
      s(item.title),
    ].join("|");

    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}
