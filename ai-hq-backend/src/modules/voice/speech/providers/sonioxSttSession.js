import {
  buildSonioxSpeechRuntimeConfig,
} from "./sonioxSpeechRuntimeConfig.js";
import {
  createSonioxRealtimeWebsocketClient,
} from "./sonioxRealtimeWebsocketClient.js";
import {
  createSonioxNodeWebsocketFactory,
} from "./sonioxNodeWebsocketFactory.js";

export const SONIOX_STT_SESSION_VERSION = "soniox_stt_session.v1";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
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

function sendAudioChunk(socket, chunk) {
  if (!socket || chunk === undefined || chunk === null) return false;
  socket.send(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
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

function renderTokens(tokens = []) {
  return asArray(tokens)
    .map((token) =>
      token?.text === undefined || token?.text === null ? "" : String(token.text)
    )
    .join("");
}

function waitForSttTranscript({
  socket,
  timeoutMs = 30_000,
} = {}) {
  return new Promise((resolve, reject) => {
    const finalTokens = [];
    let nonFinalTokens = [];
    const events = [];
    let settled = false;

    const timeout = setTimeout(() => {
      finish(reject, new Error("soniox_stt_session_timeout"));
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

      if (payload.error_code || payload.error) {
        finish(
          reject,
          new Error(
            s(payload.error_message || payload.message || payload.error_code || payload.error)
          )
        );
        return;
      }

      const tokens = asArray(payload.tokens);
      nonFinalTokens = [];

      for (const token of tokens) {
        if (!s(token?.text)) continue;

        if (token?.is_final === true) {
          finalTokens.push(token);
        } else {
          nonFinalTokens.push(token);
        }
      }

      events.push({
        tokenCount: tokens.length,
        finalTokenCount: tokens.filter((token) => token?.is_final === true).length,
        nonFinalTokenCount: tokens.filter((token) => token?.is_final !== true).length,
        finalAudioProcMs: Number(payload.final_audio_proc_ms || 0),
        totalAudioProcMs: Number(payload.total_audio_proc_ms || 0),
        finished: payload.finished === true,
      });

      if (payload.finished === true) {
        finish(resolve, {
          text: renderTokens(finalTokens),
          interimText: renderTokens(nonFinalTokens),
          finalTokens,
          nonFinalTokens,
          events,
        });
      }
    });

    addSocketListener(socket, "error", (err) => {
      finish(reject, err || new Error("soniox_stt_session_socket_error"));
    });

    addSocketListener(socket, "close", () => {
      if (settled) return;

      finish(resolve, {
        text: renderTokens(finalTokens),
        interimText: renderTokens(nonFinalTokens),
        finalTokens,
        nonFinalTokens,
        events,
      });
    });
  });
}

export function createSonioxSttSession({
  env = process.env,
  runtimeConfig = null,
  socketFactory = null,
  now = () => new Date().toISOString(),
  timeoutMs = 30_000,
} = {}) {
  const config = runtimeConfig || buildSonioxSpeechRuntimeConfig({ env });
  const factory = socketFactory || createSonioxNodeWebsocketFactory();

  return {
    version: SONIOX_STT_SESSION_VERSION,
    provider: "soniox",
    stage: "stt",
    configured: config.configured === true,
    networkIo: false,

    async transcribe({ audioChunks = [], finalize = true } = {}) {
      const chunks = asArray(audioChunks).filter((chunk) => chunk !== undefined && chunk !== null);

      if (chunks.length === 0) {
        return {
          ok: false,
          status: "blocked",
          provider: "soniox",
          stage: "stt",
          networkIo: false,
          reasonCode: "soniox_stt_audio_missing",
        };
      }

      let opened = null;

      const client = createSonioxRealtimeWebsocketClient({
        runtimeConfig: config,
        now,
        socketFactory: async (request) => {
          opened = await factory(request);
          return opened;
        },
      });

      const connectResult = await client.connect({ stage: "stt" });

      if (connectResult.ok !== true) {
        return connectResult;
      }

      const socket = opened?.socket || opened;

      if (!socket || typeof socket.send !== "function") {
        return {
          ok: false,
          status: "failed",
          provider: "soniox",
          stage: "stt",
          networkIo: true,
          reasonCode: "soniox_stt_socket_missing",
          connectionPlan: connectResult.connectionPlan,
        };
      }

      try {
        for (const chunk of chunks) {
          sendAudioChunk(socket, chunk);
        }

        if (finalize) {
          sendJson(socket, { type: "finalize" });
        }

        const transcriptResult = await waitForSttTranscript({
          socket,
          timeoutMs,
        });

        return {
          ok: true,
          status: "transcribed",
          provider: "soniox",
          stage: "stt",
          networkIo: true,
          text: transcriptResult.text,
          interimText: transcriptResult.interimText,
          finalTokens: transcriptResult.finalTokens,
          nonFinalTokens: transcriptResult.nonFinalTokens,
          events: transcriptResult.events,
          transcribedAt: now(),
          reasonCode: "",
          connectionPlan: connectResult.connectionPlan,
        };
      } catch (err) {
        return {
          ok: false,
          status: "failed",
          provider: "soniox",
          stage: "stt",
          networkIo: true,
          reasonCode: "soniox_stt_session_failed",
          errorMessage: s(err?.message || err),
          connectionPlan: connectResult.connectionPlan,
        };
      } finally {
        closeQuietly(socket);
      }
    },
  };
}
