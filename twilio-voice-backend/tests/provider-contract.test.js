import test from "node:test";
import assert from "node:assert/strict";

import {
  getVoiceProviderDescriptor,
  isVoiceProviderRuntimeReady,
  listVoiceProviderDescriptors,
  normalizeVoiceProviderId,
} from "../src/providers/index.js";

test("voice provider registry exposes twilio sip and browser lab descriptors", () => {
  const providers = listVoiceProviderDescriptors();

  assert.deepEqual(
    providers.map((provider) => provider.id),
    ["twilio", "sip", "browser_lab"]
  );

  const twilio = getVoiceProviderDescriptor("twilio");
  const sip = getVoiceProviderDescriptor("sip");
  const browserLab = getVoiceProviderDescriptor("browser");

  assert.equal(twilio.runtimeReady, true);
  assert.equal(twilio.supportsMediaStream, true);
  assert.equal(twilio.activationModes.includes("twilio_number"), true);

  assert.equal(sip.runtimeReady, false);
  assert.equal(sip.status, "adapter_pending");
  assert.equal(sip.activationModes.includes("sip_trunk"), true);
  assert.equal(sip.supportsExternalNumberOwnership, true);

  assert.equal(browserLab.id, "browser_lab");
  assert.equal(browserLab.runtimeReady, true);
  assert.equal(browserLab.supportsBrowserLab, true);
  assert.equal(browserLab.activationModes.includes("browser_lab"), true);
});

test("voice provider registry normalizes provider aliases and readiness", () => {
  assert.equal(normalizeVoiceProviderId("browserlab"), "browser_lab");
  assert.equal(normalizeVoiceProviderId("browser"), "browser_lab");
  assert.equal(isVoiceProviderRuntimeReady("twilio"), true);
  assert.equal(isVoiceProviderRuntimeReady("browser_lab"), true);
  assert.equal(isVoiceProviderRuntimeReady("sip"), false);
});
