import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";

import {
  buildPioneroLiveKitAgentRunnerState,
  createPioneroLiveKitAgentRunner,
  recordPioneroAudioIngestFrame,
  recordPioneroLlmTurnPlan,
  recordPioneroSttTranscript,
  recordPioneroTtsPlan,
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

function createVoiceApp({
  auth = {},
  pioneroLiveKitRoomClassFactory = null,
} = {}) {
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
      pioneroLiveKitRoomClassFactory,
    })
  );

  return app;
}

function assertNoSecretLeak(payload = {}, secret = "test-secret-agent") {
  const serialized = JSON.stringify(payload);

  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes("apiSecret"), false);
  assert.equal(serialized.includes("api_secret"), false);
  assert.equal(serialized.includes('"token"'), false);
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

function assertDefaultLlm(llm = {}, status = "idle") {
  assert.deepEqual(llm, {
    provider: "fast_text_llm",
    enabled: false,
    status,
    turnsPlanned: 0,
    lastInputTranscript: "",
    lastPlannedResponse: "",
    lastObservedAt: "",
    reasonCode: "llm_not_started",
    networkIo: false,
  });
}

function assertDefaultTts(tts = {}, status = "idle") {
  assert.deepEqual(tts, {
    provider: "cartesia",
    enabled: false,
    status,
    speechPlansCreated: 0,
    lastInputText: "",
    lastAudioPlan: "",
    lastObservedAt: "",
    reasonCode: "tts_not_started",
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
  assertDefaultLlm(state.llm);
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
  assertDefaultLlm(state.llm, "planned");
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

test("pionero LLM turn-plan helper stores safe planned turn only", () => {
  let state = buildPioneroLiveKitAgentRunnerState({
    roomName: "pionero-demo-room",
    status: "connected",
  });
  state.token = "test-helper-token-secret";
  state.secret = "test-helper-plain-secret";
  state.rawAudio = "raw-audio-secret";
  state.llm = {
    ...state.llm,
    token: "test-llm-token-secret",
    rawAudio: "raw-audio-secret",
  };

  state = recordPioneroLlmTurnPlan(
    state,
    {
      transcript: "Salam Pionero",
      plannedResponse: "Plan response for the next Pionero turn.",
      plannedAt: "2026-01-02T03:04:11.000Z",
      networkIo: true,
      token: "test-llm-token-secret",
      apiSecret: "test-llm-secret",
      rawAudio: "raw-audio-secret",
    },
    {
      now: () => new Date("2026-01-02T03:04:12.000Z"),
    }
  );

  assert.deepEqual(state.llm, {
    provider: "fast_text_llm",
    enabled: true,
    status: "turn_plan_built",
    turnsPlanned: 1,
    lastInputTranscript: "Salam Pionero",
    lastPlannedResponse: "Plan response for the next Pionero turn.",
    lastObservedAt: "2026-01-02T03:04:11.000Z",
    reasonCode: "",
    networkIo: false,
  });
  assertNoSecretLeak(state, "test-helper-token-secret");
  assertNoSecretLeak(state, "test-helper-plain-secret");
  assertNoSecretLeak(state, "test-llm-token-secret");
  assertNoSecretLeak(state, "test-llm-secret");
  assertNoRawAudioLeak(state);
});

test("pionero TTS plan helper stores safe speech plan only", () => {
  let state = buildPioneroLiveKitAgentRunnerState({
    roomName: "pionero-demo-room",
    status: "connected",
  });

  state.token = "test-helper-token-secret";
  state.secret = "test-helper-plain-secret";
  state.rawAudio = "raw-audio-secret";
  state.tts = {
    ...state.tts,
    token: "test-tts-token-secret",
    rawAudio: "raw-audio-secret",
  };

  state = recordPioneroTtsPlan(
    state,
    {
      text: "Turn plan pending real LLM.",
      audioPlan: "TTS plan pending real synthesis.",
      plannedAt: "2026-01-02T03:04:13.000Z",
      token: "test-tts-token-secret",
      apiSecret: "test-tts-secret",
      rawAudio: "raw-audio-secret",
    },
    {
      now: () => new Date("2026-01-02T03:04:14.000Z"),
    }
  );

  assert.deepEqual(state.tts, {
    provider: "cartesia",
    enabled: true,
    status: "speech_plan_built",
    speechPlansCreated: 1,
    lastInputText: "Turn plan pending real LLM.",
    lastAudioPlan: "TTS plan pending real synthesis.",
    lastObservedAt: "2026-01-02T03:04:13.000Z",
    reasonCode: "",
    networkIo: false,
  });
  assertNoSecretLeak(state, "test-helper-token-secret");
  assertNoSecretLeak(state, "test-helper-plain-secret");
  assertNoSecretLeak(state, "test-tts-token-secret");
  assertNoSecretLeak(state, "test-tts-secret");
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
  assertDefaultLlm(state.llm, "planned");
  assertNoSecretLeak(state, "test-agent-token-secret");

  const stoppedState = await runner.stop();

  assert.equal(rooms[0].disconnectCalls, 1);
  assert.equal(stoppedState.status, "stopped");
  assert.equal(stoppedState.networkIo, false);
  assert.equal(stoppedState.llm.status, "idle");
  assert.equal(stoppedState.llm.reasonCode, "pionero_agent_runner_stopped");
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
  assertDefaultLlm(state.llm, "planned");
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
  assert.deepEqual(state.llm, {
    provider: "fast_text_llm",
    enabled: true,
    status: "turn_plan_built",
    turnsPlanned: 1,
    lastInputTranscript: "Salam Pionero",
    lastPlannedResponse: "Turn plan pending real LLM.",
    lastObservedAt: "2026-01-02T03:04:05.000Z",
    reasonCode: "",
    networkIo: false,
  });
  assert.deepEqual(state.tts, {
    provider: "cartesia",
    enabled: true,
    status: "speech_plan_built",
    speechPlansCreated: 1,
    lastInputText: "Turn plan pending real LLM.",
    lastAudioPlan: "TTS plan pending real synthesis.",
    lastObservedAt: "2026-01-02T03:04:05.000Z",
    reasonCode: "",
    networkIo: false,
  });
  assertNoSecretLeak(state, "test-agent-token-secret");
  assertNoSecretLeak(state, "test-stt-token-secret");
  assertNoRawAudioLeak(state);
});

test("pionero LiveKit agent runner does not plan LLM turn without STT transcript", async () => {
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
    createSttSession: async () => ({
      async transcribeAudioChunk() {
        return {
          ok: true,
          status: "streaming",
          provider: "soniox",
          stage: "stt",
          networkIo: false,
          rawAudio: "raw-audio-secret",
        };
      },
    }),
    env: createLiveKitEnv(),
    logger: createTestLogger(),
    now: () => new Date("2026-01-02T03:04:05.000Z"),
    roomName: "pionero-demo-room",
  });

  await runner.start();

  await rooms[0].emit("testAudioFrame", {
    byteLength: 7,
    data: "raw-audio-secret",
  });

  const state = runner.getState();

  assert.equal(state.audioIngest.framesObserved, 1);
  assert.equal(state.stt.status, "streaming");
  assertDefaultLlm(state.llm, "planned");
  assertNoSecretLeak(state, "test-agent-token-secret");
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
      assertDefaultLlm(body.llm, "planned");
      assertDefaultTts(body.tts, "planned");
      assertNoSecretLeak(body);
    });
  });
});

test("pionero LiveKit agent start-plan route can inject a fake RoomClass seam", async () => {
  await withEnv(createLiveKitEnv(), async () => {
    const rooms = [];
    const factoryCalls = [];

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

    const app = createVoiceApp({
      pioneroLiveKitRoomClassFactory({ req, roomName, logger }) {
        factoryCalls.push({
          hasReq: Boolean(req),
          hasLogger: Boolean(logger),
          roomName,
        });
        return FakeRoom;
      },
    });

    await withTestServer(app, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/voice/pionero/livekit/agent/start-plan`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            roomName: "pionero route roomclass seam room",
          }),
        }
      );
      const body = await response.json();
      const serialized = JSON.stringify(body);

      assert.equal(response.status, 200);
      assert.equal(body.ok, true);
      assert.equal(body.status, "connected");
      assert.equal(body.networkIo, true);
      assert.equal(body.readiness.agentParticipantReady, true);
      assert.equal(body.audioIngest.status, "waiting_for_audio");
      assert.equal(body.roomName, "pionero-route-roomclass-seam-room");
      assert.deepEqual(factoryCalls, [
        {
          hasReq: true,
          hasLogger: true,
          roomName: "pionero route roomclass seam room",
        },
      ]);
      assert.equal(rooms.length, 1);
      assert.equal(rooms[0].connectCalls.length, 1);
      assert.equal(rooms[0].connectCalls[0].url, "wss://livekit.example.test");
      assert.equal(serialized.includes(rooms[0].connectCalls[0].token), false);
      assertNoSecretLeak(body);
      assertNoRawAudioLeak(body);
    });
  });
});

test("pionero LiveKit agent start-plan route ignores RoomClass factory failures", async () => {
  await withEnv(createLiveKitEnv(), async () => {
    let factoryCalls = 0;
    const app = createVoiceApp({
      pioneroLiveKitRoomClassFactory() {
        factoryCalls += 1;
        throw new Error("fake room class factory failed");
      },
    });

    await withTestServer(app, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/voice/pionero/livekit/agent/start-plan`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            roomName: "pionero route roomclass factory throws room",
          }),
        }
      );
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.ok, true);
      assert.equal(body.status, "planned");
      assert.equal(body.networkIo, false);
      assert.equal(body.reasonCode, "livekit_room_client_not_configured");
      assert.equal(body.roomName, "pionero-route-roomclass-factory-throws-room");
      assert.equal(factoryCalls, 1);
      assertNoSecretLeak(body);
      assertNoRawAudioLeak(body);
    });
  });
});

test("pionero LiveKit agent runtime status and stop routes reuse room state", async () => {
  await withEnv(createLiveKitEnv(), async () => {
    const app = createVoiceApp();

    await withTestServer(app, async (baseUrl) => {
      const roomName = "pionero runtime route room";

      const startResponse = await fetch(
        `${baseUrl}/voice/pionero/livekit/agent/start-plan`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ roomName }),
        }
      );
      const startBody = await startResponse.json();

      assert.equal(startResponse.status, 200);
      assert.equal(startBody.ok, true);
      assert.equal(startBody.status, "planned");
      assert.equal(startBody.roomName, "pionero-runtime-route-room");
      assertNoSecretLeak(startBody);

      const statusResponse = await fetch(
        `${baseUrl}/voice/pionero/livekit/agent/status?roomName=${encodeURIComponent(roomName)}`
      );
      const statusBody = await statusResponse.json();

      assert.equal(statusResponse.status, 200);
      assert.equal(statusBody.ok, true);
      assert.equal(statusBody.status, "planned");
      assert.equal(statusBody.roomName, "pionero-runtime-route-room");
      assertDefaultSttIdle(statusBody.stt);
      assertDefaultLlm(statusBody.llm, "planned");
      assertDefaultTts(statusBody.tts, "planned");
      assertNoSecretLeak(statusBody);

      const stopResponse = await fetch(
        `${baseUrl}/voice/pionero/livekit/agent/stop-plan`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ roomName }),
        }
      );
      const stopBody = await stopResponse.json();

      assert.equal(stopResponse.status, 200);
      assert.equal(stopBody.ok, true);
      assert.equal(stopBody.status, "stopped");
      assert.equal(stopBody.roomName, "pionero-runtime-route-room");
      assert.equal(stopBody.audioIngest.reasonCode, "pionero_agent_runner_stopped");
      assert.equal(stopBody.stt.reasonCode, "pionero_agent_runner_stopped");
      assert.equal(stopBody.llm.reasonCode, "pionero_agent_runner_stopped");
      assert.equal(stopBody.tts.reasonCode, "pionero_agent_runner_stopped");
      assertNoSecretLeak(stopBody);
    });
  });
});

test("pionero LiveKit agent status route returns safe not-found response", async () => {
  await withEnv(createLiveKitEnv(), async () => {
    const app = createVoiceApp();

    await withTestServer(app, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/voice/pionero/livekit/agent/status?roomName=missing-runtime-room`
      );
      const body = await response.json();

      assert.equal(response.status, 404);
      assert.equal(body.ok, false);
      assert.equal(body.error, "pionero_agent_runtime_not_found");
      assert.equal(body.reasonCode, "pionero_agent_runtime_not_found");
      assert.equal(body.roomName, "missing-runtime-room");
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

