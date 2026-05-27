import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluatePioneroRealtimeReadinessGuard,
} from "../src/modules/voice/pionero/pioneroRealtimeReadinessGuard.js";

function liveStatus(overrides = {}) {
  return {
    version: "pionero_openai_realtime_livekit_bridge.v1",
    mode: "openai_realtime_livekit_track",
    enabled: true,
    status: "live",
    roomName: "pionero-demo-room",
    provider: "openai_realtime",
    realtimeConnected: true,
    livekitAudioTrackPublished: true,
    firstAudioAt: "2026-05-27T00:00:00.000Z",
    firstAudioLatencyMs: 650,
    interruptionsObserved: 0,
    lastReasonCode: "",
    errorMessage: "",
    ...overrides,
  };
}

test("pionero realtime readiness guard accepts healthy live realtime lane", () => {
  const result = evaluatePioneroRealtimeReadinessGuard(liveStatus());

  assert.equal(result.ok, true);
  assert.equal(result.status, "ready");
  assert.equal(result.observed.realtimeConnected, true);
  assert.equal(result.observed.livekitAudioTrackPublished, true);
  assert.equal(result.observed.firstAudioLatencyMs, 650);
  assert.deepEqual(result.blockers, []);
});

test("pionero realtime readiness guard blocks when realtime is not connected", () => {
  const result = evaluatePioneroRealtimeReadinessGuard(
    liveStatus({
      realtimeConnected: false,
    })
  );

  assert.equal(result.ok, false);
  assert.equal(
    result.blockers.some(
      (blocker) =>
        blocker.reasonCode === "pionero_realtime_transport_not_connected"
    ),
    true
  );
});

test("pionero realtime readiness guard blocks when LiveKit audio track is not published", () => {
  const result = evaluatePioneroRealtimeReadinessGuard(
    liveStatus({
      livekitAudioTrackPublished: false,
    })
  );

  assert.equal(result.ok, false);
  assert.equal(
    result.blockers.some(
      (blocker) =>
        blocker.reasonCode === "pionero_livekit_audio_track_not_published"
    ),
    true
  );
});

test("pionero realtime readiness guard blocks first audio latency above target", () => {
  const result = evaluatePioneroRealtimeReadinessGuard(
    liveStatus({
      firstAudioLatencyMs: 1800,
    }),
    {
      maxFirstAudioLatencyMs: 1200,
    }
  );

  assert.equal(result.ok, false);
  assert.equal(
    result.blockers.some(
      (blocker) =>
        blocker.reasonCode === "pionero_realtime_first_audio_latency_exceeded"
    ),
    true
  );
});

test("pionero realtime readiness guard can allow pending first audio during startup", () => {
  const result = evaluatePioneroRealtimeReadinessGuard(
    liveStatus({
      firstAudioAt: "",
      firstAudioLatencyMs: 0,
    }),
    {
      allowPendingFirstAudio: true,
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.observed.firstAudioObserved, false);
});
