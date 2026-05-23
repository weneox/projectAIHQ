import {
  buildVoiceActionToolDefinitions,
} from "../actions/voiceActionContracts.js";
import {
  buildVoiceAssistantBrainInstructions,
  buildVoiceAssistantOpeningInstructions,
  VOICE_ASSISTANT_BRAIN_POLICY_VERSION,
} from "../brain/index.js";
import {
  buildRealtimeProviderContract,
} from "../realtimeProviderAdapters.js";
import {
  buildVoiceSpeechPipeline,
  normalizeVoiceOutputName,
} from "../speech/voiceSpeechPipeline.js";

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
  return normalizeVoiceOutputName(value);
}

export function readBrowserRealtimeProvider(runtimeConfig = {}) {
  const realtime = readRealtimeConfig(runtimeConfig);

  return s(
    realtime.provider ||
      realtime.realtimeProvider ||
      realtime.voiceProvider ||
      runtimeConfig.realtimeProvider ||
      runtimeConfig.voiceRealtimeProvider ||
      "openai"
  );
}

export function readBrowserRealtimeTransport(runtimeConfig = {}) {
  const realtime = readRealtimeConfig(runtimeConfig);

  return s(
    realtime.transport ||
      realtime.realtimeTransport ||
      realtime.voiceTransport ||
      runtimeConfig.realtimeTransport ||
      runtimeConfig.voiceRealtimeTransport ||
      "webrtc"
  );
}

export function buildBrowserRealtimeSessionReadiness({
  runtimeConfig = {},
  speechPipeline = null,
} = {}) {
  const provider = readBrowserRealtimeProvider(runtimeConfig);
  const transport = readBrowserRealtimeTransport(runtimeConfig);
  const providerContract = buildRealtimeProviderContract({ provider, transport });
  const speech = speechPipeline || buildVoiceSpeechPipeline({ runtimeConfig });

  const speechCompatibility = obj(speech.compatibility);
  const speechSupported = speechCompatibility.browserRealtimeSupported !== false;

  const blockingReasons = [];

  if (!providerContract.supported) {
    blockingReasons.push({
      scope: "provider",
      reasonCode: providerContract.reasonCode || "unsupported_realtime_provider",
      provider: providerContract.provider,
    });
  }

  if (!speechSupported) {
    const reasonCodes = Array.isArray(speechCompatibility.reasonCodes)
      ? speechCompatibility.reasonCodes
      : ["speech_pipeline_not_browser_realtime_supported"];

    for (const reasonCode of reasonCodes) {
      blockingReasons.push({
        scope: "speech",
        reasonCode: s(reasonCode, "speech_pipeline_not_browser_realtime_supported"),
        provider: s(speech.asr?.provider || speech.tts?.provider),
      });
    }
  }

  return {
    version: "browser-realtime-session-readiness-v1",
    ready: blockingReasons.length === 0,
    status: blockingReasons.length === 0 ? "ready" : "blocked",
    reasonCode: s(blockingReasons[0]?.reasonCode),
    provider: providerContract.provider,
    transport: providerContract.transport,
    providerContract,
    speechCompatibility,
    blockingReasons,
  };
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
  const speechPipeline = buildVoiceSpeechPipeline({
    runtimeConfig,
    requestedVoice,
  });
  const readiness = buildBrowserRealtimeSessionReadiness({
    runtimeConfig,
    speechPipeline,
  });
  const voice = speechPipeline.tts.voice;

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
    speechPipeline,
    readiness,
    providerContract: readiness.providerContract,
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
              model: speechPipeline.realtime.transcriptionModel,
            },
            turn_detection: turnDetection,
          },
        },
      },
    },
  };
}
