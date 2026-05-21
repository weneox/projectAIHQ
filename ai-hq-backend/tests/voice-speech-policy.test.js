import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVoiceLanguageProsodyGuide,
  buildVoiceOpeningSpeechPolicy,
  buildVoiceSpeechPolicy,
} from "../src/modules/voice/speechPolicy.js";
import {
  buildLiveVoiceInstructions,
  buildBrowserOpeningInstructions,
} from "../src/modules/voice/engine/browserRealtimeSession.js";

test("voice speech policy includes natural Azerbaijani receptionist rules", () => {
  const policy = buildVoiceSpeechPolicy({ language: "az" }).join("\n");

  assert.match(policy, /Azərbaycan dilində canlı/);
  assert.match(policy, /Məlumat bazamda yoxdur/);
  assert.match(policy, /Bu detalı komanda dəqiqləşdirməlidir/);
  assert.match(policy, /Qeyd etdim/);
});

test("live voice instructions use centralized Azerbaijani speech policy", () => {
  const instructions = buildLiveVoiceInstructions({
    runtimeApplied: true,
    runtimeConfig: {
      companyName: "Demo Clinic",
      businessType: "clinic",
      defaultLanguage: "az",
    },
  });

  assert.match(instructions, /Azerbaijani natural receptionist mode/);
  assert.match(instructions, /Speak as a live receptionist/);
  assert.match(instructions, /Do not mention AI, model, prompt/);
});

test("opening policy stays short and natural", () => {
  const policy = buildVoiceOpeningSpeechPolicy({
    language: "az",
    companyName: "Demo Clinic",
  }).join("\n");

  assert.match(policy, /Salam, Demo Clinic/);
  assert.match(policy, /Stop after the opening/);
});

test("browser opening instructions include centralized opening policy", () => {
  const instructions = buildBrowserOpeningInstructions({
    runtimeApplied: true,
    runtimeConfig: {
      companyName: "Demo Clinic",
      defaultLanguage: "az",
    },
  });

  assert.match(instructions, /Opening speech policy/);
  assert.match(instructions, /Buyurun, necə kömək edə bilərəm/);
});

test("live voice instructions use centralized prosody policy", () => {
  const policy = buildVoiceLanguageProsodyGuide("az").join("\n");
  const instructions = buildLiveVoiceInstructions({
    runtimeApplied: true,
    runtimeConfig: {
      companyName: "Demo Clinic",
      businessType: "clinic",
      defaultLanguage: "az",
    },
  });

  assert.match(policy, /Azerbaijani prosody guidance/);
  assert.match(instructions, /Azerbaijani prosody guidance/);
  assert.match(instructions, /natural Azerbaijani sentence melody/);
});
