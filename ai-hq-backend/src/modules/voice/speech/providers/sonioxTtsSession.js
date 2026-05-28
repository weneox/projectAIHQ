import {
  buildSonioxSpeechRuntimeConfig,
} from "./sonioxSpeechRuntimeConfig.js";
import {
  createSonioxRealtimeWebsocketClient,
} from "./sonioxRealtimeWebsocketClient.js";
import {
  createSonioxNodeWebsocketFactory,
} from "./sonioxNodeWebsocketFactory.js";

export const SONIOX_TTS_SESSION_VERSION = "soniox_tts_session.v1";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function closeQuietly(socket) {
  try {
    socket?.close?.();
  } catch {
    // ignore close failures
  }
}

function sendJson(socket, payload) {
  if (!socket || !payload || typeof payload !== "object") return false;
  socket.send(JSON.stringify(payload));
  return true;
}

function readMessagePayload(message) {
  const raw = message?.data ?? message;
  const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw || "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function addSocketListener(socket, event, handler) {
  if (typeof socket?.on === "function") {
    socket.on(event, handler);
    return;
  }

  if (typeof socket?.addEventListener === "function") {
    socket.addEventListener(event, handler);
  }
}

function waitForTtsAudio({
  socket,
  timeoutMs = 30_000,
  maxAudioBytes = 10 * 1024 * 1024,
} = {}) {
  return new Promise((resolve, reject) => {
    const audioChunks = [];
    const events = [];
    let audioByteLength = 0;
    let settled = false;

    const timeout = setTimeout(() => {
      finish(reject, new Error("soniox_tts_session_timeout"));
    }, timeoutMs);

    function finish(fn, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      fn(value);
    }

    addSocketListener(socket, "message", (message) => {
      const payload = readMessagePayload(message);
      if (!payload || Object.keys(payload).length === 0) return;

      events.push({
        streamId: s(payload.stream_id),
        hasAudio: !!payload.audio,
        audioEnd: payload.audio_end === true,
        terminated: payload.terminated === true,
        errorCode: s(payload.error_code || payload.code),
        errorMessage: s(payload.error_message || payload.message),
      });

      if (payload.error_code || payload.error) {
        finish(
          reject,
          new Error(
            s(payload.error_message || payload.message || payload.error_code || payload.error)
          )
        );
        return;
      }

      if (payload.audio) {
        const chunk = Buffer.from(String(payload.audio), "base64");
        audioByteLength += chunk.byteLength;

        if (audioByteLength > maxAudioBytes) {
          finish(reject, new Error("soniox_tts_session_audio_limit_exceeded"));
          return;
        }

        audioChunks.push(chunk);
      }

      if (payload.terminated === true || payload.audio_end === true) {
        finish(resolve, {
          audio: Buffer.concat(audioChunks),
          audioChunkCount: audioChunks.length,
          audioByteLength,
          events,
        });
      }
    });

    addSocketListener(socket, "error", (err) => {
      finish(reject, err || new Error("soniox_tts_session_socket_error"));
    });

    addSocketListener(socket, "close", () => {
      if (settled) return;

      finish(resolve, {
        audio: Buffer.concat(audioChunks),
        audioChunkCount: audioChunks.length,
        audioByteLength,
        events,
      });
    });
  });
}

export function createSonioxTtsSession({
  env = process.env,
  runtimeConfig = null,
  socketFactory = null,
  now = () => new Date().toISOString(),
  timeoutMs = 30_000,
  maxAudioBytes = 10 * 1024 * 1024,
} = {}) {
  const config = runtimeConfig || buildSonioxSpeechRuntimeConfig({ env });
  const factory = socketFactory || createSonioxNodeWebsocketFactory();

  return {
    version: SONIOX_TTS_SESSION_VERSION,
    provider: "soniox",
    stage: "tts",
    configured: config.configured === true,
    networkIo: false,

    async synthesize({ text = "", streamId = "" } = {}) {
      const cleanText = s(text);

      if (!cleanText) {
        return {
          ok: false,
          status: "blocked",
          provider: "soniox",
          stage: "tts",
          networkIo: false,
          reasonCode: "soniox_tts_text_missing",
        };
      }

      let opened = null;
      let privateRequest = null;

      const client = createSonioxRealtimeWebsocketClient({
        runtimeConfig: config,
        now,
        socketFactory: async (request) => {
          privateRequest = obj(request);
          opened = await factory(request);
          return opened;
        },
      });

      const connectResult = await client.connect({
        stage: "tts",
        text: cleanText,
        streamId,
      });

      if (connectResult.ok !== true) {
        return connectResult;
      }

      const socket = opened?.socket || opened;

      if (!socket || typeof socket.send !== "function") {
        return {
          ok: false,
          status: "failed",
          provider: "soniox",
          stage: "tts",
          networkIo: true,
          reasonCode: "soniox_tts_socket_missing",
          connectionPlan: connectResult.connectionPlan,
        };
      }

      try {
        sendJson(socket, privateRequest?.initialTextRequest);

        const audioResult = await waitForTtsAudio({
          socket,
          timeoutMs,
          maxAudioBytes,
        });

        return {
          ok: true,
          status: "synthesized",
          provider: "soniox",
          stage: "tts",
          networkIo: true,
          audio: audioResult.audio,
          audioChunkCount: audioResult.audioChunkCount,
          audioByteLength: audioResult.audioByteLength,
          events: audioResult.events,
          synthesizedAt: now(),
          reasonCode: "",
          connectionPlan: connectResult.connectionPlan,
        };
      } catch (err) {
        return {
          ok: false,
          status: "failed",
          provider: "soniox",
          stage: "tts",
          networkIo: true,
          reasonCode: "soniox_tts_session_failed",
          errorMessage: s(err?.message || err),
          connectionPlan: connectResult.connectionPlan,
        };
      } finally {
        closeQuietly(socket);
      }
    },
  };
}
