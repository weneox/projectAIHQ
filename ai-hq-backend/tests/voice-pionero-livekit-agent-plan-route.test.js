import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";

import {
  voiceRoutes,
} from "../src/routes/api/voice/public.js";

const PLAN_KEYS = [
  "ok",
  "version",
  "configured",
  "reasonCode",
  "provider",
  "url",
  "roomName",
  "agentIdentity",
  "agentName",
  "pipeline",
  "readiness",
];

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

function assertPlanKeys(body = {}) {
  const allowed = new Set(PLAN_KEYS);

  for (const key of Object.keys(body)) {
    assert.equal(allowed.has(key), true, `unexpected plan key: ${key}`);
  }
}

test("pionero LiveKit agent plan reports missing config safely", async () => {
  await withEnv(
    {
      LIVEKIT_URL: "",
      LIVEKIT_WS_URL: "",
      LIVEKIT_API_KEY: "",
      LIVEKIT_API_SECRET: "",
      PIONERO_AGENT_IDENTITY: "",
      PIONERO_AGENT_NAME: "",
    },
    async () => {
      const app = createVoiceApp();

      await withTestServer(app, async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/voice/pionero/livekit/agent/plan`
        );
        const body = await response.json();

        assert.equal(response.status, 200);
        assertPlanKeys(body);
        assert.equal(body.ok, true);
        assert.equal(body.version, "pionero_livekit_agent_plan.v1");
        assert.equal(body.configured, false);
        assert.equal(body.reasonCode, "livekit_config_missing");
        assert.equal(body.provider, "livekit");
        assert.equal(body.url, "");
        assert.equal(body.roomName, "pionero-browser-test");
        assert.equal(body.agentIdentity, "aihq-pionero-agent");
        assert.equal(body.agentName, "AIHQ Pionero Agent");
        assert.deepEqual(body.pipeline, {
          transport: "livekit",
          stt: "soniox",
          llm: "fast_text_llm",
          tts: "cartesia",
        });
        assert.deepEqual(body.readiness, {
          agentParticipantReady: false,
          reasonCode: "pionero_agent_runner_not_started",
        });
        assert.equal(JSON.stringify(body).includes("LIVEKIT_API_SECRET"), false);
        assert.equal(JSON.stringify(body).includes("token"), false);
      });
    }
  );
});

test("pionero LiveKit agent plan reports configured env without leaking secrets", async () => {
  await withEnv(
    {
      LIVEKIT_URL: "wss://livekit.example.test",
      LIVEKIT_WS_URL: "",
      LIVEKIT_API_KEY: "test-key",
      LIVEKIT_API_SECRET: "test-secret-agent",
      PIONERO_AGENT_IDENTITY: "pionero agent/one",
      PIONERO_AGENT_NAME: "Custom Pionero Agent",
    },
    async () => {
      const app = createVoiceApp();

      await withTestServer(app, async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/voice/pionero/livekit/agent/plan?roomName=pionero%20demo%20room`
        );
        const body = await response.json();
        const serialized = JSON.stringify(body);

        assert.equal(response.status, 200);
        assertPlanKeys(body);
        assert.equal(body.ok, true);
        assert.equal(body.version, "pionero_livekit_agent_plan.v1");
        assert.equal(body.configured, true);
        assert.equal(body.reasonCode, "");
        assert.equal(body.provider, "livekit");
        assert.equal(body.url, "wss://livekit.example.test");
        assert.equal(body.roomName, "pionero-demo-room");
        assert.equal(body.agentIdentity, "pionero-agent-one");
        assert.equal(body.agentName, "Custom Pionero Agent");
        assert.equal(body.readiness.agentParticipantReady, false);
        assert.equal(body.readiness.reasonCode, "pionero_agent_runner_not_started");
        assert.equal(serialized.includes("test-secret-agent"), false);
        assert.equal(serialized.includes("apiSecret"), false);
        assert.equal(serialized.includes("token"), false);
      });
    }
  );
});

test("pionero LiveKit agent plan route requires operator surface access", async () => {
  await withEnv(
    {
      LIVEKIT_URL: "wss://livekit.example.test",
      LIVEKIT_WS_URL: "",
      LIVEKIT_API_KEY: "test-key",
      LIVEKIT_API_SECRET: "test-secret-agent",
    },
    async () => {
      const app = createVoiceApp({
        auth: {
          role: "member",
          email: "member@example.com",
        },
      });

      await withTestServer(app, async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/voice/pionero/livekit/agent/plan`
        );
        const body = await response.json();

        assert.equal(response.status, 403);
        assert.equal(body.ok, false);
        assert.equal(body.error, "Forbidden");
        assert.equal(body.reason, "operator surface access required");
      });
    }
  );
});
