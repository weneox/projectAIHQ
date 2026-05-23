import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVoiceActionCallPatch,
  executeVoiceAction,
} from "../src/modules/voice/actions/voiceActionRuntime.js";
import {
  buildVoiceActionToolDefinitions,
  normalizeVoiceActionRuntime,
} from "../src/modules/voice/actions/voiceActionContracts.js";
import {
  VOICE_OPERATION_TYPES,
  VOICE_LEGACY_ACTION_OPERATION_MAP,
  VOICE_REQUEST_TYPES,
  normalizeVoiceRequestType,
} from "../src/modules/voice/actions/voiceOperationTaxonomy.js";
import {
  analyzeUniversalVoiceSlots,
} from "../src/modules/voice/actions/voiceUniversalSlots.js";

test("create_business_request missing required details returns one structured prompt hint", async () => {
  const result = await executeVoiceAction({
    name: "create_business_request",
    args: {
      requestType: "repair_request",
    },
    call: {
      id: "call-1",
      fromNumber: "browser",
      language: "en",
    },
    scope: {
      tenantId: "tenant-1",
      tenantKey: "acme",
    },
    runtimeConfig: {
      businessFamily: "repair_service",
      universalRequestMode: "request_only",
      defaultLanguage: "en",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "missing_required_fields");
  assert.equal(result.confirmed, false);
  assert.equal(result.nextMissing.field, "issue");
  assert.equal(result.nextPromptHint.field, "issue");
  assert.equal("nextQuestion" in result, false);
  assert.equal("assistantInstruction" in result, false);
  assert.equal(result.missingRequired.length >= 1, true);
});

test("create_business_request complete request records request-only universal payload", async () => {
  const result = await executeVoiceAction({
    name: "create_business_request",
    args: {
      requestType: "quote_request",
      description: "Need a quote for office cleaning",
      phone: "+994501112233",
      budget: "monthly",
    },
    call: {
      id: "call-2",
      fromNumber: "browser",
    },
    scope: {
      tenantId: "tenant-1",
      tenantKey: "acme",
    },
    runtimeConfig: {
      businessFamily: "b2b_service",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.action, "create_business_request");
  assert.equal(result.status, "request_recorded");
  assert.equal(result.confirmed, false);
  assert.equal(result.requestOnly, true);
  assert.equal(result.universal.operationType, VOICE_OPERATION_TYPES.CREATE_REQUEST);
  assert.equal(result.universal.requestType, VOICE_REQUEST_TYPES.QUOTE_REQUEST);
  assert.equal(result.universal.businessFamily, "b2b_service");
  assert.equal(result.universal.collectedSlots.phone, "+994501112233");
  assert.match(result.message, /recorded/i);
  assert.doesNotMatch(result.message, /confirmed/i);
});

test("create_business_request supports broad request types", async () => {
  for (const requestType of [
    "repair_request",
    "quote_request",
    "rental_request",
    "support_ticket",
    "consultation_request",
    "custom_request",
  ]) {
    const result = await executeVoiceAction({
      name: "create_business_request",
      args: {
        requestType,
        description: `Need help with ${requestType}`,
        phone: "+994501112233",
      },
      call: { id: `call-${requestType}`, fromNumber: "browser" },
      scope: { tenantId: "tenant-1", tenantKey: "acme" },
      runtimeConfig: { businessFamily: "generic_business" },
    });

    assert.equal(result.ok, true, `${requestType} should be supported`);
    assert.equal(result.universal.requestType, normalizeVoiceRequestType(requestType));
    assert.equal(result.confirmed, false);
  }
});

test("browser caller does not satisfy phone but real caller phone can", () => {
  const browserState = analyzeUniversalVoiceSlots({
    operationType: "create_request",
    requestType: "repair_request",
    payload: {
      requestType: "repair_request",
      description: "Washer repair",
    },
    call: {
      fromNumber: "browser",
    },
  });

  assert.equal(
    browserState.missingRequired.some((item) => item.field === "phone"),
    true
  );

  const realPhoneState = analyzeUniversalVoiceSlots({
    operationType: "create_request",
    requestType: "repair_request",
    payload: {
      requestType: "repair_request",
      description: "Washer repair",
    },
    call: {
      fromNumber: "+994501112233",
    },
  });

  assert.equal(realPhoneState.ok, true);
  assert.equal(realPhoneState.collectedSlots.phone, "+994501112233");
});

test("universal request tool is enabled by default and old tools remain", () => {
  const runtime = normalizeVoiceActionRuntime({
    reservationMode: "request_only",
    orderingMode: "request_only",
    appointmentMode: "request_only",
    handoffMode: "request_only",
  });
  const tools = buildVoiceActionToolDefinitions(runtime);
  const toolNames = tools.map((tool) => tool.name);

  assert.equal(runtime.universalRequestMode, "request_only");
  assert.equal(toolNames.includes("create_business_request"), true);
  assert.equal(toolNames.includes("create_reservation_request"), true);
  assert.equal(toolNames.includes("create_order_request"), true);
  assert.equal(toolNames.includes("create_appointment_request"), true);
  assert.equal(toolNames.includes("create_handoff_request"), true);
  assert.equal(toolNames.includes("end_call"), true);
  assert.equal(
    VOICE_LEGACY_ACTION_OPERATION_MAP.create_appointment_request.requestType,
    "appointment_request"
  );
});

test("universal call patch keeps database outcome safe and preserves detailed outcome", async () => {
  const result = await executeVoiceAction({
    name: "create_business_request",
    args: {
      requestType: "rental_request",
      description: "Need equipment rental",
      phone: "+994501112233",
    },
    call: { id: "call-3" },
    scope: { tenantId: "tenant-1", tenantKey: "acme" },
    runtimeConfig: {},
  });
  const patch = buildVoiceActionCallPatch({ result, call: { extraction: {}, meta: {} } });

  assert.equal(patch.outcome, "callback_requested");
  assert.equal(patch.extraction.voiceOutcome.type, "business_request_created");
  assert.equal(patch.extraction.voiceOutcome.dbOutcome, "callback_requested");
  assert.equal(patch.extraction.voiceOutcome.confirmed, false);
  assert.equal(patch.extraction.voiceOutcome.requestOnly, true);
  assert.equal(patch.extraction.universalBusinessRequest.requestType, "rental_request");
});

test("universal slot analysis exposes structured prompt hints", () => {
  const state = analyzeUniversalVoiceSlots({
    operationType: "create_request",
    requestType: "repair_request",
    payload: {
      requestType: "repair_request",
    },
    call: {
      fromNumber: "browser",
    },
    defaultLanguage: "en",
  });

  assert.equal(state.ok, false);
  assert.equal(state.nextMissing.field, "issue");
  assert.equal(state.nextPromptHint.field, "issue");
  assert.equal("nextQuestion" in state, false);
});
