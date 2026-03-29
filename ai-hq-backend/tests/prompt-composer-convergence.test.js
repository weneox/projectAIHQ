import assert from "node:assert/strict";
import test from "node:test";

import { buildCommentClassifierPrompt } from "../src/services/commentBrain/classifier.js";
import { buildVoiceConfigFromProjectedRuntime } from "../src/routes/api/voice/config.js";
import {
  buildPromptExtra,
  buildTenantRuntime,
} from "../src/services/n8nNotify.js";
import { buildPromptBundle } from "../src/services/promptBundle.js";
import { buildContentBehaviorProfile } from "../src/services/contentBehaviorRuntime.js";

function buildBehavior() {
  return {
    niche: "beauty",
    conversionGoal: "book_consultation",
    primaryCta: "book your consultation",
    toneProfile: "warm_premium_reassuring",
    disallowedClaims: ["instant_result_guarantees"],
    handoffTriggers: ["medical_claim", "human_request"],
    channelBehavior: {
      comments: {
        primaryAction: "qualify_then_dm",
      },
      voice: {
        primaryAction: "qualify_then_book",
        qualificationDepth: "extended",
        handoffBias: "expedited",
      },
      media: {
        primaryAction: "show_premium_transformation",
        visualDirection: "premium_clinical_trust",
      },
    },
  };
}

test("comments classifier prompt uses layered shared composer output", () => {
  const prompt = buildCommentClassifierPrompt({
    tenantKey: "acme",
    resolvedRuntime: {
      industry: "beauty",
      language: "en",
      services: ["Consultation"],
      disabledServices: [],
      serviceCatalog: [],
      businessSummary: "Premium consultation clinic",
      tone: "warm_premium_reassuring",
      toneProfile: "warm_premium_reassuring",
      primaryCta: "book your consultation",
      preferredCta: "book your consultation",
      conversionGoal: "book_consultation",
      disallowedClaims: ["instant_result_guarantees"],
      handoffTriggers: ["medical_claim", "human_request"],
      channelBehavior: {
        comments: {
          primaryAction: "qualify_then_dm",
        },
      },
      commentPolicy: {},
      bannedPhrases: [],
    },
    channel: "instagram",
    externalUserId: "u1",
    externalUsername: "anna",
    customerName: "Anna",
    commentText: "Can you guarantee instant results?",
  });

  assert.match(prompt, /Approved Runtime Behavior:/);
  assert.match(prompt, /Channel Behavior:/);
  assert.match(prompt, /qualify_then_dm/);
  assert.match(prompt, /instant_result_guarantees/);
});

test("voice realtime instructions use layered shared composer output", () => {
  const voiceConfig = buildVoiceConfigFromProjectedRuntime(
    {
      authority: { tenantId: "tenant-1", tenantKey: "acme" },
      tenant: {
        tenantId: "tenant-1",
        tenantKey: "acme",
        companyName: "Acme Clinic",
        mainLanguage: "en",
        industryKey: "beauty",
      },
      channels: {
        voice: {
          profile: {
            businessSummary: "Premium consultation clinic",
          },
          contact: {},
        },
      },
      operational: {
        voice: {
          operator: {},
          operatorRouting: {},
          realtime: {
            instructions: "Base instruction.",
          },
          contact: {},
        },
      },
      behavior: buildBehavior(),
    },
    { tenantKey: "acme", toNumber: "+15550001111" }
  );

  assert.match(voiceConfig.realtime.instructions, /Foundation:/);
  assert.match(voiceConfig.realtime.instructions, /Channel Behavior:/);
  assert.match(voiceConfig.realtime.instructions, /qualify_then_book/);
  assert.match(voiceConfig.realtime.instructions, /book your consultation/);
});

test("content media prompt path uses shared composer with media channel hints", () => {
  const runtimeBehavior = buildContentBehaviorProfile({
    behavior: buildBehavior(),
    executionPolicy: { posture: { affectedSurfaces: ["content"] } },
  });
  const tenant = buildTenantRuntime(
    { id: "proposal-1", tenant_key: "acme", tenant_id: "tenant-1" },
    { runtimeBehavior }
  );
  const promptExtra = buildPromptExtra({
    proposal: { id: "proposal-1", tenant_key: "acme", tenant_id: "tenant-1" },
    extra: {
      runtimeBehavior,
      format: "reel",
      contentPack: { format: "reel" },
    },
    media: { format: "reel", contentPack: { format: "reel" } },
    workflowHint: "runway_reel",
    mappedEvent: "proposal.approved",
  });
  const bundle = buildPromptBundle("proposal.approved", {
    tenant,
    today: "2026-03-29",
    format: "reel",
    extra: promptExtra,
  });

  assert.equal(bundle.channelKey, "media");
  assert.match(bundle.fullPrompt, /Output Contract:/);
  assert.match(bundle.fullPrompt, /schemaKey: content_draft/);
  assert.match(bundle.fullPrompt, /premium_clinical_trust/);
});
