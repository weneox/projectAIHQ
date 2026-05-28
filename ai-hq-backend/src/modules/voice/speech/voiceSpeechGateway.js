import {
  buildVoiceSpeechPipeline,
} from "./voiceSpeechPipeline.js";
import {
  buildVoiceSpeechProviderConfig,
} from "./voiceSpeechProviderConfig.js";
import {
  buildAzeriConversationOutput,
} from "./azConversationNaturalizer.js";
import {
  createSonioxSpeechAdapter,
} from "./providers/sonioxSpeechAdapter.js";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export const VOICE_SPEECH_GATEWAY_VERSION = "voice_speech_gateway.v1";

export function createDefaultSpeechAdapterRegistry({
  providerConfig = {},
  env = process.env,
} = {}) {
  const language = s(providerConfig.language, "az");
  const tts = obj(providerConfig.tts);

  return {
    soniox: createSonioxSpeechAdapter({
      apiKey: env.SONIOX_API_KEY || env.VOICE_SONIOX_API_KEY || "",
      language,
      voice: tts.voice || "default",
    }),
  };
}

function buildSpeechRuntimeConfig({ runtimeConfig = {}, providerConfig = {} } = {}) {
  const base = obj(runtimeConfig);
  const existingSpeech = obj(base.speech || base.voiceSpeech);
  const stt = obj(providerConfig.stt);
  const tts = obj(providerConfig.tts);

  return {
    ...base,
    speech: {
      ...existingSpeech,
      language: providerConfig.language,
      input: {
        ...obj(existingSpeech.input),
        provider: stt.provider,
        language: providerConfig.language,
      },
      output: {
        ...obj(existingSpeech.output),
        provider: tts.provider,
        language: providerConfig.language,
        voice: tts.voice,
      },
    },
  };
}

function buildGatewayStages(providerConfig = {}) {
  return [
    {
      name: "audio_input",
      provider: s(providerConfig.transport, "browser"),
      implemented: false,
      reasonCode: "audio_transport_not_implemented",
    },
    {
      name: "turn_taking",
      provider: "internal",
      implemented: false,
      reasonCode: "turn_taking_not_implemented",
    },
    {
      name: "stt",
      provider: s(providerConfig.stt?.provider),
      implemented: false,
      reasonCode: "stt_network_adapter_not_implemented",
    },
    {
      name: "brain",
      provider: s(providerConfig.llm?.provider, "openai"),
      implemented: false,
      reasonCode: "llm_stream_adapter_not_implemented",
    },
    {
      name: "naturalizer",
      provider: "internal",
      implemented: true,
      reasonCode: "",
    },
    {
      name: "tts",
      provider: s(providerConfig.tts?.provider),
      implemented: false,
      reasonCode: "tts_network_adapter_not_implemented",
    },
    {
      name: "audio_output",
      provider: s(providerConfig.transport, "browser"),
      implemented: false,
      reasonCode: "audio_output_transport_not_implemented",
    },
  ];
}

export function buildVoiceSpeechGatewayPlan({
  env = process.env,
  runtimeConfig = {},
  overrides = {},
  requestedVoice = "",
} = {}) {
  const providerConfig = buildVoiceSpeechProviderConfig({
    env,
    runtimeConfig,
    overrides,
  });

  const speechRuntimeConfig = buildSpeechRuntimeConfig({
    runtimeConfig,
    providerConfig,
  });

  const speechPipeline = buildVoiceSpeechPipeline({
    runtimeConfig: speechRuntimeConfig,
    requestedVoice: requestedVoice || providerConfig.tts.voice,
  });

  const adapterRegistry = createDefaultSpeechAdapterRegistry({
    providerConfig,
    env,
  });

  const sttAdapter = adapterRegistry[providerConfig.stt.provider] || null;
  const ttsAdapter = adapterRegistry[providerConfig.tts.provider] || null;

  const stages = buildGatewayStages(providerConfig);

  return {
    version: VOICE_SPEECH_GATEWAY_VERSION,
    providerAgnostic: true,
    mode: "cascaded_streaming",
    networkIo: false,
    transport: providerConfig.transport,
    language: providerConfig.language,
    providerConfig,
    speechPipeline,
    adapters: {
      stt: {
        provider: providerConfig.stt.provider,
        available: !!sttAdapter || providerConfig.stt.provider === "openai_realtime",
      },
      tts: {
        provider: providerConfig.tts.provider,
        available: !!ttsAdapter || providerConfig.tts.provider === "openai_realtime",
      },
    },
    readiness: {
      contractReady:
        providerConfig.stt.configured === true &&
        providerConfig.tts.configured === true,
      liveInferenceReady: false,
      browserRealtimeSupported:
        speechPipeline.compatibility.browserRealtimeSupported === true,
      externalSpeechAdapterRequired:
        speechPipeline.compatibility.externalSpeechAdapterRequired === true,
      reasonCode: "speech_gateway_live_inference_not_implemented",
    },
    stages,
  };
}

export function createVoiceSpeechGateway(options = {}) {
  const plan = buildVoiceSpeechGatewayPlan(options);
  const providerConfig = obj(plan.providerConfig);
  const customRegistry = obj(options.adapterRegistry);

  const adapterRegistry =
    Object.keys(customRegistry).length > 0
      ? customRegistry
      : createDefaultSpeechAdapterRegistry({
          providerConfig,
          env: options.env || process.env,
        });

  const sttAdapter = adapterRegistry[providerConfig.stt?.provider] || null;
  const ttsAdapter = adapterRegistry[providerConfig.tts?.provider] || null;

  return {
    version: VOICE_SPEECH_GATEWAY_VERSION,
    plan,

    async transcribeAudioChunk(input = {}) {
      if (!sttAdapter || typeof sttAdapter.transcribeAudioChunk !== "function") {
        return {
          ok: false,
          status: "not_implemented",
          networkIo: false,
          reasonCode: "speech_gateway_stt_not_implemented",
          provider: providerConfig.stt?.provider,
        };
      }

      return sttAdapter.transcribeAudioChunk(input);
    },

    async synthesizeSpeech(input = {}) {
      if (!ttsAdapter || typeof ttsAdapter.synthesizeSpeech !== "function") {
        return {
          ok: false,
          status: "not_implemented",
          networkIo: false,
          reasonCode: "speech_gateway_tts_not_implemented",
          provider: providerConfig.tts?.provider,
        };
      }

      return ttsAdapter.synthesizeSpeech(input);
    },

    async buildTurnPlan({ transcript = "", responseText = "", mood = "neutral" } = {}) {
      return {
        ok: true,
        status: "turn_plan_built",
        networkIo: false,
        transcript: s(transcript),
        output: buildAzeriConversationOutput({
          text: responseText,
          mood,
        }),
        providerConfig: plan.providerConfig,
      };
    },
  };
}
