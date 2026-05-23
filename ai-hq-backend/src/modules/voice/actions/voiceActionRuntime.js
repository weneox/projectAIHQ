import {
  normalizeVoiceActionRuntime,
} from "./voiceActionContracts.js";
import {
  VOICE_OPERATION_TYPES,
  normalizeVoiceActionOutcome,
  normalizeVoiceBusinessFamily,
  normalizeVoiceRequestType,
} from "./voiceOperationTaxonomy.js";
import {
  analyzeVoiceActionState,
} from "../callState.js";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
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
    Object.entries(input).filter(([, item]) => {
      if (item === undefined || item === null || item === "") return false;
      if (Array.isArray(item)) return item.length > 0;
      if (typeof item === "object") return Object.keys(item).length > 0;
      return true;
    })
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

  if (actionName === "create_business_request") {
    return s(
      runtimeConfig.universalRequestProvider ||
        actions.universalRequestProvider ||
        obj(actions.universalRequest).provider ||
        actions.provider
    ).toLowerCase();
  }

  return s(actions.provider || runtimeConfig.actionProvider).toLowerCase();
}

function isDemoProvider(value = "") {
  return ["internal_demo", "demo", "mock"].includes(s(value).toLowerCase());
}

function actionModeForName(runtime = {}, actionName = "") {
  if (actionName === "check_availability") return runtime.availabilityMode;
  if (actionName === "create_reservation_request") return runtime.reservationMode;
  if (actionName === "create_order_request") return runtime.orderingMode;
  if (actionName === "create_appointment_request") return runtime.appointmentMode;
  if (actionName === "create_handoff_request") return runtime.handoffMode;
  if (actionName === "create_business_request") return runtime.universalRequestMode;
  return "";
}

function outcomeTypeForAction(actionName = "") {
  const name = s(actionName);

  if (name === "check_availability") return "availability_checked";
  if (name === "create_business_request") return "business_request_created";
  if (name === "create_reservation_request") return "reservation_request_created";
  if (name === "create_order_request") return "order_request_created";
  if (name === "create_appointment_request") return "appointment_request_created";
  if (name === "create_handoff_request") return "handoff_requested";
  if (name === "end_call") return "call_ended";

  return "voice_action_unknown";
}

function dbSafeOutcomeForActionResult({ action = "", detailedOutcome = "", result = {} } = {}) {
  const safe = normalizeVoiceActionOutcome(result.outcome);
  if (safe !== "unknown") return safe;

  if (s(action) === "create_handoff_request") return "callback_requested";

  if (
    s(action) === "create_business_request" &&
    s(result.payload?.phone || result.payload?.customerPhone || result.payload?.customer_phone)
  ) {
    return "callback_requested";
  }

  if (s(detailedOutcome) === "handoff_requested") return "callback_requested";
  if (s(result.status) === VOICE_ACTION_RESULT_STATUS.PROVIDER_NOT_CONFIGURED) return "failed";

  return "unknown";
}

function summarizeVoiceAction({ actionName = "", payload = {}, status = "" } = {}) {
  const action = s(actionName);
  const phone = s(payload.phone || payload.customerPhone || payload.customer_phone);
  const name = s(payload.customerName || payload.customer_name || payload.name);
  const service = s(payload.service || payload.service_type || payload.intent || payload.reason);
  const date = s(payload.date || payload.preferredDate || payload.preferred_date);
  const time = s(payload.time || payload.preferredTime || payload.preferred_time);
  const summary = s(payload.summary);

  if (summary) return summary;

  if (action === "create_handoff_request") {
    return [name, phone, service].filter(Boolean).join(" | ") || "Human handoff requested.";
  }

  if (action === "create_business_request") {
    return [
      s(payload.requestType),
      s(payload.description || payload.intent || payload.issue),
      s(payload.phone || payload.customerPhone || payload.customer_phone),
    ].filter(Boolean).join(" | ") || "Business request captured.";
  }

  if (action === "create_appointment_request") {
    return [service, date, time, name, phone].filter(Boolean).join(" | ") ||
      "Appointment request captured.";
  }

  if (action === "create_reservation_request") {
    return [
      date,
      time,
      payload.partySize ? `${payload.partySize} people` : "",
      name,
      phone,
    ].filter(Boolean).join(" | ") || "Reservation request captured.";
  }

  if (action === "create_order_request") {
    return [
      Array.isArray(payload.items) ? `${payload.items.length} item` : "",
      s(payload.fulfillment),
      phone,
    ].filter(Boolean).join(" | ") || "Order request captured.";
  }

  if (action === "check_availability") {
    return status === VOICE_ACTION_RESULT_STATUS.LIVE_AVAILABLE
      ? "Live availability checked."
      : "Availability could not be confirmed.";
  }

  if (action === "end_call") {
    return "Call ended.";
  }

  return "Voice action executed.";
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
    message: "Demo provider shows availability for the requested criteria.",
  };
}

export function buildVoiceActionCallPatch({ result = {}, call = {} } = {}) {
  const action = s(result.action);
  if (!action) return {};

  const payload = cleanPayload(result.payload || result.criteria || {});
  const outcome =
    result.status === VOICE_ACTION_RESULT_STATUS.MISSING_REQUIRED_FIELDS
      ? "voice_action_missing_required_fields"
      : outcomeTypeForAction(action);

  const safeOutcome = dbSafeOutcomeForActionResult({
    action,
    detailedOutcome: outcome,
    result,
  });

  const summary = summarizeVoiceAction({
    actionName: action,
    payload,
    status: result.status,
  });

  const previousExtraction = obj(call.extraction);
  const previousMeta = obj(call.meta);

  const patch = {
    outcome: safeOutcome,
    summary: summary || s(call.summary),
    extraction: {
      ...previousExtraction,
      voiceOutcome: {
        type: outcome,
        dbOutcome: safeOutcome,
        action,
        status: s(result.status),
        confirmed: result.confirmed === true,
        requestOnly: result.requestOnly === true,
        requestId: s(result.requestId),
        payload,
        missingRequired: Array.isArray(result.missingRequired) ? result.missingRequired : [],
        nextMissing: result.nextMissing || null,
        message: s(result.message),
        createdAt: new Date().toISOString(),
      },
    },
    meta: {
      ...previousMeta,
      lastVoiceAction: {
        action,
        outcome,
        dbOutcome: safeOutcome,
        status: s(result.status),
        requestId: s(result.requestId),
        shouldEndCall: result.shouldEndCall === true,
        at: new Date().toISOString(),
      },
    },
  };

  const phone = s(payload.phone || payload.customerPhone || payload.customer_phone);
  if (phone) {
    patch.callbackRequested = true;
    patch.callbackPhone = phone;
  }

  if (action === "create_handoff_request") {
    patch.handoffRequested = true;
    patch.handoffTarget = s(payload.reason || "operator") || "operator";
  }

  if (action === "create_business_request") {
    patch.extraction.universalBusinessRequest = obj(result.universal);
  }

  return patch;
}

export const VOICE_ACTION_RESULT_STATUS = Object.freeze({
  PROVIDER_NOT_CONFIGURED: "provider_not_configured",
  ACTION_DISABLED: "action_disabled",
  LIVE_AVAILABLE: "live_available",
  REQUEST_RECORDED: "request_recorded",
  CALL_ENDED: "call_ended",
  UNKNOWN_ACTION: "unknown_action",
  MISSING_REQUIRED_FIELDS: "missing_required_fields",
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
  const actionState = analyzeVoiceActionState({
    actionName,
    payload,
    call,
    runtimeConfig,
  });

  if (actionName === "end_call") {
    return {
      ok: true,
      action: actionName,
      status: VOICE_ACTION_RESULT_STATUS.CALL_ENDED,
      shouldEndCall: true,
      confirmed: true,
      summary: s(payload.summary || "Caller ended the conversation."),
      payload,
      voiceState: actionState,
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
        voiceState: actionState,
        message: "Live availability is disabled for this business.",
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
      voiceState: actionState,
      message: "Live availability provider is not configured for this business.",
    };
  }

  if (
    [
      "create_business_request",
      "create_reservation_request",
      "create_order_request",
      "create_appointment_request",
      "create_handoff_request",
    ].includes(actionName)
  ) {
    if (!actionState.ok) {
      return {
        ok: false,
        action: actionName,
        status: VOICE_ACTION_RESULT_STATUS.MISSING_REQUIRED_FIELDS,
        confirmed: false,
        requestOnly: true,
        missingRequired: actionState.missingRequired,
        nextMissing: actionState.nextMissing,
        nextPromptHint: actionState.nextPromptHint,
        voiceState: actionState,
        payload,
        callId: s(call.id || call.callId || call.call_id),
        tenantId: s(scope.tenantId),
        tenantKey: s(scope.tenantKey),
        message: "Required structured fields are missing.",
      };
    }

    if (!["live", "request_only"].includes(mode)) {
      return {
        ok: false,
        action: actionName,
        status: VOICE_ACTION_RESULT_STATUS.ACTION_DISABLED,
        confirmed: false,
        requestOnly: false,
        payload,
        voiceState: actionState,
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
      ...(actionName === "create_business_request"
        ? {
            universal: {
              operationType: VOICE_OPERATION_TYPES.CREATE_REQUEST,
              requestType: normalizeVoiceRequestType(payload.requestType),
              businessFamily: normalizeVoiceBusinessFamily(runtime.businessFamily),
              collectedSlots: actionState.collectedSlots || {},
            },
          }
        : {}),
      voiceState: actionState,
      callId: s(call.id || call.callId || call.call_id),
      tenantId: s(scope.tenantId),
      tenantKey: s(scope.tenantKey),
      message: "Request was recorded for human or operator follow-up.",
    };
  }

  return {
    ok: false,
    action: actionName,
    status: VOICE_ACTION_RESULT_STATUS.UNKNOWN_ACTION,
    confirmed: false,
    payload,
    voiceState: actionState,
    message: "Unknown voice action.",
  };
}
