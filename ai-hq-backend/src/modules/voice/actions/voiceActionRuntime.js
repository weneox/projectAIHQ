import {
  normalizeVoiceActionRuntime,
} from "./voiceActionContracts.js";

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

function readActionProvider(runtimeConfig = {}, actionName = "") {
  const actions = obj(runtimeConfig.actions || runtimeConfig.voiceActions);
  const availability = obj(actions.availability);
  const reservation = obj(actions.reservation);
  const ordering = obj(actions.ordering);
  const appointment = obj(actions.appointment);

  if (actionName === "check_availability") {
    return s(
      runtimeConfig.availabilityProvider ||
        actions.availabilityProvider ||
        availability.provider ||
        actions.provider
    ).toLowerCase();
  }

  if (actionName === "create_reservation_request") {
    return s(
      runtimeConfig.reservationProvider ||
        actions.reservationProvider ||
        reservation.provider ||
        actions.provider
    ).toLowerCase();
  }

  if (actionName === "create_order_request") {
    return s(
      runtimeConfig.orderingProvider ||
        actions.orderingProvider ||
        ordering.provider ||
        actions.provider
    ).toLowerCase();
  }

  if (actionName === "create_appointment_request") {
    return s(
      runtimeConfig.appointmentProvider ||
        actions.appointmentProvider ||
        appointment.provider ||
        actions.provider
    ).toLowerCase();
  }

  return s(actions.provider || runtimeConfig.actionProvider).toLowerCase();
}

function isDemoProvider(value = "") {
  return ["internal_demo", "demo", "mock"].includes(s(value).toLowerCase());
}

function buildDemoAvailability({ runtime = {}, payload = {} } = {}) {
  const family = s(runtime.businessFamily || "business");
  const criteria = cleanPayload(payload);

  return {
    ok: true,
    action: "check_availability",
    status: VOICE_ACTION_RESULT_STATUS.LIVE_AVAILABLE,
    confirmed: true,
    live: true,
    provider: "internal_demo",
    businessFamily: family,
    criteria,
    available: true,
    message:
      family === "restaurant"
        ? "Demo provider shows availability for the requested table criteria."
        : family === "hotel"
          ? "Demo provider shows availability for the requested room criteria."
          : family === "clinic" || family === "salon"
            ? "Demo provider shows availability for the requested appointment criteria."
            : "Demo provider shows availability for the requested criteria.",
  };
}

function actionModeForName(runtime = {}, actionName = "") {
  if (actionName === "check_availability") return runtime.availabilityMode;
  if (actionName === "create_reservation_request") return runtime.reservationMode;
  if (actionName === "create_order_request") return runtime.orderingMode;
  if (actionName === "create_appointment_request") return runtime.appointmentMode;
  if (actionName === "create_handoff_request") return runtime.handoffMode;
  return "";
}

export const VOICE_ACTION_RESULT_STATUS = Object.freeze({
  PROVIDER_NOT_CONFIGURED: "provider_not_configured",
  ACTION_DISABLED: "action_disabled",
  LIVE_AVAILABLE: "live_available",
  REQUEST_RECORDED: "request_recorded",
  CALL_ENDED: "call_ended",
  UNKNOWN_ACTION: "unknown_action",
});

export async function executeVoiceAction({
  name = "",
  args = {},
  call = {},
  scope = {},
  runtimeConfig = {},
} = {}) {
  const actionName = s(name);
  const payload = cleanPayload(args);
  const runtime = normalizeVoiceActionRuntime(runtimeConfig);
  const mode = actionModeForName(runtime, actionName);
  const provider = readActionProvider(runtimeConfig, actionName);

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
    if (mode !== "live") {
      return {
        ok: false,
        action: actionName,
        status: VOICE_ACTION_RESULT_STATUS.ACTION_DISABLED,
        confirmed: false,
        live: false,
        criteria: payload,
        message:
          "Live availability is disabled for this business. Do not claim availability is confirmed.",
      };
    }

    if (isDemoProvider(provider)) {
      return buildDemoAvailability({ runtime, payload });
    }

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
    if (!["live", "request_only"].includes(mode)) {
      return {
        ok: false,
        action: actionName,
        status: VOICE_ACTION_RESULT_STATUS.ACTION_DISABLED,
        confirmed: false,
        requestOnly: false,
        payload,
        message: "This action is not enabled for the current business runtime.",
      };
    }

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
