import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAnalyzeExtra,
  buildAnalyzeTenant,
} from "../src/routes/api/content/analysis.js";
import {
  buildPromptExtra,
  buildTenantRuntime,
} from "../src/services/n8nNotify.js";
import { buildContentBehaviorProfile } from "../src/services/contentBehaviorRuntime.js";

function buildApprovedRuntime() {
  return {
    behavior: {
      niche: "beauty",
      conversionGoal: "book_consultation",
      primaryCta: "book your consultation",
      toneProfile: "warm_premium_reassuring",
      disallowedClaims: ["instant_result_guarantees"],
      handoffTriggers: ["medical_claim", "human_request"],
      channelBehavior: {
        content: {
          primaryAction: "educate_then_convert",
          ctaMode: "consultation_booking",
          contentAngle: "expert_reassurance",
          reviewBias: "human_review_required",
        },
        media: {
          primaryAction: "show_premium_transformation",
          visualDirection: "premium_clinical_trust",
          ctaMode: "consultation_booking",
        },
      },
    },
    executionPolicy: {
      posture: {
        truthApprovalOutcome: "allowed_with_human_review",
        affectedSurfaces: ["content", "voice"],
        truthRiskLevel: "high",
      },
    },
  };
}

test("content analyze builders consume niche-aware runtime behavior", () => {
  const runtime = buildApprovedRuntime();
  const tenant = buildAnalyzeTenant({
    tenantKey: "acme",
    tenantId: "tenant-1",
    contentPack: {
      format: "carousel",
      visualTheme: "clean_clinic",
    },
    runtimeBehavior: runtime,
  });
  const extra = buildAnalyzeExtra({
    row: { id: "content-1", proposal_id: "proposal-1" },
    proposal: { id: "proposal-1" },
    contentPack: {},
    assetUrls: ["https://cdn.example/asset-1.jpg"],
    runtimeBehavior: runtime,
  });

  assert.equal(tenant.brand.industryKey, "beauty");
  assert.deepEqual(tenant.brand.tone, ["warm_premium_reassuring"]);
  assert.equal(tenant.brand.ctaStyle, "book your consultation");
  assert.equal(tenant.behavior.reviewBias, "human_review_required");
  assert.equal(extra.cta, "book your consultation");
  assert.equal(extra.behavior.contentAngle, "expert_reassurance");
  assert.equal(extra.reviewBias, "human_review_required");
  assert.deepEqual(extra.guardrails.disallowedClaims, [
    "instant_result_guarantees",
  ]);
});

test("n8n content/media payload builders carry runtime behavior guidance", () => {
  const runtimeBehavior = buildContentBehaviorProfile(buildApprovedRuntime());
  const proposal = {
    id: "proposal-1",
    tenant_key: "acme",
    tenant_id: "tenant-1",
    language: "en",
    title: "Consultation launch",
  };
  const tenantRuntime = buildTenantRuntime(proposal, {
    runtimeBehavior,
    format: "reel",
  });
  const promptExtra = buildPromptExtra({
    proposal,
    extra: {
      runtimeBehavior,
      format: "reel",
      contentPack: {
        format: "reel",
      },
    },
    media: {
      format: "reel",
      aspectRatio: "9:16",
      contentPack: { format: "reel" },
    },
    workflowHint: "runway_reel",
    mappedEvent: "proposal.approved",
  });

  assert.equal(tenantRuntime.industryKey, "beauty");
  assert.equal(tenantRuntime.ctaStyle, "book your consultation");
  assert.deepEqual(tenantRuntime.brand.tone, ["warm_premium_reassuring"]);
  assert.equal(tenantRuntime.behavior.mediaDirection, "premium_clinical_trust");
  assert.equal(promptExtra.behavior.conversionGoal, "book_consultation");
  assert.equal(promptExtra.behavior.primaryCta, "book your consultation");
  assert.equal(promptExtra.behavior.reviewBias, "human_review_required");
  assert.equal(
    promptExtra.mediaBehavior.primaryAction,
    "show_premium_transformation"
  );
  assert.deepEqual(promptExtra.guardrails.disallowedClaims, [
    "instant_result_guarantees",
  ]);
});
