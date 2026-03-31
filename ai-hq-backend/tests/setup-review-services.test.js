import test from "node:test";
import assert from "node:assert/strict";

import { buildFrontendReviewShape } from "../src/services/workspace/setup/reviewShape.js";
import { loadCurrentReviewPayload } from "../src/services/workspace/setup/reviewFlow.js";
import { projectSetupReviewDraftToCanonical } from "../src/services/workspace/setup/projection.js";
import { loadSetupTruthPayload } from "../src/services/workspace/setup/truthPayloads.js";
import { deriveDraftPatch } from "../src/services/workspace/import/draft.js";

test("service extraction: review shape keeps bundle and provenance summary", () => {
  const shaped = buildFrontendReviewShape({
    session: { id: "session-1", primarySourceId: "source-1" },
    draft: {
      businessProfile: {
        companyName: "Alpha Studio",
        fieldSources: {
          companyName: {
            sourceType: "website",
            sourceUrl: "https://alpha.example",
            authorityRank: 300,
            sourceLabel: "Website",
            observedValue: "Alpha Studio",
          },
        },
      },
      services: [{ key: "branding", title: "Branding" }],
      knowledgeItems: [{ key: "faq", title: "FAQ" }],
      warnings: ["needs_review"],
      draftPayload: {
        sourceContributions: {
          "website|https://alpha.example": {
            businessProfile: { companyName: "Alpha Studio" },
            services: [{ key: "branding", title: "Branding" }],
            knowledgeItems: [],
            warnings: [],
            sourceSummary: {
              latestImport: {
                sourceType: "website",
                sourceUrl: "https://alpha.example",
              },
            },
          },
        },
      },
      sourceSummary: {
        imports: [
          {
            sourceId: "source-1",
            sourceType: "website",
            sourceUrl: "https://alpha.example",
            sourceLabel: "Website",
          },
        ],
      },
    },
    sources: [{ sourceId: "source-1", sourceType: "website", role: "primary" }],
    events: [{ id: "event-1" }],
  });

  assert.equal(shaped.bundleSources.length, 1);
  assert.equal(shaped.bundleSources[0].role, "primary");
  assert.equal(shaped.fieldProvenance.companyName.sourceType, "website");
  assert.equal(shaped.fieldProvenance.companyName.label, "Website");
  assert.equal(shaped.fieldProvenance.companyName.observedValue, "Alpha Studio");
  assert.equal(shaped.reviewDraftSummary.serviceCount, 1);
  assert.equal(shaped.reviewDraftSummary.fieldSourceObservedValueCount, 1);
});

test("service extraction: review shape keeps observed values from snake_case provenance", () => {
  const shaped = buildFrontendReviewShape({
    session: { id: "session-1", primarySourceId: "source-1" },
    draft: {
      businessProfile: {
        companyName: "Alpha Studio",
        primaryPhone: "+15550001111",
        fieldSources: {
          companyName: {
            source_type: "website",
            source_url: "https://alpha.example",
            authority_rank: 300,
            source_label: "Website",
            observed_value: "Alpha Studio",
          },
          primaryPhone: {
            source_type: "website",
            source_url: "https://alpha.example/contact",
            source_label: "Website",
            observed_value: "+15550001111",
          },
        },
      },
    },
    sources: [{ sourceId: "source-1", sourceType: "website", role: "primary" }],
    events: [],
  });

  assert.equal(shaped.fieldProvenance.companyName.sourceType, "website");
  assert.equal(shaped.fieldProvenance.companyName.sourceUrl, "https://alpha.example");
  assert.equal(shaped.fieldProvenance.companyName.label, "Website");
  assert.equal(shaped.fieldProvenance.companyName.observedValue, "Alpha Studio");
  assert.equal(shaped.fieldProvenance.companyName.value, "Alpha Studio");
  assert.equal(shaped.fieldProvenance.primaryPhone.observedValue, "+15550001111");
});

test("service extraction: fresh website draft shaping carries observed field values into review provenance", () => {
  const patch = deriveDraftPatch({
    currentDraft: {},
    session: { id: "session-1", primarySourceType: "website" },
    source: { id: "source-1" },
    run: { id: "run-1" },
    result: {
      profile: {
        companyTitle: "SaytPro",
        websiteUrl: "https://saytpro.az",
        primaryPhone: "+994707370717",
        primaryEmail: "salam@saytpro.az",
        companySummaryShort: "Bakida pesekar vebsayt hazirlanmasi ve SEO xidmetleri.",
        mainLanguage: "az",
        services: ["Website development", "Technical SEO"],
        products: ["Premium hosting"],
        pricingHints: ["Starting from 300 AZN"],
        socialLinks: [{ platform: "instagram", url: "https://instagram.com/saytpro" }],
      },
      warnings: [],
      signals: {},
      extracted: {
        crawl: {
          effectiveLimits: {
            maxPagesAllowed: 6,
            maxCandidatesQueued: 40,
            maxFetchPages: 10,
          },
          pagesRequested: 18,
          pagesSucceeded: 6,
          pagesKept: 4,
          pagesRejected: 2,
          warnings: ["limited_page_coverage"],
        },
        site: {
          debug: {
            weakSelectionReasons: ["limited_kept_page_coverage"],
            pageAdmissions: [{ url: "https://saytpro.az/contact", admitted: false }],
            pagesWithContactSignals: [{ url: "https://saytpro.az/contact", phones: ["+994707370717"] }],
          },
        },
      },
    },
    requestId: "req-1",
    sourceType: "website",
    sourceUrl: "https://saytpro.az",
    intakeContext: {},
    collector: {
      profilePatch: {},
      capabilitiesPatch: {},
      candidates: [],
      observationCount: 0,
      candidateCount: 0,
      snapshotCount: 0,
      lastSnapshotId: null,
    },
  });

  const shaped = buildFrontendReviewShape({
    session: { id: "session-1", primarySourceId: "source-1" },
    draft: patch,
    sources: [
      {
        sourceId: "source-1",
        sourceType: "website",
        role: "primary",
        label: "Website",
        url: "https://saytpro.az",
      },
    ],
    events: [],
  });

  assert.equal(shaped.fieldProvenance.websiteUrl.observedValue, "https://saytpro.az");
  assert.equal(shaped.fieldProvenance.primaryPhone.observedValue, "+994707370717");
  assert.equal(shaped.fieldProvenance.primaryEmail.observedValue, "salam@saytpro.az");
  assert.equal(
    shaped.fieldProvenance.description.observedValue,
    "Bakida pesekar vebsayt hazirlanmasi ve SEO xidmetleri."
  );
  assert.equal(
    shaped.fieldProvenance.socialLinks.observedValue,
    "https://instagram.com/saytpro"
  );
  assert.ok(
    shaped.fieldProvenance.services.observedValue.includes("Website development")
  );
  assert.ok(
    shaped.fieldProvenance.services.observedValue.includes("Technical SEO")
  );
  assert.equal(
    shaped.fieldProvenance.products.observedValue,
    "Premium hosting"
  );
  assert.equal(
    shaped.fieldProvenance.pricingHints.observedValue,
    "Starting from 300 AZN"
  );
  assert.ok(
    shaped.reviewDraftSummary.fieldSourceObservedFields.includes("websiteUrl")
  );
  assert.ok(
    shaped.reviewDraftSummary.fieldSourceObservedFields.includes("socialLinks")
  );
  assert.deepEqual(shaped.reviewDebug.effectiveLimits, {
    maxPagesAllowed: 6,
    maxCandidatesQueued: 40,
    maxFetchPages: 10,
  });
  assert.ok(shaped.reviewDebug.weakSelectionReasons.includes("limited_kept_page_coverage"));
});

test("service extraction: current review payload keeps shaped review and setup", async () => {
  const payload = await loadCurrentReviewPayload(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        role: "owner",
        tenant: null,
      },
      eventLimit: 12,
    },
    {
      async getCurrentSetupReview() {
        return {
          session: { id: "session-1" },
          draft: { businessProfile: { companyName: "Alpha Studio" } },
          sources: [],
        };
      },
      async listSetupReviewEvents({ limit }) {
        assert.equal(limit, 12);
        return [{ id: "event-1" }];
      },
      async buildSetupStatus() {
        return { progress: { nextRoute: "/setup/review" } };
      },
    }
  );

  assert.equal(payload.review.session.id, "session-1");
  assert.equal(payload.review.events.length, 1);
  assert.equal(payload.setup.progress.nextRoute, "/setup/review");
});

test("service extraction: projection still creates truth version and projection summaries", async () => {
  let versionInput = null;
  let serviceRows = [];

  const projected = await projectSetupReviewDraftToCanonical(
    {
      db: {
        async query(text, params = []) {
          const sql = String(text || "").toLowerCase();
          if (sql.includes("from tenant_setup_review_sessions")) {
            return {
              rows: [
                {
                  id: params[0],
                },
              ],
            };
          }
          if (sql.includes("from tenants") && (sql.includes("where id = $1::uuid") || sql.includes("where tenant_key = $1"))) {
            return {
              rows: [
                {
                  id: "tenant-1",
                  tenant_key: "alpha",
                  company_name: "Alpha Studio",
                },
              ],
            };
          }
          if (sql.includes("from tenant_services")) {
            return {
              rows: serviceRows,
            };
          }
          if (sql.includes("insert into tenant_services")) {
            serviceRows = [
              {
                id: "service-1",
                tenant_key: "alpha",
                service_key: "branding",
                title: "Branding",
                description: "Brand work",
                category: "service",
                price_from: null,
                currency: "AZN",
                pricing_model: "custom_quote",
                duration_minutes: null,
                is_active: true,
                sort_order: 0,
                highlights_json: [],
                created_at: "2026-03-29T00:00:00.000Z",
                updated_at: "2026-03-29T00:00:00.000Z",
              },
            ];
            return {
              rows: serviceRows,
            };
          }
          return { rows: [] };
        },
      },
      actor: {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        user: { name: "Reviewer" },
      },
      session: {
        id: "session-1",
        primarySourceType: "website",
      },
      draft: {
        version: 4,
        businessProfile: {
          companyName: "Alpha Studio",
          description: "Brand strategy and design",
        },
        capabilities: {
          supportsWhatsapp: true,
          primaryLanguage: "en",
        },
        sourceSummary: {
          primarySourceType: "website",
          primarySourceUrl: "https://alpha.example",
        },
        services: [{ key: "branding", title: "Branding", description: "Brand work" }],
        knowledgeItems: [],
      },
      sources: [
        {
          sourceId: "source-1",
          sourceType: "website",
          role: "primary",
          sourceUrl: "https://alpha.example",
        },
      ],
    },
    {
      knowledgeHelper: {
        async getBusinessProfile() {
          return null;
        },
        async getBusinessCapabilities() {
          return null;
        },
        async upsertBusinessProfile(input) {
          return {
            id: "profile-1",
            approved_by: "Reviewer",
            approved_at: "2026-03-25T02:00:00.000Z",
            source_summary_json: input.sourceSummaryJson,
          };
        },
        async upsertBusinessCapabilities() {
          return {
            id: "capabilities-1",
            approved_by: "Reviewer",
          };
        },
      },
      truthVersionHelper: {
        async createVersion(input) {
          versionInput = input;
          return { id: "version-1" };
        },
      },
    }
  );

  assert.equal(projected.projectedProfile, true);
  assert.equal(projected.projectedCapabilities, true);
  assert.equal(projected.truthVersion.id, "version-1");
  assert.equal(projected.serviceProjection.total, 1);
  assert.equal(versionInput.reviewSessionId, "session-1");
  assert.equal(versionInput.metadataJson.reviewSessionProjection, true);
  assert.equal(versionInput.services.length, 1);
  assert.equal(versionInput.services[0].serviceKey, "branding");
});

test("service extraction: truth payload keeps approved-truth blocker semantics", async () => {
  const payload = await loadSetupTruthPayload(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        role: "owner",
        tenant: null,
      },
    },
    {
      knowledgeHelper: {
        async getBusinessProfile() {
          return null;
        },
      },
      truthVersionHelper: {
        async listVersions() {
          return [];
        },
        buildHistoryEntries() {
          return [];
        },
      },
      async setupBuilder() {
        return {
          progress: {
            nextRoute: "/setup/business",
            primaryMissingStep: "approved_truth",
          },
        };
      },
    }
  );

  assert.equal(payload.truth.readiness.status, "blocked");
  assert.equal(payload.truth.readiness.blockers[0].reasonCode, "approved_truth_unavailable");
  assert.equal(payload.setup.progress.nextRoute, "/setup/business");
});
