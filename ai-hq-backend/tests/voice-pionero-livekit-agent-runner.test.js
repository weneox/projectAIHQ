import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";

import {
  createPioneroLiveKitAgentRunner,
} from "../src/modules/voice/pionero/pioneroLiveKitAgentRunner.js";
import {
  voiceRoutes,
} from "../src/routes/api/voice/public.js";

function createTestLogger() {
  return {
    error() {},
    warn() {},
  };
}

function createLiveKitEnv(overrides = {}) {
  return {
    LIVEKIT_URL: "wss://livekit.example.test",
    LIVEKIT_WS_URL: "",
    LIVEKIT_API_KEY: "test-key",
    LIVEKIT_API_SECRET: "test-secret-agent",
    PIONERO_AGENT_IDENTITY: "aihq-pionero-agent",
    PIONERO_AGENT_NAME: "AIHQ Pionero Agent",
    ...overrides,
  };
}

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

  return app;
}

function assertNoSecretLeak(payload = {}, secret = "test-secret-agent") {
  const serialized = JSON.stringify(payload);

  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes("apiSecret"), false);
  assert.equal(Object.hasOwn(payload, "token"), false);
}

test("pionero LiveKit agent runner fails safely when config is missing", async () => {
  const runner = createPioneroLiveKitAgentRunner({
    env: createLiveKitEnv({
      LIVEKIT_URL: "",
      LIVEKIT_WS_URL: "",
      LIVEKIT_API_KEY: "",
      LIVEKIT_API_SECRET: "missing-secret-should-not-leak",
    }),
    logger: createTestLogger(),
    roomName: "pionero-demo-room",
  });

  const state = await runner.start();

  assert.equal(state.version, "pionero_livekit_agent_runner.v1");
  assert.equal(state.status, "blocked");
  assert.equal(state.configured, false);
  assert.equal(state.networkIo, false);
  assert.equal(state.reasonCode, "livekit_config_missing");
  assert.equal(state.roomName, "pionero-demo-room");
  assertNoSecretLeak(state, "missing-secret-should-not-leak");
});

test("pionero LiveKit agent runner plans without RoomClass and does no network IO", async () => {
  const runner = createPioneroLiveKitAgentRunner({
    env: createLiveKitEnv(),
    logger: createTestLogger(),
    roomName: "pionero-demo-room",
  });

  const state = await runner.start();

  assert.equal(state.version, "pionero_livekit_agent_runner.v1");
  assert.equal(state.status, "planned");
  assert.equal(state.configured, true);
  assert.equal(state.networkIo, false);
  assert.equal(state.reasonCode, "livekit_room_client_not_configured");
  assert.equal(state.url, "wss://livekit.example.test");
  assert.equal(state.roomName, "pionero-demo-room");
  assert.equal(state.agentIdentity, "aihq-pionero-agent");
  assertNoSecretLeak(state);
});

test("pionero LiveKit agent runner connects fake RoomClass without exposing token", async () => {
  const rooms = [];

  class FakeRoom {
    constructor() {
      this.connectCalls = [];
      this.disconnectCalls = 0;
      rooms.push(this);
    }

    async connect(url, token) {
      this.connectCalls.push({ url, token });
    }

    async disconnect() {
      this.disconnectCalls += 1;
    }
  }

  const createAgentToken = async () => ({
    version: "pionero_livekit_agent_plan.v1",
    provider: "livekit",
    url: "wss://livekit.example.test",
    roomName: "pionero-demo-room",
    agentIdentity: "aihq-pionero-agent",
    agentName: "AIHQ Pionero Agent",
    token: "agent-token-secret",
    expiresInSeconds: 600,
  });

  const runner = createPioneroLiveKitAgentRunner({
    RoomClass: FakeRoom,
    createAgentToken,
    env: createLiveKitEnv(),
    logger: createTestLogger(),
    roomName: "pionero-demo-room",
  });

  const state = await runner.start();

  assert.equal(rooms.length, 1);
  assert.deepEqual(rooms[0].connectCalls, [
    {
      url: "wss://livekit.example.test",
      token: "agent-token-secret",
    },
  ]);
  assert.equal(state.status, "connected");
  assert.equal(state.networkIo, true);
  assert.equal(state.reasonCode, "");
  assertNoSecretLeak(state, "agent-token-secret");

  const stoppedState = await runner.stop();

  assert.equal(rooms[0].disconnectCalls, 1);
  assert.equal(stoppedState.status, "stopped");
  assert.equal(stoppedState.networkIo, false);
  assertNoSecretLeak(stoppedState, "agent-token-secret");
});

test("pionero LiveKit agent start-plan route returns planned local state", async () => {
  await withEnv(createLiveKitEnv(), async () => {
    const app = createVoiceApp();

    await withTestServer(app, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/voice/pionero/livekit/agent/start-plan`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            roomName: "pionero route room",
          }),
        }
      );
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.ok, true);
      assert.equal(body.version, "pionero_livekit_agent_runner.v1");
      assert.equal(body.status, "planned");
      assert.equal(body.networkIo, false);
      assert.equal(body.reasonCode, "livekit_room_client_not_configured");
      assert.equal(body.roomName, "pionero-route-room");
      assertNoSecretLeak(body);
    });
  });
});

test("pionero LiveKit agent start-plan route requires operator access", async () => {
  await withEnv(createLiveKitEnv(), async () => {
    const app = createVoiceApp({
      auth: {
        role: "member",
      },
    });

    await withTestServer(app, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/voice/pionero/livekit/agent/start-plan`,
        {
          method: "POST",
        }
      );
      const body = await response.json();

      assert.equal(response.status, 403);
      assert.equal(body.ok, false);
      assert.equal(body.error, "Forbidden");
      assert.equal(body.reason, "operator surface access required");
    });
  });
});
