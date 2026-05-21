const fs = require("fs");

const runtimePath = "ai-hq-backend/src/modules/voice/actions/voiceActionRuntime.js";
let code = fs.readFileSync(runtimePath, "utf8");

if (!code.includes('MISSING_REQUIRED_FIELDS: "missing_required_fields"')) {
  code = code.replace(
    `  UNKNOWN_ACTION: "unknown_action",`,
    `  UNKNOWN_ACTION: "unknown_action",
  MISSING_REQUIRED_FIELDS: "missing_required_fields",`
  );
}

if (!code.includes("function validateVoiceActionPayload")) {
  const marker = `function actionModeForName(runtime = {}, actionName = "") {`;

  const helper = `
function readKnownPhone(payload = {}, call = {}) {
  return s(
    payload.phone ||
      payload.customerPhone ||
      payload.customer_phone ||
      payload.callbackPhone ||
      payload.callback_phone ||
      call.fromNumber ||
      call.from ||
      call.phone ||
      call.customerNumber
  );
}

function hasUsefulItems(value) {
  if (Array.isArray(value)) return value.length > 0;
  return !!s(value);
}

function addMissing(list, field, label = field) {
  list.push({ field, label });
}

function validateVoiceActionPayload(actionName = "", payload = {}, call = {}) {
  const action = s(actionName);
  const p = cleanPayload(payload);
  const missingRequired = [];
  const phone = readKnownPhone(p, call);
  const customerName = s(
    p.customerName ||
      p.customer_name ||
      p.name ||
      p.fullName ||
      p.full_name
  );
  const service = s(
    p.service ||
      p.serviceType ||
      p.service_type ||
      p.intent ||
      p.reason
  );
  const date = s(p.date || p.preferredDate || p.preferred_date);
  const time = s(p.time || p.preferredTime || p.preferred_time);

  if (action === "create_appointment_request") {
    if (!service) addMissing(missingRequired, "service", "service");
    if (!date && !time) {
      addMissing(missingRequired, "preferredDateOrTime", "preferred date or time");
    }
    if (!customerName) addMissing(missingRequired, "customerName", "customer name");
    if (!phone) addMissing(missingRequired, "phone", "phone");
  }

  if (action === "create_reservation_request") {
    if (!date) addMissing(missingRequired, "date", "date");
    if (!customerName) addMissing(missingRequired, "customerName", "customer name");
    if (!phone) addMissing(missingRequired, "phone", "phone");
  }

  if (action === "create_order_request") {
    if (!hasUsefulItems(p.items)) addMissing(missingRequired, "items", "items");
    if (!s(p.fulfillment)) addMissing(missingRequired, "fulfillment", "delivery or pickup");
    if (s(p.fulfillment).toLowerCase() === "delivery" && !s(p.address)) {
      addMissing(missingRequired, "address", "delivery address");
    }
    if (!phone) addMissing(missingRequired, "phone", "phone");
  }

  if (action === "create_handoff_request") {
    if (!s(p.reason)) addMissing(missingRequired, "reason", "handoff reason");
    if (!phone) addMissing(missingRequired, "phone", "phone");
    if (!s(p.summary)) addMissing(missingRequired, "summary", "short summary");
  }

  return {
    ok: missingRequired.length === 0,
    missingRequired,
  };
}

`;

  code = code.replace(marker, helper + marker);
}

const requestBlock = `  if (
    [
      "create_reservation_request",
      "create_order_request",
      "create_appointment_request",
      "create_handoff_request",
    ].includes(actionName)
  ) {
    if (!["live", "request_only"].includes(mode)) {`;

if (
  code.includes(requestBlock) &&
  !code.includes("const validation = validateVoiceActionPayload(actionName, payload, call);")
) {
  code = code.replace(
    requestBlock,
    `  if (
    [
      "create_reservation_request",
      "create_order_request",
      "create_appointment_request",
      "create_handoff_request",
    ].includes(actionName)
  ) {
    const validation = validateVoiceActionPayload(actionName, payload, call);
    if (!validation.ok) {
      return {
        ok: false,
        action: actionName,
        status: VOICE_ACTION_RESULT_STATUS.MISSING_REQUIRED_FIELDS,
        confirmed: false,
        requestOnly: true,
        missingRequired: validation.missingRequired,
        payload,
        callId: s(call.id || call.callId || call.call_id),
        tenantId: s(scope.tenantId),
        tenantKey: s(scope.tenantKey),
        message:
          "Required fields are missing. Ask the caller for the missing information one question at a time before creating the request.",
      };
    }

    if (!["live", "request_only"].includes(mode)) {`
  );
}

if (code.includes("const outcome = outcomeTypeForAction(action);")) {
  code = code.replace(
    `  const outcome = outcomeTypeForAction(action);`,
    `  const outcome =
    result.status === VOICE_ACTION_RESULT_STATUS.MISSING_REQUIRED_FIELDS
      ? "voice_action_missing_required_fields"
      : outcomeTypeForAction(action);`
  );
}

fs.writeFileSync(runtimePath, code);

const testPath = "ai-hq-backend/tests/voice-action-runtime-required-slots.test.js";

if (!fs.existsSync(testPath)) {
  fs.writeFileSync(
    testPath,
    `import test from "node:test";
import assert from "node:assert/strict";

import {
  executeVoiceAction,
} from "../src/modules/voice/actions/voiceActionRuntime.js";

test("voice action runtime blocks incomplete appointment requests", async () => {
  const result = await executeVoiceAction({
    name: "create_appointment_request",
    args: {
      service: "implant consultation",
      phone: "+994501112233",
    },
    call: { id: "call_1" },
    scope: { tenantId: "tenant_1", tenantKey: "clinic" },
    runtimeConfig: {
      appointmentMode: "request_only",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "missing_required_fields");
  assert.equal(
    result.missingRequired.some((item) => item.field === "preferredDateOrTime"),
    true
  );
  assert.equal(
    result.missingRequired.some((item) => item.field === "customerName"),
    true
  );
});

test("voice action runtime allows complete appointment requests", async () => {
  const result = await executeVoiceAction({
    name: "create_appointment_request",
    args: {
      service: "implant consultation",
      date: "tomorrow",
      customerName: "Nigar",
      phone: "+994501112233",
    },
    call: { id: "call_1" },
    scope: { tenantId: "tenant_1", tenantKey: "clinic" },
    runtimeConfig: {
      appointmentMode: "request_only",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "request_recorded");
  assert.equal(result.confirmed, false);
  assert.equal(result.requestOnly, true);
});

test("voice action runtime requires delivery address for delivery orders", async () => {
  const result = await executeVoiceAction({
    name: "create_order_request",
    args: {
      items: [{ name: "Pizza" }],
      fulfillment: "delivery",
      phone: "+994501112233",
    },
    call: { id: "call_1" },
    scope: { tenantId: "tenant_1", tenantKey: "restaurant" },
    runtimeConfig: {
      orderingMode: "request_only",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "missing_required_fields");
  assert.equal(
    result.missingRequired.some((item) => item.field === "address"),
    true
  );
});

test("voice action runtime blocks handoff without summary", async () => {
  const result = await executeVoiceAction({
    name: "create_handoff_request",
    args: {
      reason: "price confirmation",
      phone: "+994501112233",
    },
    call: { id: "call_1" },
    scope: { tenantId: "tenant_1", tenantKey: "clinic" },
    runtimeConfig: {
      handoffMode: "request_only",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "missing_required_fields");
  assert.equal(
    result.missingRequired.some((item) => item.field === "summary"),
    true
  );
});
`,
    "utf8"
  );
}

console.log("voice required slot enforcement patch applied");
