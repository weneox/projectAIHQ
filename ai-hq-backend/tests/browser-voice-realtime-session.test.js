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

        if (text.includes("from voice_calls")) {
          return {
            rows: [callRow],
          };
        }

        if (text.includes("insert into voice_call_events")) {
          const payload = JSON.parse(params[6]);
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
