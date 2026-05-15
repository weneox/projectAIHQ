import { createVoiceProviderDescriptor } from "./contract.js";

export const twilioVoiceProvider = createVoiceProviderDescriptor({
  id: "twilio",
  label: "Twilio",
  status: "ready",
  runtimeReady: true,
  supportsInboundCalls: true,
  supportsMediaStream: true,
  supportsTransfers: true,
  supportsNumberProvisioning: true,
  supportsExternalNumberOwnership: true,
  supportsRoutingTest: true,
  activationModes: ["twilio_number", "call_forwarding", "hosted_number"],
  verificationMethods: ["voice_code", "sms_code", "manual_admin", "system_import"],
  routingMethods: ["twilio_webhook", "call_forwarding", "test_call"],
  notes: [
    "Current production phone provider adapter.",
    "Existing /twilio routes remain unchanged.",
  ],
});
