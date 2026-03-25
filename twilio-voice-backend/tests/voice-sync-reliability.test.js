import test from "node:test";
import assert from "node:assert/strict";

import { createAihqVoiceClient } from "../src/services/aihqVoiceClient.js";
import { shouldSuppressVoiceSync } from "../src/services/voiceSyncReliability.js";
import {
  getRuntimeMetricsSnapshot,
  resetRuntimeMetrics,
} from "../src/services/runtimeObservability.js";

test("duplicate transcript syncs now rely on durable backend idempotency keys", async () => {
  resetRuntimeMetrics();
  let calls = 0;
  const bodies = [];

  const payload = {
    tenantKey: "acme",
    providerCallSid: "CA123",
    role: "customer",
    text: "hello",
  };

  const fetchRecorder = async (_url, req) => {
    calls += 1;
    bodies.push(JSON.parse(req.body));
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          ok: true,
          execution: {
            id: "exec-1",
            status: "pending",
          },
        });
      },
    };
  };

  const durableClient = createAihqVoiceClient({
    fetchFn: fetchRecorder,
    baseUrl: "https://aihq.example.test",
    internalToken: "token",
  });

  const first = await durableClient.appendTranscript(payload);
  const second = await durableClient.appendTranscript(payload);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(calls, 2);
  assert.equal(
    bodies[0]?.idempotencyKey,
    bodies[1]?.idempotencyKey
  );
  assert.equal(bodies[0]?.actionType, "voice.sync.transcript");
  assert.equal(getRuntimeMetricsSnapshot().voice_sync_successes_total, 2);
});

test("invalid voice sync responses are rejected", async () => {
  resetRuntimeMetrics();
  const client = createAihqVoiceClient({
    fetchFn: async () => ({
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ ok: true, execution: {} });
      },
    }),
    baseUrl: "https://aihq.example.test",
    internalToken: "token",
  });

  const result = await client.updateSessionState({
    providerCallSid: "CA123",
    eventType: "session_state_updated",
  });

  assert.equal(result.ok, false);
  assert.equal(result.text, "durable_execution_id_required");
  assert.equal(getRuntimeMetricsSnapshot().voice_sync_failures_total, 1);
});

test("duplicate suppression metric is emitted when voice sync cache sees the same payload twice", () => {
  resetRuntimeMetrics();

  const first = shouldSuppressVoiceSync("voice.sync.transcript", {
    providerCallSid: "CA555",
    text: "hello",
  });
  const second = shouldSuppressVoiceSync("voice.sync.transcript", {
    providerCallSid: "CA555",
    text: "hello",
  });

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(getRuntimeMetricsSnapshot().voice_sync_duplicate_suppressions_total, 1);
});
