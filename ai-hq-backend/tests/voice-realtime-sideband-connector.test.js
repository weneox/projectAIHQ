import assert from "node:assert/strict";
import test from "node:test";

import {
  VOICE_REALTIME_SIDEBAND_CONNECTOR_VERSION,
  buildRealtimeSidebandConnectionPlan,
  buildRealtimeSidebandTrace,
  isRealtimeSidebandEnabled,
} from "../src/modules/voice/realtimeSidebandConnector.js";
import {
  buildOpenAIRealtimeSidebandConnectionPlan,
  buildOpenAIRealtimeSidebandTrace,
} from "../src/modules/voice/providers/openaiRealtimeSidebandAdapter.js";

test("realtime sideband connector is disabled by default", () => {
  const env = {};
  assert.equal(isRealtimeSidebandEnabled(env), false);

  const plan = buildRealtimeSidebandConnectionPlan({
    target: {
      provider: "openai",
      transport: "webrtc",
      providerRealtimeCallId: "call_abc123",
    },
    env,
  });

  assert.equal(plan.version, VOICE_REALTIME_SIDEBAND_CONNECTOR_VERSION);
  assert.equal(plan.enabled, false);
  assert.equal(plan.status, "disabled");
  assert.equal(plan.reasonCode, "sideband_disabled");
  assert.equal(plan.networkIo, false);
});

test("realtime sideband connector blocks enabled plans without api key", () => {
  const plan = buildRealtimeSidebandConnectionPlan({
    target: {
      provider: "openai",
      transport: "webrtc",
      providerRealtimeCallId: "call_abc123",
    },
    env: {
      VOICE_REALTIME_SIDEBAND_ENABLED: "true",
    },
  });

  assert.equal(plan.enabled, false);
  assert.equal(plan.status, "blocked");
  assert.equal(plan.reasonCode, "openai_api_key_missing");
});

test("realtime sideband connector builds ready plan without opening socket", () => {
  const plan = buildRealtimeSidebandConnectionPlan({
    target: {
      provider: "openai",
      transport: "webrtc",
      providerRealtimeCallId: "call_abc123",
    },
    env: {
      VOICE_REALTIME_SIDEBAND_ENABLED: "1",
      OPENAI_API_KEY: "sk-test",
    },
  });

  assert.equal(plan.enabled, true);
  assert.equal(plan.status, "ready");
  assert.equal(plan.reasonCode, "");
  assert.equal(plan.url, "wss://api.openai.com/v1/realtime?call_id=call_abc123");
  assert.equal(plan.networkIo, false);
  assert.equal(plan.headers.Authorization, "Bearer <configured>");

  const trace = buildRealtimeSidebandTrace(plan);
  assert.equal(trace.enabled, true);
  assert.equal(trace.networkIo, false);
  assert.equal(trace.providerRealtimeCallId, "call_abc123");
});

test("compatibility sideband connector delegates to OpenAI adapter behavior", () => {
  const input = {
    target: {
      provider: "openai",
      transport: "webrtc",
      providerRealtimeCallId: "call_abc123",
    },
    env: {
      VOICE_REALTIME_SIDEBAND_ENABLED: "1",
      OPENAI_API_KEY: "sk-test",
    },
  };

  const plan = buildRealtimeSidebandConnectionPlan(input);
  assert.deepEqual(plan, buildOpenAIRealtimeSidebandConnectionPlan(input));
  assert.deepEqual(
    buildRealtimeSidebandTrace(plan),
    buildOpenAIRealtimeSidebandTrace(plan)
  );
});
