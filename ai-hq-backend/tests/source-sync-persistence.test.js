import test from "node:test";
import assert from "node:assert/strict";

import { persistSynthesisOutputs } from "../src/services/sourceSync/persistence.js";

test("website sync persistence stores review-required draft truth metadata instead of canonical writes", async () => {
  let createdCandidates = null;
  let snapshotInput = null;

  const result = await persistSynthesisOutputs({
    source: {
      id: "source-1",
      tenant_id: "tenant-1",
      tenant_key: "alpha",
      source_url: "https://alpha.example",
      review_session_id: "session-1",
    },
    run: {
      id: "run-1",
      review_session_id: "session-1",
    },
    requestedBy: "worker",
    knowledge: {
      async listCandidates() {
        return [];
      },
      async createCandidatesBulk(items) {
        createdCandidates = items;
        return items.map((item, idx) => ({
          ...item,
          id: `candidate-${idx + 1}`,
        }));
      },
    },
    fusion: {
      async createSynthesisSnapshot(input) {
        snapshotInput = input;
        return {
          id: "snapshot-1",
          ...input,
        };
      },
    },
    synthesis: {
      summaryText: "Alpha Studio helps clinics with brand strategy and web presence.",
      confidence: 0.84,
      confidenceLabel: "high",
      profile: {
        companyName: "Alpha Studio",
        websiteUrl: "https://alpha.example",
        summaryShort: "Brand studio for clinics.",
        summaryLong: "Brand studio for clinics with clear website support.",
        services: ["Brand strategy", "Website design"],
        faqItems: [
          {
            question: "Do you work with clinics?",
            answer: "Yes, that is our main focus.",
          },
        ],
        policyHighlights: ["Please notify us 24 hours in advance for workshop changes."],
        pricingHints: ["Custom quotes after discovery."],
        bookingLinks: ["https://alpha.example/book"],
        emails: ["hello@alpha.example"],
      },
      capabilities: {
        replyStyle: "professional",
      },
      selectedClaims: {
        policy_highlight: [
          {
            claimType: "policy_highlight",
            valueText: "Please notify us 24 hours in advance for workshop changes.",
            score: 0.82,
            evidence: [
              {
                source_type: "website",
                source_id: "source-1",
                source_run_id: "run-1",
                page_url: "https://alpha.example/policy",
              },
            ],
            governance: {
              quarantine: false,
            },
            status: "promotable",
          },
        ],
      },
      conflicts: [],
      governance: {},
    },
    candidateDrafts: [
      {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        sourceId: "source-1",
        sourceRunId: "run-1",
        candidateGroup: "policy",
        category: "policy",
        itemKey: "policy_cancellation_notice",
        title: "Cancellation policy",
        valueText: "Please notify us 24 hours in advance for workshop changes.",
        normalizedText: "Please notify us 24 hours in advance for workshop changes.",
        normalizedJson: {},
        confidence: 0.82,
        confidenceLabel: "high",
        status: "needs_review",
        reviewReason: "website_policy_highlight",
        sourceEvidenceJson: [
          {
            pageUrl: "https://alpha.example/policy",
          },
        ],
      },
    ],
    createdObservations: [
      {
        observationGroup: "policy",
        claimType: "policy_highlight",
        claimKey: "policy_cancellation_notice",
        rawValueText: "Please notify us 24 hours in advance for workshop changes.",
        normalizedValueText: "Please notify us 24 hours in advance for workshop changes.",
        evidenceText: "Policy content detected on website page",
        pageUrl: "https://alpha.example/policy",
        pageTitle: "Policy",
        confidence: 0.82,
        sourceId: "source-1",
        sourceRunId: "run-1",
        sourceType: "website",
      },
    ],
    sourceType: "website",
    sourceUrl: "https://alpha.example",
    skipCandidateCreate: false,
    candidateAdmission: {
      allowCandidateCreation: true,
      reason: "",
    },
    trust: {
      confidence: "high",
      signals: {
        pages: 3,
      },
    },
    artifactSummary: {
      persisted: true,
      pageCount: 3,
      artifactCount: 4,
      chunkCount: 14,
      pageTypeCounts: {
        home: 1,
        services: 1,
        policies: 1,
      },
    },
  });

  assert.equal(result.createdCount, 1);
  assert.equal(createdCandidates.length, 1);
  assert.equal(snapshotInput.profileJson.projection_status, "review_required");
  assert.equal(
    snapshotInput.profileJson.projection_reason,
    "source_sync_does_not_write_canonical_profile"
  );
  assert.equal(
    snapshotInput.capabilitiesJson.projection_reason,
    "source_sync_does_not_write_canonical_capabilities"
  );
  assert.equal(snapshotInput.metadataJson.canonical_projection, "deferred_to_review");
  assert.equal(snapshotInput.metadataJson.artifacts.pageCount, 3);
  assert.equal(snapshotInput.sourcesJson.artifacts.artifactCount, 4);
  assert.equal(
    snapshotInput.metadataJson.websiteDraft.businessProfileDraft.companyName,
    "Alpha Studio"
  );
  assert.ok(
    snapshotInput.metadataJson.websiteDraft.policiesDraft.some((item) =>
      /24 hours/i.test(item)
    )
  );
});
