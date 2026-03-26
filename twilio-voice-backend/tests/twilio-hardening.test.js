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
const {
  checkAihqOperationalBootReadiness,
} = await import("../src/services/bootReadiness.js");
const {
  getRuntimeMetricsSnapshot,
  resetRuntimeMetrics,
} = await import("../src/services/runtimeObservability.js");

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
