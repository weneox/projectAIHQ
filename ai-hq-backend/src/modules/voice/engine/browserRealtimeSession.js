import {
  buildVoiceActionToolDefinitions,
} from "../actions/voiceActionContracts.js";
import {
  buildVoiceAssistantBrainInstructions,
  buildVoiceAssistantOpeningInstructions,
  VOICE_ASSISTANT_BRAIN_POLICY_VERSION,
} from "../brain/index.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

export function normalizeBrowserVoiceModel(value = "") {
  const raw = s(value, "gpt-realtime-1.5").toLowerCase();

  if (raw === "gpt-realtime-2") return "gpt-realtime-1.5";
  if (raw === "gpt-realtime" || raw === "gpt-realtime-1.5") return "gpt-realtime-1.5";

  return "gpt-realtime-1.5";
}

export function normalizeBrowserVoiceName(value = "") {
  const raw = s(value, "coral").toLowerCase();

  if (["alloy", "echo", "shimmer", "verse"].includes(raw)) return "coral";

  return ["coral", "sage", "ash", "ballad"].includes(raw)
    ? raw
    : "coral";
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
            turn_detection: {
              type: "server_vad",
              threshold: 0.7,
              prefix_padding_ms: 260,
              silence_duration_ms: 650,
              create_response: true,
              interrupt_response: false,
            },
          },
        },
      },
    },
  };
}
