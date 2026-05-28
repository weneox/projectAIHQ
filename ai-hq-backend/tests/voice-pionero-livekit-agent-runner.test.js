import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";

import {
  buildPioneroLiveKitAgentRunnerState,
  createPioneroLiveKitAgentRunner,
  normalizePioneroAudioFrameToPcmBuffer,
  recordPioneroAudioIngestEvent,
  recordPioneroAudioIngestFrame,
  recordPioneroLlmTurnPlan,
  recordPioneroSttTranscript,
  recordPioneroTtsPlan,
  snapshotPioneroRoomParticipants,
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

function waitImmediate() {
  return new Promise((resolve) => {
    setImmediate(resolve);
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
  assert.equal(serialized.includes('"apiSecret"'), false);
  assert.equal(serialized.includes('"apiKey"'), false);
  assert.equal(serialized.includes("api_secret"), false);
  assert.equal(serialized.includes('"api_key"'), false);
  assert.equal(serialized.includes("jwt"), false);
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
    framesBuffered: 0,
    sttFramesDropped: 0,
    sttFrameNormalizeFailed: 0,
    sttPcmBytesBuffered: 0,
    flushesAttempted: 0,
    flushesSucceeded: 0,
    flushesFailed: 0,
    lastFlushReasonCode: "",
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

function expectedAudioIngest(overrides = {}) {
  return {
    enabled: false,
    status: "idle",
    eventCounts: {},
    lastEventName: "",
    lastTrackKind: "",
    lastTrackSource: "",
    tracksObserved: 0,
    participantsObserved: 0,
    remoteParticipantsObserved: 0,
    trackPublicationsObserved: 0,
    audioPublicationsObserved: 0,
    subscribedAudioTracksObserved: 0,
    audioStreamsOpened: 0,
    audioStreamFramesObserved: 0,
    audioStreamReadErrors: 0,
    lastAudioStreamReasonCode: "",
    lastParticipantIdentity: "",
    lastPublicationKind: "",
    lastPublicationSource: "",
    lastPublicationSubscribed: false,
    framesObserved: 0,
    bytesObserved: 0,
    lastObservedAt: "",
    reasonCode: "",
    ...overrides,
  };
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
  assert.deepEqual(state.audioIngest, expectedAudioIngest({
    reasonCode: "livekit_config_missing",
  }));
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
  assert.deepEqual(state.audioIngest, expectedAudioIngest({
    reasonCode: "livekit_room_client_not_configured",
  }));
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

  assert.deepEqual(state.audioIngest, expectedAudioIngest({
    enabled: true,
    status: "audio_observed",
    framesObserved: 4,
    bytesObserved: 12,
    lastObservedAt: "2026-01-02T03:04:08.000Z",
  }));
  assertNoRawAudioLeak(state);
  assertNoSecretLeak(state, "test-helper-token-secret");
});

test("pionero PCM normalizer extracts Int16Array AudioFrame data", () => {
  const samples = new Int16Array([1, -2, 32767]);
  const pcm = normalizePioneroAudioFrameToPcmBuffer({
    data: samples,
    rawAudio: "raw-audio-secret",
  });

  assert.equal(Buffer.isBuffer(pcm), true);
  assert.equal(pcm.byteLength, samples.byteLength);
  assert.equal(pcm.readInt16LE(0), 1);
  assert.equal(pcm.readInt16LE(2), -2);
  assert.equal(pcm.readInt16LE(4), 32767);
});

test("pionero PCM normalizer converts float samples to signed 16-bit LE", () => {
  const pcm = normalizePioneroAudioFrameToPcmBuffer({
    data: new Float32Array([-1, 0, 1]),
  });

  assert.equal(Buffer.isBuffer(pcm), true);
  assert.equal(pcm.byteLength, 6);
  assert.equal(pcm.readInt16LE(0), -32768);
  assert.equal(pcm.readInt16LE(2), 0);
  assert.equal(pcm.readInt16LE(4), 32767);
});

test("pionero PCM normalizer preserves DataView and Uint8Array byte windows", () => {
  const source = new Uint8Array([9, 1, 2, 3, 8]);
  const dataViewPcm = normalizePioneroAudioFrameToPcmBuffer(
    new DataView(source.buffer, 1, 3)
  );
  const uint8Pcm = normalizePioneroAudioFrameToPcmBuffer(source.subarray(2, 4));

  assert.deepEqual([...dataViewPcm], [1, 2, 3]);
  assert.deepEqual([...uint8Pcm], [2, 3]);
});

test("pionero audio ingest event helper stores safe diagnostics only", () => {
  let state = buildPioneroLiveKitAgentRunnerState({
    roomName: "pionero-demo-room",
    status: "connected",
  });

  state.token = "test-helper-token-secret";
  state.rawAudio = "raw-audio-secret";
  state = recordPioneroAudioIngestEvent(state, {
    eventName: "trackSubscribed",
    track: {
      kind: "audio",
      source: "microphone",
      token: "track-token-secret",
      apiSecret: "track-api-secret",
      rawAudio: "raw-audio-secret",
      audioChunk: "audio-chunk-secret",
    },
  });
  state = recordPioneroAudioIngestEvent(state, {
    eventName: "audioFrame",
    firstArg: {
      data: "raw-audio-secret",
      token: "payload-token-secret",
    },
  });

  assert.deepEqual(state.audioIngest, expectedAudioIngest({
    enabled: true,
    status: "waiting_for_audio",
    eventCounts: {
      trackSubscribed: 1,
      audioFrame: 1,
    },
    lastEventName: "audioFrame",
    lastTrackKind: "audio",
    lastTrackSource: "microphone",
    tracksObserved: 1,
    trackPublicationsObserved: 1,
    audioPublicationsObserved: 1,
    subscribedAudioTracksObserved: 1,
    lastPublicationKind: "audio",
    lastPublicationSource: "microphone",
    lastPublicationSubscribed: true,
  }));
  assertNoSecretLeak(state, "test-helper-token-secret");
  assertNoSecretLeak(state, "track-token-secret");
  assertNoSecretLeak(state, "track-api-secret");
  assertNoSecretLeak(state, "payload-token-secret");
  assertNoRawAudioLeak(state);
});

test("pionero room participant snapshot counts safe publication diagnostics", () => {
  let state = buildPioneroLiveKitAgentRunnerState({
    roomName: "pionero-demo-room",
    status: "connected",
  });
  state.token = "test-helper-token-secret";
  const room = {
    localParticipant: {
      identity: "aihq-pionero-agent",
    },
    remoteParticipants: new Map([
      [
        "browser-1",
        {
          identity: "browser-1",
          token: "participant-token-secret",
          trackPublications: new Map([
            [
              "mic-1",
              {
                kind: "audio",
                source: "microphone",
                isSubscribed: true,
                rawAudio: "raw-audio-secret",
              },
            ],
          ]),
        },
      ],
    ]),
  };

  state = snapshotPioneroRoomParticipants(state, room);

  assert.deepEqual(state.audioIngest, expectedAudioIngest({
    enabled: true,
    status: "waiting_for_audio",
    participantsObserved: 2,
    remoteParticipantsObserved: 1,
    trackPublicationsObserved: 1,
    audioPublicationsObserved: 1,
    subscribedAudioTracksObserved: 1,
    lastParticipantIdentity: "browser-1",
    lastPublicationKind: "audio",
    lastPublicationSource: "microphone",
    lastPublicationSubscribed: true,
  }));
  assertNoSecretLeak(state, "test-helper-token-secret");
  assertNoSecretLeak(state, "participant-token-secret");
  assertNoRawAudioLeak(state);
});

test("pionero room participant snapshot redacts unsafe identity strings", () => {
  let state = buildPioneroLiveKitAgentRunnerState({
    roomName: "pionero-demo-room",
    status: "connected",
  });
  const room = {
    remoteParticipants: new Map([
      [
        "unsafe",
        {
          identity: "token-apiKey-apiSecret-jwt-rawAudio-audioBase64-audioChunk",
          trackPublications: new Map([
            [
              "camera-1",
              {
                kind: "video",
                source: "camera",
                isSubscribed: false,
                token: "publication-token-secret",
              },
            ],
          ]),
        },
      ],
    ]),
  };

  state = snapshotPioneroRoomParticipants(state, room);

  assert.equal(state.audioIngest.remoteParticipantsObserved, 1);
  assert.equal(state.audioIngest.trackPublicationsObserved, 1);
  assert.equal(state.audioIngest.audioPublicationsObserved, 0);
  assert.equal(state.audioIngest.subscribedAudioTracksObserved, 0);
  assert.equal(state.audioIngest.lastParticipantIdentity, "[redacted]");
  assert.equal(state.audioIngest.lastPublicationKind, "video");
  assert.equal(state.audioIngest.lastPublicationSource, "camera");
  assert.equal(state.audioIngest.lastPublicationSubscribed, false);
  assertNoSecretLeak(state, "publication-token-secret");
  assertNoRawAudioLeak(state);
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
    framesBuffered: 0,
    sttFramesDropped: 0,
    sttFrameNormalizeFailed: 0,
    sttPcmBytesBuffered: 0,
    flushesAttempted: 0,
    flushesSucceeded: 0,
    flushesFailed: 0,
    lastFlushReasonCode: "",
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
  assert.deepEqual(state.audioIngest, expectedAudioIngest({
    enabled: true,
    status: "waiting_for_audio",
  }));
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

  assert.deepEqual(state.audioIngest, expectedAudioIngest({
    enabled: true,
    status: "audio_observed",
    eventCounts: {
      testAudioFrame: 1,
    },
    lastEventName: "testAudioFrame",
    framesObserved: 1,
    bytesObserved: 7,
    lastObservedAt: "2026-01-02T03:04:05.000Z",
  }));
  assertDefaultSttIdle(state.stt);
  assertDefaultLlm(state.llm, "planned");
  assertNoSecretLeak(state, "test-agent-token-secret");
  assertNoRawAudioLeak(state);
});

test("pionero LiveKit agent runner keeps STT no-network by default", async () => {
  const rooms = [];
  let sttSessionCreateCalls = 0;

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
    createSttSession: async () => {
      sttSessionCreateCalls += 1;
      return {
        async transcribe() {
          throw new Error("stt should remain disabled by default");
        },
      };
    },
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

  assert.equal(sttSessionCreateCalls, 0);
  assert.equal(state.audioIngest.framesObserved, 1);
  assert.equal(state.stt.status, "idle");
  assert.equal(state.stt.flushesAttempted, 0);
  assert.equal(state.stt.framesBuffered, 0);
  assertNoSecretLeak(state, "test-agent-token-secret");
  assertNoRawAudioLeak(state);
});

test("pionero LiveKit agent runner counts participant events and snapshots participants", async () => {
  const rooms = [];

  class FakeRoom {
    constructor() {
      this.handlers = new Map();
      this.remoteParticipants = new Map();
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
    RoomEvent: {
      ParticipantConnected: "participantConnected",
    },
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
    roomName: "pionero-demo-room",
  });

  await runner.start();

  const participant = {
    identity: "browser-1",
    token: "participant-token-secret",
  };
  rooms[0].remoteParticipants.set("browser-1", participant);
  await rooms[0].emit("participantConnected", participant);

  const state = runner.getState();

  assert.deepEqual(state.audioIngest, expectedAudioIngest({
    enabled: true,
    status: "waiting_for_audio",
    eventCounts: {
      participantConnected: 1,
    },
    lastEventName: "participantConnected",
    participantsObserved: 1,
    remoteParticipantsObserved: 1,
    lastParticipantIdentity: "browser-1",
  }));
  assertNoSecretLeak(state, "test-agent-token-secret");
  assertNoSecretLeak(state, "participant-token-secret");
});

test("pionero LiveKit agent runner counts track published publication diagnostics", async () => {
  const rooms = [];

  class FakeRoom {
    constructor() {
      this.handlers = new Map();
      this.remoteParticipants = new Map();
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
    RoomEvent: {
      TrackPublished: "trackPublished",
    },
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
    roomName: "pionero-demo-room",
  });

  await runner.start();

  const publication = {
    kind: "audio",
    source: "microphone",
    isSubscribed: false,
    token: "publication-token-secret",
    rawAudio: "raw-audio-secret",
  };
  const participant = {
    identity: "browser-1",
    trackPublications: new Map([["mic-1", publication]]),
  };
  rooms[0].remoteParticipants.set("browser-1", participant);
  await rooms[0].emit("trackPublished", publication, participant);

  const state = runner.getState();

  assert.deepEqual(state.audioIngest, expectedAudioIngest({
    enabled: true,
    status: "waiting_for_audio",
    eventCounts: {
      trackPublished: 1,
    },
    lastEventName: "trackPublished",
    lastTrackKind: "audio",
    lastTrackSource: "microphone",
    tracksObserved: 1,
    participantsObserved: 1,
    remoteParticipantsObserved: 1,
    trackPublicationsObserved: 1,
    audioPublicationsObserved: 1,
    subscribedAudioTracksObserved: 0,
    lastParticipantIdentity: "browser-1",
    lastPublicationKind: "audio",
    lastPublicationSource: "microphone",
    lastPublicationSubscribed: false,
  }));
  assertNoSecretLeak(state, "test-agent-token-secret");
  assertNoSecretLeak(state, "publication-token-secret");
  assertNoRawAudioLeak(state);
});

test("pionero LiveKit agent runner records trackSubscribed diagnostics for audio tracks", async () => {
  const rooms = [];

  class FakeAudioTrack {
    constructor() {
      this.kind = "audio";
      this.source = "microphone";
      this.handlers = new Map();
      this.rawAudio = "raw-audio-secret";
      this.token = "track-token-secret";
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

    async emit(eventName, ...args) {
      const results = [];
      this.handlers.get(eventName)?.forEach((handler) => {
        results.push(handler(...args));
      });
      await Promise.all(results);
    }
  }

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
    RoomEvent: {
      TrackSubscribed: "trackSubscribed",
    },
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

  await runner.start();

  const track = new FakeAudioTrack();
  await rooms[0].emit("trackSubscribed", track);

  assert.deepEqual(runner.getState().audioIngest, expectedAudioIngest({
    enabled: true,
    status: "waiting_for_audio",
    eventCounts: {
      trackSubscribed: 1,
    },
    lastEventName: "trackSubscribed",
    lastTrackKind: "audio",
    lastTrackSource: "microphone",
    tracksObserved: 1,
    trackPublicationsObserved: 1,
    audioPublicationsObserved: 1,
    subscribedAudioTracksObserved: 1,
    lastPublicationKind: "audio",
    lastPublicationSource: "microphone",
    lastPublicationSubscribed: true,
  }));

  await track.emit("audioFrame", Buffer.from([1, 2, 3, 4]));

  const state = runner.getState();

  assert.deepEqual(state.audioIngest, expectedAudioIngest({
    enabled: true,
    status: "audio_observed",
    eventCounts: {
      trackSubscribed: 1,
      audioFrame: 1,
    },
    lastEventName: "audioFrame",
    lastTrackKind: "audio",
    lastTrackSource: "microphone",
    tracksObserved: 1,
    trackPublicationsObserved: 1,
    audioPublicationsObserved: 1,
    subscribedAudioTracksObserved: 1,
    lastPublicationKind: "audio",
    lastPublicationSource: "microphone",
    lastPublicationSubscribed: true,
    framesObserved: 1,
    bytesObserved: 4,
    lastObservedAt: "2026-01-02T03:04:05.000Z",
  }));
  assertNoSecretLeak(state, "test-agent-token-secret");
  assertNoSecretLeak(state, "track-token-secret");
  assertNoRawAudioLeak(state);
});

test("pionero LiveKit agent runner reads rtc-node AudioStream frames safely", async () => {
  const rooms = [];
  const streams = [];

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

  class FakeAudioStream {
    constructor(track, options) {
      this.track = track;
      this.options = options;
      this.cancelCalls = 0;
      this.reads = [
        { value: { data: new Uint8Array([1, 2, 3]) } },
        { value: { samplesPerChannel: 2, channels: 1 } },
        { done: true },
      ];
      streams.push(this);
    }

    getReader() {
      return {
        read: async () => this.reads.shift() || { done: true },
        cancel: async () => {
          this.cancelCalls += 1;
        },
      };
    }
  }

  const runner = createPioneroLiveKitAgentRunner({
    AudioStream: FakeAudioStream,
    RoomClass: FakeRoom,
    RoomEvent: {
      TrackSubscribed: "trackSubscribed",
    },
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

  await runner.start();

  const track = {
    kind: "audio",
    source: "microphone",
    sid: "track-1",
    rawAudio: "raw-audio-secret",
    token: "track-token-secret",
  };

  await rooms[0].emit("trackSubscribed", track);
  await waitImmediate();

  const state = runner.getState();

  assert.equal(streams.length, 1);
  assert.equal(streams[0].track, track);
  assert.deepEqual(streams[0].options, {
    sampleRate: 16000,
    numChannels: 1,
    frameSizeMs: 20,
  });
  assert.deepEqual(state.audioIngest, expectedAudioIngest({
    enabled: true,
    status: "audio_observed",
    eventCounts: {
      trackSubscribed: 1,
    },
    lastEventName: "trackSubscribed",
    lastTrackKind: "audio",
    lastTrackSource: "microphone",
    tracksObserved: 1,
    trackPublicationsObserved: 1,
    audioPublicationsObserved: 1,
    subscribedAudioTracksObserved: 1,
    audioStreamsOpened: 1,
    audioStreamFramesObserved: 2,
    lastAudioStreamReasonCode: "audio_stream_frame_observed",
    lastPublicationKind: "audio",
    lastPublicationSource: "microphone",
    lastPublicationSubscribed: true,
    framesObserved: 2,
    bytesObserved: 7,
    lastObservedAt: "2026-01-02T03:04:05.000Z",
  }));
  assertNoSecretLeak(state, "test-agent-token-secret");
  assertNoSecretLeak(state, "track-token-secret");
  assertNoRawAudioLeak(state);
});

test("pionero LiveKit agent runner cancels AudioStream reader on stop", async () => {
  const rooms = [];
  const readers = [];

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

  class FakeAudioStream {
    getReader() {
      const reader = {
        cancelCalls: 0,
        read: () => new Promise(() => {}),
        cancel: async () => {
          reader.cancelCalls += 1;
        },
      };
      readers.push(reader);
      return reader;
    }
  }

  const runner = createPioneroLiveKitAgentRunner({
    AudioStreamClass: FakeAudioStream,
    RoomClass: FakeRoom,
    RoomEvent: {
      TrackSubscribed: "trackSubscribed",
    },
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
    roomName: "pionero-demo-room",
  });

  await runner.start();
  await rooms[0].emit("trackSubscribed", {
    kind: "audio",
    source: "microphone",
  });
  assert.equal(readers.length, 1);

  const stoppedState = await runner.stop();

  assert.equal(readers[0].cancelCalls, 1);
  assert.equal(stoppedState.status, "stopped");
  assert.equal(stoppedState.audioIngest.audioStreamsOpened, 1);
  assertNoSecretLeak(stoppedState, "test-agent-token-secret");
});

test("pionero LiveKit agent runner does not duplicate AudioStream for same track", async () => {
  const rooms = [];
  let streamCount = 0;

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

  class FakeAudioStream {
    constructor() {
      streamCount += 1;
    }

    getReader() {
      return {
        read: () => new Promise(() => {}),
        cancel: async () => {},
      };
    }
  }

  const runner = createPioneroLiveKitAgentRunner({
    AudioStream: FakeAudioStream,
    RoomClass: FakeRoom,
    RoomEvent: {
      TrackSubscribed: "trackSubscribed",
    },
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
    roomName: "pionero-demo-room",
  });

  await runner.start();
  const track = {
    kind: "audio",
    source: "microphone",
    sid: "track-1",
  };

  await rooms[0].emit("trackSubscribed", track);
  await rooms[0].emit("trackSubscribed", track);

  const state = runner.getState();

  assert.equal(streamCount, 1);
  assert.equal(state.audioIngest.audioStreamsOpened, 1);
  assert.equal(state.audioIngest.eventCounts.trackSubscribed, 2);
  assertNoSecretLeak(state, "test-agent-token-secret");

  await runner.stop();
});

test("pionero LiveKit agent runner maps numeric rtc-node kind and source", async () => {
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
    RoomEvent: {
      TrackPublished: "trackPublished",
    },
    TrackKind: {
      KIND_AUDIO: 1,
      KIND_VIDEO: 2,
    },
    TrackSource: {
      SOURCE_CAMERA: 1,
      SOURCE_MICROPHONE: 2,
    },
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
    roomName: "pionero-demo-room",
  });

  await runner.start();
  await rooms[0].emit("trackPublished", {
    kind: 1,
    source: 2,
    isSubscribed: true,
    rawAudio: "raw-audio-secret",
    token: "numeric-track-token-secret",
  });

  const state = runner.getState();

  assert.equal(state.audioIngest.lastTrackKind, "audio");
  assert.equal(state.audioIngest.lastTrackSource, "microphone");
  assert.equal(state.audioIngest.audioPublicationsObserved, 1);
  assert.equal(state.audioIngest.subscribedAudioTracksObserved, 1);
  assert.equal(state.audioIngest.lastPublicationKind, "audio");
  assert.equal(state.audioIngest.lastPublicationSource, "microphone");
  assertNoSecretLeak(state, "test-agent-token-secret");
  assertNoSecretLeak(state, "numeric-track-token-secret");
  assertNoRawAudioLeak(state);
});

test("pionero LiveKit agent runner records non-audio track metadata without counting frames", async () => {
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
    RoomEvent: {
      TrackSubscribed: "trackSubscribed",
    },
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

  await runner.start();
  await rooms[0].emit("trackSubscribed", {
    kind: "video",
    source: "camera",
    byteLength: 123,
    rawAudio: "raw-audio-secret",
    token: "video-track-token-secret",
  });

  const state = runner.getState();

  assert.deepEqual(state.audioIngest, expectedAudioIngest({
    enabled: true,
    status: "waiting_for_audio",
    eventCounts: {
      trackSubscribed: 1,
    },
    lastEventName: "trackSubscribed",
    lastTrackKind: "video",
    lastTrackSource: "camera",
    tracksObserved: 1,
    trackPublicationsObserved: 1,
    lastPublicationKind: "video",
    lastPublicationSource: "camera",
    lastPublicationSubscribed: true,
  }));
  assertNoSecretLeak(state, "test-agent-token-secret");
  assertNoSecretLeak(state, "video-track-token-secret");
  assertNoRawAudioLeak(state);
});

test("pionero LiveKit agent runner blocks gated Soniox STT when api key is missing", async () => {
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
  }

  const runner = createPioneroLiveKitAgentRunner({
    RoomClass: FakeRoom,
    createAgentToken: async () => ({
      provider: "livekit",
      url: "wss://livekit.example.test",
      roomName: "pionero-demo-room",
      agentIdentity: "aihq-pionero-agent",
      agentName: "AIHQ Pionero Agent",
      token: "test-agent-token-secret",
    }),
    env: createLiveKitEnv({
      PIONERO_LIVEKIT_STT_ENABLED: "1",
    }),
    logger: createTestLogger(),
    roomName: "pionero-demo-room",
  });

  const state = await runner.start();

  assert.equal(rooms.length, 1);
  assert.equal(state.status, "connected");
  assert.equal(state.stt.enabled, false);
  assert.equal(state.stt.status, "error");
  assert.equal(state.stt.reasonCode, "soniox_api_key_missing");
  assert.equal(state.stt.networkIo, false);
  assert.equal(state.stt.flushesAttempted, 0);
  assertNoSecretLeak(state, "test-agent-token-secret");
  assertNoRawAudioLeak(state);
});

test("pionero LiveKit agent runner flushes buffered audio into fake STT session", async () => {
  const rooms = [];
  const sttCalls = [];
  let llmComposerCalls = 0;

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
      async transcribe(input = {}) {
        sttCalls.push({
          chunkCount: input.audioChunks?.length || 0,
          firstChunkBytes: input.audioChunks?.[0]?.byteLength || 0,
          firstChunkIsBuffer: Buffer.isBuffer(input.audioChunks?.[0]),
          finalize: input.finalize,
        });
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
    createLlmTurnComposer: async () => {
      llmComposerCalls += 1;
      return {
        provider: "openai",
        configured: true,
        enabled: true,
        async composeTurn() {
          return {
            ok: true,
            responseText: "Should not be used while disabled.",
          };
        },
      };
    },
    env: createLiveKitEnv({
      PIONERO_LIVEKIT_STT_ENABLED: "1",
      PIONERO_LIVEKIT_STT_FLUSH_MS: "1",
    }),
    logger: createTestLogger(),
    now: () => new Date("2026-01-02T03:04:05.000Z"),
    roomName: "pionero-demo-room",
  });

  const startedState = await runner.start();

  assert.equal(startedState.stt.enabled, true);
  assert.equal(startedState.stt.status, "waiting_for_audio");

  await rooms[0].emit("testAudioFrame", {
    byteLength: 7,
    data: new Uint8Array([1, 2, 3, 4, 5, 6, 7]),
    rawAudio: "raw-audio-secret",
  });
  await new Promise((resolve) => {
    setTimeout(resolve, 5);
  });

  const state = runner.getState();

  assert.equal(sttCalls.length, 1);
  assert.equal(sttCalls[0].chunkCount, 1);
  assert.equal(sttCalls[0].firstChunkBytes, 7);
  assert.equal(sttCalls[0].firstChunkIsBuffer, true);
  assert.equal(sttCalls[0].finalize, true);
  assert.equal(llmComposerCalls, 0);
  assert.deepEqual(state.audioIngest, expectedAudioIngest({
    enabled: true,
    status: "audio_observed",
    eventCounts: {
      testAudioFrame: 1,
    },
    lastEventName: "testAudioFrame",
    framesObserved: 1,
    bytesObserved: 7,
    lastObservedAt: "2026-01-02T03:04:05.000Z",
  }));
  assert.deepEqual(state.stt, {
    provider: "soniox",
    enabled: true,
    status: "transcript_observed",
    transcriptsObserved: 1,
    lastTranscript: "Salam Pionero",
    lastObservedAt: "2026-01-02T03:04:06.000Z",
    reasonCode: "",
    networkIo: true,
    framesBuffered: 0,
    sttFramesDropped: 0,
    sttFrameNormalizeFailed: 0,
    sttPcmBytesBuffered: 0,
    flushesAttempted: 1,
    flushesSucceeded: 1,
    flushesFailed: 0,
    lastFlushReasonCode: "stt_flush_interval",
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

test("pionero LiveKit agent runner composes OpenAI turn when gated LLM is enabled", async () => {
  const rooms = [];
  const sttCalls = [];
  const composeCalls = [];

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
      async transcribe(input = {}) {
        sttCalls.push({
          chunkCount: input.audioChunks?.length || 0,
          finalize: input.finalize,
        });
        return {
          ok: true,
          status: "transcribed",
          provider: "soniox",
          stage: "stt",
          text: "1-2-3.",
          transcribedAt: "2026-01-02T03:04:06.000Z",
          networkIo: true,
          rawAudio: "raw-audio-secret",
        };
      },
    }),
    createLlmTurnComposer: async ({ env, roomName }) => {
      assert.equal(env.PIONERO_LIVEKIT_LLM_ENABLED, "true");
      assert.equal(roomName, "pionero-demo-room");

      return {
        provider: "openai",
        configured: true,
        enabled: true,
        async composeTurn(input = {}) {
          composeCalls.push(input);
          return {
            ok: true,
            status: "composed",
            provider: "openai",
            model: "gpt-test",
            networkIo: true,
            inputTranscript: input.transcript,
            responseText: "Sure, I heard 1-2-3.",
            composedAt: "2026-01-02T03:04:07.000Z",
            token: "test-openai-token-secret",
            rawAudio: "raw-audio-secret",
          };
        },
      };
    },
    env: createLiveKitEnv({
      PIONERO_LIVEKIT_STT_ENABLED: "1",
      PIONERO_LIVEKIT_STT_FLUSH_MS: "1",
      PIONERO_LIVEKIT_LLM_ENABLED: "true",
    }),
    logger: createTestLogger(),
    now: () => new Date("2026-01-02T03:04:05.000Z"),
    roomName: "pionero-demo-room",
  });

  await runner.start();
  await rooms[0].emit("testAudioFrame", {
    byteLength: 7,
    data: new Uint8Array([1, 2, 3, 4, 5, 6, 7]),
    rawAudio: "raw-audio-secret",
  });
  await new Promise((resolve) => {
    setTimeout(resolve, 5);
  });

  const state = runner.getState();

  assert.equal(sttCalls.length, 1);
  assert.deepEqual(composeCalls, [
    {
      transcript: "1-2-3.",
      roomName: "pionero-demo-room",
    },
  ]);
  assert.deepEqual(state.llm, {
    provider: "openai",
    enabled: true,
    status: "turn_plan_built",
    turnsPlanned: 1,
    lastInputTranscript: "1-2-3.",
    lastPlannedResponse: "Sure, I heard 1-2-3.",
    lastObservedAt: "2026-01-02T03:04:07.000Z",
    reasonCode: "",
    networkIo: true,
  });
  assert.equal(state.tts.status, "speech_plan_built");
  assert.equal(state.tts.lastInputText, "Sure, I heard 1-2-3.");
  assert.equal(state.tts.networkIo, false);
  assertNoSecretLeak(state, "test-agent-token-secret");
  assertNoSecretLeak(state, "test-openai-token-secret");
  assertNoRawAudioLeak(state);

  await runner.stop();
});

test("pionero LiveKit agent runner marks LLM error when OpenAI composer fails", async () => {
  const rooms = [];
  const composeCalls = [];

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
      async transcribe() {
        return {
          ok: true,
          status: "transcribed",
          provider: "soniox",
          stage: "stt",
          text: "Salam Pionero",
          transcribedAt: "2026-01-02T03:04:06.000Z",
          networkIo: true,
          rawAudio: "raw-audio-secret",
        };
      },
    }),
    createLlmTurnComposer: async () => ({
      provider: "openai",
      configured: true,
      enabled: true,
      async composeTurn(input = {}) {
        composeCalls.push(input);
        return {
          ok: false,
          status: "failed",
          provider: "openai",
          networkIo: true,
          reasonCode: "openai_llm_response_failed",
          errorMessage: "safe failure",
        };
      },
    }),
    env: createLiveKitEnv({
      PIONERO_LIVEKIT_STT_ENABLED: "1",
      PIONERO_LIVEKIT_STT_FLUSH_MS: "1",
      PIONERO_LIVEKIT_LLM_ENABLED: "1",
    }),
    logger: createTestLogger(),
    now: () => new Date("2026-01-02T03:04:05.000Z"),
    roomName: "pionero-demo-room",
  });

  await runner.start();
  await rooms[0].emit("testAudioFrame", {
    byteLength: 4,
    data: new Uint8Array([1, 2, 3, 4]),
    rawAudio: "raw-audio-secret",
  });
  await new Promise((resolve) => {
    setTimeout(resolve, 5);
  });

  const state = runner.getState();

  assert.equal(state.stt.status, "transcript_observed");
  assert.equal(state.stt.flushesSucceeded, 1);
  assert.deepEqual(composeCalls, [
    {
      transcript: "Salam Pionero",
      roomName: "pionero-demo-room",
    },
  ]);
  assert.deepEqual(state.llm, {
    provider: "openai",
    enabled: true,
    status: "error",
    turnsPlanned: 0,
    lastInputTranscript: "Salam Pionero",
    lastPlannedResponse: "",
    lastObservedAt: "",
    errorMessage: "safe_failure",
    reasonCode: "openai_llm_response_failed",
    networkIo: true,
  });
  assertDefaultTts(state.tts, "planned");
  assertNoSecretLeak(state, "test-agent-token-secret");
  assertNoRawAudioLeak(state);

  await runner.stop();
});

test("pionero LiveKit agent runner treats special-token-only STT success as no transcript", async () => {
  const rooms = [];
  const sttCalls = [];
  let llmComposerCalls = 0;

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
      async transcribe(input = {}) {
        sttCalls.push({
          chunkCount: input.audioChunks?.length || 0,
          finalize: input.finalize,
        });
        return {
          ok: true,
          status: "transcribed",
          provider: "soniox",
          stage: "stt",
          text: "",
          realTokenCount: 0,
          specialTokenCount: 1,
          finalTokenCount: 1,
          nonFinalTokenCount: 0,
          transcribedAt: "2026-01-02T03:04:06.000Z",
          networkIo: true,
          rawAudio: "raw-audio-secret",
          token: "test-stt-token-secret",
        };
      },
    }),
    createLlmTurnComposer: async () => {
      llmComposerCalls += 1;
      return {
        provider: "openai",
        configured: true,
        enabled: true,
        async composeTurn() {
          throw new Error("composer should not be called");
        },
      };
    },
    env: createLiveKitEnv({
      PIONERO_LIVEKIT_STT_ENABLED: "1",
      PIONERO_LIVEKIT_STT_FLUSH_MS: "1",
      PIONERO_LIVEKIT_LLM_ENABLED: "1",
    }),
    logger: createTestLogger(),
    now: () => new Date("2026-01-02T03:04:05.000Z"),
    roomName: "pionero-demo-room",
  });

  await runner.start();
  await rooms[0].emit("testAudioFrame", {
    byteLength: 7,
    data: new Uint8Array([1, 2, 3, 4, 5, 6, 7]),
    rawAudio: "raw-audio-secret",
  });
  await new Promise((resolve) => {
    setTimeout(resolve, 5);
  });

  const state = runner.getState();

  assert.equal(sttCalls.length, 1);
  assert.equal(sttCalls[0].chunkCount, 1);
  assert.equal(sttCalls[0].finalize, true);
  assert.equal(state.stt.status, "streaming");
  assert.equal(state.stt.transcriptsObserved, 0);
  assert.equal(state.stt.lastTranscript, "");
  assert.equal(state.stt.flushesAttempted, 1);
  assert.equal(state.stt.flushesSucceeded, 1);
  assert.equal(state.stt.flushesFailed, 0);
  assert.equal(state.stt.lastFlushReasonCode, "stt_flush_interval");
  assert.equal(llmComposerCalls, 0);
  assertDefaultLlm(state.llm, "planned");
  assertDefaultTts(state.tts, "planned");
  assertNoSecretLeak(state, "test-agent-token-secret");
  assertNoSecretLeak(state, "test-stt-token-secret");
  assertNoRawAudioLeak(state);

  await runner.stop();
});

test("pionero LiveKit agent runner bounds STT frame buffer", async () => {
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
      async transcribe(input = {}) {
        sttCalls.push({
          chunkCount: input.audioChunks?.length || 0,
          firstChunkIsBuffer: Buffer.isBuffer(input.audioChunks?.[0]),
          finalize: input.finalize,
        });
        return {
          ok: true,
          status: "streaming",
          provider: "soniox",
          stage: "stt",
          networkIo: false,
        };
      },
    }),
    env: createLiveKitEnv({
      PIONERO_LIVEKIT_STT_ENABLED: "true",
      PIONERO_LIVEKIT_STT_MAX_FRAMES: "2",
      PIONERO_LIVEKIT_STT_FLUSH_MS: "60000",
    }),
    logger: createTestLogger(),
    now: () => new Date("2026-01-02T03:04:05.000Z"),
    roomName: "pionero-demo-room",
  });

  await runner.start();
  await rooms[0].emit("testAudioFrame", {
    byteLength: 1,
    data: new Uint8Array([1]),
    rawAudio: "raw-audio-secret",
  });
  await rooms[0].emit("testAudioFrame", {
    byteLength: 2,
    data: new Uint8Array([1, 2]),
    rawAudio: "raw-audio-secret",
  });
  await rooms[0].emit("testAudioFrame", {
    byteLength: 3,
    data: new Uint8Array([1, 2, 3]),
    rawAudio: "raw-audio-secret",
  });

  const state = runner.getState();

  assert.equal(state.audioIngest.framesObserved, 3);
  assert.equal(state.stt.framesBuffered, 2);
  assert.equal(state.stt.sttPcmBytesBuffered, 5);
  assert.equal(state.stt.flushesAttempted, 0);
  assert.equal(sttCalls.length, 0);

  await runner.stop();

  assert.equal(sttCalls.length, 1);
  assert.equal(sttCalls[0].chunkCount, 2);
  assertNoSecretLeak(runner.getState(), "test-agent-token-secret");
  assertNoRawAudioLeak(runner.getState());
});

test("pionero LiveKit agent runner drops malformed STT frames without calling Soniox", async () => {
  const rooms = [];
  let transcribeCalls = 0;

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
      async transcribe() {
        transcribeCalls += 1;
        return {
          ok: true,
          status: "transcribed",
          provider: "soniox",
          stage: "stt",
          text: "Should not happen",
        };
      },
    }),
    env: createLiveKitEnv({
      PIONERO_LIVEKIT_STT_ENABLED: "true",
      PIONERO_LIVEKIT_STT_FLUSH_MS: "1",
    }),
    logger: createTestLogger(),
    now: () => new Date("2026-01-02T03:04:05.000Z"),
    roomName: "pionero-demo-room",
  });

  await runner.start();
  await rooms[0].emit("testAudioFrame", {
    byteLength: 7,
    rawAudio: "raw-audio-secret",
    token: "test-frame-token-secret",
  });
  await new Promise((resolve) => {
    setTimeout(resolve, 5);
  });

  const state = runner.getState();

  assert.equal(transcribeCalls, 0);
  assert.equal(state.audioIngest.framesObserved, 1);
  assert.equal(state.audioIngest.bytesObserved, 7);
  assert.equal(state.stt.framesBuffered, 0);
  assert.equal(state.stt.sttFramesDropped, 1);
  assert.equal(state.stt.sttFrameNormalizeFailed, 1);
  assert.equal(state.stt.sttPcmBytesBuffered, 0);
  assert.equal(state.stt.lastFlushReasonCode, "stt_frame_pcm_normalize_failed");
  assert.equal(state.stt.reasonCode, "stt_frame_pcm_normalize_failed");
  assert.equal(state.stt.flushesAttempted, 0);
  assertNoSecretLeak(state, "test-agent-token-secret");
  assertNoSecretLeak(state, "test-frame-token-secret");
  assertNoRawAudioLeak(state);

  await runner.stop();
});

test("pionero LiveKit agent runner prevents parallel STT flushes", async () => {
  const rooms = [];
  const resolvers = [];
  let transcribeCalls = 0;
  let activeFlushes = 0;
  let maxActiveFlushes = 0;

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
      async transcribe() {
        transcribeCalls += 1;
        activeFlushes += 1;
        maxActiveFlushes = Math.max(maxActiveFlushes, activeFlushes);
        const result = await new Promise((resolve) => {
          resolvers.push(resolve);
        });
        activeFlushes -= 1;
        return result || {
          ok: true,
          status: "streaming",
          provider: "soniox",
          stage: "stt",
          networkIo: false,
        };
      },
    }),
    env: createLiveKitEnv({
      PIONERO_LIVEKIT_STT_ENABLED: "1",
      PIONERO_LIVEKIT_STT_FLUSH_MS: "1",
    }),
    logger: createTestLogger(),
    roomName: "pionero-demo-room",
  });

  await runner.start();
  await rooms[0].emit("testAudioFrame", {
    byteLength: 1,
    data: new Uint8Array([1]),
    rawAudio: "raw-audio-secret",
  });
  await new Promise((resolve) => {
    setTimeout(resolve, 5);
  });
  await rooms[0].emit("testAudioFrame", {
    byteLength: 2,
    data: new Uint8Array([1, 2]),
    rawAudio: "raw-audio-secret",
  });
  await new Promise((resolve) => {
    setTimeout(resolve, 5);
  });

  const stopPromise = runner.stop();

  await waitImmediate();
  assert.equal(transcribeCalls, 1);
  assert.equal(maxActiveFlushes, 1);

  resolvers.shift()?.({
    ok: true,
    status: "streaming",
    provider: "soniox",
    stage: "stt",
    networkIo: false,
  });
  await waitImmediate();
  resolvers.shift()?.({
    ok: true,
    status: "streaming",
    provider: "soniox",
    stage: "stt",
    networkIo: false,
  });
  await stopPromise;

  assert.equal(maxActiveFlushes, 1);
  assert.equal(transcribeCalls, 2);
  assertNoSecretLeak(runner.getState(), "test-agent-token-secret");
  assertNoRawAudioLeak(runner.getState());
});

test("pionero LiveKit agent runner performs final STT flush on stop", async () => {
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
      async transcribe(input = {}) {
        sttCalls.push({
          chunkCount: input.audioChunks?.length || 0,
          firstChunkIsBuffer: Buffer.isBuffer(input.audioChunks?.[0]),
          finalize: input.finalize,
        });
        return {
          ok: true,
          status: "transcribed",
          provider: "soniox",
          stage: "stt",
          text: "Final flush transcript",
          transcribedAt: "2026-01-02T03:04:06.000Z",
          networkIo: true,
          rawAudio: "raw-audio-secret",
        };
      },
    }),
    env: createLiveKitEnv({
      PIONERO_LIVEKIT_STT_ENABLED: "true",
      PIONERO_LIVEKIT_STT_FLUSH_MS: "60000",
    }),
    logger: createTestLogger(),
    now: () => new Date("2026-01-02T03:04:05.000Z"),
    roomName: "pionero-demo-room",
  });

  await runner.start();
  await rooms[0].emit("testAudioFrame", {
    byteLength: 7,
    data: new Uint8Array([1, 2, 3, 4, 5, 6, 7]),
    rawAudio: "raw-audio-secret",
  });

  assert.equal(sttCalls.length, 0);

  const stoppedState = await runner.stop();

  assert.equal(sttCalls.length, 1);
  assert.equal(sttCalls[0].chunkCount, 1);
  assert.equal(sttCalls[0].firstChunkIsBuffer, true);
  assert.equal(sttCalls[0].finalize, true);
  assert.equal(stoppedState.status, "stopped");
  assert.equal(stoppedState.stt.status, "idle");
  assert.equal(stoppedState.stt.reasonCode, "pionero_agent_runner_stopped");
  assert.equal(stoppedState.stt.transcriptsObserved, 1);
  assert.equal(stoppedState.stt.lastTranscript, "Final flush transcript");
  assert.equal(stoppedState.stt.flushesAttempted, 1);
  assert.equal(stoppedState.stt.flushesSucceeded, 1);
  assert.equal(stoppedState.stt.flushesFailed, 0);
  assert.equal(stoppedState.stt.sttPcmBytesBuffered, 0);
  assert.equal(stoppedState.stt.lastFlushReasonCode, "stt_final_flush");
  assertNoSecretLeak(stoppedState, "test-agent-token-secret");
  assertNoRawAudioLeak(stoppedState);
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
      async transcribe() {
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
    env: createLiveKitEnv({
      PIONERO_LIVEKIT_STT_ENABLED: "true",
      PIONERO_LIVEKIT_STT_FLUSH_MS: "60000",
    }),
    logger: createTestLogger(),
    now: () => new Date("2026-01-02T03:04:05.000Z"),
    roomName: "pionero-demo-room",
  });

  await runner.start();

  await rooms[0].emit("testAudioFrame", {
    byteLength: 7,
    data: new Uint8Array([1, 2, 3, 4, 5, 6, 7]),
    rawAudio: "raw-audio-secret",
  });

  const state = runner.getState();

  assert.equal(state.audioIngest.framesObserved, 1);
  assert.equal(state.stt.status, "streaming");
  assertDefaultLlm(state.llm, "planned");
  assertNoSecretLeak(state, "test-agent-token-secret");
  assertNoRawAudioLeak(state);

  await runner.stop();
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
      assert.deepEqual(body.audioIngest, expectedAudioIngest({
        reasonCode: "livekit_room_client_not_configured",
      }));
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

