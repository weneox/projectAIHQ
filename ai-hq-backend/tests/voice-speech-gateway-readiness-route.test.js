import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";

import {
  voiceRoutes,
} from "../src/routes/api/voice/public.js";

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

function createAuthedVoiceApp({ env = {} } = {}) {
  const previousEnv = {};

  for (const [key, value] of Object.entries(env)) {
    previousEnv[key] = process.env[key];
    process.env[key] = value;
  }

  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    req.auth = {
      tenantId: "tenant-test",
      tenantKey: "tenant-test",
      role: "admin",
      userId: "user-test",
      email: "operator@example.com",
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

  return {
    app,
    restoreEnv() {
      for (const key of Object.keys(env)) {
        if (previousEnv[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = previousEnv[key];
        }
      }
    },
  };
}

test("voice speech gateway readiness exposes Soniox config without network IO", async () => {
  const { app, restoreEnv } = createAuthedVoiceApp({
    env: {
      SONIOX_API_KEY: "test-secret",
      VOICE_STT_PROVIDER: "soniox",
      VOICE_TTS_PROVIDER: "soniox",
      VOICE_LANGUAGE: "az",
    },
  });

  try {
    await withTestServer(app, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/voice/speech/gateway/readiness?language=az`
      );
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.ok, true);
      assert.equal(body.version, "voice_speech_gateway_readiness.v1");

      assert.equal(body.gateway.providerAgnostic, true);
      assert.equal(body.gateway.networkIo, false);
      assert.equal(body.gateway.language, "az");
      assert.equal(body.gateway.providers.stt, "soniox");
      assert.equal(body.gateway.providers.tts, "soniox");
      assert.equal(body.gateway.readiness.liveInferenceReady, false);
      assert.equal(
        body.gateway.readiness.reasonCode,
        "speech_gateway_live_inference_not_implemented"
      );

      assert.equal(body.soniox.provider, "soniox");
      assert.equal(body.soniox.configured, true);
      assert.equal(body.soniox.networkIo, false);
      assert.equal(body.soniox.stt.ok, true);
      assert.equal(body.soniox.stt.networkIo, false);
      assert.equal(body.soniox.tts.ok, true);
      assert.equal(body.soniox.tts.networkIo, false);

      assert.equal(JSON.stringify(body).includes("test-secret"), false);
    });
  } finally {
    restoreEnv();
  }
});

test("voice speech gateway readiness reports missing Soniox key safely", async () => {
  const { app, restoreEnv } = createAuthedVoiceApp({
    env: {
      VOICE_STT_PROVIDER: "soniox",
      VOICE_TTS_PROVIDER: "soniox",
      VOICE_LANGUAGE: "az",
    },
  });

  try {
    delete process.env.SONIOX_API_KEY;
    delete process.env.VOICE_SONIOX_API_KEY;

    await withTestServer(app, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/voice/speech/gateway/readiness?language=az`
      );
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.ok, true);
      assert.equal(body.soniox.configured, false);
      assert.equal(body.soniox.reasonCode, "soniox_api_key_missing");
      assert.equal(body.soniox.stt.ok, false);
      assert.equal(body.soniox.tts.ok, false);
      assert.equal(body.soniox.stt.reasonCode, "soniox_api_key_missing");
      assert.equal(body.soniox.tts.reasonCode, "soniox_api_key_missing");
    });
  } finally {
    restoreEnv();
  }
});
