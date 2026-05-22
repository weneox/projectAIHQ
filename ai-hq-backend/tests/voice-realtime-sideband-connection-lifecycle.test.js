import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRealtimeSidebandConnectionState,
  buildRealtimeSidebandLifecycleTrace,
  transitionRealtimeSidebandConnectionState,
  SIDEBAND_CONNECTION_STATES,
  VOICE_REALTIME_SIDEBAND_CONNECTION_LIFECYCLE_VERSION,
} from "../src/modules/voice/realtimeSidebandConnectionLifecycle.js";

function target(provider = "openai") {
  return {
    provider,
    transport: "webrtc",
    providerRealtimeCallId: "call_realtime_1",
  };
}

test("disabled plan becomes disabled state", () => {
  const state = buildRealtimeSidebandConnectionState({
    provider: "openai",
    target: target("openai"),
    env: {},
  });

  assert.equal(state.version, VOICE_REALTIME_SIDEBAND_CONNECTION_LIFECYCLE_VERSION);
  assert.equal(state.provider, "openai");
  assert.equal(state.status, "disabled");
  assert.equal(state.state, SIDEBAND_CONNECTION_STATES.DISABLED);
  assert.equal(state.reasonCode, "sideband_disabled");
  assert.equal(state.networkIo, false);
  assert.equal(state.sidebandPlan.networkIo, false);
});

test("missing api key enabled plan becomes blocked state", () => {
  const state = buildRealtimeSidebandConnectionState({
    provider: "openai",
    target: target("openai"),
    env: {
      VOICE_REALTIME_SIDEBAND_ENABLED: "true",
    },
  });

  assert.equal(state.status, "blocked");
  assert.equal(state.state, SIDEBAND_CONNECTION_STATES.BLOCKED);
  assert.equal(state.reasonCode, "openai_api_key_missing");
  assert.equal(state.networkIo, false);
});

test("ready OpenAI plan becomes ready state", () => {
  const state = buildRealtimeSidebandConnectionState({
    provider: "openai",
    target: target("openai"),
    env: {
      VOICE_REALTIME_SIDEBAND_ENABLED: "1",
      OPENAI_API_KEY: "sk-test",
    },
  });

  assert.equal(state.status, "ready");
  assert.equal(state.state, SIDEBAND_CONNECTION_STATES.READY);
  assert.equal(state.reasonCode, "");
  assert.equal(state.sidebandPlan.providerRealtimeCallId, "call_realtime_1");
  assert.equal(state.sidebandPlan.networkIo, false);
});

test("unsupported provider becomes blocked state", () => {
  const state = buildRealtimeSidebandConnectionState({
    provider: "elevenlabs",
    target: target("elevenlabs"),
    env: {
      VOICE_REALTIME_SIDEBAND_ENABLED: "1",
    },
  });

  assert.equal(state.provider, "elevenlabs");
  assert.equal(state.status, "unsupported");
  assert.equal(state.state, SIDEBAND_CONNECTION_STATES.BLOCKED);
  assert.equal(state.reasonCode, "unsupported_realtime_provider");
  assert.equal(state.sidebandPlan, null);
  assert.equal(state.networkIo, false);
});

test("valid transition ready to connecting to open to closing to closed", () => {
  const ready = buildRealtimeSidebandConnectionState({
    provider: "openai",
    target: target("openai"),
    env: {
      VOICE_REALTIME_SIDEBAND_ENABLED: "1",
      OPENAI_API_KEY: "sk-test",
    },
  });

  const connecting = transitionRealtimeSidebandConnectionState({
    current: ready,
    eventType: "connect_requested",
  });
  const open = transitionRealtimeSidebandConnectionState({
    current: connecting,
    eventType: "connected",
  });
  const closing = transitionRealtimeSidebandConnectionState({
    current: open,
    eventType: "close_requested",
  });
  const closed = transitionRealtimeSidebandConnectionState({
    current: closing,
    eventType: "closed",
  });

  assert.equal(connecting.state, SIDEBAND_CONNECTION_STATES.CONNECTING);
  assert.equal(connecting.status, SIDEBAND_CONNECTION_STATES.CONNECTING);
  assert.equal(open.state, SIDEBAND_CONNECTION_STATES.OPEN);
  assert.equal(closing.state, SIDEBAND_CONNECTION_STATES.CLOSING);
  assert.equal(closed.state, SIDEBAND_CONNECTION_STATES.CLOSED);
  assert.equal(closed.networkIo, false);
});

test("failed transition from any state", () => {
  const disabled = buildRealtimeSidebandConnectionState({
    provider: "openai",
    target: target("openai"),
    env: {},
  });

  const failed = transitionRealtimeSidebandConnectionState({
    current: disabled,
    eventType: "failed",
    reasonCode: "lifecycle_test_failure",
    error: "boom",
  });

  assert.equal(failed.state, SIDEBAND_CONNECTION_STATES.FAILED);
  assert.equal(failed.status, SIDEBAND_CONNECTION_STATES.FAILED);
  assert.equal(failed.reasonCode, "lifecycle_test_failure");
  assert.equal(failed.error, "boom");
  assert.equal(failed.networkIo, false);
});

test("invalid transition does not throw and returns invalid_lifecycle_transition", () => {
  const ready = buildRealtimeSidebandConnectionState({
    provider: "openai",
    target: target("openai"),
    env: {
      VOICE_REALTIME_SIDEBAND_ENABLED: "1",
      OPENAI_API_KEY: "sk-test",
    },
  });

  const invalid = transitionRealtimeSidebandConnectionState({
    current: ready,
    eventType: "closed",
  });

  assert.equal(invalid.state, SIDEBAND_CONNECTION_STATES.READY);
  assert.equal(invalid.status, "ready");
  assert.equal(invalid.reasonCode, "invalid_lifecycle_transition");
  assert.equal(invalid.networkIo, false);
});

test("lifecycle trace contains providerRealtimeCallId and networkIo false", () => {
  const state = buildRealtimeSidebandConnectionState({
    provider: "openai",
    target: target("openai"),
    env: {
      VOICE_REALTIME_SIDEBAND_ENABLED: "1",
      OPENAI_API_KEY: "sk-test",
    },
  });
  const trace = buildRealtimeSidebandLifecycleTrace({
    state,
    target: target("openai"),
  });

  assert.deepEqual(trace, {
    version: VOICE_REALTIME_SIDEBAND_CONNECTION_LIFECYCLE_VERSION,
    provider: "openai",
    state: "ready",
    status: "ready",
    reasonCode: "",
    providerRealtimeCallId: "call_realtime_1",
    networkIo: false,
  });
});

test("no socket or network behavior exists", () => {
  const originalFetch = globalThis.fetch;
  const originalWebSocket = globalThis.WebSocket;
  let fetchCalls = 0;
  let socketCalls = 0;

  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("fetch should not be called");
  };
  globalThis.WebSocket = function WebSocket() {
    socketCalls += 1;
    throw new Error("WebSocket should not be constructed");
  };

  try {
    const state = buildRealtimeSidebandConnectionState({
      provider: "openai",
      target: target("openai"),
      env: {
        VOICE_REALTIME_SIDEBAND_ENABLED: "1",
        OPENAI_API_KEY: "sk-test",
      },
    });
    const connecting = transitionRealtimeSidebandConnectionState({
      current: state,
      eventType: "connect_requested",
    });
    const trace = buildRealtimeSidebandLifecycleTrace({
      state: connecting,
      target: target("openai"),
    });

    assert.equal(state.networkIo, false);
    assert.equal(connecting.networkIo, false);
    assert.equal(trace.networkIo, false);
    assert.equal(fetchCalls, 0);
    assert.equal(socketCalls, 0);
  } finally {
    if (originalFetch === undefined) {
      delete globalThis.fetch;
    } else {
      globalThis.fetch = originalFetch;
    }
    if (originalWebSocket === undefined) {
      delete globalThis.WebSocket;
    } else {
      globalThis.WebSocket = originalWebSocket;
    }
  }
});
