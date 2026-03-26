function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function normalizeAction(value = {}) {
  const action = obj(value);
  return {
    id: s(action.id),
    kind: s(action.kind || "focus").toLowerCase(),
    label: s(action.label || "Review blocker"),
    requiredRole: s(action.requiredRole || action.required_role || "operator").toLowerCase(),
    allowed: typeof action.allowed === "boolean" ? action.allowed : true,
    target: obj(action.target),
  };
}

function normalizeBlocker(value = {}) {
  const item = obj(value);
  const action = normalizeAction(item.action || item.nextAction || item.repairAction);

  return {
    blocked:
      typeof item.blocked === "boolean"
        ? item.blocked
        : s(item.reasonCode || item.reason_code) !== "",
    category: s(item.category).toLowerCase(),
    dependencyType: s(item.dependencyType || item.dependency_type).toLowerCase(),
    title: s(item.title || item.label || "Operational blocker"),
    subtitle: s(item.subtitle || item.message || item.explanation),
    reasonCode: s(item.reasonCode || item.reason_code).toLowerCase(),
    missing: arr(item.missing || item.missingDependencies || item.dependencies)
      .map((entry) => s(entry))
      .filter(Boolean),
    suggestedRepairActionId: s(
      item.suggestedRepairActionId || item.suggested_repair_action_id || action.id
    ),
    action,
  };
}

export function createReadinessViewModel(readiness = {}, blockersOverride) {
  const source = obj(readiness);
  const incomingBlockers =
    blockersOverride !== undefined
      ? arr(blockersOverride)
      : Array.isArray(source.blockers)
      ? source.blockers
      : arr(source.blockers?.items);
  const blockers = incomingBlockers.map((item) => normalizeBlocker(item));
  const blockedItems = blockers.filter((item) => item.blocked);
  const status = s(source.status || (blockedItems.length ? "blocked" : "ready")).toLowerCase();

  return {
    status,
    blocked: source.blocked === true || status === "blocked" || blockedItems.length > 0,
    intentionallyUnavailable: source.intentionallyUnavailable === true,
    reasonCode: s(source.reasonCode || source.reason_code).toLowerCase(),
    message: s(source.message),
    blockers,
    blockedItems,
    repairActions: arr(source.repairActions).map((item) => normalizeAction(item)),
  };
}
