import { createSystemSignal, s } from "../contracts/index.js";

function titleize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (item) => item.toUpperCase());
}

function channelSurfaceToCapability(surface = "") {
  const next = s(surface).toLowerCase();
  if (next.includes("whatsapp")) return "whatsapp";
  if (next.includes("instagram")) return "instagram";
  if (next.includes("voice")) return "voice";
  if (next.includes("meta")) return "meta";
  if (next.includes("comment")) return "comments";
  if (next.includes("publish")) return "publish";
  if (next.includes("inbox")) return "inbox";
  return "channel_safety";
}

function normalizeCapabilityTone(item = {}) {
  if (item?.repairRequired || item?.policyOutcome === "blocked") return "blocked";
  if (item?.reviewRequired || item?.handoffRequired) return "review_only";
  if (item?.policyOutcome === "allowed") return "autonomous";
  return item?.policyOutcome || item?.autonomyStatus || "limited";
}

function targetKindForSurface(surface = "") {
  const next = s(surface).toLowerCase();
  if (next === "comments") return "comments";
  if (next === "inbox") return "inbox";
  return "policy_controls";
}

function buildChannelAutonomySignals(trust = {}) {
  const autonomyItems =
    trust?.summary?.channelAutonomy?.items && Array.isArray(trust.summary.channelAutonomy.items)
      ? trust.summary.channelAutonomy.items
      : [];

  return autonomyItems.slice(0, 6).map((item, index) =>
    createSystemSignal({
      id: `capability-${item?.surface || index}`,
      kind: "capability_state",
      relatedCapability: channelSurfaceToCapability(item?.surface),
      sourceSubsystem: "capability_state",
      statusCode: normalizeCapabilityTone(item),
      priority: item?.repairRequired ? "high" : item?.reviewRequired ? "medium" : "low",
      confidence: item?.telemetryAvailable === false ? 0.55 : 0.86,
      requiresHuman: item?.reviewRequired === true || item?.handoffRequired === true,
      canAutoFix: false,
      target: {
        kind: targetKindForSurface(item?.surface),
        allowed: item?.nextAction?.allowed !== false,
      },
      evidenceSummary: [
        item?.policyOutcome,
        item?.requiredRole,
        ...(Array.isArray(item?.reasonCodes) ? item.reasonCodes : []),
      ].filter(Boolean),
      context: {
        title: `${titleize(item?.surface || "channel")} is ${titleize(
          normalizeCapabilityTone(item)
        )}`,
        subjectName: titleize(item?.surface || "channel"),
        statusLabel: normalizeCapabilityTone(item),
        summary:
          item?.explanation || "Current channel capability posture is available.",
        reasonSummary:
          item?.requiredAction
            ? `Next requirement: ${item.requiredAction}.`
            : item?.policyOutcome
              ? `Policy posture is ${titleize(item.policyOutcome)}.`
              : "Runtime and policy posture were combined into a single capability summary.",
        impactSummary:
          item?.reviewRequired || item?.handoffRequired
            ? "This channel can assist, but a person still needs to review or send the final output."
            : item?.repairRequired
              ? "This channel should be treated as unavailable until it is repaired."
              : "This channel can continue operating under its current posture.",
      },
    })
  );
}

function buildRuntimeSafetySignal(trust = {}) {
  const posture = trust?.summary?.policyPosture || {};
  const executionPosture = s(posture?.executionPosture || "unknown");

  return createSystemSignal({
    id: "capability-channel-safety",
    kind: "capability_state",
    relatedCapability: "channel_safety",
    sourceSubsystem: "capability_state",
    statusCode: executionPosture || "unknown",
    priority:
      posture?.blocked || posture?.blockedUntilRepair
        ? "high"
        : posture?.reviewRequired
          ? "medium"
          : "low",
    confidence: 0.83,
    requiresHuman: posture?.reviewRequired === true || posture?.handoffRequired === true,
    canAutoFix: false,
    target: {
      kind: "policy_controls",
      allowed: posture?.nextAction?.allowed !== false,
    },
    evidenceSummary: Array.isArray(posture?.reasons) ? posture.reasons : [],
    context: {
      title: `Channel safety is ${titleize(executionPosture || "unknown")}`,
      subjectName: "Channel safety",
      statusLabel: executionPosture || "unknown",
      summary:
        posture?.explanation ||
        "The system combined approval, runtime, and policy posture into one safety summary.",
      reasonSummary:
        posture?.requiredAction
          ? `Current next step: ${posture.requiredAction}.`
          : "No single next action was returned.",
      impactSummary:
        posture?.blocked || posture?.blockedUntilRepair
          ? "Automation remains constrained until safety posture improves."
          : "Channels can continue operating within the current safety posture.",
    },
  });
}

export function buildCapabilitySystemSignals({
  trust = null,
} = {}) {
  return [
    buildRuntimeSafetySignal(trust || {}),
    ...buildChannelAutonomySignals(trust || {}),
  ].filter(Boolean);
}
