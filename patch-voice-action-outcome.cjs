const fs = require("fs");

const runtimePath = "ai-hq-backend/src/modules/voice/actions/voiceActionRuntime.js";
const publicPath = "ai-hq-backend/src/routes/api/voice/public.js";

let runtime = fs.readFileSync(runtimePath, "utf8");

if (!runtime.includes("function outcomeTypeForAction")) {
  const marker = `function actionModeForName(runtime = {}, actionName = "") {
  if (actionName === "check_availability") return runtime.availabilityMode;
  if (actionName === "create_reservation_request") return runtime.reservationMode;
  if (actionName === "create_order_request") return runtime.orderingMode;
  if (actionName === "create_appointment_request") return runtime.appointmentMode;
  if (actionName === "create_handoff_request") return runtime.handoffMode;
  return "";
}
`;

  const addition = `
function outcomeTypeForAction(actionName = "") {
  const name = s(actionName);
  if (name === "check_availability") return "availability_checked";
  if (name === "create_reservation_request") return "reservation_request_created";
  if (name === "create_order_request") return "order_request_created";
  if (name === "create_appointment_request") return "appointment_request_created";
  if (name === "create_handoff_request") return "handoff_requested";
  if (name === "end_call") return "call_ended";
  return "voice_action_unknown";
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

  if (action === "create_appointment_request") {
    return [service, date, time, name, phone].filter(Boolean).join(" | ") || "Appointment request captured.";
  }

  if (action === "create_reservation_request") {
    return [date, time, payload.partySize ? \`\${payload.partySize} nəfər\` : "", name, phone]
      .filter(Boolean)
      .join(" | ") || "Reservation request captured.";
  }

  if (action === "create_order_request") {
    return [Array.isArray(payload.items) ? \`\${payload.items.length} item\` : "", s(payload.fulfillment), phone]
      .filter(Boolean)
      .join(" | ") || "Order request captured.";
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

export function buildVoiceActionCallPatch({ result = {}, call = {} } = {}) {
  const action = s(result.action);
  if (!action) return {};

  const payload = cleanPayload(result.payload || result.criteria || {});
  const outcome = outcomeTypeForAction(action);
  const summary = summarizeVoiceAction({
    actionName: action,
    payload,
    status: result.status,
  });

  const previousExtraction = obj(call.extraction);
  const previousMeta = obj(call.meta);

  const patch = {
    outcome,
    summary: summary || s(call.summary),
    extraction: {
      ...previousExtraction,
      voiceOutcome: {
        type: outcome,
        action,
        status: s(result.status),
        confirmed: result.confirmed === true,
        requestOnly: result.requestOnly === true,
        requestId: s(result.requestId),
        payload,
        message: s(result.message),
        createdAt: new Date().toISOString(),
      },
    },
    meta: {
      ...previousMeta,
      lastVoiceAction: {
        action,
        outcome,
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

  return patch;
}
`;

  runtime = runtime.replace(marker, marker + addition);
}

fs.writeFileSync(runtimePath, runtime);

let pub = fs.readFileSync(publicPath, "utf8");

pub = pub.replace(
  `import {
  executeVoiceAction,
} from "../../../modules/voice/actions/voiceActionRuntime.js";`,
  `import {
  buildVoiceActionCallPatch,
  executeVoiceAction,
} from "../../../modules/voice/actions/voiceActionRuntime.js";`
);

const routeMarker = `    await appendVoiceCallEvent(db, {
      callId: voiceCallId,
      tenantId: scope.tenantId,
      tenantKey: scope.tenantKey,
      eventType: "browser_voice.tool_executed",
      actor: "system",
      payload: {
        toolCallId,
        toolName,
        arguments: toolArgs,
        result,
      },
    });

    if (result?.shouldEndCall === true) {`;

if (pub.includes(routeMarker) && !pub.includes("buildVoiceActionCallPatch({")) {
  pub = pub.replace(
    routeMarker,
    `    await appendVoiceCallEvent(db, {
      callId: voiceCallId,
      tenantId: scope.tenantId,
      tenantKey: scope.tenantKey,
      eventType: "browser_voice.tool_executed",
      actor: "system",
      payload: {
        toolCallId,
        toolName,
        arguments: toolArgs,
        result,
      },
    });

    const callPatch = buildVoiceActionCallPatch({ result, call });
    if (Object.keys(callPatch).length > 0) {
      await updateVoiceCall(db, voiceCallId, callPatch);
    }

    if (result?.shouldEndCall === true) {`
  );
}

fs.writeFileSync(publicPath, pub);

console.log("voice action outcome patch applied");
