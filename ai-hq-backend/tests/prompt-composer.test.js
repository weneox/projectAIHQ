import assert from "node:assert/strict";
import test from "node:test";

import { composePromptLayers } from "../src/services/promptComposer.js";
import { buildPromptBundle } from "../src/services/promptBundle.js";

function buildTenantBehavior() {
  return {
    tenantKey: "acme",
    tenantId: "tenant-1",
    companyName: "Acme Clinic",
    brandName: "Acme Clinic",
    industryKey: "beauty",
    defaultLanguage: "en",
    outputLanguage: "en",
    tone: ["warm_premium_reassuring"],
    services: ["Consultation"],
    audiences: ["High-intent clients"],
    behavior: {
      niche: "beauty",
      conversionGoal: "book_consultation",
      primaryCta: "book your consultation",
      toneProfile: "warm_premium_reassuring",
      disallowedClaims: ["instant_result_guarantees"],
      handoffTriggers: ["medical_claim", "human_request"],
      channelBehavior: {
        inbox: {
          primaryAction: "qualify_then_book",
          qualificationDepth: "guided",
        },
        content: {
          primaryAction: "educate_then_convert",
          contentAngle: "expert_reassurance",
          ctaMode: "consultation_booking",
        },
      },
    },
  };
}

test("prompt composer builds different channel layers for inbox and content", () => {
  const tenant = buildTenantBehavior();
  const inbox = composePromptLayers({
    foundation: "Foundation prompt",
    industry: "Beauty prompt",
    usecase: "Inbox reply prompt",
    tenantContext: "Tenant context",
    tenant,
    event: "inbox.reply",
    usecaseKey: "inbox.reply",
  });
  const content = composePromptLayers({
    foundation: "Foundation prompt",
    industry: "Beauty prompt",
    usecase: "Content analyze prompt",
    tenantContext: "Tenant context",
    tenant,
    event: "content.analyze",
    usecaseKey: "content.analyze",
  });

  assert.equal(inbox.channelKey, "inbox");
  assert.equal(content.channelKey, "content");
  assert.match(inbox.fullPrompt, /qualify_then_book/);
  assert.match(content.fullPrompt, /expert_reassurance/);
  assert.doesNotMatch(inbox.fullPrompt, /expert_reassurance/);
});

test("prompt bundle exposes layered runtime, policy, and output-contract hints", () => {
  const bundle = buildPromptBundle("content.analyze", {
    tenant: buildTenantBehavior(),
    today: "2026-03-29",
    format: "carousel",
    extra: {
      outputContract: {
        mode: "json",
        schemaKey: "content_analysis",
        strictJson: true,
        hint: "Return strict JSON only.",
      },
      policy: {
        contentReviewRequired: true,
        reviewBias: "human_review_required",
      },
    },
  });

  const layerKeys = bundle.layers.map((layer) => layer.key);
  assert.ok(layerKeys.includes("foundation"));
  assert.ok(layerKeys.includes("runtime_behavior"));
  assert.ok(layerKeys.includes("channel_behavior"));
  assert.ok(layerKeys.includes("policy"));
  assert.ok(layerKeys.includes("output_contract"));
  assert.equal(bundle.channelKey, "content");
  assert.match(bundle.fullPrompt, /book_consultation/);
  assert.match(bundle.fullPrompt, /instant_result_guarantees/);
  assert.match(bundle.fullPrompt, /schemaKey: content_analysis/);
});
