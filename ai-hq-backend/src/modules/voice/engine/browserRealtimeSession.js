import {
  buildVoiceActionToolDefinitions,
} from "../actions/voiceActionContracts.js";
import {
  buildVoiceAssistantBrainInstructions,
  buildVoiceAssistantOpeningInstructions,
  VOICE_ASSISTANT_BRAIN_POLICY_VERSION,
} from "../brain/index.js";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function b(value, fallback = false) {
  if (typeof value === "boolean") return value;

  const raw = s(value).toLowerCase();
  if (!raw) return fallback;

  if (["1", "true", "yes", "y", "on"].includes(raw)) return true;
  if (["0", "false", "no", "n", "off"].includes(raw)) return false;

  return fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function readRealtimeConfig(runtimeConfig = {}) {
  return obj(
    runtimeConfig.realtime ||
      runtimeConfig.voiceRealtime ||
      runtimeConfig.realtimeConfig ||
      runtimeConfig.voiceRealtimeConfig
  );
}

function readTurnDetectionConfig(runtimeConfig = {}) {
  const realtime = readRealtimeConfig(runtimeConfig);

  return obj(
    realtime.turnDetection ||
      realtime.turn_detection ||
      runtimeConfig.turnDetection ||
      runtimeConfig.turn_detection
  );
}

export function normalizeBrowserVoiceModel(value = "") {
  const raw = s(value, "gpt-realtime-1.5").toLowerCase();

  if (raw === "gpt-realtime-2") return "gpt-realtime-1.5";
  if (raw === "gpt-realtime" || raw === "gpt-realtime-1.5") return "gpt-realtime-1.5";
  if (raw === "gpt-4o-realtime-preview") return "gpt-realtime-1.5";

  return "gpt-realtime-1.5";
}

export function normalizeBrowserVoiceName(value = "") {
  const raw = s(value, "coral").toLowerCase();

  if (["alloy", "echo", "shimmer", "verse"].includes(raw)) return "coral";

  return ["coral", "sage", "ash", "ballad"].includes(raw)
    ? raw
    : "coral";
}

export function buildBrowserTurnDetectionConfig(runtimeConfig = {}) {
  const turnDetection = readTurnDetectionConfig(runtimeConfig);

  return {
    type: s(turnDetection.type || "server_vad"),
    threshold: clamp(n(turnDetection.threshold, 0.7), 0.1, 1),
    prefix_padding_ms: Math.max(
      0,
      n(turnDetection.prefix_padding_ms || turnDetection.prefixPaddingMs, 260)
    ),
    silence_duration_ms: Math.max(
      100,
      n(turnDetection.silence_duration_ms || turnDetection.silenceDurationMs, 650)
    ),
    create_response: b(
      turnDetection.create_response ?? turnDetection.createResponse,
      true
    ),
    interrupt_response: b(
      turnDetection.interrupt_response ?? turnDetection.interruptResponse,
      true
    ),
  };
}

export function buildLiveVoiceInstructions({
  baseInstructions = "",
  runtimeConfig = {},
  runtimeApplied = false,
} = {}) {
  return buildVoiceAssistantBrainInstructions({
    baseInstructions,
    runtimeConfig,
    runtimeApplied,
  });
}

export function buildBrowserOpeningInstructions({
  runtimeConfig = {},
  runtimeApplied = false,
} = {}) {
  return buildVoiceAssistantOpeningInstructions({
    runtimeConfig,
    runtimeApplied,
  });
}

export function buildBrowserRealtimeSessionPlan({
  requestedModel = "",
  requestedVoice = "",
  baseInstructions = "",
  runtimeConfig = {},
  runtimeApplied = false,
} = {}) {
  const model = normalizeBrowserVoiceModel(requestedModel);
  const voice = normalizeBrowserVoiceName(requestedVoice);

  const instructions = buildLiveVoiceInstructions({
    baseInstructions,
    runtimeConfig,
    runtimeApplied,
  });

  const openingInstructions = buildBrowserOpeningInstructions({
    runtimeConfig,
    runtimeApplied,
  });

  const tools = buildVoiceActionToolDefinitions(runtimeConfig);
  const turnDetection = buildBrowserTurnDetectionConfig(runtimeConfig);

  return {
    brainPolicyVersion: VOICE_ASSISTANT_BRAIN_POLICY_VERSION,
    model,
    voice,
    instructions,
    openingResponse: {
      enabled: true,
      maxOutputTokens: 120,
      instructions: openingInstructions,
    },
    clientSecretRequest: {
      expires_after: {
        anchor: "created_at",
        seconds: 600,
      },
      session: {
        type: "realtime",
        model,
        instructions,
        output_modalities: ["audio"],
        ...(tools.length ? { tools, tool_choice: "auto" } : {}),
        audio: {
          output: {
            voice,
          },
          input: {
            transcription: {
              model: "gpt-4o-mini-transcribe",
            },
            turn_detection: turnDetection,
          },
        },
      },
    },
  };
}
