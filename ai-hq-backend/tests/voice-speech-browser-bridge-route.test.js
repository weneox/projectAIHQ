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

function createAuthedVoiceApp({ speechGatewayFactory } = {}) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.use((req, res, next) => {
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
      speechGatewayFactory,
    })
  );

  app.use((req, res) => {
    res.status(404).json({
      ok: false,
      error: "test_route_not_found",
      method: req.method,
      path: req.path,
    });
  });

  return app;
}

test("browser speech bridge transcribes base64 audio through gateway runtime", async () => {
  let gatewayInput = null;

  const app = createAuthedVoiceApp({
    speechGatewayFactory: () => ({
      transcribeAudioChunk: async (input) => {
        gatewayInput = input;
        return {
          ok: true,
          status: "transcribed",
          provider: "soniox",
          stage: "stt",
          networkIo: true,
          text: "Salam",
        };
      },
    }),
  });

  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/voice/speech/browser/transcribe`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        audioBase64: Buffer.from("fake-audio").toString("base64"),
        encoding: "base64",
        finalize: true,
      }),
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.version, "voice_speech_browser_bridge.v1");
    assert.equal(body.stage, "stt");
    assert.equal(body.result.ok, true);
    assert.equal(body.result.text, "Salam");
    assert.equal(body.text, "Salam");

    assert.equal(Array.isArray(gatewayInput.audioChunks), true);
    assert.equal(gatewayInput.audioChunks.length, 1);
    assert.equal(gatewayInput.audioChunks[0].toString("utf8"), "fake-audio");
    assert.equal(gatewayInput.finalize, true);
  });
});

test("browser speech bridge synthesizes text and returns base64 audio", async () => {
  let gatewayInput = null;

  const app = createAuthedVoiceApp({
    speechGatewayFactory: () => ({
      synthesizeSpeech: async (input) => {
        gatewayInput = input;
        return {
          ok: true,
          status: "synthesized",
          provider: "soniox",
          stage: "tts",
          networkIo: true,
          audio: Buffer.from("fake-audio"),
        };
      },
    }),
  });

  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/voice/speech/browser/synthesize`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: "Oldu.",
        streamId: "stream-test",
      }),
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.version, "voice_speech_browser_bridge.v1");
    assert.equal(body.stage, "tts");
    assert.equal(body.result.ok, true);
    assert.equal(body.result.audioBase64, Buffer.from("fake-audio").toString("base64"));
    assert.equal(body.result.audioByteLength, Buffer.byteLength("fake-audio"));
    assert.equal(body.result.audioEncoding, "base64");

    assert.deepEqual(gatewayInput, {
      text: "Oldu.",
      streamId: "stream-test",
    });
  });
});

test("browser speech bridge fails closed when audio or text is missing", async () => {
  const app = createAuthedVoiceApp({
    speechGatewayFactory: () => {
      throw new Error("should not create gateway");
    },
  });

  await withTestServer(app, async (baseUrl) => {
    const transcribe = await fetch(`${baseUrl}/voice/speech/browser/transcribe`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const transcribeBody = await transcribe.json();

    assert.equal(transcribe.status, 400);
    assert.equal(transcribeBody.ok, false);
    assert.equal(transcribeBody.error, "voice_speech_audio_missing");

    const synthesize = await fetch(`${baseUrl}/voice/speech/browser/synthesize`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const synthesizeBody = await synthesize.json();

    assert.equal(synthesize.status, 400);
    assert.equal(synthesizeBody.ok, false);
    assert.equal(synthesizeBody.error, "voice_speech_text_missing");
  });
});
