import { browserLabVoiceProvider } from "./browserLab.js";
import { sipVoiceProvider } from "./sip.js";
import { twilioVoiceProvider } from "./twilio.js";
import { normalizeVoiceProviderId } from "./contract.js";

export {
  VOICE_ACTIVATION_MODES,
  VOICE_PROVIDER_IDS,
  assertVoiceProviderDescriptor,
  createVoiceProviderDescriptor,
  normalizeActivationMode,
  normalizeVoiceProviderId,
} from "./contract.js";

export const voiceProviderDescriptors = Object.freeze([
  twilioVoiceProvider,
  sipVoiceProvider,
  browserLabVoiceProvider,
]);

export function listVoiceProviderDescriptors() {
  return voiceProviderDescriptors.map((provider) => ({ ...provider }));
}

export function getVoiceProviderDescriptor(providerId = "") {
  const id = normalizeVoiceProviderId(providerId);
  return voiceProviderDescriptors.find((provider) => provider.id === id) || null;
}

export function isVoiceProviderRuntimeReady(providerId = "") {
  return getVoiceProviderDescriptor(providerId)?.runtimeReady === true;
}
