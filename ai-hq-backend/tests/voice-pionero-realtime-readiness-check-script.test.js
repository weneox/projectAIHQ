import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(
  new URL("../scripts/check-pionero-realtime-readiness.mjs", import.meta.url)
);

function runCheck(env = {}) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PIONERO_REALTIME_READINESS_REQUIRED: "",
      PIONERO_REALTIME_STATUS_JSON: "",
      PIONERO_REALTIME_STATUS_URL: "",
      PIONERO_REALTIME_STATUS_BEARER_TOKEN: "",
      ...env,
    },
    encoding: "utf8",
  });
}

function parseStdout(result) {
  return JSON.parse(result.stdout);
}

function healthyStatus(overrides = {}) {
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

test("pionero realtime readiness check passes healthy status JSON", () => {
  const result = runCheck({
    PIONERO_REALTIME_READINESS_REQUIRED: "1",
    PIONERO_REALTIME_STATUS_JSON: JSON.stringify(healthyStatus()),
  });
  const body = parseStdout(result);

  assert.equal(result.status, 0);
  assert.equal(body.ok, true);
  assert.equal(body.source, "env_json");
  assert.equal(body.readiness.ok, true);
});

test("pionero realtime readiness check fails blocked status JSON", () => {
  const result = runCheck({
    PIONERO_REALTIME_READINESS_REQUIRED: "1",
    PIONERO_REALTIME_STATUS_JSON: JSON.stringify(
      healthyStatus({
        livekitAudioTrackPublished: false,
      })
    ),
  });
  const body = parseStdout(result);

  assert.equal(result.status, 1);
  assert.equal(body.ok, false);
  assert.equal(
    body.readiness.blockers.some(
      (blocker) =>
        blocker.reasonCode === "pionero_livekit_audio_track_not_published"
    ),
    true
  );
});

test("pionero realtime readiness check fails when required source is missing", () => {
  const result = runCheck({
    PIONERO_REALTIME_READINESS_REQUIRED: "1",
  });
  const body = parseStdout(result);

  assert.equal(result.status, 1);
  assert.equal(body.ok, false);
  assert.equal(body.reasonCode, "pionero_realtime_status_source_missing");
});

test("pionero realtime readiness check skips when not required and no source exists", () => {
  const result = runCheck({});
  const body = parseStdout(result);

  assert.equal(result.status, 0);
  assert.equal(body.ok, true);
  assert.equal(body.source, "skipped");
});
