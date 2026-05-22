import assert from "node:assert/strict";
import test from "node:test";

import {
  VOICE_REALTIME_CONTROL_PLANE_VERSION,
  buildRealtimeControlTarget,
  buildRealtimeProviderLinkPayload,
  normalizeProviderRealtimeCallId,
} from "../src/modules/voice/realtimeControlPlane.js";

test("realtime control plane normalizes provider call ids from OpenAI-style values", () => {
  assert.equal(
    normalizeProviderRealtimeCallId("https://api.openai.com/v1/realtime/calls/call_abc123"),
    "call_abc123"
  );
  assert.equal(
    normalizeProviderRealtimeCallId("https://api.openai.com/v1/realtime/calls/rtc_u7_abc"),
    "rtc_u7_abc"
  );
  assert.equal(
    normalizeProviderRealtimeCallId("/v1/realtime/calls/rtc_path_123"),
    "rtc_path_123"
  );
  assert.equal(
    normalizeProviderRealtimeCallId("/v1/realtime?call_id=call_xyz789"),
    "call_xyz789"
  );
  assert.equal(normalizeProviderRealtimeCallId("call_direct_1"), "call_direct_1");
  assert.equal(normalizeProviderRealtimeCallId("rtc_direct_1"), "rtc_direct_1");
  assert.equal(normalizeProviderRealtimeCallId("sess_direct_1"), "sess_direct_1");
});

test("realtime control plane builds sideband target without opening a socket", () => {
  const target = buildRealtimeControlTarget({
    provider: "openai",
    transport: "webrtc",
    voiceCallId: "voice-call-1",
    tenantId: "tenant-1",
    tenantKey: "acme",
    providerRealtimeCallId: "call_abc123",
    model: "gpt-realtime-1.5",
    voice: "coral",
  });

  assert.equal(target.version, VOICE_REALTIME_CONTROL_PLANE_VERSION);
  assert.equal(target.providerRealtimeCallId, "call_abc123");
  assert.equal(target.sideband.available, true);
  assert.equal(target.sideband.connectPath, "/v1/realtime?call_id=call_abc123");

  const payload = buildRealtimeProviderLinkPayload({
    target,
    locationHeader: "https://api.openai.com/v1/realtime/calls/call_abc123",
  });

  assert.equal(payload.controlPlaneVersion, VOICE_REALTIME_CONTROL_PLANE_VERSION);
  assert.equal(payload.providerRealtimeCallId, "call_abc123");
  assert.equal(payload.sidebandAvailable, true);
});
