import test from "node:test";
import assert from "node:assert/strict";

import { buildCandidatesFromSynthesis } from "../src/services/sourceFusion/candidates.js";
import {
  __test__ as governanceTest,
} from "../src/services/sourceFusion/governance.js";
import {
  __test__ as approvalPolicyTest,
} from "../src/services/sourceFusion/approvalPolicy.js";
import { detectConflicts, groupObservationsByClaimType } from "../src/services/sourceFusion/clustering.js";
import { synthesizeTenantBusinessFromObservations } from "../src/services/sourceFusion/synthesis.js";

test("trust tiers clearly separate strong official sources from weak inferred ones", () => {
  const manual = governanceTest.getSourceTrustProfile("manual");
  const weak = governanceTest.getSourceTrustProfile("google_maps");

  assert.equal(manual.trustTier, "admin_confirmed");
  assert.equal(weak.trustTier, "weak_inferred_scrape");
  assert.ok(manual.trustScore > weak.trustScore);
  assert.ok(manual.authorityRank > weak.authorityRank);
});

test("stale competing evidence is classified distinctly from normal conflicts", () => {
  const clusterMap = groupObservationsByClaimType([
    {
      claim_type: "primary_phone",
      raw_value_text: "+994501112233",
      normalized_value_text: "+994501112233",
      confidence: 0.9,
      source_type: "website",
      source_id: "source-web",
      source_run_id: "run-web",
      last_seen_at: "2026-03-20T00:00:00.000Z",
    },
    {
      claim_type: "primary_phone",
      raw_value_text: "+994509998877",
      normalized_value_text: "+994509998877",
      confidence: 0.92,
      source_type: "google_business_profile",
      source_id: "source-gbp",
      source_run_id: "run-gbp",
      last_seen_at: "2025-01-01T00:00:00.000Z",
    },
  ]);

  const conflicts = detectConflicts(clusterMap);

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].classification, "stale_source_loses");
  assert.equal(conflicts[0].resolution, "winner_selected");
  assert.equal(conflicts[0].review_required, false);
});

test("weaker sources do not outrank stronger evidence during synthesis", () => {
  const synthesis = synthesizeTenantBusinessFromObservations({
    observations: [
      {
        claim_type: "company_name",
        raw_value_text: "Alpha Studio",
        normalized_value_text: "Alpha Studio",
        confidence: 0.88,
        source_type: "website",
        source_id: "source-web",
        source_run_id: "run-web",
        last_seen_at: "2026-03-20T00:00:00.000Z",
      },
      {
        claim_type: "company_name",
        raw_value_text: "Alpha Studio Map Pin",
        normalized_value_text: "Alpha Studio Map Pin",
        confidence: 0.96,
        source_type: "google_maps",
        source_id: "source-gmaps",
        source_run_id: "run-gmaps",
        last_seen_at: "2026-03-20T00:00:00.000Z",
      },
    ],
  });

  assert.equal(synthesis.profile.companyName, "Alpha Studio");
  assert.equal(synthesis.selectedClaims.company_name[0].bestSourceType, "website");
  assert.equal(synthesis.selectedClaims.company_name[0].governance.trust.strongestSourceType, "website");
});

test("quarantined weak claims are suppressed from candidate promotion", () => {
  const candidates = buildCandidatesFromSynthesis({
    tenantId: "tenant-1",
    tenantKey: "alpha",
    sourceId: "source-1",
    sourceRunId: "run-1",
    synthesis: {
      confidence: 0.72,
      profile: {
        summaryShort: "Low-quality scrape summary",
      },
      selectedClaims: {
        summary_short: [
          {
            valueText: "Low-quality scrape summary",
            score: 0.41,
            evidence: [
              {
                source_type: "google_maps",
                source_id: "source-gmaps",
                source_run_id: "run-gmaps",
              },
            ],
            governance: {
              quarantine: true,
              quarantineReasons: ["weak_only_sources", "low_score"],
            },
            status: "quarantined",
          },
        ],
      },
    },
  });

  assert.deepEqual(candidates, []);
});

test("finalize impact summaries expose downstream canonical and runtime areas", () => {
  const impact = governanceTest.buildFinalizeImpactSummary({
    draft: {
      businessProfile: {
        companyName: "Alpha Studio",
        websiteUrl: "https://alpha.example",
      },
      capabilities: {
        supportsWhatsapp: true,
      },
      services: [{ key: "branding" }],
      knowledgeItems: [{ key: "faq_turnaround" }],
    },
  });

  assert.deepEqual(impact.canonicalAreas, [
    "business_profile",
    "business_capabilities",
    "services",
    "knowledge",
  ]);
  assert.ok(impact.runtimeAreas.includes("tenant_profile"));
  assert.ok(impact.runtimeAreas.includes("behavioral_policy"));
  assert.ok(impact.runtimeAreas.includes("offerings"));
  assert.ok(impact.runtimeAreas.includes("knowledge"));
});

test("low-risk strong evidence can be marked auto approvable", () => {
  const candidates = buildCandidatesFromSynthesis({
    tenantId: "tenant-1",
    tenantKey: "alpha",
    sourceId: "source-1",
    sourceRunId: "run-1",
    synthesis: {
      confidence: 0.9,
      profile: {
        summaryShort: "Calm and professional brand studio for small clinics.",
      },
      selectedClaims: {
        summary_short: [
          {
            valueText: "Calm and professional brand studio for small clinics.",
            score: 0.91,
            evidence: [
              {
                source_type: "website",
                source_id: "source-web",
                source_run_id: "run-web",
                last_seen_at: "2026-03-25T00:00:00.000Z",
              },
              {
                source_type: "instagram",
                source_id: "source-ig",
                source_run_id: "run-ig",
                last_seen_at: "2026-03-24T00:00:00.000Z",
              },
            ],
            governance: {
              trust: {
                strongestTier: "official_website",
                strongestTrustScore: 0.9,
                weakOnly: false,
              },
              freshness: {
                bucket: "fresh",
                stale: false,
              },
              support: {
                uniqueSourceCount: 2,
                strongEvidenceCount: 2,
              },
              quarantine: false,
            },
            status: "promotable",
          },
        ],
      },
    },
  });

  assert.equal(candidates.length, 1);
  assert.equal(
    candidates[0].metadataJson.approvalPolicy.outcome,
    "auto_approvable"
  );
  assert.equal(
    candidates[0].metadataJson.approvalPolicy.requiredRole,
    "system"
  );
});

test("weak or conflicted claims do not get auto promoted by approval policy", () => {
  const reviewPolicy = approvalPolicyTest.classifyApprovalPolicy({
    title: "Primary phone",
    category: "contact",
    itemKey: "phone_primary",
    impact: {
      canonicalAreas: ["business_profile"],
      runtimeAreas: ["contact_channels"],
    },
    governance: {
      trust: {
        strongestTier: "official_website",
        strongestTrustScore: 0.9,
        weakOnly: false,
      },
      freshness: {
        bucket: "stale",
        stale: true,
      },
      support: {
        uniqueSourceCount: 2,
        strongEvidenceCount: 2,
      },
      conflict: {
        classification: "conflicting_but_reviewable",
      },
    },
  });

  const blockedPolicy = approvalPolicyTest.classifyApprovalPolicy({
    title: "Auto handoff on low confidence",
    category: "capability",
    itemKey: "autoHandoffOnLowConfidence",
    impact: {
      canonicalAreas: ["business_capabilities"],
      runtimeAreas: ["behavioral_policy"],
      affectedSurfaces: ["voice", "twilio", "automation_executions"],
    },
    governance: {
      trust: {
        strongestTier: "weak_inferred_scrape",
        strongestTrustScore: 0.42,
        weakOnly: true,
      },
      freshness: {
        bucket: "fresh",
        stale: false,
      },
      support: {
        uniqueSourceCount: 1,
        strongEvidenceCount: 0,
      },
    },
  });

  assert.equal(reviewPolicy.outcome, "review_required");
  assert.notEqual(reviewPolicy.outcome, "auto_approvable");
  assert.equal(blockedPolicy.outcome, "blocked");
});

test("high-risk operational truth requires stronger approval levels", () => {
  const policy = approvalPolicyTest.classifyApprovalPolicy({
    title: "Auto handoff on human request",
    category: "capability",
    itemKey: "autoHandoffOnHumanRequest",
    impact: {
      canonicalAreas: ["business_capabilities"],
      runtimeAreas: ["behavioral_policy"],
      affectedSurfaces: ["voice", "twilio", "automation_executions"],
    },
    governance: {
      trust: {
        strongestTier: "connected_official_provider",
        strongestTrustScore: 0.88,
        weakOnly: false,
      },
      freshness: {
        bucket: "fresh",
        stale: false,
      },
      support: {
        uniqueSourceCount: 2,
        strongEvidenceCount: 2,
      },
    },
  });

  assert.equal(policy.outcome, "dual_approval_required");
  assert.equal(policy.requiredRole, "admin_and_owner");
  assert.equal(policy.autoApprovalForbidden, true);
});
