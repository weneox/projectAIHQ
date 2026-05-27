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

test("pionero start-plan uses realtime registry when realtime lane is enabled", async () => {
  const starts = [];
  const registry = {
    async start(input = {}) {
      starts.push(input);
      return {
        version: "pionero_openai_realtime_livekit_bridge.v1",
        registryVersion: "pionero_realtime_agent_registry.v1",
        mode: "openai_realtime_livekit_track",
        enabled: true,
        status: "live",
        roomName: input.roomName,
        provider: "openai_realtime",
        realtimeConnected: true,
        livekitAudioTrackPublished: true,
        firstAudioAt: "",
        firstAudioLatencyMs: 0,
        interruptionsObserved: 0,
        lastReasonCode: "",
        errorMessage: "",
      };
    },
    getState() {
      return null;
    },
    async stop() {
      return null;
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
    assert.equal(body.transport, "livekit_audio_track");
    assert.equal(body.mode, "openai_realtime_livekit_track");
    assert.equal(body.status, "live");
    assert.equal(body.realtimeConnected, true);
    assert.equal(body.livekitAudioTrackPublished, true);
    assert.equal(starts.length, 1);
    assert.equal(starts[0].roomName, "pionero-demo-room");
  });
});

test("pionero status route returns realtime registry state before legacy runner state", async () => {
  const registry = {
    async start() {
      throw new Error("start should not be called");
    },
    getState(input = {}) {
      return {
        version: "pionero_openai_realtime_livekit_bridge.v1",
        mode: "openai_realtime_livekit_track",
        enabled: true,
        status: "live",
        roomName: input.roomName,
        provider: "openai_realtime",
        realtimeConnected: true,
        livekitAudioTrackPublished: true,
        firstAudioAt: "",
        firstAudioLatencyMs: 0,
        interruptionsObserved: 0,
        lastReasonCode: "",
        errorMessage: "",
      };
    },
    async stop() {
      return null;
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
    assert.equal(body.status, "live");
    assert.equal(body.roomName, "pionero-demo-room");
  });
});

test("pionero stop-plan returns realtime registry stop state before legacy runner stop", async () => {
  const registry = {
    async start() {
      throw new Error("start should not be called");
    },
    getState() {
      return null;
    },
    async stop(input = {}) {
      return {
        version: "pionero_openai_realtime_livekit_bridge.v1",
        mode: "openai_realtime_livekit_track",
        enabled: true,
        status: "stopped",
        roomName: input.roomName,
        provider: "openai_realtime",
        realtimeConnected: false,
        livekitAudioTrackPublished: false,
        firstAudioAt: "",
        firstAudioLatencyMs: 0,
        interruptionsObserved: 0,
        lastReasonCode: "pionero_realtime_bridge_stopped",
        errorMessage: "",
      };
    },
  };

  const app = createVoiceApp({ pioneroRealtimeAgentRegistry: registry });

  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/voice/pionero/livekit/agent/stop-plan`,
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
    assert.equal(body.transport, "livekit_audio_track");
    assert.equal(body.status, "stopped");
  });
});
