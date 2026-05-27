import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import {
  PIONERO_OPENAI_REALTIME_LIVEKIT_BRIDGE_MODE,
  createOpenAIRealtimeLiveKitBridge,
} from "../src/modules/voice/pionero/realtime/openaiRealtimeLiveKitBridge.js";
import {
  createPioneroRealtimeAgentRegistry,
} from "../src/modules/voice/pionero/pioneroRealtimeAgentRegistry.js";

function readyEnv(overrides = {}) {
  return {
    PIONERO_REALTIME_LANE_ENABLED: "1",
    PIONERO_REALTIME_PROVIDER: "openai_realtime",
    ["OPENAI_" + "API_KEY"]: "unit-test-openai-key",
    LIVEKIT_URL: "wss://livekit.example.test",
    LIVEKIT_API_KEY: "livekit-key",
    ["LIVEKIT_" + "API_SECRET"]: "unit-test-livekit-secret",
    ...overrides,
  };
}

function createAgentToken(overrides = {}) {
  return async ({ roomName }) => ({
    url: "wss://livekit.example.test",
    token: "livekit-agent-token-secret",
    roomName,
    ...overrides,
  });
}

function waitImmediate() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

class FakeRoom {
  static instances = [];

  constructor() {
    this.handlers = new Map();
    this.connectCalls = [];
    this.disconnectCalls = 0;
    this.localParticipant = {
      publishTrack: async () => ({ ok: true }),
    };
    FakeRoom.instances.push(this);
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

  async connect(url, token, options) {
    this.connectCalls.push({ url, token, options });
  }

  async disconnect() {
    this.disconnectCalls += 1;
  }

  async emit(eventName, ...args) {
    for (const handler of this.handlers.get(eventName) || []) {
      await handler(...args);
    }
  }
}

class FakeRealtimeTransport extends EventEmitter {
  constructor() {
    super();
    this.connectCalls = [];
    this.frames = [];
    this.interrupts = [];
    this.closed = false;
  }

  async connect(input = {}) {
    this.connectCalls.push(input);
    this.emit("connected", { ok: true });
    return { ok: true };
  }

  sendUserAudioFrame(frame) {
    this.frames.push(Buffer.from(frame));
    return true;
  }

  interrupt(input = {}) {
    this.interrupts.push(input);
    return true;
  }

  async close() {
    this.closed = true;
    this.emit("closed");
  }
}

class FakeAudioPublisher {
  constructor() {
    this.started = false;
    this.published = [];
    this.interrupts = 0;
    this.closed = false;
  }

  async start() {
    this.started = true;
    return this.getStatus();
  }

  async publishAudioDelta(audio) {
    this.published.push(Buffer.from(audio));
    return this.getStatus();
  }

  async interrupt() {
    this.interrupts += 1;
    return this.getStatus();
  }

  async close() {
    this.closed = true;
    this.started = false;
  }

  getStatus() {
    return {
      published: this.started,
      audioDeltaCount: this.published.length,
    };
  }
}

function createBridgeHarness({
  env = readyEnv(),
  now = () => 1_000,
  runtimeConfig = {},
  runtimeApplied = false,
} = {}) {
  FakeRoom.instances = [];
  const transport = new FakeRealtimeTransport();
  const publisher = new FakeAudioPublisher();
  const bridge = createOpenAIRealtimeLiveKitBridge({
    RoomClass: FakeRoom,
    createAgentToken: createAgentToken(),
    createPublisher: () => publisher,
    createTransport: () => transport,
    env,
    now,
    roomName: "pionero-room-test",
    runtimeApplied,
    runtimeConfig,
  });

  return {
    bridge,
    publisher,
    transport,
  };
}

test("bridge starts only when feature flag enabled", async () => {
  let transportCreated = false;
  const bridge = createOpenAIRealtimeLiveKitBridge({
    RoomClass: FakeRoom,
    createAgentToken: createAgentToken(),
    createPublisher: () => new FakeAudioPublisher(),
    createTransport: () => {
      transportCreated = true;
      return new FakeRealtimeTransport();
    },
    env: {},
    roomName: "pionero-room-test",
  });

  const status = await bridge.start();

  assert.equal(status.enabled, false);
  assert.equal(status.status, "disabled");
  assert.equal(status.lastReasonCode, "pionero_realtime_lane_disabled");
  assert.equal(transportCreated, false);
});

test("registry does not create a bridge while realtime lane flag is disabled", async () => {
  let bridgeCreated = false;
  const registry = createPioneroRealtimeAgentRegistry({
    env: {},
    createBridge: () => {
      bridgeCreated = true;
      throw new Error("bridge should not be created");
    },
  });

  const status = await registry.start({ roomName: "pionero-room-test" });

  assert.equal(status.mode, PIONERO_OPENAI_REALTIME_LIVEKIT_BRIDGE_MODE);
  assert.equal(status.status, "disabled");
  assert.equal(status.lastReasonCode, "pionero_realtime_lane_disabled");
  assert.equal(bridgeCreated, false);
});

test("user audio frames are forwarded to the realtime transport", async () => {
  const { bridge, transport } = createBridgeHarness();

  const status = await bridge.start();
  assert.equal(status.status, "live");
  assert.equal(status.realtimeConnected, true);
  assert.equal(status.livekitAudioTrackPublished, true);

  const forwarded = await bridge.observeUserAudioFrame(Buffer.from([1, 0, 2, 0]));

  assert.equal(forwarded, true);
  assert.equal(transport.frames.length, 1);
  assert.deepEqual([...transport.frames[0]], [1, 0, 2, 0]);
});

test("realtime audio deltas are published to the LiveKit audio track", async () => {
  let clock = 1_000;
  const { bridge, publisher, transport } = createBridgeHarness({
    now: () => clock,
  });

  await bridge.start();
  clock = 1_185;
  transport.emit("audioDelta", {
    audio: Buffer.from([3, 0, 4, 0]),
    responseId: "response-1",
    itemId: "assistant-item-1",
  });
  await waitImmediate();

  assert.equal(publisher.published.length, 1);
  assert.deepEqual([...publisher.published[0]], [3, 0, 4, 0]);

  const status = bridge.getStatus();
  assert.equal(status.firstAudioAt, "1970-01-01T00:00:01.185Z");
  assert.equal(status.firstAudioLatencyMs, 185);
});

test("interruption event stops current assistant audio", async () => {
  const { bridge, publisher, transport } = createBridgeHarness();

  await bridge.start();
  transport.emit("audioDelta", {
    audio: Buffer.from([5, 0, 6, 0]),
    responseId: "response-barge",
    itemId: "assistant-item-barge",
  });
  await waitImmediate();

  transport.emit("userSpeechStarted");
  await waitImmediate();

  assert.equal(publisher.interrupts, 1);
  assert.equal(transport.interrupts.length, 1);
  assert.deepEqual(transport.interrupts[0], {
    responseId: "response-barge",
    itemId: "assistant-item-barge",
  });

  const status = bridge.getStatus();
  assert.equal(status.interruptionsObserved, 1);
  assert.equal(status.lastReasonCode, "openai_input_audio_speech_started");
});

test("user audio during assistant speech triggers barge-in cancellation", async () => {
  const { bridge, publisher, transport } = createBridgeHarness();

  await bridge.start();
  transport.emit("audioDelta", {
    audio: Buffer.from([7, 0, 8, 0]),
    responseId: "response-barge-frame",
    itemId: "assistant-item-barge-frame",
  });
  await waitImmediate();

  await bridge.observeUserAudioFrame(Buffer.from([9, 0]));

  assert.equal(publisher.interrupts, 1);
  assert.equal(transport.interrupts.length, 1);
  assert.equal(transport.frames.length, 1);
  assert.equal(bridge.getStatus().lastReasonCode, "user_barge_in");
});

test("status exposes latency fields safely", async () => {
  let clock = 2_000;
  const { bridge, transport } = createBridgeHarness({
    now: () => clock,
    runtimeApplied: true,
    runtimeConfig: {
      companyName: "Secret Tenant",
      realtime: {
        instructions: "Use approved business context only.",
      },
    },
  });

  await bridge.start();
  clock = 2_220;
  transport.emit("audioDelta", {
    audio: Buffer.from("raw-audio-secret"),
    responseId: "response-safe",
    itemId: "assistant-item-safe",
  });
  await waitImmediate();

  const status = bridge.getStatus();
  const serialized = JSON.stringify(status);

  assert.equal(status.mode, PIONERO_OPENAI_REALTIME_LIVEKIT_BRIDGE_MODE);
  assert.equal(status.firstAudioLatencyMs, 220);
  assert.equal(serialized.includes("sk-test-secret"), false);
  assert.equal(serialized.includes("livekit-agent-token-secret"), false);
  assert.equal(serialized.includes("raw-audio-secret"), false);
  assert.equal(serialized.includes("Voice assistant brain"), false);
  assert.equal(serialized.includes("Use approved business context only."), false);
});
