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

function normalizeAudioChunkToBuffer(chunk) {
  if (chunk === undefined || chunk === null) return null;
  if (Buffer.isBuffer(chunk)) return chunk;
  if (typeof chunk === "string") return Buffer.from(chunk);

  if (chunk instanceof ArrayBuffer) {
    return Buffer.from(chunk);
  }

  if (ArrayBuffer.isView(chunk)) {
    return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  }

  return null;
}

function sendAudioChunk(socket, chunk) {
  if (!socket || chunk === undefined || chunk === null) return false;
  const buffer = normalizeAudioChunkToBuffer(chunk);

  if (!buffer) return false;

  socket.send(buffer);
  return true;
}

function sendEndOfAudio(socket) {
  if (!socket || typeof socket.send !== "function") return false;
  socket.send("");
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

export function isSonioxSpecialTokenText(text) {
  const value = s(text).toLowerCase();

  return !value || [
    "<fin>",
    "<end>",
    "<eos>",
    "<sil>",
    "<noise>",
    "<unk>",
  ].includes(value);
}

function renderTokens(tokens = []) {
  return asArray(tokens)
    .filter((token) => !isSonioxSpecialTokenText(token?.text))
    .map((token) =>
      token?.text === undefined || token?.text === null ? "" : String(token.text)
    )
    .join("")
    .trim();
}

function waitForSttTranscript({
  socket,
  timeoutMs = 30_000,
} = {}) {
  return new Promise((resolve, reject) => {
    const finalTokens = [];
    let nonFinalTokens = [];
    const events = [];
    let realTokenCount = 0;
    let specialTokenCount = 0;
    let finalTokenCount = 0;
    let nonFinalTokenCount = 0;
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

    function buildTranscriptResult() {
      return {
        text: renderTokens(finalTokens),
        interimText: renderTokens(nonFinalTokens),
        finalTokens,
        nonFinalTokens,
        events,
        realTokenCount,
        specialTokenCount,
        finalTokenCount,
        nonFinalTokenCount,
      };
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
      let eventRealTokenCount = 0;
      let eventSpecialTokenCount = 0;
      let eventFinalTokenCount = 0;
      let eventNonFinalTokenCount = 0;

      for (const token of tokens) {
        const isFinal = token?.is_final === true;

        if (isFinal) {
          finalTokenCount += 1;
          eventFinalTokenCount += 1;
        } else {
          nonFinalTokenCount += 1;
          eventNonFinalTokenCount += 1;
        }

        if (isSonioxSpecialTokenText(token?.text)) {
          specialTokenCount += 1;
          eventSpecialTokenCount += 1;
          continue;
        }

        realTokenCount += 1;
        eventRealTokenCount += 1;

        if (isFinal) {
          finalTokens.push(token);
        } else {
          nonFinalTokens.push(token);
        }
      }

      events.push({
        tokenCount: tokens.length,
        realTokenCount: eventRealTokenCount,
        specialTokenCount: eventSpecialTokenCount,
        finalTokenCount: eventFinalTokenCount,
        nonFinalTokenCount: eventNonFinalTokenCount,
        finalAudioProcMs: Number(payload.final_audio_proc_ms || 0),
        totalAudioProcMs: Number(payload.total_audio_proc_ms || 0),
        finished: payload.finished === true,
      });

      if (payload.finished === true) {
        finish(resolve, buildTranscriptResult());
      }
    });

    addSocketListener(socket, "error", (err) => {
      finish(reject, err || new Error("soniox_stt_session_socket_error"));
    });

    addSocketListener(socket, "close", () => {
      if (settled) return;

      finish(resolve, buildTranscriptResult());
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
          sendEndOfAudio(socket);
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
          realTokenCount: transcriptResult.realTokenCount,
          specialTokenCount: transcriptResult.specialTokenCount,
          finalTokenCount: transcriptResult.finalTokenCount,
          nonFinalTokenCount: transcriptResult.nonFinalTokenCount,
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
