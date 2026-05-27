import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";

import {
  voiceRoutes,
} from "../src/routes/api/voice/public.js";

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

function createVoiceApp({ pioneroRealtimeAgentRegistry }) {
  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    req.auth = {
      tenantId: "tenant-test",
      tenantKey: "tenant-test",
      role: "admin",
      userId: "user-test",
      email: "operator@example.com",
    };
    next();
  });

  app.use(
    voiceRoutes({
      db: null,
      dbDisabled: true,
      audit: null,
      pioneroRealtimeAgentRegistry,
    })
  );

  return app;
}

function realtimeStatus(overrides = {}) {
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

test("pionero realtime status route includes ready realtime readiness payload", async () => {
  const registry = {
    getState(input = {}) {
      return realtimeStatus({
        roomName: input.roomName,
      });
    },
  };

  const app = createVoiceApp({ pioneroRealtimeAgentRegistry: registry });

  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/voice/pionero/livekit/agent/status?roomName=pionero-demo-room`
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.lane, "pionero_realtime");
    assert.equal(body.transport, "livekit_audio_track");
    assert.equal(body.realtimeReadiness.ok, true);
    assert.equal(body.realtimeReadiness.status, "ready");
    assert.deepEqual(body.realtimeReadiness.blockers, []);
    assert.equal(body.realtimeReadiness.observed.firstAudioLatencyMs, 650);
  });
});

test("pionero realtime status route exposes readiness blockers", async () => {
  const registry = {
    getState(input = {}) {
      return realtimeStatus({
        roomName: input.roomName,
        livekitAudioTrackPublished: false,
        firstAudioLatencyMs: 1800,
      });
    },
  };

  const app = createVoiceApp({ pioneroRealtimeAgentRegistry: registry });

  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/voice/pionero/livekit/agent/status?roomName=pionero-demo-room`
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.realtimeReadiness.ok, false);
    assert.equal(body.realtimeReadiness.status, "blocked");
    assert.equal(
      body.realtimeReadiness.blockers.some(
        (blocker) =>
          blocker.reasonCode === "pionero_livekit_audio_track_not_published"
      ),
      true
    );
    assert.equal(
      body.realtimeReadiness.blockers.some(
        (blocker) =>
          blocker.reasonCode === "pionero_realtime_first_audio_latency_exceeded"
      ),
      true
    );
  });
});

test("pionero realtime start-plan allows pending first audio but still reports readiness", async () => {
  const registry = {
    async start(input = {}) {
      return realtimeStatus({
        roomName: input.roomName,
        firstAudioAt: "",
        firstAudioLatencyMs: 0,
      });
    },
  };

  const app = createVoiceApp({ pioneroRealtimeAgentRegistry: registry });

  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/voice/pionero/livekit/agent/start-plan`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          roomName: "pionero-demo-room",
        }),
      }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.lane, "pionero_realtime");
    assert.equal(body.realtimeReadiness.ok, true);
    assert.equal(body.realtimeReadiness.observed.firstAudioObserved, false);
  });
});
