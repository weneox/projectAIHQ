import {
  bool,
  normalizeConfidence,
  normalizePriority,
  obj,
  s,
} from "./helpers.js";

export function createSystemSignal(input = {}) {
  const context = obj(input.context);
  const target = obj(input.target);

  return {
    id: s(input.id),
    kind: s(input.kind || "signal").toLowerCase(),
    relatedCapability: s(input.relatedCapability || "workspace").toLowerCase(),
    sourceSubsystem: s(input.sourceSubsystem || "workspace").toLowerCase(),
    statusCode: s(input.statusCode || input.status).toLowerCase(),
    reasonCode: s(input.reasonCode).toLowerCase(),
    priority: normalizePriority(input.priority),
    confidence: normalizeConfidence(input.confidence),
    timestamp: s(input.timestamp),
    actor: s(input.actor),
    requiresHuman: bool(input.requiresHuman),
    canAutoFix: bool(input.canAutoFix),
    evidenceSummary: Array.isArray(input.evidenceSummary)
      ? input.evidenceSummary.map((item) => s(item)).filter(Boolean)
      : [],
    detailRef:
      input.detailRef && typeof input.detailRef === "object"
        ? {
            type: s(input.detailRef.type),
            id: s(input.detailRef.id),
          }
        : null,
    target:
      target && (target.kind || target.actionKind)
        ? {
            kind: s(target.kind || target.actionKind).toLowerCase(),
            allowed: target.allowed !== false,
          }
        : null,
    context,
  };
}
