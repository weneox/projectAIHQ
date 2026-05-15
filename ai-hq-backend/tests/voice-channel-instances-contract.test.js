import test from "node:test";
import assert from "node:assert/strict";

import { validateVoiceOperationalResponse } from "@aihq/shared-contracts/operations";

import { buildOperationalChannels } from "../src/services/operationalChannels.js";
import { buildVoiceConfigFromProjectedRuntime } from "../src/modules/voice/config.js";

test("voice operational contract exposes multiple provider channel instances", async () => {
  const operationalChannels = await buildOperationalChannels({
    tenantRow: {
      company_name: "Clinic A",
      default_language: "az",
    },
    voiceSettings: {
      enabled: true,
      provider: "twilio",
      mode: "assistant",
      displayName: "Clinic A voice",
      defaultLanguage: "az",
      twilioPhoneNumber: "+15551234567",
      twilioPhoneSid: "PN123",
      twilioConfig: {
        callerId: "+15551234567",
      },
      meta: {
        realtimeVoice: "alloy",
        operatorRouting: {
          mode: "department",
          defaultDepartment: "reception",
          departments: {
            reception: {
              enabled: true,
              label: "Reception",
              phone: "+994501112233",
              keywords: ["reception"],
            },
          },
        },
        voiceChannels: [
          {
            id: "sip-local-reception",
            provider: "sip",
            label: "Local reception",
            externalNumber: "+994501112233",
            routeKey: "reception",
            enabled: true,
            defaultLanguage: "az",
            providerConfig: {
              trunk: "local-sip",
            },
          },
        ],
      },
    },
  });

  assert.equal(operationalChannels.voice.ready, true);
  assert.equal(operationalChannels.voice.provider, "twilio");
  assert.equal(operationalChannels.voice.channels.length, 2);
  assert.equal(operationalChannels.voice.readyChannelCount, 1);
  assert.deepEqual(operationalChannels.voice.providers, ["twilio", "sip"]);

  const twilioChannel = operationalChannels.voice.channels.find(
    (channel) => channel.provider === "twilio"
  );
  const sipChannel = operationalChannels.voice.channels.find(
    (channel) => channel.provider === "sip"
  );

  assert.equal(twilioChannel.ready, true);
  assert.equal(twilioChannel.externalNumber, "+15551234567");
  assert.equal(sipChannel.ready, false);
  assert.equal(sipChannel.reasonCode, "voice_provider_adapter_pending");

  const checked = validateVoiceOperationalResponse({
    ok: true,
    operationalChannels,
  });

  assert.equal(checked.ok, true);
  assert.equal(checked.value.operationalChannels.voice.channels.length, 2);
  assert.equal(
    checked.value.operationalChannels.voice.channels[1].providerConfig.trunk,
    "local-sip"
  );

  const voiceConfig = buildVoiceConfigFromProjectedRuntime(
    {
      tenant: {
        tenantId: "tenant-1",
        tenantKey: "clinic-a",
        companyName: "Clinic A",
        mainLanguage: "az",
      },
      authority: {
        available: true,
        source: "approved_runtime_projection",
        tenantId: "tenant-1",
        tenantKey: "clinic-a",
        runtimeProjectionId: "projection-1",
      },
      channels: {
        voice: {
          profile: {
            defaultLanguage: "az",
            businessSummary: "Clinic reception and booking.",
          },
          contact: {
            phoneIntl: "+994501112233",
          },
        },
      },
      operational: {
        voice: checked.value.operationalChannels.voice,
      },
    },
    {
      tenantKey: "clinic-a",
      toNumber: "+15551234567",
    }
  );

  assert.equal(voiceConfig.voiceChannels.length, 2);
  assert.equal(voiceConfig.activeVoiceChannelId, twilioChannel.id);
});

test("voice config resolves active channel by provider and toNumber", async () => {
  const operationalChannels = await buildOperationalChannels({
    tenantRow: {
      company_name: "Clinic A",
      default_language: "az",
    },
    voiceSettings: {
      enabled: true,
      provider: "twilio",
      twilioPhoneNumber: "+15551234567",
      meta: {
        voiceChannels: [
          {
            id: "sip-local-reception",
            provider: "sip",
            label: "Local reception",
            externalNumber: "+994501112233",
            routeKey: "reception",
            enabled: true,
            defaultLanguage: "az",
          },
        ],
      },
    },
  });

  const checked = validateVoiceOperationalResponse({
    ok: true,
    operationalChannels,
  });

  assert.equal(checked.ok, true);

  const sipConfig = buildVoiceConfigFromProjectedRuntime(
    {
      tenant: {
        tenantId: "tenant-1",
        tenantKey: "clinic-a",
        companyName: "Clinic A",
        mainLanguage: "az",
      },
      authority: {
        available: true,
        source: "approved_runtime_projection",
        tenantId: "tenant-1",
        tenantKey: "clinic-a",
        runtimeProjectionId: "projection-1",
      },
      channels: {
        voice: {
          profile: {
            defaultLanguage: "az",
          },
        },
      },
      operational: {
        voice: checked.value.operationalChannels.voice,
      },
    },
    {
      tenantKey: "clinic-a",
      provider: "sip",
      toNumber: "+994501112233",
    }
  );

  assert.equal(sipConfig.activeVoiceChannelId, "sip-local-reception");
  assert.equal(sipConfig.activeVoiceChannel.id, "sip-local-reception");
  assert.equal(sipConfig.match.provider, "sip");
  assert.equal(sipConfig.match.voiceChannelId, "sip-local-reception");
});

test("voice channel contract carries number connection lifecycle", async () => {
  const operationalChannels = await buildOperationalChannels({
    tenantRow: {
      company_name: "Restaurant A",
      default_language: "az",
    },
    voiceSettings: {
      enabled: true,
      provider: "twilio",
      twilioPhoneNumber: "+15551234567",
      meta: {
        voiceChannels: [
          {
            id: "restaurant-main-sip",
            provider: "sip",
            label: "Restaurant main line",
            externalNumber: "+994501112233",
            enabled: true,
            routeKey: "orders",
            activationMode: "sip_trunk",
            ownershipStatus: "verified",
            verificationMethod: "voice_code",
            routingStatus: "test_pending",
            routing: {
              lastTestCallAt: "2026-05-15T18:00:00.000Z",
            },
          },
        ],
      },
    },
  });

  const channel = operationalChannels.voice.channels.find(
    (entry) => entry.id === "restaurant-main-sip"
  );

  assert.equal(channel.activationMode, "sip_trunk");
  assert.equal(channel.ownershipStatus, "verified");
  assert.equal(channel.verificationMethod, "voice_code");
  assert.equal(channel.routingStatus, "test_pending");
  assert.equal(channel.connectionStatus, "provider_pending");
  assert.equal(channel.connectionNextAction, "connect_provider");
  assert.equal(channel.connectionReady, false);
  assert.equal(channel.verification.verified, true);
  assert.equal(channel.routing.lastTestCallAt, "2026-05-15T18:00:00.000Z");

  const checked = validateVoiceOperationalResponse({
    ok: true,
    operationalChannels,
  });

  assert.equal(checked.ok, true);

  const checkedChannel = checked.value.operationalChannels.voice.channels.find(
    (entry) => entry.id === "restaurant-main-sip"
  );

  assert.equal(checkedChannel.activationMode, "sip_trunk");
  assert.equal(checkedChannel.ownershipStatus, "verified");
  assert.equal(checkedChannel.routingStatus, "test_pending");
  assert.equal(checkedChannel.connectionStatus, "provider_pending");
  assert.equal(checkedChannel.verification.method, "voice_code");
  assert.equal(checkedChannel.routing.lastTestCallAt, "2026-05-15T18:00:00.000Z");
});
