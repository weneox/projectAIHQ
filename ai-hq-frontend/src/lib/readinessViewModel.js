import {
  validateOperationalRepairAction,
  validateReadinessSurface,
} from "@aihq/shared-contracts/operations";

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
  if (!Object.keys(action).length) {
    return {
      id: "",
      kind: "focus",
      label: "Review blocker",
      requiredRole: "operator",
      allowed: false,
      target: {},
    };
  }

  const checked = validateOperationalRepairAction(action);
  if (checked.ok) {
    return checked.value;
  }

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
  const action = normalizeAction(item.nextAction || item.action || item.repairAction);

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
    nextAction: action,
    action,
  };
}

export function createReadinessViewModel(readiness = {}, blockersOverride) {
  const source = obj(readiness);
  const contractInput =
    blockersOverride === undefined
      ? source
      : {
          ...source,
          blockers: arr(blockersOverride),
        };
  const checked = validateReadinessSurface(contractInput);
  const safeValue = checked.ok
    ? checked.value
    : {
        status: s(source.status || "ready").toLowerCase(),
        intentionallyUnavailable: source.intentionallyUnavailable === true,
        reasonCode: s(source.reasonCode || source.reason_code).toLowerCase(),
        message: s(source.message),
        blockers: [],
      };
  const blockers = arr(safeValue.blockers).map((item) => normalizeBlocker(item));
  const blockedItems = blockers.filter((item) => item.blocked);
  const status = s(safeValue.status || (blockedItems.length ? "blocked" : "ready")).toLowerCase();

  return {
    status,
    blocked: source.blocked === true || status === "blocked" || blockedItems.length > 0,
    intentionallyUnavailable: safeValue.intentionallyUnavailable === true,
    reasonCode: s(safeValue.reasonCode).toLowerCase(),
    message: s(safeValue.message),
    blockers,
    blockedItems,
    repairActions: arr(source.repairActions)
      .map((item) => normalizeAction(item))
      .filter((item) => item.id || item.label),
  };
}
