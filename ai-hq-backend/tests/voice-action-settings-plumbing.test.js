import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeVoiceSettingsInput,
} from "../src/modules/voice/settings.js";
import {
  normalizeSettingsInput,
} from "../src/routes/api/voice/utils.js";
import {
  buildOperationalChannels,
} from "../src/services/operationalChannels.js";

test("voice settings preserve explicit action config in meta actions", () => {
  const settings = normalizeVoiceSettingsInput({
    enabled: true,
    provider: "browser_lab",
    defaultLanguage: "az",
    actions: {
      businessType: "restaurant",
      ordering: { mode: "request_only" },
      reservation: { mode: "request_only" },
      availability: { mode: "disabled" },
      appointment: { mode: "disabled" },
      handoff: { mode: "request_only" },
    },
  });

  assert.equal(settings.actions.businessType, "restaurant");
  assert.equal(settings.actions.orderingMode, "request_only");
  assert.equal(settings.actions.reservationMode, "request_only");
  assert.equal(settings.actions.availabilityMode, "disabled");
  assert.deepEqual(settings.meta.actions, settings.actions);
});

test("voice route settings normalization delegates to module owner", () => {
  const payload = {
    enabled: true,
    provider: "browser_lab",
    defaultLanguage: "az",
    actions: {
      businessType: "restaurant",
      ordering: { mode: "request_only" },
      reservation: { mode: "request_only" },
      availability: { mode: "disabled" },
      appointment: { mode: "disabled" },
      handoff: { mode: "request_only" },
    },
    meta: {
      source: "test",
    },
  };

  assert.deepEqual(normalizeSettingsInput(payload), normalizeVoiceSettingsInput(payload));
});

test("operational voice runtime exposes explicit action config", async () => {
  const settings = normalizeVoiceSettingsInput({
    enabled: true,
    provider: "browser_lab",
    displayName: "Demo Restaurant",
    defaultLanguage: "az",
    actions: {
      businessType: "restaurant",
      ordering: { mode: "request_only" },
      reservation: { mode: "request_only" },
      availability: { mode: "disabled" },
      appointment: { mode: "disabled" },
      handoff: { mode: "request_only" },
    },
  });

  const operational = await buildOperationalChannels({
    voiceSettings: settings,
    tenantRow: {
      company_name: "Demo Restaurant",
      default_language: "az",
    },
  });

  assert.equal(operational.voice.actions.businessType, "restaurant");
  assert.equal(operational.voice.actions.orderingMode, "request_only");
  assert.equal(operational.voice.actions.reservationMode, "request_only");
  assert.equal(operational.voice.actions.availabilityMode, "disabled");
});
