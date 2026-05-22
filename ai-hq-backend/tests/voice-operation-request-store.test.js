import test from "node:test";
import assert from "node:assert/strict";

import {
  createOperationRequest,
  getOperationRequestByIdForTenant,
  listOperationRequestsForTenant,
  updateOperationRequestForTenant,
} from "../src/db/helpers/operationRequests.js";
import {
  buildOperationRequestFromVoiceResult,
  shouldCreateOperationRequestFromVoiceResult,
} from "../src/modules/voice/actions/voiceOperationRequestBuilder.js";
import {
  executeVoiceAction,
} from "../src/modules/voice/actions/voiceActionRuntime.js";
import {
  persistRealtimeSidebandTrace,
} from "../src/modules/voice/realtimeSidebandPersistence.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const CALL_ID = "22222222-2222-4222-8222-222222222222";

function assertTenantPredicate(sql) {
  const text = String(sql).replace(/\s+/g, " ").toLowerCase();
  if (!text.includes("operation_requests")) return;
  if (!text.includes("select") && !text.includes("update operation_requests")) return;
  const whereClause = text.split(" where ")[1] || "";
  if (!whereClause.includes("tenant_id")) {
    const err = new Error("Tenant-scoped database query requires tenant predicate");
    err.code = "TENANT_PREDICATE_REQUIRED";
    throw err;
  }
}

function rowFromCreateParams(params = []) {
  return {
    id: params[0],
    tenant_id: params[1],
    tenant_key: params[2],
    source_channel: params[3],
    source_call_id: params[4],
    source_event_id: params[5],
    source_tool_call_id: params[6],
    operation_type: params[7],
    request_type: params[8],
    business_family: params[9],
    status: params[10],
    priority: params[11],
    title: params[12],
    description: params[13],
    customer_name: params[14],
    customer_phone: params[15],
    customer_email: params[16],
    company_name: params[17],
    requested_date: params[18],
    requested_time: params[19],
    location: params[20],
    address: params[21],
    assigned_to: params[22],
    due_at: params[23],
    resolved_at: params[24],
    slots: JSON.parse(params[25]),
    extraction: JSON.parse(params[26]),
    meta: JSON.parse(params[27]),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function makeOperationRequestDb() {
  const rows = [];
  const queries = [];
  return {
    rows,
    queries,
    db: {
      query: async (sql, params = []) => {
        const text = String(sql);
        const normalized = text.replace(/\s+/g, " ").toLowerCase();
        queries.push({ text: normalized, params });
        assertTenantPredicate(text);

        if (normalized.includes("insert into operation_requests")) {
          const sourceToolCallId = params[6];
          const duplicate = rows.find(
            (row) =>
              sourceToolCallId &&
              row.tenant_id === params[1] &&
              row.source_channel === params[3] &&
              row.source_tool_call_id === sourceToolCallId
          );
          if (duplicate) return { rows: [] };
          const row = rowFromCreateParams(params);
          rows.push(row);
          return { rows: [row] };
        }

        if (normalized.includes("from operation_requests")) {
          if (normalized.includes("where id = $1 and tenant_id = $2")) {
            return {
              rows: rows.filter((row) => row.id === params[0] && row.tenant_id === params[1]),
            };
          }
          return {
            rows: rows.filter((row) => row.tenant_id === params[0]),
          };
        }

        if (normalized.includes("update operation_requests")) {
          assert.match(normalized, /where id = \$1 and tenant_id = \$2/);
          const row = rows.find((item) => item.id === params[0] && item.tenant_id === params[1]);
          if (!row) return { rows: [] };
          row.tenant_key = params[2];
          row.source_channel = params[3];
          row.source_call_id = params[4];
          row.source_event_id = params[5];
          row.source_tool_call_id = params[6];
          row.operation_type = params[7];
          row.request_type = params[8];
          row.business_family = params[9];
          row.status = params[10];
          row.priority = params[11];
          row.title = params[12];
          row.description = params[13];
          row.customer_name = params[14];
          row.customer_phone = params[15];
          row.customer_email = params[16];
          row.company_name = params[17];
          row.requested_date = params[18];
          row.requested_time = params[19];
          row.location = params[20];
          row.address = params[21];
          row.assigned_to = params[22];
          row.due_at = params[23];
          row.resolved_at = params[24];
          row.slots = JSON.parse(params[25]);
          row.extraction = JSON.parse(params[26]);
          row.meta = JSON.parse(params[27]);
          return { rows: [row] };
        }

        throw new Error(`unexpected query: ${text}`);
      },
    },
  };
}

function scope() {
  return {
    tenantId: TENANT_ID,
    tenantKey: "acme",
  };
}

function call(overrides = {}) {
  return {
    id: CALL_ID,
    fromNumber: "browser",
    extraction: {},
    meta: {},
    ...overrides,
  };
}

function normalizedToolCall({ toolCallId = "tool-call-1", name = "create_business_request" } = {}) {
  return {
    eventType: "voice.sideband.tool_call",
    providerRealtimeCallId: "rtc_123",
    toolCall: {
      id: toolCallId,
      name,
      arguments: {},
    },
  };
}

function resultTrace({ result, toolCallId = "tool-call-1", toolName = "create_business_request" } = {}) {
  return {
    eventType: "voice.sideband.tool_result",
    payload: {
      toolCallId,
      toolName,
      providerRealtimeCallId: "rtc_123",
      result,
    },
  };
}

test("createOperationRequest inserts and normalizes a request", async () => {
  const fixture = makeOperationRequestDb();
  const request = await createOperationRequest(fixture.db, {
    tenantId: TENANT_ID,
    tenantKey: "acme",
    sourceCallId: CALL_ID,
    sourceToolCallId: "tool-call-1",
    operationType: "create_request",
    requestType: "repair_request",
    businessFamily: "repair_service",
    title: "repair_request - Washer repair",
    description: "Washer repair",
    customerPhone: "+994501112233",
    slots: { description: "Washer repair" },
    extraction: { voiceOutcome: { type: "business_request_created" } },
    meta: { source: "voice_action_runtime" },
  });

  assert.equal(request.tenantId, TENANT_ID);
  assert.equal(request.sourceChannel, "voice");
  assert.equal(request.requestType, "repair_request");
  assert.equal(request.status, "new");
  assert.equal(request.priority, "normal");
  assert.equal(request.slots.description, "Washer repair");
});

test("tenant-facing operation request helpers require tenant_id predicates", async () => {
  const fixture = makeOperationRequestDb();
  const created = await createOperationRequest(fixture.db, {
    tenantId: TENANT_ID,
    tenantKey: "acme",
    sourceCallId: CALL_ID,
    sourceToolCallId: "tool-call-2",
    operationType: "create_request",
    requestType: "quote_request",
    title: "quote request",
    description: "Need a quote",
  });

  const fetched = await getOperationRequestByIdForTenant(fixture.db, {
    id: created.id,
    tenantId: TENANT_ID,
  });
  const listed = await listOperationRequestsForTenant(fixture.db, {
    tenantId: TENANT_ID,
    requestType: "quote_request",
  });
  const updated = await updateOperationRequestForTenant(fixture.db, {
    id: created.id,
    tenantId: TENANT_ID,
    patch: {
      status: "in_review",
      priority: "high",
      meta: { reviewed: true },
    },
  });

  assert.equal(fetched.id, created.id);
  assert.equal(listed.length, 1);
  assert.equal(updated.status, "in_review");
  assert.equal(updated.priority, "high");
  assert.equal(updated.meta.reviewed, true);
  assert.equal(
    fixture.queries
      .filter((query) => query.text.includes("operation_requests"))
      .every((query) => !query.text.includes("select") || query.text.includes("tenant_id")),
    true
  );
});

test("create_business_request successful tool result creates operation request and patches call", async () => {
  const result = await executeVoiceAction({
    name: "create_business_request",
    args: {
      requestType: "repair_request",
      description: "Washer repair",
      phone: "+994501112233",
    },
    call: call(),
    scope: scope(),
    runtimeConfig: {},
  });
  const createdRequests = [];
  const updates = [];

  const persisted = await persistRealtimeSidebandTrace({
    db: {},
    call: call(),
    scope: scope(),
    normalized: normalizedToolCall(),
    resultTrace: resultTrace({ result }),
    callPatch: {
      extraction: { voiceOutcome: { type: "business_request_created" } },
      meta: { lastVoiceAction: { action: "create_business_request" } },
    },
    appendEvent: async () => ({ id: "event-1" }),
    createRequest: async (db, input) => {
      createdRequests.push(input);
      return { id: "33333333-3333-4333-8333-333333333333", ...input };
    },
    updateCall: async (db, callId, patch) => {
      updates.push({ callId, patch });
      return { id: callId, ...patch };
    },
  });

  assert.equal(createdRequests.length, 1);
  assert.equal(createdRequests[0].sourceCallId, CALL_ID);
  assert.equal(createdRequests[0].sourceToolCallId, "tool-call-1");
  assert.equal(createdRequests[0].requestType, "repair_request");
  assert.equal(createdRequests[0].slots.description, "Washer repair");
  assert.equal(persisted.operationRequest.id, "33333333-3333-4333-8333-333333333333");
  assert.equal(updates[0].patch.extraction.operationRequestId, persisted.operationRequest.id);
  assert.equal(updates[0].patch.meta.lastOperationRequestId, persisted.operationRequest.id);
});

test("missing_required_fields and action_disabled do not create operation requests", async () => {
  for (const result of [
    {
      action: "create_business_request",
      status: "missing_required_fields",
      payload: { requestType: "repair_request" },
    },
    {
      action: "create_business_request",
      status: "action_disabled",
      payload: { requestType: "repair_request" },
    },
  ]) {
    const created = [];
    const persisted = await persistRealtimeSidebandTrace({
      db: {},
      call: call(),
      scope: scope(),
      normalized: normalizedToolCall(),
      resultTrace: resultTrace({ result }),
      appendEvent: async () => ({ id: "event-1" }),
      createRequest: async (db, input) => {
        created.push(input);
        return { id: "should-not-create", ...input };
      },
      updateCall: async () => ({ id: CALL_ID }),
    });

    assert.equal(created.length, 0);
    assert.equal(persisted.operationRequest, null);
  }
});

test("create_appointment_request also creates an operation request", async () => {
  const result = await executeVoiceAction({
    name: "create_appointment_request",
    args: {
      service: "Dental consultation",
      date: "tomorrow",
      customerName: "Nigar",
      phone: "+994501112233",
    },
    call: call(),
    scope: scope(),
    runtimeConfig: {
      appointmentMode: "request_only",
    },
  });
  const input = buildOperationRequestFromVoiceResult({
    result,
    call: call(),
    scope: scope(),
    normalized: normalizedToolCall({
      toolCallId: "tool-call-appointment",
      name: "create_appointment_request",
    }),
    toolCall: {
      id: "tool-call-appointment",
      name: "create_appointment_request",
    },
  });

  assert.equal(input.requestType, "appointment_request");
  assert.equal(input.sourceCallId, CALL_ID);
  assert.equal(input.sourceToolCallId, "tool-call-appointment");
  assert.equal(input.customerPhone, "+994501112233");
});

test("duplicate tool execution does not create duplicate operation request", async () => {
  const duplicateResult = {
    ok: true,
    action: "create_business_request",
    status: "duplicate_skipped",
    duplicate: true,
    payload: {
      requestType: "repair_request",
      description: "Washer repair",
      phone: "+994501112233",
    },
  };
  const created = [];

  const persisted = await persistRealtimeSidebandTrace({
    db: {},
    call: call(),
    scope: scope(),
    normalized: normalizedToolCall(),
    resultTrace: resultTrace({ result: duplicateResult }),
    appendEvent: async () => ({ id: "event-1" }),
    createRequest: async (db, input) => {
      created.push(input);
      return { id: "duplicate", ...input };
    },
  });

  assert.equal(shouldCreateOperationRequestFromVoiceResult(duplicateResult), false);
  assert.equal(created.length, 0);
  assert.equal(persisted.operationRequest, null);
});

test("browser phone is ignored but real caller phone can be used", async () => {
  const browserResult = await executeVoiceAction({
    name: "create_business_request",
    args: {
      requestType: "support_ticket",
      description: "Need help",
    },
    call: call({ fromNumber: "browser" }),
    scope: scope(),
    runtimeConfig: {},
  });
  assert.equal(browserResult.status, "missing_required_fields");

  const realPhoneResult = await executeVoiceAction({
    name: "create_business_request",
    args: {
      requestType: "support_ticket",
      description: "Need help",
    },
    call: call({ fromNumber: "+994501112233" }),
    scope: scope(),
    runtimeConfig: {},
  });
  const input = buildOperationRequestFromVoiceResult({
    result: realPhoneResult,
    call: call({ fromNumber: "+994501112233" }),
    scope: scope(),
    normalized: normalizedToolCall(),
    toolCall: { id: "tool-call-phone", name: "create_business_request" },
  });

  assert.equal(realPhoneResult.status, "request_recorded");
  assert.equal(input.customerPhone, "+994501112233");
});
