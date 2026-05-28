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

test("pionero LiveKit token route creates a scoped browser token without leaking secrets", async () => {
  const { app, restoreEnv } = createAuthedVoiceApp({
    env: {
      LIVEKIT_URL: "wss://livekit.example.test",
      LIVEKIT_API_KEY: "test-key",
      LIVEKIT_API_SECRET: "test-secret",
    },
  });

  try {
    await withTestServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/voice/pionero/livekit/token`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          roomName: "pionero-demo-room",
        }),
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.ok, true);
      assert.equal(body.version, "pionero_livekit_token.v1");
      assert.equal(body.provider, "livekit");
      assert.equal(body.configured, true);
      assert.equal(body.url, "wss://livekit.example.test");
      assert.equal(body.roomName, "pionero-demo-room");
      assert.equal(body.identity, "user-test");
      assert.equal(typeof body.token, "string");
      assert.equal(body.token.length > 20, true);
      assert.equal(body.pipeline.transport, "livekit");
      assert.equal(body.pipeline.stt, "soniox");
      assert.equal(body.pipeline.tts, "cartesia");
      assert.equal(JSON.stringify(body).includes("test-secret"), false);
    });
  } finally {
    restoreEnv();
  }
});

test("pionero LiveKit token route reports missing config safely", async () => {
  const { app, restoreEnv } = createAuthedVoiceApp({
    env: {
      LIVEKIT_URL: "",
      LIVEKIT_API_KEY: "",
      LIVEKIT_API_SECRET: "",
    },
  });

  try {
    await withTestServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/voice/pionero/livekit/token`, {
        method: "POST",
      });
      const body = await response.json();

      assert.equal(response.status, 503);
      assert.equal(body.ok, false);
      assert.equal(body.version, "pionero_livekit_token.v1");
      assert.equal(body.error, "livekit_config_missing");
      assert.equal(body.configured, false);
      assert.equal(body.missing.url, true);
      assert.equal(body.missing.apiKey, true);
      assert.equal(body.missing.apiSecret, true);
    });
  } finally {
    restoreEnv();
  }
});
