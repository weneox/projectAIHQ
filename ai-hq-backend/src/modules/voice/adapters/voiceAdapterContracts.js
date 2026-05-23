function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export const VOICE_TRANSPORT_ADAPTER_CONTRACT_VERSION =
  "voice_transport_adapter_contract.v1";

export const VOICE_TRANSPORT_PROVIDERS = Object.freeze([
  "browser",
  "twilio",
  "livekit",
  "sip",
  "unknown",
]);

export function normalizeVoiceTransportProvider(value = "", fallback = "unknown") {
  const raw = s(value || fallback)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (["browser", "browser_lab", "browserlab", "browser_adapter", "pre_sip_browser"].includes(raw)) {
    return "browser";
  }

  if (["twilio", "twilio_voice", "twilio_pstn"].includes(raw)) {
    return "twilio";
  }

  if (["livekit", "livekit_sip", "livekit_agents"].includes(raw)) {
    return "livekit";
  }

  if (["sip", "sip_trunk", "sip_provider"].includes(raw)) {
    return "sip";
  }

  return VOICE_TRANSPORT_PROVIDERS.includes(raw) ? raw : "unknown";
}

export function buildVoiceTransportAdapterContract({
  provider = "",
  channel = {},
  runtimeConfig = {},
} = {}) {
  const item = obj(channel);
  const runtime = obj(runtimeConfig);
  const normalizedProvider = normalizeVoiceTransportProvider(
    provider ||
      item.provider ||
      runtime.provider ||
      runtime.voiceProvider ||
      runtime.transportProvider
  );

  const isBrowserLab = normalizedProvider === "browser";
  const isTelephony = ["twilio", "livekit", "sip"].includes(normalizedProvider);
  const isRealtimeCapable = ["browser", "livekit"].includes(normalizedProvider);

  return {
    version: VOICE_TRANSPORT_ADAPTER_CONTRACT_VERSION,
    provider: normalizedProvider,
    rawProvider: s(provider || item.provider || runtime.provider),
    transport:
      normalizedProvider === "browser"
        ? "webrtc"
        : normalizedProvider === "twilio"
          ? "pstn"
          : normalizedProvider === "livekit"
            ? "livekit"
            : normalizedProvider === "sip"
              ? "sip"
              : "unknown",
    browserLab: isBrowserLab,
    telephony: isTelephony,
    realtimeCapable: isRealtimeCapable,
    requiresSipProvider: ["twilio", "livekit", "sip"].includes(normalizedProvider),
    requiresExternalSpeechAdapter: ["livekit", "sip"].includes(normalizedProvider),
    productionReady: normalizedProvider !== "browser" && normalizedProvider !== "unknown",
    reasonCode:
      normalizedProvider === "unknown"
        ? "voice_transport_provider_unknown"
        : isBrowserLab
          ? "browser_voice_lab_adapter"
          : "",
  };
}
