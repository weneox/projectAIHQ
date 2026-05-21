function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function requestId(prefix = "voice_action") {
  return `${prefix}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

function cleanPayload(value = {}) {
  const input = obj(value);
  return Object.fromEntries(
    Object.entries(input).filter(([, item]) => item !== undefined && item !== null && item !== "")
  );
}

export const VOICE_ACTION_RESULT_STATUS = Object.freeze({
  PROVIDER_NOT_CONFIGURED: "provider_not_configured",
  REQUEST_RECORDED: "request_recorded",
  CALL_ENDED: "call_ended",
  UNKNOWN_ACTION: "unknown_action",
});

export async function executeVoiceAction({ name = "", args = {}, call = {}, scope = {} } = {}) {
  const actionName = s(name);
  const payload = cleanPayload(args);

  if (actionName === "end_call") {
    return {
      ok: true,
      action: actionName,
      status: VOICE_ACTION_RESULT_STATUS.CALL_ENDED,
      shouldEndCall: true,
      confirmed: true,
      summary: s(payload.summary || "Caller ended the conversation."),
    };
  }

  if (actionName === "check_availability") {
    return {
      ok: false,
      action: actionName,
      status: VOICE_ACTION_RESULT_STATUS.PROVIDER_NOT_CONFIGURED,
      confirmed: false,
      live: false,
      criteria: payload,
      message:
        "Live availability provider is not configured for this business yet. Do not claim availability is confirmed.",
    };
  }

  if (
    [
      "create_reservation_request",
      "create_order_request",
      "create_appointment_request",
      "create_handoff_request",
    ].includes(actionName)
  ) {
    return {
      ok: true,
      action: actionName,
      status: VOICE_ACTION_RESULT_STATUS.REQUEST_RECORDED,
      confirmed: false,
      requestOnly: true,
      requestId: requestId(actionName),
      payload,
      callId: s(call.id || call.callId || call.call_id),
      tenantId: s(scope.tenantId),
      tenantKey: s(scope.tenantKey),
      message:
        "Request was recorded for human/operator follow-up. Do not say booking/order/appointment is confirmed.",
    };
  }

  return {
    ok: false,
    action: actionName,
    status: VOICE_ACTION_RESULT_STATUS.UNKNOWN_ACTION,
    confirmed: false,
    message: "Unknown voice action.",
  };
}
