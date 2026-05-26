import {
  buildPioneroLiveKitAgentPlan,
  readPioneroLiveKitAgentConfig,
} from "./pioneroLiveKitAgent.js";
import {
  readOpenAiApiKey,
  readOpenAiLlmRuntimeConfig,
} from "../llm/providers/openaiLlmRuntimeConfig.js";
import { buildSonioxSpeechRuntimeConfig } from "../speech/providers/sonioxSpeechRuntimeConfig.js";

export const PIONERO_VOICE_READINESS_SNAPSHOT_VERSION =
  "pionero_voice_readiness_snapshot.v1";

const DEFAULT_ROOM_CLIENT_MODULE = "@livekit/rtc-node";
const SENSITIVE_VALUE_PATTERNS = [
  "token",
  "secret",
  "rawaudio",
  "audiobase64",
  "audiochunk",
  "apikey",
  "apisecret",
  "jwt",
];

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function isEnabled(value = "") {
  return ["1", "true"].includes(s(value).toLowerCase());
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? Math.floor(next) : fallback;
}

function safeText(value = "") {
  const normalized = s(value);
  const folded = normalized.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (SENSITIVE_VALUE_PATTERNS.some((pattern) => folded.includes(pattern))) {
    return "[redacted]";
  }

  return normalized.replace(/[\u0000-\u001f\u007f]+/g, " ").slice(0, 160);
}

function safeCode(value = "") {
  return s(value)
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 160);
}

function component({
  name,
  provider,
  ok = false,
  configured = false,
  enabled = false,
  status = "",
  reasonCode = "",
  metadata = {},
} = {}) {
  return {
    name: safeText(name),
    provider: safeText(provider),
    ok: ok === true,
    configured: configured === true,
    enabled: enabled === true,
    status: safeCode(status || (ok ? "ready" : "blocked")),
    reasonCode: safeCode(reasonCode),
    metadata,
  };
}

function summarizeSpeechLoopSmoke(result = null) {
  if (!result || typeof result !== "object") {
    return component({
      name: "speechLoopSmoke",
      provider: "pionero",
      ok: false,
      configured: false,
      enabled: false,
      status: "not_run",
      reasonCode: "pionero_speech_loop_smoke_not_run",
    });
  }

  const status = safeCode(result.status);
  const skipped = status === "skipped";
  const passed = result.ok === true && status === "passed";

  return component({
    name: "speechLoopSmoke",
    provider: "pionero",
    ok: passed,
    configured: true,
    enabled: !skipped,
    status: status || (passed ? "passed" : "unknown"),
    reasonCode:
      result.reasonCode ||
      (skipped ? "pionero_speech_loop_smoke_skipped" : ""),
    metadata: {
      transcriptObserved: result.transcriptObserved === true,
      llmNetworkIo: result.llmNetworkIo === true,
      ttsSeedAudioByteLength: n(result.ttsSeedAudioByteLength),
      ttsFinalAudioByteLength: n(result.ttsFinalAudioByteLength),
    },
  });
}

function summarizeOverall(components = []) {
  const required = components.filter((item) => item.name !== "speechLoopSmoke");
  const blocked = required.filter((item) => item.ok !== true);
  const validation = components.find((item) => item.name === "speechLoopSmoke");

  if (blocked.length > 0) {
    return {
      ok: false,
      status: "blocked",
      reasonCode: blocked[0]?.reasonCode || "pionero_voice_readiness_blocked",
      blockers: blocked.map((item) => ({
        name: item.name,
        reasonCode: item.reasonCode,
      })),
    };
  }

  if (!validation || validation.ok !== true) {
    return {
      ok: false,
      status: "degraded",
      reasonCode:
        validation?.reasonCode || "pionero_speech_loop_smoke_not_passed",
      blockers: [],
    };
  }

  return {
    ok: true,
    status: "ready",
    reasonCode: "",
    blockers: [],
  };
}

export function buildPioneroVoiceReadinessSnapshot({
  env = process.env,
  speechLoopSmokeResult = null,
  now = () => new Date().toISOString(),
} = {}) {
  const liveKitConfig = readPioneroLiveKitAgentConfig(env);
  const liveKitPlan = buildPioneroLiveKitAgentPlan({
    env,
    config: liveKitConfig,
  });
  const roomClientEnabled = isEnabled(env.PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED);

  const sonioxConfig = buildSonioxSpeechRuntimeConfig({ env });
  const openAiConfig = readOpenAiLlmRuntimeConfig({ env });
  const openAiCredentialConfigured = !!readOpenAiApiKey({ env });

  const components = [
    component({
      name: "livekit",
      provider: "livekit",
      ok: liveKitPlan.configured === true && roomClientEnabled,
      configured: liveKitPlan.configured === true,
      enabled: roomClientEnabled,
      status: liveKitPlan.configured && roomClientEnabled ? "ready" : "blocked",
      reasonCode: liveKitPlan.configured
        ? (roomClientEnabled ? "" : "pionero_livekit_room_client_disabled")
        : "livekit_config_missing",
      metadata: {
        roomClientModule: safeText(
          env.PIONERO_LIVEKIT_ROOM_CLIENT_MODULE || DEFAULT_ROOM_CLIENT_MODULE
        ),
        agentIdentity: safeText(liveKitPlan.agentIdentity),
        roomName: safeText(liveKitPlan.roomName),
      },
    }),
    component({
      name: "sonioxStt",
      provider: "soniox",
      ok: sonioxConfig.configured === true,
      configured: sonioxConfig.configured === true,
      enabled: sonioxConfig.configured === true,
      status: sonioxConfig.configured ? "ready" : "blocked",
      reasonCode: sonioxConfig.reasonCode,
      metadata: {
        model: safeText(sonioxConfig.stt?.model),
        language: safeText(sonioxConfig.stt?.language),
        sampleRateHz: n(sonioxConfig.stt?.sampleRateHz),
      },
    }),
    component({
      name: "sonioxTts",
      provider: "soniox",
      ok: sonioxConfig.configured === true,
      configured: sonioxConfig.configured === true,
      enabled: sonioxConfig.configured === true,
      status: sonioxConfig.configured ? "ready" : "blocked",
      reasonCode: sonioxConfig.reasonCode,
      metadata: {
        model: safeText(sonioxConfig.tts?.model),
        voice: safeText(sonioxConfig.tts?.voice),
        language: safeText(sonioxConfig.tts?.language),
      },
    }),
    component({
      name: "openaiComposer",
      provider: "openai",
      ok: openAiConfig.configured === true && openAiConfig.enabled === true,
      configured: openAiCredentialConfigured,
      enabled: openAiConfig.enabled === true,
      status:
        openAiConfig.configured && openAiConfig.enabled ? "ready" : "blocked",
      reasonCode: openAiConfig.reasonCode,
      metadata: {
        model: safeText(openAiConfig.model),
        maxOutputTokens: n(openAiConfig.maxOutputTokens),
      },
    }),
    summarizeSpeechLoopSmoke(speechLoopSmokeResult),
  ];

  const overall = summarizeOverall(components);

  return {
    version: PIONERO_VOICE_READINESS_SNAPSHOT_VERSION,
    checkedAt: safeText(typeof now === "function" ? now() : now),
    ok: overall.ok,
    status: overall.status,
    reasonCode: overall.reasonCode,
    blockers: overall.blockers,
    components,
  };
}