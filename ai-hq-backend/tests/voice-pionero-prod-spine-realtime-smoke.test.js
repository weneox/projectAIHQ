import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import {
  derivePioneroRealtimeStatusUrl,
  summarizePioneroRealtimeStatus,
  verifyPioneroRealtimeLane,
} from "../../scripts/prod-spine-smoke.mjs";

async function withTestServer(handler, fn) {
  const server = http.createServer(handler);

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

function statusPayload(overrides = {}) {
  return {
    ok: true,
    lane: "pionero_realtime",
    transport: "livekit_audio_track",
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
    realtimeReadiness: {
      ok: true,
      status: "ready",
      blockers: [],
      observed: {
        realtimeStatus: "live",
        realtimeConnected: true,
        livekitAudioTrackPublished: true,
        firstAudioObserved: true,
        firstAudioLatencyMs: 650,
        interruptionsObserved: 0,
      },
    },
    ...overrides,
  };
}

test("derivePioneroRealtimeStatusUrl builds room-scoped status URL", () => {
  assert.equal(
    derivePioneroRealtimeStatusUrl("https://aihq.example.test/", "demo room"),
    "https://aihq.example.test/voice/pionero/livekit/agent/status?roomName=demo+room"
  );
});

test("summarizePioneroRealtimeStatus reads ready realtime readiness", () => {
  const summary = summarizePioneroRealtimeStatus(statusPayload());

  assert.equal(summary.readinessPresent, true);
  assert.equal(summary.ok, true);
  assert.equal(summary.readinessStatus, "ready");
  assert.equal(summary.realtimeConnected, true);
  assert.equal(summary.livekitAudioTrackPublished, true);
  assert.equal(summary.firstAudioLatencyMs, 650);
});

test("verifyPioneroRealtimeLane passes required healthy realtime status", async () => {
  await withTestServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(statusPayload()));
  }, async (baseUrl) => {
    const [result] = await verifyPioneroRealtimeLane({
      baseUrl,
      internalToken: "unit-test-internal-token",
      roomName: "pionero-demo-room",
      timeoutMs: 1000,
      requirePioneroRealtime: true,
      checkPioneroRealtime: true,
    });

    assert.equal(result.name, "pionero_realtime_prod_spine");
    assert.equal(result.ok, true);
    assert.equal(result.details.realtimeConnected, true);
    assert.equal(result.details.livekitAudioTrackPublished, true);
  });
});

test("verifyPioneroRealtimeLane fails required blocked realtime status", async () => {
  await withTestServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(statusPayload({
      livekitAudioTrackPublished: false,
      realtimeReadiness: {
        ok: false,
        status: "blocked",
        blockers: [
          {
            reasonCode: "pionero_livekit_audio_track_not_published",
            severity: "blocker",
          },
        ],
        observed: {
          realtimeStatus: "live",
          realtimeConnected: true,
          livekitAudioTrackPublished: false,
          firstAudioObserved: true,
          firstAudioLatencyMs: 650,
          interruptionsObserved: 0,
        },
      },
    })));
  }, async (baseUrl) => {
    const [result] = await verifyPioneroRealtimeLane({
      baseUrl,
      roomName: "pionero-demo-room",
      timeoutMs: 1000,
      requirePioneroRealtime: true,
      checkPioneroRealtime: true,
    });

    assert.equal(result.ok, false);
    assert.equal(result.details.reasonCode, "pionero_realtime_readiness_blocked");
    assert.deepEqual(result.details.blockerReasonCodes, [
      "pionero_livekit_audio_track_not_published",
    ]);
  });
});

test("verifyPioneroRealtimeLane skips when not requested", async () => {
  const [result] = await verifyPioneroRealtimeLane({
    baseUrl: "",
    timeoutMs: 1000,
    requirePioneroRealtime: false,
    checkPioneroRealtime: false,
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(
    result.details.reasonCode,
    "pionero_realtime_not_required_for_deploy_gate"
  );
});
