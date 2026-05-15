import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVoiceSettingsInputWithChannels,
  confirmVoiceChannelVerification,
  createVoiceChannelConnection,
  listVoiceChannelsFromSettings,
  startVoiceChannelRoutingTest,
  startVoiceChannelVerification,
} from "../src/modules/voice/channelConnection.js";

test("voice channel connection helpers support add verify and routing test lifecycle", () => {
  const settings = {
    enabled: true,
    provider: "twilio",
    mode: "assistant",
    defaultLanguage: "az",
    meta: {},
  };

  const created = createVoiceChannelConnection(settings, {
    provider: "sip",
    label: "Restaurant main line",
    externalNumber: "+994501112233",
    routeKey: "orders",
    activationMode: "sip_trunk",
  });

  assert.equal(created.channel.provider, "sip");
  assert.equal(created.channel.ownershipStatus, "unverified");
  assert.equal(created.channel.routingStatus, "not_connected");
  assert.equal(created.channel.connectionStatus, "verify_number");

  const nextSettings = buildVoiceSettingsInputWithChannels(
    settings,
    created.channels
  );

  assert.equal(listVoiceChannelsFromSettings(nextSettings).length, 1);

  const verification = startVoiceChannelVerification(
    nextSettings,
    created.channel.id,
    { method: "voice_code" }
  );

  assert.equal(verification.channel.ownershipStatus, "pending");
  assert.equal(verification.channel.verification.method, "voice_code");

  const confirmed = confirmVoiceChannelVerification(
    buildVoiceSettingsInputWithChannels(nextSettings, verification.channels),
    created.channel.id,
    { confirmed: true }
  );

  assert.equal(confirmed.channel.ownershipStatus, "verified");
  assert.equal(confirmed.channel.verification.verified, true);
  assert.equal(confirmed.channel.connectionStatus, "connect_routing");

  const routing = startVoiceChannelRoutingTest(
    buildVoiceSettingsInputWithChannels(nextSettings, confirmed.channels),
    created.channel.id,
    {}
  );

  assert.equal(routing.channel.routingStatus, "test_pending");
  assert.equal(routing.channel.routing.status, "test_pending");
  assert.equal(routing.channel.connectionStatus, "connect_routing");
  assert.ok(routing.channel.routing.lastTestCallAt);
});

test("voice channel connection helper rejects duplicate provider number", () => {
  const settings = {
    meta: {
      voiceChannels: [
        {
          id: "sip:+994501112233",
          provider: "sip",
          externalNumber: "+994501112233",
        },
      ],
    },
  };

  assert.throws(
    () =>
      createVoiceChannelConnection(settings, {
        provider: "sip",
        externalNumber: "994 50 111 22 33",
      }),
    /voice_channel_already_exists/
  );
});
