function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

export const OPERATION_REQUEST_STATUSES = Object.freeze([
  "new",
  "in_review",
  "waiting_customer",
  "contacted",
  "scheduled",
  "resolved",
  "cancelled",
  "failed",
]);

export const OPERATION_REQUEST_PRIORITIES = Object.freeze([
  "low",
  "normal",
  "high",
  "urgent",
]);

export const OPERATION_REQUEST_TERMINAL_STATUSES = Object.freeze([
  "resolved",
  "cancelled",
  "failed",
]);

export const OPERATION_REQUEST_STATUS_TRANSITIONS = Object.freeze({
  new: Object.freeze(["in_review", "waiting_customer", "contacted", "scheduled", "resolved", "cancelled", "failed"]),
  in_review: Object.freeze(["waiting_customer", "contacted", "scheduled", "resolved", "cancelled", "failed"]),
  waiting_customer: Object.freeze(["in_review", "contacted", "scheduled", "resolved", "cancelled", "failed"]),
  contacted: Object.freeze(["in_review", "waiting_customer", "scheduled", "resolved", "cancelled", "failed"]),
  scheduled: Object.freeze(["in_review", "waiting_customer", "contacted", "resolved", "cancelled", "failed"]),
  resolved: Object.freeze([]),
  cancelled: Object.freeze([]),
  failed: Object.freeze([]),
});

export function normalizeOperationRequestStatus(value = "", fallback = "new") {
  const raw = s(value).toLowerCase();
  return OPERATION_REQUEST_STATUSES.includes(raw) ? raw : fallback;
}

export function normalizeOperationRequestPriority(value = "", fallback = "normal") {
  const raw = s(value).toLowerCase();
  return OPERATION_REQUEST_PRIORITIES.includes(raw) ? raw : fallback;
}

export function isValidOperationRequestStatus(value = "") {
  return OPERATION_REQUEST_STATUSES.includes(s(value).toLowerCase());
}

export function isValidOperationRequestPriority(value = "") {
  return OPERATION_REQUEST_PRIORITIES.includes(s(value).toLowerCase());
}

export function isTerminalOperationRequestStatus(value = "") {
  return OPERATION_REQUEST_TERMINAL_STATUSES.includes(
    normalizeOperationRequestStatus(value)
  );
}

export function getAllowedOperationRequestNextStatuses(status = "") {
  const current = normalizeOperationRequestStatus(status);
  return [...(OPERATION_REQUEST_STATUS_TRANSITIONS[current] || [])];
}

export function validateOperationRequestStatusTransition({
  currentStatus = "",
  nextStatus = "",
} = {}) {
  if (nextStatus === undefined || nextStatus === null || s(nextStatus) === "") {
    return { ok: true };
  }

  const current = normalizeOperationRequestStatus(currentStatus);
  const next = s(nextStatus).toLowerCase();

  if (!isValidOperationRequestStatus(next)) {
    return {
      ok: false,
      code: "invalid_operation_request_status",
      currentStatus: current,
      nextStatus: next,
      allowedStatuses: OPERATION_REQUEST_STATUSES,
    };
  }

  if (next === current) {
    return { ok: true, unchanged: true };
  }

  if (isTerminalOperationRequestStatus(current)) {
    return {
      ok: false,
      code: "operation_request_terminal_status_locked",
      currentStatus: current,
      nextStatus: next,
      allowedStatuses: [current],
    };
  }

  const allowed = getAllowedOperationRequestNextStatuses(current);
  if (!allowed.includes(next)) {
    return {
      ok: false,
      code: "invalid_operation_request_status_transition",
      currentStatus: current,
      nextStatus: next,
      allowedStatuses: allowed,
    };
  }

  return {
    ok: true,
    currentStatus: current,
    nextStatus: next,
    allowedStatuses: allowed,
  };
}

export function buildOperationRequestWorkflowMeta({
  body = {},
  current = {},
  patch = {},
  actor = "",
  now = new Date().toISOString(),
} = {}) {
  const input = obj(body);
  const previousWorkflow = obj(current.meta?.workflow);
  const from = normalizeOperationRequestStatus(current.status);
  const to = normalizeOperationRequestStatus(patch.status || current.status);
  const statusChanged = patch.status !== undefined && from !== to;

  const reason = s(
    input.transitionReason ||
      input.statusReason ||
      input.resolutionReason ||
      input.reason
  );

  const operatorNote = s(
    input.operatorNote ||
      input.operatorNotes ||
      input.notes ||
      input.meta?.operatorNotes
  );

  if (!statusChanged && !reason && !operatorNote) {
    return null;
  }

  const transition = {
    at: now,
    actor: s(actor, "user"),
    from,
    to,
    statusChanged,
    reason,
    operatorNote,
  };

  return {
    ...previousWorkflow,
    lastTransition: transition,
    transitions: [...arr(previousWorkflow.transitions).slice(-49), transition],
  };
}
