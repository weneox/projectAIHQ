import { EventEmitter } from "node:events";
import WebSocket from "ws";

import { s } from "../../shared.js";

export const PIONERO_OPENAI_REALTIME_TRANSPORT_VERSION =
  "pionero_openai_realtime_transport.v1";

const DEFAULT_REALTIME_URL = "wss://api.openai.com/v1/realtime";
const DEFAULT_REALTIME_MODEL = "gpt-realtime-1.5";
const DEFAULT_REALTIME_VOICE = "marin";
const DEFAULT_SAMPLE_RATE_HZ = 24000;

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? Math.floor(next) : fallback;
}

function readMessageData(message) {
  if (message && typeof message === "object" && "data" in message) {
    return readMessageData(message.data);
  }

  if (Buffer.isBuffer(message)) return message.toString("utf8");

  if (message instanceof ArrayBuffer) {
    return Buffer.from(message).toString("utf8");
  }

  return String(message ?? "");
}

function parseJson(raw = "") {
  try {
    return {
      ok: true,
      value: JSON.parse(String(raw)),
    };
  } catch (err) {
    return {
      ok: false,
      errorMessage: s(err?.message || err, "realtime_message_invalid_json"),
    };
  }
}

function attachSocketHandler(socket, eventName, handler) {
  if (typeof socket?.on === "function") {
    socket.on(eventName, handler);
    return;
  }

  if (typeof socket?.addEventListener === "function") {
    socket.addEventListener(eventName, (event) => handler(event));
  }
}

function readRealtimeUrl({ env = process.env, model = "" } = {}) {
  const url = new URL(s(env.OPENAI_REALTIME_WS_URL, DEFAULT_REALTIME_URL));
  url.searchParams.set("model", s(model, DEFAULT_REALTIME_MODEL));
  return url.toString();
}

function normalizePcmBuffer(audio) {
  if (Buffer.isBuffer(audio)) return Buffer.from(audio);
  if (audio instanceof ArrayBuffer) return Buffer.from(audio);
  if (ArrayBuffer.isView(audio)) {
    return Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength);
  }
  return Buffer.alloc(0);
}

function readAudioDelta(event = {}) {
  const delta = s(event.delta || event.audio || event.audio_base64);

  if (!delta) return Buffer.alloc(0);

  try {
    return Buffer.from(delta, "base64");
  } catch {
    return Buffer.alloc(0);
  }
}

export function buildOpenAIRealtimeSessionUpdate({
  instructions = "",
  model = DEFAULT_REALTIME_MODEL,
  voice = DEFAULT_REALTIME_VOICE,
  sampleRateHz = DEFAULT_SAMPLE_RATE_HZ,
} = {}) {
  return {
    type: "session.update",
    session: {
      type: "realtime",
      model: s(model, DEFAULT_REALTIME_MODEL),
      instructions: s(instructions),
      output_modalities: ["audio"],
      max_output_tokens: 256,
      audio: {
        input: {
          format: {
            type: "audio/pcm",
            rate: n(sampleRateHz, DEFAULT_SAMPLE_RATE_HZ),
          },
          turn_detection: {
            type: "server_vad",
            threshold: 0.55,
            prefix_padding_ms: 240,
            silence_duration_ms: 520,
            create_response: true,
            interrupt_response: true,
          },
        },
        output: {
          format: {
            type: "audio/pcm",
            rate: n(sampleRateHz, DEFAULT_SAMPLE_RATE_HZ),
          },
          voice: s(voice, DEFAULT_REALTIME_VOICE),
          speed: 1.05,
        },
      },
      tracing: null,
    },
  };
}

export function createOpenAIRealtimeTransport({
  env = process.env,
  logger = null,
  WebSocketImpl = WebSocket,
  model = "",
  voice = "",
  sampleRateHz = DEFAULT_SAMPLE_RATE_HZ,
} = {}) {
  const emitter = new EventEmitter();
  const safeModel = s(model || env.OPENAI_REALTIME_MODEL, DEFAULT_REALTIME_MODEL);
  const safeVoice = s(voice || env.OPENAI_REALTIME_VOICE, DEFAULT_REALTIME_VOICE);
  const safeSampleRateHz = n(sampleRateHz, DEFAULT_SAMPLE_RATE_HZ);
  let socket = null;
  let connected = false;
  let closed = false;
  let currentResponseId = "";
  let currentItemId = "";

  function emit(eventName, payload = {}) {
    emitter.emit(eventName, payload);
  }

  function sendEvent(event = {}) {
    if (!socket || typeof socket.send !== "function") {
      return false;
    }

    socket.send(JSON.stringify(event));
    return true;
  }

  function handleRealtimeEvent(event = {}) {
    const type = s(event.type);

    if (type === "input_audio_buffer.speech_started") {
      emit("userSpeechStarted", {
        type,
        eventId: s(event.event_id),
      });
      return;
    }

    if (type === "response.created") {
      currentResponseId = s(event.response?.id || event.response_id);
      emit("assistantResponseStarted", {
        responseId: currentResponseId,
      });
      return;
    }

    if (
      type === "response.output_audio.delta" ||
      type === "response.audio.delta"
    ) {
      const audio = readAudioDelta(event);

      if (!audio.byteLength) return;

      currentResponseId = s(event.response_id, currentResponseId);
      currentItemId = s(event.item_id, currentItemId);
      emit("audioDelta", {
        audio,
        responseId: currentResponseId,
        itemId: currentItemId,
      });
      return;
    }

    if (
      type === "response.output_audio.done" ||
      type === "response.audio.done" ||
      type === "response.done"
    ) {
      emit("assistantResponseDone", {
        responseId: s(event.response_id || event.response?.id, currentResponseId),
        itemId: s(event.item_id, currentItemId),
        status: s(event.response?.status || event.status),
      });
    }

    if (type === "error") {
      emit("error", {
        reasonCode: s(event.error?.code || event.error?.type || "openai_realtime_error"),
        errorMessage: s(event.error?.message || event.message, "OpenAI realtime error"),
      });
    }
  }

  async function connect({ instructions = "" } = {}) {
    if (!s(env.OPENAI_API_KEY)) {
      const err = new Error("openai_api_key_missing");
      err.code = "openai_api_key_missing";
      throw err;
    }

    if (connected) {
      return getStatus();
    }

    const url = readRealtimeUrl({
      env,
      model: safeModel,
    });

    socket = new WebSocketImpl(url, {
      headers: {
        Authorization: `Bearer ${s(env.OPENAI_API_KEY)}`,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    attachSocketHandler(socket, "message", (message) => {
      const parsed = parseJson(readMessageData(message));

      if (!parsed.ok) {
        emit("error", {
          reasonCode: "openai_realtime_message_invalid_json",
          errorMessage: parsed.errorMessage,
        });
        return;
      }

      handleRealtimeEvent(parsed.value);
    });

    attachSocketHandler(socket, "close", () => {
      connected = false;
      closed = true;
      emit("closed");
    });

    attachSocketHandler(socket, "error", (err) => {
      emit("error", {
        reasonCode: "openai_realtime_socket_error",
        errorMessage: s(err?.message || err, "OpenAI realtime socket error"),
      });
      logger?.error?.("pionero.openai_realtime.socket_error", {
        reasonCode: "openai_realtime_socket_error",
      });
    });

    return new Promise((resolve) => {
      attachSocketHandler(socket, "open", () => {
        connected = true;
        closed = false;
        sendEvent(buildOpenAIRealtimeSessionUpdate({
          instructions,
          model: safeModel,
          voice: safeVoice,
          sampleRateHz: safeSampleRateHz,
        }));
        emit("connected", getStatus());
        resolve(getStatus());
      });
    });
  }

  function sendUserAudioFrame(audio) {
    const pcm = normalizePcmBuffer(audio);

    if (!pcm.byteLength) {
      return false;
    }

    return sendEvent({
      type: "input_audio_buffer.append",
      audio: pcm.toString("base64"),
    });
  }

  function interrupt({ responseId = currentResponseId, itemId = currentItemId } = {}) {
    sendEvent({
      type: "response.cancel",
      ...(s(responseId) ? { response_id: s(responseId) } : {}),
    });

    sendEvent({
      type: "output_audio_buffer.clear",
    });

    if (s(itemId)) {
      sendEvent({
        type: "conversation.item.truncate",
        item_id: s(itemId),
        content_index: 0,
        audio_end_ms: 0,
      });
    }

    return true;
  }

  async function close() {
    closed = true;
    connected = false;
    socket?.close?.();
  }

  function getStatus() {
    return {
      version: PIONERO_OPENAI_REALTIME_TRANSPORT_VERSION,
      provider: "openai_realtime",
      model: safeModel,
      connected,
      closed,
    };
  }

  return {
    close,
    connect,
    getStatus,
    interrupt,
    on: (...args) => {
      emitter.on(...args);
      return undefined;
    },
    sendEvent,
    sendUserAudioFrame,
  };
}
