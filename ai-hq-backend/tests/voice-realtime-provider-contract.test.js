import test from "node:test";
import assert from "node:assert/strict";

import {
  assertRealtimeProviderSupported,
  buildRealtimeProviderContract,
  getRealtimeProviderAdapter,
  normalizeRealtimeProviderName,
  OPENAI_REALTIME_PROVIDER,
  VOICE_REALTIME_PROVIDER_CONTRACT_VERSION,
} from "../src/modules/voice/realtimeProviderAdapters.js";

test("OpenAI realtime provider exposes supported voice provider contract", () => {
  const contract = buildRealtimeProviderContract({
    provider: "openai_realtime",
    transport: "webrtc",
  });

  assert.equal(contract.version, VOICE_REALTIME_PROVIDER_CONTRACT_VERSION);
  assert.equal(contract.provider, OPENAI_REALTIME_PROVIDER);
  assert.equal(contract.transport, "webrtc");
  assert.equal(contract.supported, true);
  assert.equal(contract.status, "supported");
  assert.equal(contract.reasonCode, "");
  assert.equal(contract.capabilities.realtimeSession, true);
  assert.equal(contract.capabilities.sidebandConnector, true);
  assert.equal(contract.capabilities.toolOutputEvents, true);
  assert.equal(contract.requirements.apiKeyEnv, "OPENAI_API_KEY");
});

test("future providers do not pretend to be ready before adapters exist", () => {
  const contract = buildRealtimeProviderContract({
    provider: "livekit",
    transport: "sip",
  });

  assert.equal(contract.provider, "livekit");
  assert.equal(contract.transport, "sip");
  assert.equal(contract.supported, false);
  assert.equal(contract.status, "unsupported");
  assert.equal(contract.reasonCode, "unsupported_realtime_provider");
  assert.equal(contract.capabilities.realtimeSession, false);
  assert.equal(contract.capabilities.sidebandConnector, false);
  assert.equal(contract.capabilities.livekitGateway, false);
  assert.equal(contract.requirements.apiKeyEnv, "");
});

test("provider support assertion returns contract-shaped readiness", () => {
  const ready = assertRealtimeProviderSupported({ provider: "gpt_realtime" });
  const blocked = assertRealtimeProviderSupported({ provider: "twilio" });

  assert.equal(ready.ok, true);
  assert.equal(ready.provider, "openai");
  assert.equal(ready.contract.capabilities.browserRealtime, true);

  assert.equal(blocked.ok, false);
  assert.equal(blocked.provider, "twilio");
  assert.equal(blocked.reasonCode, "unsupported_realtime_provider");
  assert.equal(blocked.contract.capabilities.browserRealtime, false);
});

test("realtime provider adapters expose their provider contract", () => {
  const openai = getRealtimeProviderAdapter("openai");
  const livekit = getRealtimeProviderAdapter("livekit");

  assert.equal(openai.status, "supported");
  assert.equal(openai.contract.supported, true);
  assert.equal(openai.contract.provider, "openai");

  assert.equal(livekit.status, "unsupported");
  assert.equal(livekit.contract.supported, false);
  assert.equal(livekit.contract.provider, "livekit");
});

test("provider aliases still normalize to canonical provider names", () => {
  assert.equal(normalizeRealtimeProviderName("openai-realtime"), "openai");
  assert.equal(normalizeRealtimeProviderName("gpt realtime"), "openai");
  assert.equal(normalizeRealtimeProviderName("livekit"), "livekit");
});
