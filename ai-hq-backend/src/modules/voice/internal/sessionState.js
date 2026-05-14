import { s } from "../shared.js";
import { lower } from "./primitives.js";
import { buildVoiceInternalErrorResult } from "./response.js";

const TERMINAL_SESSION_STATUSES = new Set(["completed", "failed"]);

export function isTerminalSessionStatus(status = "") {
  return TERMINAL_SESSION_STATUSES.has(lower(status));
}

export function buildSessionStateConflict({
  currentStatus = "",
  requestedStatus = "",
  eventType = "",
} = {}) {
  const requested = lower(requestedStatus);
  const current = lower(currentStatus);

  return buildVoiceInternalErrorResult({
    statusCode: 409,
    error: "voice_session_state_conflict",
    details: {
      reasonCode:
        requested && requested !== current
          ? "terminal_state_regression"
          : "terminal_state_conflict",
      currentStatus: current,
      requestedStatus: requested,
      eventType: s(eventType || "session_state_updated"),
      strict: true,
    },
  });
}
