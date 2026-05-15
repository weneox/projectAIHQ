import { createVoiceProviderDescriptor } from "./contract.js";

export const sipVoiceProvider = createVoiceProviderDescriptor({
  id: "sip",
  label: "Local SIP",
  status: "adapter_pending",
  runtimeReady: false,
  supportsInboundCalls: true,
  supportsMediaStream: false,
  supportsTransfers: false,
  supportsNumberProvisioning: false,
  supportsExternalNumberOwnership: true,
  supportsRoutingTest: true,
  activationModes: ["sip_trunk", "call_forwarding", "ported_number"],
  verificationMethods: ["voice_code", "test_call", "provider_document", "manual_admin"],
  routingMethods: ["sip_trunk", "call_forwarding", "test_call"],
  notes: [
    "Target adapter for local SIP numbers.",
    "Runtime is intentionally pending until SIP media bridge work starts.",
  ],
});
