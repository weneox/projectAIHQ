import { s } from "./shared.js";

export function isMissingSchemaError(error) {
  const code = s(error?.code).toUpperCase();
  const message = s(error?.message).toLowerCase();

  if (code === "42P01" || code === "42703") {
    return true;
  }

  return (
    message.includes("does not exist") ||
    message.includes("undefined column") ||
    message.includes("undefined table")
  );
}

export function getSessionCallId(session = {}) {
  return s(
    session?.voiceCallId ||
      session?.voice_call_id ||
      session?.callId ||
      session?.call_id
  );
}

export function sessionMatchesCall(session = {}, callId = "") {
  return s(getSessionCallId(session)) === s(callId);
}
