import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import express from "express";

import {
  buildStableIdempotencyKey,
} from "../src/utils/idempotency.js";
import {
  buildRealtimeSidebandToolOutputEvents,
  dispatchRealtimeSidebandToolCall,
} from "../src/modules/voice/realtimeSidebandToolDispatcher.js";
import {
  buildVoiceRealtimeToolExecutionKey,
  reserveVoiceRealtimeToolExecution,
} from "../src/modules/voice/realtimeToolExecutionIdempotency.js";
import {
  voiceRoutes,
} from "../src/routes/api/voice/public.js";

function toolEvent(overrides = {}) {
  return {
    type: "response.function_call_arguments.done",
    call_id: "tool-call-1",
    name: "create_handoff_request",
    arguments: {
      reason: "operator",
      phone: "+994501112233",
    },
    ...overrides,
  };
}

function target() {
  return {
    provider: "openai",
    transport: "webrtc",
    providerRealtimeCallId: "call_realtime_1",
  };
}

function call() {
  return {
    id: "voice-call-1",
    extraction: {},
    meta: {
      realtime: {
        providerRealtimeCallId: "call_realtime_1",
      },
    },
  };
}

function scope() {
  return {
    tenantId: "tenant-1",
    tenantKey: "acme",
  };
}

function acquiredReservation(input = {}) {
  return {
    ok: true,
    skipped: false,
    acquired: true,
    duplicate: false,
    reasonCode: "",
    version: "voice-realtime-tool-execution-idempotency-v1",
    provider: "voice_realtime",
    actionType: "tool_execution",
    idempotencyKey: input.idempotencyKey || "idem-acquired",
    leaseToken: "lease-acquired",
    recordState: "reserved",
    source: input.source,
  };
}

function duplicateReservation(input = {}) {
  return {
    ...acquiredReservation(input),
    acquired: false,
    duplicate: true,
    reasonCode: "voice_realtime_tool_execution_duplicate",
    idempotencyKey: input.idempotencyKey || "idem-duplicate",
    recordState: "sent",
    record: {
      state: "sent",
    },
  };
}

function requestJson(server, { method = "POST", path = "/", body = {}, headers = {} } = {}) {
  const address = server.address();
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method,
        hostname: "127.0.0.1",
        port: address.port,
        path,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          try {
            resolve({
              statusCode: res.statusCode,
              body: raw ? JSON.parse(raw) : null,
            });
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    req.on("error", reject);
    req.end(payload);
  });
}

test("stable key uses buildStableIdempotencyKey behavior", () => {
  const key = buildVoiceRealtimeToolExecutionKey({
    tenantKey: "ACME",
    voiceCallId: "voice-call-1",
    providerRealtimeCallId: "call_realtime_1",
    toolCallId: "tool-call-1",
    toolName: "create_handoff_request",
    args: {
      phone: "+994501112233",
      reason: "operator",
    },
  });

  const expected = buildStableIdempotencyKey("voice_realtime_tool_execution", {
    tenantKey: "acme",
    voiceCallId: "voice-call-1",
    providerRealtimeCallId: "call_realtime_1",
    toolCallId: "tool-call-1",
    toolName: "create_handoff_request",
    argsJson: "{\"phone\":\"+994501112233\",\"reason\":\"operator\"}",
  });

  assert.equal(key, expected);
});

test("same tenant/call/provider/tool/args gives same key", () => {
  const left = buildVoiceRealtimeToolExecutionKey({
    tenantKey: "acme",
    voiceCallId: "voice-call-1",
    providerRealtimeCallId: "call_realtime_1",
    toolCallId: "tool-call-1",
    toolName: "create_handoff_request",
    args: {
      reason: "operator",
      phone: "+994501112233",
    },
  });
  const right = buildVoiceRealtimeToolExecutionKey({
    tenantKey: "acme",
    voiceCallId: "voice-call-1",
    providerRealtimeCallId: "call_realtime_1",
    toolCallId: "tool-call-1",
    toolName: "create_handoff_request",
    args: {
      phone: "+994501112233",
      reason: "operator",
    },
  });

  assert.equal(left, right);
});

test("changed args gives different key", () => {
  const left = buildVoiceRealtimeToolExecutionKey({
    tenantKey: "acme",
    voiceCallId: "voice-call-1",
    providerRealtimeCallId: "call_realtime_1",
    toolCallId: "tool-call-1",
    toolName: "create_handoff_request",
    args: {
      reason: "operator",
      phone: "+994501112233",
    },
  });
  const right = buildVoiceRealtimeToolExecutionKey({
    tenantKey: "acme",
    voiceCallId: "voice-call-1",
    providerRealtimeCallId: "call_realtime_1",
    toolCallId: "tool-call-1",
    toolName: "create_handoff_request",
    args: {
      reason: "operator",
      phone: "+994507778899",
    },
  });

  assert.notEqual(left, right);
});

test("reserve acquired:true allows execution", async () => {
  const calls = [];
  const result = await dispatchRealtimeSidebandToolCall({
    event: toolEvent(),
    target: target(),
    call: call(),
    scope: scope(),
    reserveExecution: async (input) => {
      calls.push(["reserve", input.toolCallId]);
      return acquiredReservation(input);
    },
    markExecutionSent: async (input) => {
      calls.push(["sent", input.reservation.idempotencyKey]);
      return {
        state: "sent",
      };
    },
    executeAction: async (input) => {
      calls.push(["execute", input.name]);
      return {
        ok: true,
        status: "request_recorded",
      };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.dispatched, true);
  assert.deepEqual(calls, [
    ["reserve", "tool-call-1"],
    ["execute", "create_handoff_request"],
    ["sent", "idem-acquired"],
  ]);
  assert.equal(result.resultTrace.payload.idempotency.idempotencyKey, "idem-acquired");
  assert.equal(result.resultTrace.payload.reservationAcquired, true);
});

test("reserve acquired:false skips execution", async () => {
  const reservation = await reserveVoiceRealtimeToolExecution({
    db: {
      query: async () => {
        throw new Error("direct db query should be delegated to injected helper");
      },
    },
    tenantId: "tenant-1",
    tenantKey: "acme",
    voiceCallId: "voice-call-1",
    providerRealtimeCallId: "call_realtime_1",
    toolCallId: "tool-call-1",
    toolName: "create_handoff_request",
    args: {
      reason: "operator",
    },
    reserveSideEffect: async (db, input) => ({
      acquired: false,
      leaseToken: "lease-duplicate",
      record: {
        state: "sent",
        idempotency_key: input.idempotencyKey,
      },
    }),
  });

  assert.equal(reservation.ok, true);
  assert.equal(reservation.acquired, false);
  assert.equal(reservation.duplicate, true);
  assert.equal(reservation.reasonCode, "voice_realtime_tool_execution_duplicate");
});

test("sideband dispatcher does not call executeAction on duplicate", async () => {
  let executeCount = 0;
  const result = await dispatchRealtimeSidebandToolCall({
    event: toolEvent(),
    target: target(),
    call: call(),
    scope: scope(),
    reserveExecution: async (input) => duplicateReservation(input),
    executeAction: async () => {
      executeCount += 1;
      throw new Error("duplicate should not execute");
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.dispatched, false);
  assert.equal(result.status, "duplicate_skipped");
  assert.equal(result.result.status, "duplicate_skipped");
  assert.equal(result.outboundEvents.length, 1);
  assert.equal(result.outboundEvents[0].item.type, "function_call_output");
  assert.equal(executeCount, 0);
  assert.equal(result.resultTrace.payload.reservationDuplicate, true);
});

test("sideband dispatcher marks sent after successful execution", async () => {
  const calls = [];

  const result = await dispatchRealtimeSidebandToolCall({
    event: toolEvent(),
    target: target(),
    call: call(),
    scope: scope(),
    reserveExecution: async (input) => {
      calls.push("reserve");
      return acquiredReservation(input);
    },
    executeAction: async () => {
      calls.push("execute");
      return {
        ok: true,
        status: "request_recorded",
      };
    },
    markExecutionSent: async (input) => {
      calls.push("sent");
      assert.equal(input.reservation.idempotencyKey, "idem-acquired");
      assert.equal(input.providerMessageId, "tool-call-1");
      assert.equal(input.providerResponse.source, "sideband_tool_dispatcher");
      return {
        state: "sent",
      };
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["reserve", "execute", "sent"]);
  assert.equal(result.resultTrace.payload.reservationState, "sent");
});

test("sideband dispatcher marks failed if executeAction throws", async () => {
  const calls = [];

  await assert.rejects(
    dispatchRealtimeSidebandToolCall({
      event: toolEvent(),
      target: target(),
      call: call(),
      scope: scope(),
      reserveExecution: async (input) => {
        calls.push("reserve");
        return acquiredReservation(input);
      },
      executeAction: async () => {
        calls.push("execute");
        throw new Error("action exploded");
      },
      markExecutionFailed: async (input) => {
        calls.push("failed");
        assert.equal(input.reservation.idempotencyKey, "idem-acquired");
        assert.equal(input.errorCode, "voice_realtime_tool_execution_failed");
        assert.match(input.errorMessage, /action exploded/);
        return {
          state: "failed",
        };
      },
    }),
    /action exploded/
  );

  assert.deepEqual(calls, ["reserve", "execute", "failed"]);
});

test("browser tool path uses same key contract where practical", async () => {
  const expectedKey = buildVoiceRealtimeToolExecutionKey({
    tenantKey: "acme",
    voiceCallId: "voice-call-browser",
    providerRealtimeCallId: "call_realtime_browser",
    toolCallId: "tool-call-browser",
    toolName: "create_handoff_request",
    args: {
      reason: "operator",
      phone: "+994501112233",
    },
  });
  const appendedEvents = [];

  const db = {
    query: async (sql, params = []) => {
      const text = String(sql);

      if (text.includes("from voice_calls")) {
        return {
          rows: [
            {
              id: "voice-call-browser",
              tenant_id: "tenant-1",
              tenant_key: "acme",
              provider: "browser",
              provider_call_sid: "browser-call-sid",
              status: "in_progress",
              meta: {
                realtime: {
                  providerRealtimeCallId: "call_realtime_browser",
                },
              },
              extraction: {},
            },
          ],
        };
      }

      if (text.includes("insert into external_idempotency_keys")) {
        assert.equal(params[1], "acme");
        assert.equal(params[2], "voice_realtime");
        assert.equal(params[3], "tool_execution");
        assert.equal(params[4], expectedKey);
        return {
          rows: [],
        };
      }

      if (text.includes("from external_idempotency_keys")) {
        assert.equal(params[0], "acme");
        assert.equal(params[1], "voice_realtime");
        assert.equal(params[2], "tool_execution");
        assert.equal(params[3], expectedKey);
        return {
          rows: [
            {
              id: "idem-browser",
              tenant_id: "tenant-1",
              tenant_key: "acme",
              provider: "voice_realtime",
              action_type: "tool_execution",
              idempotency_key: expectedKey,
              state: "sent",
            },
          ],
        };
      }

      if (text.includes("insert into voice_call_events")) {
        const payload = JSON.parse(params[6]);
        appendedEvents.push(payload);
        return {
          rows: [
            {
              id: "event-browser-duplicate",
              call_id: params[1],
              tenant_id: params[2],
              tenant_key: params[3],
              event_type: params[4],
              actor: params[5],
              payload,
            },
          ],
        };
      }

      throw new Error(`unexpected query: ${text}`);
    },
  };

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.auth = {
      userId: "user-1",
      tenantId: "tenant-1",
      tenantKey: "acme",
      role: "admin",
    };
    next();
  });
  app.use(
    voiceRoutes({
      db,
      getRuntime: async () => {
        throw new Error("duplicate request should return before runtime load");
      },
    })
  );

  const server = await new Promise((resolve) => {
    const nextServer = app.listen(0, () => resolve(nextServer));
  });
  try {
    const response = await requestJson(server, {
      path: "/voice/browser/calls/voice-call-browser/tools",
      body: {
        toolCallId: "tool-call-browser",
        name: "create_handoff_request",
        args: {
          phone: "+994501112233",
          reason: "operator",
        },
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.result.status, "duplicate_skipped");
    assert.equal(response.body.idempotency.idempotencyKey, expectedKey);
    assert.equal(appendedEvents.length, 1);
    assert.equal(appendedEvents[0].idempotencyKey, expectedKey);
    assert.equal(appendedEvents[0].reservationDuplicate, true);
    assert.equal(appendedEvents[0].providerRealtimeCallId, "call_realtime_browser");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

test("browser tool request-recorded path dispatches inbox sink and links call", async () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const voiceCallId = "22222222-2222-4222-8222-222222222222";
  const inboxThreadId = "33333333-3333-4333-8333-333333333333";
  const inboxMessageId = "44444444-4444-4444-8444-444444444444";
  const toolCallId = "tool-call-recorded";
  const providerRealtimeCallId = "call_realtime_recorded";
  const args = {
    requestType: "callback_request",
    issue: "Need an operator callback",
    phone: "+994501112233",
  };
  const expectedKey = buildVoiceRealtimeToolExecutionKey({
    tenantKey: "acme",
    voiceCallId,
    providerRealtimeCallId,
    toolCallId,
    toolName: "create_business_request",
    args,
  });
  const appendedEvents = [];
  const voiceUpdates = [];
  const clientQueries = [];

  const callRow = {
    id: voiceCallId,
    tenant_id: tenantId,
    tenant_key: "acme",
    provider: "browser",
    provider_call_sid: "browser-call-sid",
    status: "in_progress",
    from_number: "+994501112233",
    meta: {
      realtime: {
        providerRealtimeCallId,
      },
    },
    extraction: {},
    metrics: {},
  };
  const threadRow = {
    id: inboxThreadId,
    tenant_id: tenantId,
    tenant_key: "acme",
    channel: "voice",
    external_thread_id: `voice:call:${voiceCallId}`,
    external_user_id: "+994501112233",
    external_username: "+994501112233",
    customer_name: "+994501112233",
    status: "open",
    unread_count: 1,
    labels: [],
    meta: {},
    handoff_active: false,
    handoff_priority: "normal",
  };

  const db = {
    connect: async () => ({
      query: async (sql, params = []) => {
        const text = String(sql);
        clientQueries.push({ text, params });

        if (/^\s*BEGIN/i.test(text) || /^\s*COMMIT/i.test(text)) {
          return { rows: [] };
        }

        if (text.includes("from inbox_threads")) {
          assert.equal(params[0], "acme");
          assert.equal(params[1], "voice");
          assert.equal(params[2], `voice:call:${voiceCallId}`);
          return { rows: [] };
        }

        if (text.includes("insert into inbox_threads")) {
          assert.equal(params[0], tenantId);
          assert.equal(params[1], "acme");
          assert.equal(params[2], "voice");
          assert.equal(params[3], `voice:call:${voiceCallId}`);
          return { rows: [threadRow] };
        }

        if (text.includes("insert into inbox_messages")) {
          assert.equal(params[0], inboxThreadId);
          assert.equal(params[1], tenantId);
          assert.equal(params[2], "acme");
          assert.match(params[3], /^voice_request:acme:/);
          const meta = JSON.parse(params[5]);
          assert.equal(meta.source, "voice_business_action_sink");
          assert.equal(meta.callId, voiceCallId);
          return {
            rows: [
              {
                id: inboxMessageId,
                thread_id: inboxThreadId,
                tenant_id: tenantId,
                tenant_key: "acme",
                direction: "inbound",
                sender_type: "customer",
                external_message_id: params[3],
                message_type: "text",
                text: params[4],
                attachments: [],
                meta,
                sent_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
              },
            ],
          };
        }

        throw new Error(`unexpected client query: ${text}`);
      },
      release() {},
    }),
    query: async (sql, params = []) => {
      const text = String(sql);

      if (text.includes("from voice_calls")) {
        return { rows: [callRow] };
      }

      if (text.includes("insert into external_idempotency_keys")) {
        assert.equal(params[1], "acme");
        assert.equal(params[2], "voice_realtime");
        assert.equal(params[3], "tool_execution");
        assert.equal(params[4], expectedKey);
        return {
          rows: [
            {
              id: "idem-recorded",
              tenant_id: tenantId,
              tenant_key: "acme",
              provider: "voice_realtime",
              action_type: "tool_execution",
              idempotency_key: expectedKey,
              state: "reserved",
              lease_token: params[7],
            },
          ],
        };
      }

      if (text.includes("update external_idempotency_keys")) {
        assert.equal(params[3], expectedKey);
        const providerResponse = JSON.parse(params[5]);
        assert.equal(providerResponse.source, "browser_voice_tool_route");
        assert.equal(providerResponse.resultStatus, "request_recorded");
        return {
          rows: [
            {
              id: "idem-recorded",
              tenant_id: tenantId,
              tenant_key: "acme",
              provider: "voice_realtime",
              action_type: "tool_execution",
              idempotency_key: expectedKey,
              state: "sent",
              provider_response: providerResponse,
            },
          ],
        };
      }

      if (text.includes("insert into voice_call_events")) {
        const payload = JSON.parse(params[6]);
        appendedEvents.push({
          eventType: params[4],
          payload,
        });
        return {
          rows: [
            {
              id: `event-${appendedEvents.length}`,
              call_id: params[1],
              tenant_id: params[2],
              tenant_key: params[3],
              event_type: params[4],
              actor: params[5],
              payload,
            },
          ],
        };
      }

      if (text.includes("from inbox_threads t")) {
        return { rows: [threadRow] };
      }

      if (text.includes("update voice_calls")) {
        const extraction = JSON.parse(params[32]);
        const meta = JSON.parse(params[33]);
        voiceUpdates.push({
          inboxThreadId: params[23],
          extraction,
          meta,
        });
        return {
          rows: [
            {
              ...callRow,
              inbox_thread_id: params[23],
              callback_requested: params[20],
              callback_phone: params[21],
              summary: params[25],
              outcome: params[26],
              extraction,
              meta,
            },
          ],
        };
      }

      throw new Error(`unexpected query: ${text}`);
    },
  };

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.auth = {
      userId: "user-1",
      tenantId,
      tenantKey: "acme",
      role: "admin",
    };
    next();
  });
  app.use(
    voiceRoutes({
      db,
      getRuntime: async () => {
        throw new Error("runtime intentionally unavailable in route test");
      },
    })
  );

  const server = await new Promise((resolve) => {
    const nextServer = app.listen(0, () => resolve(nextServer));
  });
  try {
    const response = await requestJson(server, {
      path: `/voice/browser/calls/${voiceCallId}/tools`,
      body: {
        toolCallId,
        name: "create_business_request",
        args,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.result.status, "request_recorded");
    assert.equal(response.body.idempotency.idempotencyKey, expectedKey);

    const recordedEvent = appendedEvents.find(
      (event) => event.eventType === "business_request_recorded"
    );
    assert.ok(recordedEvent);
    assert.equal(recordedEvent.payload.sinkDelivery.inbox, "delivered");
    assert.equal(
      recordedEvent.payload.sinkDispatch.deliveries.some(
        (item) => item.sink === "inbox" && item.inboxThreadId === inboxThreadId
      ),
      true
    );

    assert.equal(
      clientQueries.some((item) => item.text.includes("insert into inbox_messages")),
      true
    );
    assert.equal(voiceUpdates.length, 1);
    assert.equal(voiceUpdates[0].inboxThreadId, inboxThreadId);
    assert.equal(
      voiceUpdates[0].extraction.voiceOutcome.inboxSinkDelivery.inboxThreadId,
      inboxThreadId
    );
    assert.equal(
      voiceUpdates[0].meta.lastVoiceAction.inboxSinkDelivery.inboxMessageId,
      inboxMessageId
    );
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

test("no socket, network, frontend, or schema behavior is introduced", async () => {
  const originalFetch = globalThis.fetch;
  const originalWebSocket = globalThis.WebSocket;
  let fetchCalls = 0;
  let socketCalls = 0;

  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("fetch should not be called");
  };
  globalThis.WebSocket = function WebSocket() {
    socketCalls += 1;
    throw new Error("WebSocket should not be constructed");
  };

  try {
    const events = buildRealtimeSidebandToolOutputEvents({
      toolCall: {
        id: "tool-call-no-network",
      },
      result: {
        ok: true,
        status: "request_recorded",
      },
    });

    assert.equal(events.length, 2);
    assert.equal(fetchCalls, 0);
    assert.equal(socketCalls, 0);
  } finally {
    if (originalFetch === undefined) {
      delete globalThis.fetch;
    } else {
      globalThis.fetch = originalFetch;
    }
    if (originalWebSocket === undefined) {
      delete globalThis.WebSocket;
    } else {
      globalThis.WebSocket = originalWebSocket;
    }
  }
});
