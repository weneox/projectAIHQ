import { s } from "./shared.js";

const TERMINAL_SESSION_STATUSES = new Set(["completed", "failed"]);

export function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

export function isTerminalSessionStatus(status = "") {
  return TERMINAL_SESSION_STATUSES.has(lower(status));
}

export function buildSessionStateConflict({
  currentStatus = "",
  requestedStatus = "",
  eventType = "",
} = {}) {
  const current = lower(currentStatus);
  const requested = lower(requestedStatus);

  return {
    ok: false,
    statusCode: 409,
    error: "voice_session_state_conflict",
    mutationOutcome: "rejected",
    details: {
      reasonCode:
        requested && requested !== current
          ? "terminal_state_regression"
          : "terminal_state_conflict",
      currentStatus: current,
      requestedStatus: requested,
      eventType: s(eventType),
    },
  };
}
