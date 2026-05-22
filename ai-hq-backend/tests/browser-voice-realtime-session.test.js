import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import express from "express";

import {
  buildBrowserRealtimeSessionPlan,
  normalizeBrowserVoiceModel,
  normalizeBrowserVoiceName,
} from "../src/modules/voice/engine/browserRealtimeSession.js";
import {
  VOICE_ASSISTANT_BRAIN_POLICY_VERSION,
} from "../src/modules/voice/brain/index.js";
import {
  voiceRoutes,
} from "../src/routes/api/voice/public.js";

function assertVoiceCallsTenantPredicate(sql) {
  const text = String(sql).replace(/\s+/g, " ").toLowerCase();
  const selectsVoiceCalls = text.includes(" from voice_calls ");
  const updatesVoiceCalls = text.includes("update voice_calls ");
  if (!selectsVoiceCalls && !updatesVoiceCalls) return;

  const whereClause = text.split(" where ")[1] || "";
  if (!whereClause.includes("tenant_id")) {
    const err = new Error("Tenant-scoped database query requires tenant predicate");
    err.code = "TENANT_PREDICATE_REQUIRED";
    throw err;
  }
}

function makeRealtimeLinkDb({ callId = "voice-call-link", tenantKey = "acme" } = {}) {
  const appendedEvents = [];
  const updates = [];

  const callRow = {
    id: callId,
    tenant_id: "tenant-1",
    tenant_key: tenantKey,
    provider: "browser",
    provider_call_sid: "",
    provider_stream_sid: "",
    direction: "inbound",
    status: "in_progress",
    from_number: "+994501112233",
    to_number: "browser",
    language: "az",
    agent_mode: "assistant",
    transcript: "",
    summary: "",
    outcome: "unknown",
    metrics: {},
    extraction: {},
    meta: {},
  };

  return {
    appendedEvents,
    updates,
    db: {
      query: async (sql, params = []) => {
        const text = String(sql);
        assertVoiceCallsTenantPredicate(text);

        if (text.includes("from voice_calls")) {
          return {
            rows:
              params[0] === callRow.id && params[1] === callRow.tenant_id
                ? [callRow]
                : [],
          };
        }

        if (text.includes("insert into voice_call_events")) {
          const payload = JSON.parse(params[6]);
          if (String(params[4]).startsWith("browser_voice.")) {
            throw new Error("voice_call_events_event_type_check");
          }
          appendedEvents.push({
            callId: params[1],
            tenantId: params[2],
            tenantKey: params[3],
            eventType: params[4],
            actor: params[5],
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

        if (text.includes("update voice_calls")) {
          if (params[0] !== callRow.id || params[1] !== callRow.tenant_id) {
            return { rows: [] };
          }
          const meta = JSON.parse(params[33]);
          updates.push({
            callId: params[0],
            providerCallSid: params[4],
            meta,
          });
          return {
            rows: [
              {
                ...callRow,
                provider_call_sid: params[4],
                meta,
              },
            ],
          };
        }

        throw new Error(`unexpected query: ${text}`);
      },
    },
  };
}

function makeBrowserSessionDb({ tenantId = "tenant-1", tenantKey = "acme" } = {}) {
  const calls = [];
  const appendedEvents = [];
  const updates = [];

  return {
    calls,
    appendedEvents,
    updates,
    db: {
      query: async (sql, params = []) => {
        const text = String(sql);
        assertVoiceCallsTenantPredicate(text);

        if (text.includes("insert into voice_calls")) {
          const meta = JSON.parse(params[33]);
          const callRow = {
            id: params[0],
            tenant_id: params[1],
            tenant_key: params[2],
            provider: params[3],
            provider_call_sid: params[4] || "",
            provider_stream_sid: params[5] || "",
            direction: params[6],
            status: params[7],
            from_number: params[8],
            to_number: params[9],
            caller_name: params[10] || "",
            started_at: params[11],
            answered_at: params[12],
            ended_at: params[13],
            duration_seconds: params[14],
            language: params[15],
            agent_mode: params[16],
            handoff_requested: params[17],
            handoff_completed: params[18],
            handoff_target: params[19] || "",
            callback_requested: params[20],
            callback_phone: params[21] || "",
            lead_id: params[22] || "",
            inbox_thread_id: params[23] || "",
            transcript: params[24] || "",
            summary: params[25] || "",
            outcome: params[26],
            intent: params[27] || "",
            sentiment: params[28] || "",
            cost_amount: params[29],
            cost_currency: params[30],
            metrics: JSON.parse(params[31]),
            extraction: JSON.parse(params[32]),
            meta,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          calls.push(callRow);
          return { rows: [callRow] };
        }

        if (text.includes("from voice_calls")) {
          const id = params[0];
          const tenantIdParam = params[1];
          return {
            rows: calls.filter(
              (call) => call.id === id && call.tenant_id === tenantIdParam
            ),
          };
        }

        if (text.includes("insert into voice_call_events")) {
          const payload = JSON.parse(params[6]);
          if (String(params[4]).startsWith("browser_voice.")) {
            throw new Error("voice_call_events_event_type_check");
          }
          appendedEvents.push({
            callId: params[1],
            tenantId: params[2],
            tenantKey: params[3],
            eventType: params[4],
            actor: params[5],
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

        if (text.includes("update voice_calls")) {
          const id = params[0];
          const tenantIdParam = params[1];
          const meta = JSON.parse(params[33]);
          const call = calls.find(
            (item) => item.id === id && item.tenant_id === tenantIdParam
          );
          if (!call) return { rows: [] };

          call.provider_call_sid = params[4] || "";
          call.status = params[7];
          call.meta = meta;
          updates.push({
            callId: id,
            providerCallSid: params[4],
            meta,
          });
          return { rows: [call] };
        }

        throw new Error(`unexpected query: ${text}`);
      },
    },
    tenantId,
    tenantKey,
  };
}

function buildStartedSidebandRunnerResult() {
  return {
    ok: true,
    skipped: false,
    socketCreated: true,
    reasonCode: "",
    lifecycleTrace: {
      provider: "openai",
      state: "connecting",
      status: "connecting",
      reasonCode: "",
      providerRealtimeCallId: "call_realtime_link",
      networkIo: false,
    },
  };
}

function requestJson(server, { path = "/", body = {} } = {}) {
  const address = server.address();
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method: "POST",
        hostname: "127.0.0.1",
        port: address.port,
        path,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
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

async function withBrowserSessionRoute({
  body = { useTenantRuntime: false },
  openAiPayload = {
    value: "client-secret-test",
    session: {
      id: "sess_browser_test",
      client_secret: {
        value: "client-secret-test",
      },
    },
  },
  startSidebandRunner = async () => buildStartedSidebandRunnerResult(),
} = {}) {
  const previousFetch = globalThis.fetch;
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test";
  globalThis.fetch = async () =>
    new Response(JSON.stringify(openAiPayload), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });

  const fixture = makeBrowserSessionDb();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.auth = {
      userId: "user-1",
      tenantId: fixture.tenantId,
      tenantKey: fixture.tenantKey,
      role: "admin",
    };
    next();
  });
  app.use(voiceRoutes({
    db: fixture.db,
    startSidebandRunner,
  }));

  const server = await new Promise((resolve) => {
    const nextServer = app.listen(0, () => resolve(nextServer));
  });

  try {
    return {
      ...fixture,
      server,
      close: () =>
        new Promise((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        }),
      sessionResponse: await requestJson(server, {
        path: "/voice/browser/session",
        body,
      }),
    };
  } finally {
    if (previousFetch === undefined) {
      delete globalThis.fetch;
    } else {
      globalThis.fetch = previousFetch;
    }
    if (previousOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousOpenAiKey;
    }
  }
}

async function withRealtimeLinkRoute({
  env = {},
  body = {},
  startSidebandRunner = async () => buildStartedSidebandRunnerResult(),
  getRuntime = async () => null,
} = {}) {
  const previousEnv = {
    VOICE_REALTIME_SIDEBAND_ENABLED: process.env.VOICE_REALTIME_SIDEBAND_ENABLED,
    AIHQ_VOICE_REALTIME_SIDEBAND_ENABLED: process.env.AIHQ_VOICE_REALTIME_SIDEBAND_ENABLED,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };
  for (const key of Object.keys(previousEnv)) {
    delete process.env[key];
  }
  Object.assign(process.env, env);

  const fixture = makeRealtimeLinkDb();
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
  app.use(voiceRoutes({
    db: fixture.db,
    getRuntime,
    startSidebandRunner,
  }));

  const server = await new Promise((resolve) => {
    const nextServer = app.listen(0, () => resolve(nextServer));
  });

  try {
    const response = await requestJson(server, {
      path: "/voice/browser/calls/voice-call-link/realtime-link",
      body: {
        providerRealtimeCallId: "call_realtime_link",
        ...body,
      },
    });

    return {
      ...fixture,
      response,
    };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("browser voice session plan builds live runtime without scenario bias", () => {
  const plan = buildBrowserRealtimeSessionPlan({
    requestedModel: "gpt-realtime-2",
    requestedVoice: "alloy",
    baseInstructions: "Base receptionist prompt.",
    runtimeApplied: true,
    runtimeConfig: {
      companyName: "Dental Prime",
      defaultLanguage: "az",
      businessType: "clinic",
      supportedIntents: ["appointment_booking", "business_faq"],
      unsupportedIntents: ["hotel_room_booking", "restaurant_order"],
      services: [{ name: "Dental consultation" }],
      voiceProfile: {
        assistantName: "Ayla",
        roleLabel: "clinic receptionist",
        businessSummary: "Dental Prime is a dental clinic in Baku.",
        allowedTopics: ["appointments", "services", "working hours"],
        forbiddenTopics: ["medical diagnosis"],
        answerStyle: "short_clear",
        askStyle: "single_question",
      },
      voiceBehavior: {
        qualificationQuestions: ["Which service do you need?", "Which day is better?"],
        handoffTriggers: ["angry caller", "medical advice"],
        disallowedClaims: ["guaranteed treatment results"],
        toneProfile: "professional_warm",
      },
      contact: {
        phoneIntl: "+994501112233",
        website: "https://example.test",
      },
      activeVoiceChannel: {
        id: "browser_lab",
        provider: "browser_lab",
      },
    },
  });

  assert.equal(plan.model, "gpt-realtime-1.5");
  assert.equal(plan.voice, "coral");
  assert.equal(plan.brainPolicyVersion, VOICE_ASSISTANT_BRAIN_POLICY_VERSION);

  assert.match(plan.instructions, /Dental Prime/);
  assert.match(plan.instructions, /Voice assistant brain/);
  assert.match(plan.instructions, /real inbound business call/);
  assert.match(plan.instructions, /temporary pre-SIP adapter/);
  assert.match(plan.instructions, /approved tenant runtime/);
  assert.match(plan.instructions, /Language policy/);
  assert.match(plan.instructions, /Turn and noise policy/);
  assert.match(plan.instructions, /Semantic intent policy/);
  assert.match(plan.instructions, /Dialogue state and slot policy/);
  assert.match(plan.instructions, /Grounding policy/);
  assert.match(plan.instructions, /Business scope guard/);
  assert.match(plan.instructions, /Action planning policy/);
  assert.match(plan.instructions, /Response composer policy/);
  assert.match(plan.instructions, /Call lifecycle policy/);
  assert.match(plan.instructions, /Approved business type: clinic/);
  assert.match(plan.instructions, /Supported caller intents: appointment_booking; business_faq/);
  assert.match(plan.instructions, /Unsupported caller intents: hotel_room_booking; restaurant_order/);
  assert.match(plan.instructions, /Approved services\/products: Dental consultation/);
  assert.match(plan.instructions, /Booking, order, reservation, appointment, callback, and handoff intent must be explicit/);
  assert.match(plan.instructions, /Operational logic/);
  assert.match(plan.instructions, /Do not pretend to check availability/);
  assert.match(plan.instructions, /Approved business context/);
  assert.match(plan.instructions, /Human handoff triggers/);
  assert.match(plan.instructions, /medical diagnosis/);
  assert.match(plan.instructions, /end_call tool/);

  assert.doesNotMatch(plan.instructions, /Voice Lab canonical scenario/);
  assert.doesNotMatch(plan.instructions, /Caller roleplay script/);
  assert.doesNotMatch(plan.instructions, /\blab\b/i);
  assert.doesNotMatch(plan.instructions, /\bscenario\b/i);
  assert.doesNotMatch(plan.instructions, /\bevaluation\b/i);
  assert.doesNotMatch(plan.instructions, /\bscorecard\b/i);
  assert.doesNotMatch(plan.instructions, /Appointment booking/);

  assert.equal(plan.clientSecretRequest.session.type, "realtime");
  assert.equal(plan.clientSecretRequest.session.model, "gpt-realtime-1.5");
  assert.equal(plan.clientSecretRequest.session.audio.output.voice, "coral");
  assert.equal(
    plan.clientSecretRequest.session.audio.input.turn_detection.create_response,
    true
  );
  assert.equal(
    plan.clientSecretRequest.session.audio.input.turn_detection.interrupt_response,
    false
  );

  assert.equal(plan.openingResponse.enabled, true);
  assert.match(plan.openingResponse.instructions, /pre-SIP browser audio adapter/);
  assert.match(plan.openingResponse.instructions, /Approved business name: Dental Prime/);
});

test("browser voice normalizers keep safe realtime defaults", () => {
  assert.equal(normalizeBrowserVoiceModel("gpt-realtime-2"), "gpt-realtime-1.5");
  assert.equal(normalizeBrowserVoiceModel("bad-model"), "gpt-realtime-1.5");

  assert.equal(normalizeBrowserVoiceName("alloy"), "coral");
  assert.equal(normalizeBrowserVoiceName("verse"), "coral");
  assert.equal(normalizeBrowserVoiceName("sage"), "sage");
  assert.equal(normalizeBrowserVoiceName("unknown"), "coral");
});

test("browser voice session creates and returns a tenant-scoped call id", async () => {
  const fixture = await withBrowserSessionRoute();

  try {
    const { sessionResponse, calls } = fixture;

    assert.equal(sessionResponse.statusCode, 200);
    assert.equal(sessionResponse.body.ok, true);
    assert.ok(sessionResponse.body.browserCallId);
    assert.equal(sessionResponse.body.callId, sessionResponse.body.browserCallId);
    assert.equal(sessionResponse.body.clientSecret, "client-secret-test");
    assert.equal(sessionResponse.body.runtimeApplied, false);
    assert.equal(sessionResponse.body.runtimeReasonCode, "browser_voice_manual_mode");
    assert.ok(sessionResponse.body.openingResponse);
    assert.equal(sessionResponse.body.call.id, sessionResponse.body.browserCallId);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].id, sessionResponse.body.browserCallId);
    assert.equal(calls[0].tenant_id, "tenant-1");
    assert.equal(calls[0].tenant_key, "acme");
    assert.equal(calls[0].provider, "other");
    assert.equal(calls[0].direction, "inbound");
    assert.equal(calls[0].status, "in_progress");
    assert.equal(calls[0].from_number, "browser");
    assert.equal(calls[0].to_number, "browser");
    assert.equal(calls[0].language, "en");
    assert.equal(calls[0].agent_mode, "assistant");
    assert.equal(calls[0].meta.browserVoice, true);
    assert.equal(calls[0].meta.adapterType, "pre_sip_browser");
    assert.equal(calls[0].meta.realtimeSessionId, "sess_browser_test");
    assert.equal(calls[0].meta.model, sessionResponse.body.model);
    assert.equal(calls[0].meta.voice, sessionResponse.body.voice);
  } finally {
    await fixture.close();
  }
});

test("browser realtime-link can use the call id returned by browser session", async () => {
  const fixture = await withBrowserSessionRoute();
  const callId = fixture.sessionResponse.body.browserCallId;

  try {
    const linkResponse = await requestJson(fixture.server, {
      path: `/voice/browser/calls/${callId}/realtime-link`,
      body: {
        provider: "openai",
        transport: "webrtc",
        providerRealtimeCallId: "rtc_session_link",
        locationHeader: "/v1/realtime/calls/rtc_session_link",
        model: fixture.sessionResponse.body.model,
        voice: fixture.sessionResponse.body.voice,
      },
    });

    assert.equal(linkResponse.statusCode, 200);
    assert.equal(linkResponse.body.ok, true);
    assert.equal(linkResponse.body.controlTarget.voiceCallId, callId);
    assert.equal(linkResponse.body.controlTarget.providerRealtimeCallId, "rtc_session_link");
    assert.equal(fixture.appendedEvents.length, 1);
    assert.equal(fixture.appendedEvents[0].callId, callId);
    assert.equal(fixture.appendedEvents[0].eventType, "voice.event");
    assert.equal(
      fixture.appendedEvents[0].payload.originalEventType,
      "browser_voice.provider_session_linked"
    );
    assert.ok(linkResponse.body.sidebandLifecycle);
    assert.ok(linkResponse.body.sidebandRunner);
    assert.equal(fixture.updates.length, 1);
    assert.equal(fixture.updates[0].callId, callId);
  } finally {
    await fixture.close();
  }
});

test("browser call event route persists connected events with schema-safe type", async () => {
  const fixture = await withBrowserSessionRoute();
  const callId = fixture.sessionResponse.body.browserCallId;

  try {
    const response = await requestJson(fixture.server, {
      path: `/voice/browser/calls/${callId}/events`,
      body: {
        eventType: "browser_voice.connected",
        actor: "system",
        payload: {
          model: "gpt-realtime-1.5",
          voice: "coral",
        },
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.event.eventType, "voice.event");
    assert.equal(response.body.event.payload.originalEventType, "browser_voice.connected");
    assert.equal(fixture.appendedEvents.length, 1);
    assert.equal(fixture.appendedEvents[0].eventType, "voice.event");
  } finally {
    await fixture.close();
  }
});

test("browser call event route preserves opening_started original event type", async () => {
  const fixture = await withBrowserSessionRoute();
  const callId = fixture.sessionResponse.body.browserCallId;

  try {
    const response = await requestJson(fixture.server, {
      path: `/voice/browser/calls/${callId}/events`,
      body: {
        eventType: "browser_voice.opening_started",
        actor: "system",
        payload: {
          openingStarted: true,
        },
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.event.eventType, "voice.event");
    assert.equal(
      response.body.event.payload.originalEventType,
      "browser_voice.opening_started"
    );
    assert.equal(fixture.appendedEvents[0].payload.openingStarted, true);
  } finally {
    await fixture.close();
  }
});


test("browser voice business scope guard redirects out-of-scope caller intent", () => {
  const plan = buildBrowserRealtimeSessionPlan({
    runtimeApplied: true,
    runtimeConfig: {
      companyName: "Baku Pizza",
      businessType: "restaurant",
      supportedIntents: ["food_order", "table_reservation", "menu_question"],
      unsupportedIntents: ["hotel_room_booking"],
      services: ["pizza", "delivery", "table reservation"],
      voiceProfile: {
        assistantName: "Leyla",
        roleLabel: "restaurant receptionist",
        businessSummary: "Baku Pizza is a restaurant. It accepts food orders and table reservations.",
      },
    },
  });

  assert.match(plan.instructions, /Approved business type: restaurant/);
  assert.match(plan.instructions, /Supported caller intents: food_order; table_reservation; menu_question/);
  assert.match(plan.instructions, /Unsupported caller intents: hotel_room_booking/);
  assert.match(plan.instructions, /If the business is a restaurant and the caller asks for a hotel room/);
  assert.match(plan.instructions, /do not discuss rooms/);
});

test("browser realtime-link stores sidebandConnector and sidebandLifecycle", async () => {
  let runnerCalls = 0;
  const { response, appendedEvents, updates } = await withRealtimeLinkRoute({
    startSidebandRunner: async () => {
      runnerCalls += 1;
      throw new Error("runner should not start when flag is off");
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.controlTarget.provider, "openai");
  assert.equal(response.body.sidebandConnector.status, "disabled");
  assert.equal(response.body.sidebandConnector.networkIo, false);
  assert.equal(response.body.sidebandLifecycle.state, "disabled");
  assert.equal(response.body.sidebandLifecycle.networkIo, false);
  assert.equal(response.body.sidebandRunner.enabled, false);
  assert.equal(response.body.sidebandRunner.attempted, false);
  assert.equal(response.body.sidebandRunner.status, "disabled");
  assert.equal(response.body.sidebandRunner.reasonCode, "sideband_disabled");
  assert.equal(runnerCalls, 0);

  assert.equal(appendedEvents.length, 1);
  assert.equal(appendedEvents[0].eventType, "voice.event");
  assert.equal(
    appendedEvents[0].payload.originalEventType,
    "browser_voice.provider_session_linked"
  );
  assert.equal(appendedEvents[0].payload.sidebandConnector.status, "disabled");
  assert.equal(appendedEvents[0].payload.sidebandLifecycle.state, "disabled");
  assert.equal(appendedEvents[0].payload.sidebandRunner.status, "disabled");
  assert.equal(updates.length, 1);
  assert.equal(updates[0].meta.realtime.sidebandConnector.status, "disabled");
  assert.equal(updates[0].meta.realtime.sidebandLifecycle.state, "disabled");
  assert.equal(updates[0].meta.realtime.sidebandRunner.status, "disabled");
});

test("browser realtime-link response remains compatible and can report ready lifecycle", async () => {
  const runnerCalls = [];
  const { response, appendedEvents, updates } = await withRealtimeLinkRoute({
    env: {
      VOICE_REALTIME_SIDEBAND_ENABLED: "1",
      OPENAI_API_KEY: "sk-test",
    },
    startSidebandRunner: async (input) => {
      runnerCalls.push(input);
      return buildStartedSidebandRunnerResult();
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.ok(response.body.controlTarget);
  assert.ok(response.body.sidebandConnector);
  assert.ok(response.body.event);
  assert.equal(response.body.sidebandConnector.status, "ready");
  assert.equal(response.body.sidebandConnector.providerRealtimeCallId, "call_realtime_link");
  assert.equal(response.body.sidebandLifecycle.state, "ready");
  assert.equal(response.body.sidebandRunner.enabled, true);
  assert.equal(response.body.sidebandRunner.attempted, true);
  assert.equal(response.body.sidebandRunner.status, "started");
  assert.equal(response.body.sidebandRunner.lifecycleState.state, "connecting");
  assert.equal(runnerCalls.length, 1);
  assert.equal(runnerCalls[0].target.providerRealtimeCallId, "call_realtime_link");
  assert.equal(runnerCalls[0].scope.tenantKey, "acme");
  assert.equal(appendedEvents[0].eventType, "voice.event");
  assert.equal(
    appendedEvents[0].payload.originalEventType,
    "browser_voice.provider_session_linked"
  );
  assert.equal(appendedEvents[0].payload.sidebandConnector.status, "ready");
  assert.equal(appendedEvents[0].payload.sidebandLifecycle.state, "ready");
  assert.equal(appendedEvents[0].payload.sidebandRunner.status, "started");
  assert.equal(updates[0].meta.realtime.sidebandRunner.status, "started");
});

test("browser realtime-link gives unsupported provider blocked lifecycle without socket or network", async () => {
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
    let runnerCalls = 0;
    const { response, updates } = await withRealtimeLinkRoute({
      env: {
        VOICE_REALTIME_SIDEBAND_ENABLED: "1",
      },
      body: {
        provider: "elevenlabs",
      },
      startSidebandRunner: async () => {
        runnerCalls += 1;
        throw new Error("runner should not start for blocked lifecycle");
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.sidebandConnector.status, "unsupported");
    assert.equal(response.body.sidebandConnector.reasonCode, "unsupported_realtime_provider");
    assert.equal(response.body.sidebandLifecycle.state, "blocked");
    assert.equal(response.body.sidebandLifecycle.reasonCode, "unsupported_realtime_provider");
    assert.equal(response.body.sidebandRunner.enabled, true);
    assert.equal(response.body.sidebandRunner.attempted, false);
    assert.equal(response.body.sidebandRunner.status, "blocked");
    assert.equal(response.body.sidebandRunner.reasonCode, "unsupported_realtime_provider");
    assert.equal(updates[0].meta.realtime.sidebandLifecycle.state, "blocked");
    assert.equal(updates[0].meta.realtime.sidebandRunner.status, "blocked");
    assert.equal(runnerCalls, 0);
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

test("browser realtime-link runner failure does not fail route", async () => {
  const { response, appendedEvents, updates } = await withRealtimeLinkRoute({
    env: {
      VOICE_REALTIME_SIDEBAND_ENABLED: "1",
      OPENAI_API_KEY: "sk-test",
    },
    startSidebandRunner: async () => {
      throw new Error("runner exploded");
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.sidebandConnector.status, "ready");
  assert.equal(response.body.sidebandLifecycle.state, "ready");
  assert.equal(response.body.sidebandRunner.enabled, true);
  assert.equal(response.body.sidebandRunner.attempted, true);
  assert.equal(response.body.sidebandRunner.status, "failed");
  assert.equal(response.body.sidebandRunner.reasonCode, "sideband_runner_start_failed");
  assert.match(response.body.sidebandRunner.error, /runner exploded/);
  assert.equal(appendedEvents[0].payload.sidebandRunner.status, "failed");
  assert.equal(updates[0].meta.realtime.sidebandRunner.status, "failed");
});
