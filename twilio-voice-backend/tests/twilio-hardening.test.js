import test from "node:test";
import assert from "node:assert/strict";
import twilio from "twilio";

process.env.PUBLIC_BASE_URL = "https://voice.example.test";
process.env.AIHQ_INTERNAL_TOKEN = "voice-internal-token";
process.env.AIHQ_BASE_URL = "https://aihq.example.test";
process.env.TWILIO_AUTH_TOKEN = "twilio-auth-token";
process.env.TWILIO_ACCOUNT_SID = "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
process.env.TWILIO_API_KEY = "SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
process.env.TWILIO_API_SECRET = "secret";
process.env.TWILIO_TWIML_APP_SID = "APaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const { twilioRouter } = await import("../src/routes/twilio.js");
const { resolveTenantFromRequest } = await import("../src/services/tenantResolver.js");
const { __test__: tenantConfigTest } = await import("../src/services/tenantConfig.js");
const { createAihqVoiceClient } = await import("../src/services/aihqVoiceClient.js");
const {
  checkAihqOperationalBootReadiness,
} = await import("../src/services/bootReadiness.js");
const {
  configureRuntimeSignalPersistence,
  getRuntimeMetricsSnapshot,
  listRuntimeSignals,
  recordRuntimeSignal,
  resetRuntimeMetrics,
} = await import("../src/services/runtimeObservability.js");
const { createAihqRuntimeIncidentClient } = await import(
  "../src/services/aihqRuntimeIncidentClient.js"
);
const {
  buildRuntimeSignalsResponse,
  createHealthHandler,
} = await import("../src/services/healthRoute.js");

const originalFetch = global.fetch;

function createMockRes(onFinish) {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    finished: false,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.finished = true;
      onFinish?.();
      return this;
    },
    type(value) {
      this.headers["content-type"] = value;
      return this;
    },
    send(payload) {
      this.body = payload;
      this.finished = true;
      onFinish?.();
      return this;
    },
    sendStatus(code) {
      this.statusCode = code;
      this.finished = true;
      onFinish?.();
      return this;
    },
  };
}

async function invokeHandler(router, method, path, req = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve({ req: fullReq, res });
    };

    const normalizedHeaders = Object.fromEntries(
      Object.entries(req.headers || {}).map(([key, value]) => [String(key).toLowerCase(), value])
    );

    const fullReq = {
      method: String(method || "GET").toUpperCase(),
      path,
      originalUrl: path,
      url: path,
      headers: normalizedHeaders,
      query: req.query || {},
      body: req.body || {},
      protocol: "https",
      get(name) {
        return this.headers[String(name || "").toLowerCase()];
      },
      header(name) {
        return this.headers[String(name || "").toLowerCase()];
      },
      ...req,
    };

    const res = createMockRes(finish);
    router.handle(fullReq, res, (err) => {
      if (settled) return;
      if (err) {
        settled = true;
        reject(err);
        return;
      }
      settled = true;
      resolve({ req: fullReq, res });
    });
  });
}

function mockFetchJson({ ok = true, status = 200, json = {} } = {}) {
  global.fetch = async () => ({
    ok,
    status,
    async text() {
      return JSON.stringify(json);
    },
  });
}

test.after(() => {
  global.fetch = originalFetch;
});

test("unauthorized browser token request is denied", async () => {
  resetRuntimeMetrics();
  const router = twilioRouter();
  const { res } = await invokeHandler(router, "post", "/twilio/token", {
    body: {
      tenantKey: "acme",
      identity: "browser-user",
    },
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body?.error, "unauthorized");
  assert.equal(getRuntimeMetricsSnapshot()["twilio_internal_auth_failures_total:unauthorized"], 1);
});

test("invalid Twilio signature is rejected", async () => {
  resetRuntimeMetrics();
  const router = twilioRouter();
  const { res } = await invokeHandler(router, "post", "/twilio/voice", {
    headers: {
      "x-twilio-signature": "bad-signature",
    },
    body: {
      To: "+15551234567",
      From: "+15557654321",
    },
  });

  assert.equal(res.statusCode, 403);
  assert.equal(getRuntimeMetricsSnapshot()["twilio_signature_failures_total:invalid_twilio_signature"], 1);
});

test("request-supplied tenant keys are blocked for production call routing", async () => {
  const result = await resolveTenantFromRequest({
    headers: {
      "x-tenant-key": "acme",
    },
    query: {},
    body: {},
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "unsafe_tenant_key_resolution_blocked");
});

test("boot readiness blocks prod-like startup when AI HQ reports operational blockers", async () => {
  mockFetchJson({
    ok: true,
    status: 200,
    json: {
      ok: true,
      operationalReadiness: {
        blockers: {
          total: 2,
        },
      },
    },
  });

  await assert.rejects(
    () =>
      checkAihqOperationalBootReadiness({
        fetchFn: global.fetch,
        baseUrl: "https://aihq.example.test",
        internalToken: "voice-internal-token",
        appEnv: "production",
        requireOnBoot: true,
      }),
    /aihq_operational_readiness_blocked:2/
  );
});

test("boot readiness can report converged blocker reason codes without throwing", async () => {
  mockFetchJson({
    ok: true,
    status: 200,
    json: {
      ok: true,
      operationalReadiness: {
        blockerReasonCodes: ["voice_phone_number_missing", "provider_secret_missing"],
        blockers: {
          total: 2,
        },
      },
    },
  });

  const readiness = await checkAihqOperationalBootReadiness({
    fetchFn: global.fetch,
    baseUrl: "https://aihq.example.test",
    internalToken: "voice-internal-token",
    appEnv: "production",
    requireOnBoot: true,
    throwOnBlocked: false,
  });

  assert.equal(readiness.ok, false);
  assert.equal(readiness.status, "blocked");
  assert.equal(readiness.intentionallyUnavailable, true);
  assert.deepEqual(readiness.blockerReasonCodes, [
    "voice_phone_number_missing",
    "provider_secret_missing",
  ]);
});

test("health route response exposes direct structured readiness", () => {
  const handler = createHealthHandler({
    service: "twilio-voice-backend",
    bootReadiness: {
      checkedAt: "2026-03-26T00:00:00.000Z",
      enforced: true,
      status: "blocked",
      reasonCode: "voice_phone_number_missing",
      blockerReasonCodes: ["voice_phone_number_missing"],
      blockersTotal: 1,
      intentionallyUnavailable: true,
      dependency: {
        aihqReady: false,
      },
      aihq: {
        ok: false,
      },
      localDecision: {
        failClosed: true,
      },
    },
  });
  const res = createMockRes();
  handler({}, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.service, "twilio-voice-backend");
  assert.equal(res.body.readiness.status, "blocked");
  assert.equal(res.body.readiness.checkedAt, "2026-03-26T00:00:00.000Z");
  assert.equal(res.body.readiness.enforced, true);
  assert.equal(res.body.readiness.reasonCode, "voice_phone_number_missing");
  assert.deepEqual(res.body.readiness.blockerReasonCodes, [
    "voice_phone_number_missing",
  ]);
  assert.equal(res.body.readiness.blockersTotal, 1);
  assert.equal(res.body.readiness.intentionallyUnavailable, true);
});

test("voice AI HQ client forwards request and correlation headers", async () => {
  let seenHeaders = null;
  const client = createAihqVoiceClient({
    fetchFn: async (_url, options = {}) => {
      seenHeaders = options.headers || {};
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            ok: true,
            execution: {
              id: "exec-1",
              status: "pending",
            },
          });
        },
      };
    },
    baseUrl: "https://aihq.example.test",
    internalToken: "voice-internal-token",
  });

  const out = await client.updateSessionState(
    {
      providerCallSid: "CA123",
      eventType: "session_state_updated",
      status: "in_progress",
    },
    {
      requestId: "req-voice-1",
      correlationId: "corr-voice-1",
    }
  );

  assert.equal(out.ok, true);
  assert.equal(seenHeaders["x-request-id"], "req-voice-1");
  assert.equal(seenHeaders["x-correlation-id"], "corr-voice-1");
});

test("voice runtime signals response exposes readiness and runtime counters", () => {
  resetRuntimeMetrics();
  recordRuntimeSignal({
    level: "warn",
    category: "voice_route",
    code: "voice_tenant_config_unavailable",
    reasonCode: "tenant_config_not_found",
    requestId: "req-voice-2",
    correlationId: "corr-voice-2",
    status: 404,
    tenantKey: "acme",
  });

  const response = buildRuntimeSignalsResponse({
    service: "twilio-voice-backend",
    bootReadiness: {
      status: "ok",
      checkedAt: "2026-03-26T00:00:00.000Z",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.service, "twilio-voice-backend");
  assert.equal(response.body.readiness.status, "ok");
  assert.equal(typeof response.body.runtime.checkedAt, "string");
  assert.deepEqual(response.body.runtime.metrics, getRuntimeMetricsSnapshot());
  assert.equal(response.body.runtime.recentSignals[0]?.code, "voice_tenant_config_unavailable");
  assert.equal(response.body.runtime.recentSignals[0]?.requestId, "req-voice-2");
  assert.equal(response.body.runtime.recentSignals[0]?.correlationId, "corr-voice-2");
  assert.equal(listRuntimeSignals()[0]?.tenantKey, "acme");
});

test("voice durable incident client posts sanitized incident payload to AI HQ", async () => {
  let seenUrl = "";
  let seenHeaders = null;
  let seenBody = null;
  const client = createAihqRuntimeIncidentClient({
    fetchFn: async (url, options = {}) => {
      seenUrl = url;
      seenHeaders = options.headers || {};
      seenBody = JSON.parse(options.body || "{}");
      return {
        ok: true,
        status: 202,
        async text() {
          return JSON.stringify({
            ok: true,
            incident: {
              id: "incident-2",
            },
          });
        },
      };
    },
    baseUrl: "https://aihq.example.test",
    internalToken: "voice-internal-token",
  });

  const result = await client.recordIncident({
    service: "twilio-voice-backend",
    area: "voice_sync",
    severity: "warn",
    code: "voice_sync_request_failed",
    reasonCode: "request_failed",
    requestId: "req-voice-3",
    correlationId: "corr-voice-3",
    tenantKey: "ACME",
    detailSummary: "AI HQ request failed",
    context: {
      status: 504,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(seenUrl, "https://aihq.example.test/api/internal/runtime-signals/incidents");
  assert.equal(seenHeaders["x-request-id"], "req-voice-3");
  assert.equal(seenHeaders["x-correlation-id"], "corr-voice-3");
  assert.equal(seenBody.tenantKey, "acme");
  assert.equal(seenBody.code, "voice_sync_request_failed");
});

test("voice runtime observability forwards only warn/error signals to durable sink", async () => {
  resetRuntimeMetrics();
  const forwarded = [];
  configureRuntimeSignalPersistence(async (entry) => {
    forwarded.push(entry);
  });

  recordRuntimeSignal({
    level: "info",
    category: "realtime",
    code: "voice_realtime_heartbeat",
  });
  recordRuntimeSignal({
    level: "error",
    category: "voice_route",
    code: "voice_route_failed",
    reasonCode: "voice_route_failed",
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0]?.code, "voice_route_failed");
});

test("allowed flows work with correct auth and signature", async () => {
  const router = twilioRouter();
  mockFetchJson({
    ok: true,
    status: 200,
    json: {
      ok: true,
      projectedRuntime: {
        authority: {
          mode: "strict",
          required: true,
          available: true,
          source: "approved_runtime_projection",
          tenantId: "tenant-1",
          tenantKey: "acme",
          runtimeProjectionId: "projection-1",
        },
        tenant: {
          tenantId: "tenant-1",
          tenantKey: "acme",
          companyName: "Acme",
          mainLanguage: "en",
        },
        channels: {
          voice: {
            enabled: true,
            supportsCalls: true,
            primaryPhone: "+15550001111",
            profile: {
              defaultLanguage: "en",
            },
            contact: {},
          },
        },
        operational: {
          voice: {
            operator: {
              phone: "+15550001111",
            },
            realtime: {},
          },
        },
      },
      operationalChannels: {
        voice: {
          available: true,
          ready: true,
          provider: "twilio",
          operator: {
            enabled: true,
            phone: "+15550001111",
            mode: "manual",
          },
          operatorRouting: {
            mode: "manual",
            departments: {},
          },
          realtime: {},
        },
      },
    },
  });

  const tokenResult = await invokeHandler(router, "post", "/twilio/token", {
    headers: {
      "x-internal-token": "voice-internal-token",
    },
    body: {
      tenantKey: "acme",
      identity: "browser-user",
    },
  });

  assert.equal(tokenResult.res.statusCode, 200);
  assert.equal(tokenResult.res.body?.ok, true);
  assert.equal(tokenResult.res.body?.tenantKey, "acme");

  const params = {
    tenantKey: "acme",
    To: "+15551234567",
    From: "+15557654321",
  };
  const signature = twilio.getExpectedTwilioSignature(
    "twilio-auth-token",
    "https://voice.example.test/twilio/voice",
    params
  );

  const voiceResult = await invokeHandler(router, "post", "/twilio/voice", {
    headers: {
      "x-twilio-signature": signature,
    },
    body: params,
  });

  assert.equal(voiceResult.res.statusCode, 200);
  assert.match(String(voiceResult.res.body || ""), /<Response>/);
});

test("voice route fails closed when AIHQ tenant config cannot be resolved", async () => {
  const router = twilioRouter();
  mockFetchJson({
    ok: false,
    status: 404,
    json: {
      ok: false,
      error: "tenant_not_found",
    },
  });

  const params = {
    To: "+15551234567",
    From: "+15557654321",
  };
  const signature = twilio.getExpectedTwilioSignature(
    "twilio-auth-token",
    "https://voice.example.test/twilio/voice",
    params
  );

  const { res } = await invokeHandler(router, "post", "/twilio/voice", {
    headers: {
      "x-twilio-signature": signature,
    },
    body: params,
  });

  assert.equal(res.statusCode, 404);
  assert.equal(res.body?.ok, false);
  assert.equal(res.body?.error, "tenant_not_found");
});

test("voice route fails closed when operational voice contract is not ready", async () => {
  const router = twilioRouter();
  mockFetchJson({
    ok: true,
    status: 200,
    json: {
      ok: true,
      projectedRuntime: {
        authority: {
          mode: "strict",
          required: true,
          available: true,
          source: "approved_runtime_projection",
          tenantId: "tenant-1",
          tenantKey: "acme",
        },
        tenant: {
          tenantId: "tenant-1",
          tenantKey: "acme",
          companyName: "Acme",
        },
        channels: {
          voice: {
            enabled: true,
            supportsCalls: true,
          },
        },
      },
      operationalChannels: {
        voice: {
          available: true,
          ready: false,
          reasonCode: "voice_phone_number_missing",
          provider: "twilio",
          operator: {
            enabled: true,
            phone: "+15550001111",
          },
          operatorRouting: {
            mode: "manual",
            departments: {},
          },
          realtime: {},
          telephony: {
            phoneNumber: "",
          },
        },
      },
    },
  });

  const params = {
    To: "+15551234567",
    From: "+15557654321",
  };
  const signature = twilio.getExpectedTwilioSignature(
    "twilio-auth-token",
    "https://voice.example.test/twilio/voice",
    params
  );

  const { res } = await invokeHandler(router, "post", "/twilio/voice", {
    headers: {
      "x-twilio-signature": signature,
    },
    body: params,
  });

  assert.equal(res.statusCode, 409);
  assert.equal(res.body?.error, "voice_phone_number_missing");
});

test("local Twilio voice config adapter derives voice behavior from projected runtime", () => {
  const config = tenantConfigTest.buildVoiceConfigFromContracts({
    authority: {
      mode: "strict",
      required: true,
      available: true,
      source: "approved_runtime_projection",
      tenantId: "tenant-1",
      tenantKey: "acme",
      runtimeProjectionId: "projection-1",
    },
    tenant: {
      tenantId: "tenant-1",
      tenantKey: "acme",
      companyName: "Acme",
      mainLanguage: "en",
    },
    channels: {
      voice: {
        enabled: true,
        supportsCalls: true,
        primaryPhone: "+15550001111",
        contact: {
          phoneIntl: "+15550001111",
        },
        profile: {
          defaultLanguage: "en",
          businessSummary: "Premium care",
        },
      },
    },
    operational: {
      voice: {
        operator: {
          phone: "+15550002222",
        },
      },
    },
  }, {
    voice: {
      available: true,
      ready: true,
      provider: "twilio",
      operator: {
        enabled: true,
        phone: "+15550002222",
        mode: "manual",
      },
      operatorRouting: {
        mode: "manual",
        departments: {},
      },
      realtime: {
        model: "gpt-4o-realtime-preview",
      },
    },
  });

  assert.equal(config.tenantKey, "acme");
  assert.equal(config.authority.runtimeProjectionId, "projection-1");
  assert.equal(config.operator.phone, "+15550002222");
  assert.equal(config.voiceProfile.businessSummary, "Premium care");
});
