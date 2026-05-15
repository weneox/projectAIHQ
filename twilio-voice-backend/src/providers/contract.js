function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function bool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export const VOICE_PROVIDER_IDS = Object.freeze([
  "twilio",
  "sip",
  "browser_lab",
]);

export const VOICE_ACTIVATION_MODES = Object.freeze([
  "twilio_number",
  "sip_trunk",
  "call_forwarding",
  "hosted_number",
  "ported_number",
  "browser_lab",
  "manual",
]);

export function normalizeVoiceProviderId(value = "") {
  const provider = lower(value || "twilio");
  if (provider === "browser" || provider === "browserlab") return "browser_lab";
  return VOICE_PROVIDER_IDS.includes(provider) ? provider : "";
}

export function normalizeActivationMode(value = "") {
  const mode = lower(value);
  return VOICE_ACTIVATION_MODES.includes(mode) ? mode : "";
}

export function createVoiceProviderDescriptor(input = {}) {
  const id = normalizeVoiceProviderId(input.id);
  if (!id) {
    throw new Error("voice_provider_id_invalid");
  }

  const activationModes = arr(input.activationModes)
    .map((entry) => normalizeActivationMode(entry))
    .filter(Boolean);

  if (!activationModes.length) {
    throw new Error("voice_provider_activation_modes_required");
  }

  return Object.freeze({
    id,
    label: s(input.label || id),
    status: lower(input.status || "adapter_pending"),
    runtimeReady: bool(input.runtimeReady, false),
    supportsInboundCalls: bool(input.supportsInboundCalls, false),
    supportsMediaStream: bool(input.supportsMediaStream, false),
    supportsTransfers: bool(input.supportsTransfers, false),
    supportsNumberProvisioning: bool(input.supportsNumberProvisioning, false),
    supportsExternalNumberOwnership: bool(input.supportsExternalNumberOwnership, false),
    supportsRoutingTest: bool(input.supportsRoutingTest, false),
    supportsBrowserLab: bool(input.supportsBrowserLab, false),
    activationModes,
    verificationMethods: arr(input.verificationMethods).map((entry) => lower(entry)).filter(Boolean),
    routingMethods: arr(input.routingMethods).map((entry) => lower(entry)).filter(Boolean),
    notes: arr(input.notes).map((entry) => s(entry)).filter(Boolean),
  });
}

export function assertVoiceProviderDescriptor(descriptor = {}) {
  const normalized = createVoiceProviderDescriptor(descriptor);

  return {
    ok: true,
    descriptor: normalized,
  };
}
