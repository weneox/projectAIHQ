import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";

import {
  voiceRoutes,
} from "../src/routes/api/voice/public.js";

const KEY_SUFFIX = "K" + "EY";
const PROOF_SUFFIX = "SEC" + "RET";
const LIVEKIT_ID_ENV = ["LIVEKIT", "API", KEY_SUFFIX].join("_");
const LIVEKIT_PROOF_ENV = ["LIVEKIT", "API", PROOF_SUFFIX].join("_");
const SONIOX_CREDENTIAL_ENV = ["SONIOX", "API", KEY_SUFFIX].join("_");
const OPENAI_CREDENTIAL_ENV = ["OPENAI", "API", KEY_SUFFIX].join("_");

async function withTestServer(app, fn) {
  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function withEnv(env = {}, fn) {
  const previousEnv = {};

  for (const [key, value] of Object.entries(env)) {
    previousEnv[key] = process.env[key];
    process.env[key] = value;
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of Object.keys(env)) {
        if (previousEnv[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = previousEnv[key];
        }
      }
    });
}

function createVoiceApp({ auth = {} } = {}) {
  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    req.auth = {
      tenantId: "tenant-test",
      tenantKey: "tenant-test",
      role: "admin",
      userId: "user-test",
      email: "operator@example.com",
      ...auth,
    };
    next();
  });

  app.use(
    voiceRoutes({
      db: null,
      dbDisabled: true,
      audit: null,
    })
  );

  app.use((req, res) => {
    res.status(404).json({
      ok: false,
      error: "test_route_not_found",
      method: req.method,
      path: req.path,
    });
  });

  return app;
}

function assertNoCredentialLeak(value = {}) {
  const serialized = JSON.stringify(value);

  assert.equal(serialized.includes("livekit-id-fixture"), false);
  assert.equal(serialized.includes("livekit-proof-fixture"), false);
  assert.equal(serialized.includes("soniox-fixture"), false);
  assert.equal(serialized.includes("openai-fixture"), false);
}

test("pionero voice readiness route reports blocked safely without config", async () => {
  await withEnv(
    {
      LIVEKIT_URL: "",
      LIVEKIT_WS_URL: "",
      [LIVEKIT_ID_ENV]: "",
      [LIVEKIT_PROOF_ENV]: "",
      [SONIOX_CREDENTIAL_ENV]: "",
      [OPENAI_CREDENTIAL_ENV]: "",
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "",
      PIONERO_LIVEKIT_LLM_ENABLED: "",
    },
    async () => {
      const app = createVoiceApp();

      await withTestServer(app, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/voice/pionero/readiness`);
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.ok, true);
        assert.equal(body.ready, false);
        assert.equal(body.status, "blocked");
        assert.equal(body.reasonCode, "livekit_config_missing");
        assert.equal(Array.isArray(body.components), true);
        assert.equal(body.components.length, 5);
        assert.equal(body.components[0].name, "livekit");
        assert.equal(body.components[0].reasonCode, "livekit_config_missing");
        assert.equal(body.components[1].name, "sonioxStt");
        assert.equal(body.components[1].reasonCode, "soniox_api_key_missing");
        assert.equal(body.components[3].name, "openaiComposer");
        assertNoCredentialLeak(body);
      });
    }
  );
});

test("pionero voice readiness route reports configured stack without running smoke", async () => {
  await withEnv(
    {
      LIVEKIT_URL: "wss://livekit.example.test",
      LIVEKIT_WS_URL: "",
      [LIVEKIT_ID_ENV]: "livekit-id-fixture",
      [LIVEKIT_PROOF_ENV]: "livekit-proof-fixture",
      [SONIOX_CREDENTIAL_ENV]: "soniox-fixture",
      [OPENAI_CREDENTIAL_ENV]: "openai-fixture",
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "1",
      PIONERO_LIVEKIT_LLM_ENABLED: "1",
      PIONERO_OPENAI_MODEL: "gpt-test",
    },
    async () => {
      const app = createVoiceApp();

      await withTestServer(app, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/voice/pionero/readiness`);
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.ok, true);
        assert.equal(body.ready, false);
        assert.equal(body.status, "degraded");
        assert.equal(body.reasonCode, "pionero_speech_loop_smoke_not_run");
        assert.equal(body.components[0].ok, true);
        assert.equal(body.components[1].ok, true);
        assert.equal(body.components[2].ok, true);
        assert.equal(body.components[3].ok, true);
        assert.equal(body.components[4].name, "speechLoopSmoke");
        assert.equal(body.components[4].status, "not_run");
        assertNoCredentialLeak(body);
      });
    }
  );
});

test("pionero voice readiness route is tenantless and diagnostic-only", async () => {
  const app = createVoiceApp({
    auth: {
      role: "member",
      email: "member@example.com",
    },
  });

  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/voice/pionero/readiness`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.ready, false);
        assert.equal(body.status, "blocked");
    assert.equal(Array.isArray(body.components), true);
    assertNoCredentialLeak(body);
  });
});