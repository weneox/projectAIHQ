import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";

import {
  buildPioneroLiveKitAgentRunnerState,
  createPioneroLiveKitAgentRunner,
  recordPioneroAudioIngestFrame,
  recordPioneroSttTranscript,
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

function assertNoRawAudioLeak(payload = {}, rawAudio = "raw-audio-secret") {
  const serialized = JSON.stringify(payload);

  assert.equal(serialized.includes(rawAudio), false);
  assert.equal(serialized.includes("audioBase64"), false);
  assert.equal(serialized.includes("audioChunk"), false);
}

function assertDefaultSttIdle(stt = {}) {
  assert.deepEqual(stt, {
    provider: "soniox",
    enabled: false,
    status: "idle",
    transcriptsObserved: 0,
    lastTranscript: "",
    lastObservedAt: "",
    reasonCode: "stt_session_not_started",
    networkIo: false,
  });
}

test("pionero LiveKit agent runner fails safely when config is missing", async () => {
  const runner = createPioneroLiveKitAgentRunner({
    env: createLiveKitEnv({
      LIVEKIT_URL: "",
      LIVEKIT_WS_URL: "",
      LIVEKIT_API_KEY: "",
      LIVEKIT_API_SECRET: "test-missing-secret-should-not-leak",
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
  assert.deepEqual(state.audioIngest, {
    enabled: false,
    status: "idle",
    framesObserved: 0,
    bytesObserved: 0,
    lastObservedAt: "",
    reasonCode: "livekit_config_missing",
  });
  assertDefaultSttIdle(state.stt);
  assertNoSecretLeak(state, "test-missing-secret-should-not-leak");
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
  assert.deepEqual(state.audioIngest, {
    enabled: false,
    status: "idle",
    framesObserved: 0,
    bytesObserved: 0,
    lastObservedAt: "",
    reasonCode: "livekit_room_client_not_configured",
  });
  assertDefaultSttIdle(state.stt);
  assertNoSecretLeak(state);
});

test("pionero audio ingest helper counts frames and never stores raw audio", () => {
  let state = buildPioneroLiveKitAgentRunnerState({
    roomName: "pionero-demo-room",
    status: "connected",
  });
  state.token = "test-helper-token-secret";
  state.rawAudio = "raw-audio-secret";

  state = recordPioneroAudioIngestFrame(state, Buffer.from([1, 2, 3]), {
    now: () => new Date("2026-01-02T03:04:05.000Z"),
  });
  state = recordPioneroAudioIngestFrame(state, new Uint8Array([4, 5]), {
    now: () => new Date("2026-01-02T03:04:06.000Z"),
  });
  state = recordPioneroAudioIngestFrame(state, "abc", {
    now: () => new Date("2026-01-02T03:04:07.000Z"),
  });
  state = recordPioneroAudioIngestFrame(
    state,
    {
      byteLength: 4,
      data: "raw-audio-secret",
    },
    {
      now: () => new Date("2026-01-02T03:04:08.000Z"),
    }
  );

  assert.deepEqual(state.audioIngest, {
    enabled: true,
    status: "audio_observed",
    framesObserved: 4,
    bytesObserved: 12,
    lastObservedAt: "2026-01-02T03:04:08.000Z",
    reasonCode: "",
  });
  assertNoRawAudioLeak(state);
  assertNoSecretLeak(state, "test-helper-token-secret");
});

test("pionero STT transcript helper stores safe text only", () => {
  let state = buildPioneroLiveKitAgentRunnerState({
    roomName: "pionero-demo-room",
    status: "connected",
    stt: {
      provider: "soniox",
      enabled: true,
      status: "streaming",
      networkIo: false,
    },
  });
  state.token = "test-helper-token-secret";
  state.rawAudio = "raw-audio-secret";

  state = recordPioneroSttTranscript(
    state,
    {
      ok: true,
      status: "transcribed",
      text: "Salam Pionero",
      transcribedAt: "2026-01-02T03:04:09.000Z",
      networkIo: true,
      token: "test-stt-token-secret",
      rawAudio: "raw-audio-secret",
    },
    {
      now: () => new Date("2026-01-02T03:04:10.000Z"),
    }
  );

  assert.deepEqual(state.stt, {
    provider: "soniox",
    enabled: true,
    status: "transcript_observed",
    transcriptsObserved: 1,
    lastTranscript: "Salam Pionero",
    lastObservedAt: "2026-01-02T03:04:09.000Z",
    reasonCode: "",
    networkIo: true,
  });
  assertNoSecretLeak(state, "test-helper-token-secret");
  assertNoSecretLeak(state, "test-stt-token-secret");
  assertNoRawAudioLeak(state);
});

test("pionero LiveKit agent runner connects fake RoomClass without exposing token", async () => {
  const rooms = [];

  class FakeRoom {
    constructor() {
      this.handlers = new Map();
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

    on(eventName, handler) {
      const handlers = this.handlers.get(eventName) || new Set();
      handlers.add(handler);
      this.handlers.set(eventName, handlers);
      return this;
    }

    off(eventName, handler) {
      this.handlers.get(eventName)?.delete(handler);
      return this;
    }
  }

  const createAgentToken = async () => ({
    version: "pionero_livekit_agent_plan.v1",
    provider: "livekit",
    url: "wss://livekit.example.test",
    roomName: "pionero-demo-room",
    agentIdentity: "aihq-pionero-agent",
    agentName: "AIHQ Pionero Agent",
    token: "test-agent-token-secret",
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
      token: "test-agent-token-secret",
    },
  ]);
  assert.equal(state.status, "connected");
  assert.equal(state.networkIo, true);
  assert.equal(state.reasonCode, "");
  assert.deepEqual(state.audioIngest, {
    enabled: true,
    status: "waiting_for_audio",
    framesObserved: 0,
    bytesObserved: 0,
    lastObservedAt: "",
    reasonCode: "",
  });
  assertDefaultSttIdle(state.stt);
  assertNoSecretLeak(state, "test-agent-token-secret");

  const stoppedState = await runner.stop();

  assert.equal(rooms[0].disconnectCalls, 1);
  assert.equal(stoppedState.status, "stopped");
  assert.equal(stoppedState.networkIo, false);
  assertNoSecretLeak(stoppedState, "test-agent-token-secret");
});

test("pionero LiveKit agent runner observes fake room audio events safely", async () => {
  const rooms = [];

  class FakeRoom {
    constructor() {
      this.handlers = new Map();
      rooms.push(this);
    }

    async connect() {}

    on(eventName, handler) {
      const handlers = this.handlers.get(eventName) || new Set();
      handlers.add(handler);
      this.handlers.set(eventName, handlers);
      return this;
    }

    off(eventName, handler) {
      this.handlers.get(eventName)?.delete(handler);
      return this;
    }

    async emit(eventName, ...args) {
      const results = [];
      this.handlers.get(eventName)?.forEach((handler) => {
        results.push(handler(...args));
      });
      await Promise.all(results);
    }
  }

  const runner = createPioneroLiveKitAgentRunner({
    RoomClass: FakeRoom,
    audioIngestEventNames: ["testAudioFrame"],
    createAgentToken: async () => ({
      provider: "livekit",
      url: "wss://livekit.example.test",
      roomName: "pionero-demo-room",
      agentIdentity: "aihq-pionero-agent",
      agentName: "AIHQ Pionero Agent",
      token: "test-agent-token-secret",
    }),
    env: createLiveKitEnv(),
    logger: createTestLogger(),
    now: () => new Date("2026-01-02T03:04:05.000Z"),
    roomName: "pionero-demo-room",
  });

  const startedState = await runner.start();

  assert.equal(startedState.audioIngest.status, "waiting_for_audio");

  await rooms[0].emit("testAudioFrame", {
    byteLength: 7,
    data: "raw-audio-secret",
  });

  const state = runner.getState();

  assert.deepEqual(state.audioIngest, {
    enabled: true,
    status: "audio_observed",
    framesObserved: 1,
    bytesObserved: 7,
    lastObservedAt: "2026-01-02T03:04:05.000Z",
    reasonCode: "",
  });
  assertDefaultSttIdle(state.stt);
  assertNoSecretLeak(state, "test-agent-token-secret");
  assertNoRawAudioLeak(state);
});

test("pionero LiveKit agent runner streams observed audio into fake STT session", async () => {
  const rooms = [];
  const sttCalls = [];

  class FakeRoom {
    constructor() {
      this.handlers = new Map();
      rooms.push(this);
    }

    async connect() {}

    on(eventName, handler) {
      const handlers = this.handlers.get(eventName) || new Set();
      handlers.add(handler);
      this.handlers.set(eventName, handlers);
      return this;
    }

    off(eventName, handler) {
      this.handlers.get(eventName)?.delete(handler);
      return this;
    }

    async emit(eventName, ...args) {
      const results = [];
      this.handlers.get(eventName)?.forEach((handler) => {
        results.push(handler(...args));
      });
      await Promise.all(results);
    }
  }

  const runner = createPioneroLiveKitAgentRunner({
    RoomClass: FakeRoom,
    audioIngestEventNames: ["testAudioFrame"],
    createAgentToken: async () => ({
      provider: "livekit",
      url: "wss://livekit.example.test",
      roomName: "pionero-demo-room",
      agentIdentity: "aihq-pionero-agent",
      agentName: "AIHQ Pionero Agent",
      token: "test-agent-token-secret",
    }),
    createSttSession: async () => ({
      provider: "soniox",
      async transcribeAudioChunk(input = {}) {
        sttCalls.push(input);
        return {
          ok: true,
          status: "transcribed",
          provider: "soniox",
          stage: "stt",
          text: "Salam Pionero",
          transcribedAt: "2026-01-02T03:04:06.000Z",
          networkIo: true,
          token: "test-stt-token-secret",
          rawAudio: "raw-audio-secret",
        };
      },
    }),
    env: createLiveKitEnv(),
    logger: createTestLogger(),
    now: () => new Date("2026-01-02T03:04:05.000Z"),
    roomName: "pionero-demo-room",
  });

  const startedState = await runner.start();

  assert.equal(startedState.stt.enabled, true);
  assert.equal(startedState.stt.status, "waiting_for_audio");

  await rooms[0].emit("testAudioFrame", {
    byteLength: 7,
    data: "raw-audio-secret",
  });

  const state = runner.getState();

  assert.equal(sttCalls.length, 1);
  assert.equal(sttCalls[0].audioChunk.byteLength, 7);
  assert.equal(sttCalls[0].finalize, false);
  assert.deepEqual(state.audioIngest, {
    enabled: true,
    status: "audio_observed",
    framesObserved: 1,
    bytesObserved: 7,
    lastObservedAt: "2026-01-02T03:04:05.000Z",
    reasonCode: "",
  });
  assert.deepEqual(state.stt, {
    provider: "soniox",
    enabled: true,
    status: "transcript_observed",
    transcriptsObserved: 1,
    lastTranscript: "Salam Pionero",
    lastObservedAt: "2026-01-02T03:04:06.000Z",
    reasonCode: "",
    networkIo: true,
  });
  assertNoSecretLeak(state, "test-agent-token-secret");
  assertNoSecretLeak(state, "test-stt-token-secret");
  assertNoRawAudioLeak(state);
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
      assert.deepEqual(body.audioIngest, {
        enabled: false,
        status: "idle",
        framesObserved: 0,
        bytesObserved: 0,
        lastObservedAt: "",
        reasonCode: "livekit_room_client_not_configured",
      });
      assertDefaultSttIdle(body.stt);
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

