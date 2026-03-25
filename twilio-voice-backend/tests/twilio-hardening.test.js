import test from "node:test";
import assert from "node:assert/strict";
import twilio from "twilio";

process.env.PUBLIC_BASE_URL = "https://voice.example.test";
process.env.AIHQ_INTERNAL_TOKEN = "voice-internal-token";
process.env.TWILIO_AUTH_TOKEN = "twilio-auth-token";
process.env.TWILIO_ACCOUNT_SID = "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
process.env.TWILIO_API_KEY = "SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
process.env.TWILIO_API_SECRET = "secret";
process.env.TWILIO_TWIML_APP_SID = "APaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const { twilioRouter } = await import("../src/routes/twilio.js");
const {
  getRuntimeMetricsSnapshot,
  resetRuntimeMetrics,
} = await import("../src/services/runtimeObservability.js");

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

test("allowed flows work with correct auth and signature", async () => {
  const router = twilioRouter();

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
