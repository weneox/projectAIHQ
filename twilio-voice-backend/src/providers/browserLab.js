import { createVoiceProviderDescriptor } from "./contract.js";

export const browserLabVoiceProvider = createVoiceProviderDescriptor({
  id: "browser_lab",
  label: "Browser Voice Lab",
  status: "ready",
  runtimeReady: true,
  supportsInboundCalls: false,
  supportsMediaStream: false,
  supportsTransfers: false,
  supportsNumberProvisioning: false,
  supportsExternalNumberOwnership: false,
  supportsRoutingTest: false,
  supportsBrowserLab: true,
  activationModes: ["browser_lab"],
  verificationMethods: ["manual_admin", "system_import"],
  routingMethods: ["browser_realtime_test"],
  notes: [
    "Used to test how the assistant speaks before a real phone provider is live.",
    "This must remain available while SIP and Twilio adapters evolve.",
  ],
});
