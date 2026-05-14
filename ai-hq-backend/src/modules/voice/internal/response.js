import { s } from "../shared.js";

export function buildVoiceInternalOkResult(payload = {}, extra = {}) {
  return {
    ok: true,
    statusCode: 200,
    payload,
    ...extra,
  };
}

export function buildVoiceInternalErrorResult({
  statusCode = 500,
  error = "voice_internal_error",
  details,
  ...extra
} = {}) {
  const result = {
    ok: false,
    statusCode: Number(statusCode || 500),
    error: s(error || "voice_internal_error"),
  };

  if (details !== undefined) {
    result.details = details;
  }

  return {
    ...result,
    ...extra,
  };
}

export function buildVoiceInternalPayloadResult(result = {}) {
  return {
    ok: result.ok,
    statusCode: result.statusCode,
    payload: result.payload,
  };
}
