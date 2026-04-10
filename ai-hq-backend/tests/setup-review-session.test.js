import test from "node:test";
import assert from "node:assert/strict";

import { __test__ as importTest } from "../src/services/workspace/import.js";
import { __test__ as setupTest } from "../src/routes/api/workspace/setup.js";
import { __test__ as intakeAnalyzeTest } from "../src/services/workspace/intakeAnalyze.js";
import { normalizeSynthesisResult } from "../src/services/sourceSync/normalize.js";
import { __test__ as barrierTest } from "../src/services/sourceSync/orchestrator/barrier.js";
import {
  __test__ as draftTest,
  sanitizeSetupBusinessProfile,
  sanitizeSetupReviewDraft,
} from "../src/services/workspace/import/draft.js";
import {
  hasCanonicalBaselineDrift,
  createCanonicalBaselineDriftError,
  finalizeSetupReviewSession,
} from "../src/db/helpers/tenantSetupReview.js";
import { buildTenantRuntimeProjection } from "../src/db/helpers/tenantRuntimeProjection.js";
import {
  __test__ as truthVersionTest,
  executeTruthVersionRollbackInternal,
} from "../src/db/helpers/tenantTruthVersions.js";
import {
  buildInstagramSignals,
  synthesizeInstagramBusinessProfile,
} from "../src/services/sourceSync/instagramHelpers.js";
import { __test__ as httpTest } from "../src/utils/http.js";
import { __test__ as websiteFetchTest } from "../src/services/sourceSync/websiteExtractor/fetch.js";
import {
  checkDb,
  isDbTimeoutError,
  queryDbWithTimeout,
} from "../src/routes/api/adminAuth/utils.js";

test("Case A: different primary intake starts a fresh session", () => {
  const currentReview = {
    session: {
      id: "session-a",
      metadata: {
        intakeBundleKey: importTest.buildIntakeBundleKey({
          primarySource: {
            sourceType: "website",
            url: "https://alpha.example",
          },
          sources: [
            {
              sourceType: "website",
              url: "https://alpha.example",
              isPrimary: true,
            },
          ],
        }),
      },
    },
    draft: {
      sourceSummary: {
        primarySourceType: "website",
        primarySourceUrl: "https://alpha.example",
      },
    },
    sources: [],
  };

  const shouldReuse = importTest.shouldReuseSessionForImport({
    currentReview,
    incomingType: "website",
    incomingUrl: "https://beta.example",
    allowSessionReuse: true,
    nextIntakeContext: {
      primarySource: {
        sourceType: "website",
        url: "https://beta.example",
      },
      sources: [
        {
          sourceType: "website",
          url: "https://beta.example",
          isPrimary: true,
        },
      ],
    },
  });

  assert.equal(shouldReuse, false);
});

test("Case A: same intake bundle reuses the current session", () => {
  const bundle = {
    primarySource: {
      sourceType: "website",
      url: "https://alpha.example",
    },
    sources: [
      {
        sourceType: "website",
        url: "https://alpha.example",
        isPrimary: true,
      },
      {
        sourceType: "instagram",
        url: "https://instagram.com/alpha",
      },
    ],
  };

  const currentReview = {
    session: {
      id: "session-a",
      metadata: {
        intakeBundleKey: importTest.buildIntakeBundleKey(bundle),
      },
    },
    draft: {
      sourceSummary: {
        primarySourceType: "website",
        primarySourceUrl: "https://alpha.example",
      },
    },
    sources: [],
  };

  const shouldReuse = importTest.shouldReuseSessionForImport({
    currentReview,
    incomingType: "website",
    incomingUrl: "https://alpha.example",
    allowSessionReuse: true,
    nextIntakeContext: bundle,
  });

  assert.equal(shouldReuse, true);
});

test("Case A: same intake bundle stays fresh-by-default until reuse is explicit", () => {
  const bundle = {
    primarySource: {
      sourceType: "website",
      url: "https://alpha.example",
    },
    sources: [
      {
        sourceType: "website",
        url: "https://alpha.example",
        isPrimary: true,
      },
    ],
  };

  const currentReview = {
    session: {
      id: "session-a",
      metadata: {
        intakeBundleKey: importTest.buildIntakeBundleKey(bundle),
      },
    },
    draft: {
      sourceSummary: {
        primarySourceType: "website",
        primarySourceUrl: "https://alpha.example",
      },
    },
    sources: [],
  };

  const shouldReuse = importTest.shouldReuseSessionForImport({
    currentReview,
    incomingType: "website",
    incomingUrl: "https://alpha.example",
    nextIntakeContext: bundle,
  });

  assert.equal(shouldReuse, false);
});

test("Case A2: setup assistant shell can reuse the current session when the same website is scanned", () => {
  const bundle = {
    primarySource: {
      sourceType: "website",
      url: "https://alpha.example",
    },
    sources: [
      {
        sourceType: "website",
        url: "https://alpha.example",
        isPrimary: true,
      },
    ],
  };

  const currentReview = {
    session: {
      id: "session-assistant",
      metadata: {
        setupAssistantShell: true,
      },
    },
    draft: {
      businessProfile: {},
      draftPayload: {
        setupAssistant: {
          businessProfile: {
            websiteUrl: "https://alpha.example",
          },
        },
      },
    },
    sources: [],
  };

  const shouldReuse = importTest.shouldReuseSessionForImport({
    currentReview,
    incomingType: "website",
    incomingUrl: "https://alpha.example",
    allowSessionReuse: true,
    nextIntakeContext: bundle,
  });

  assert.equal(shouldReuse, true);
});

test("Case A3: same website does not reuse when the intake bundle changed", () => {
  const existingBundle = {
    primarySource: {
      sourceType: "website",
      url: "https://alpha.example",
    },
    sources: [
      {
        sourceType: "website",
        url: "https://alpha.example",
        isPrimary: true,
      },
      {
        sourceType: "instagram",
        url: "https://instagram.com/alpha",
      },
    ],
  };

  const currentReview = {
    session: {
      id: "session-bundle-change",
      metadata: {
        intakeBundleKey: importTest.buildIntakeBundleKey(existingBundle),
      },
    },
    draft: {
      sourceSummary: {
        primarySourceType: "website",
        primarySourceUrl: "https://alpha.example",
      },
    },
    sources: [],
  };

  const shouldReuse = importTest.shouldReuseSessionForImport({
    currentReview,
    incomingType: "website",
    incomingUrl: "https://alpha.example",
    allowSessionReuse: true,
    nextIntakeContext: {
      primarySource: {
        sourceType: "website",
        url: "https://alpha.example",
      },
      sources: [
        {
          sourceType: "website",
          url: "https://alpha.example",
          isPrimary: true,
        },
      ],
    },
  });

  assert.equal(shouldReuse, false);
});

test("Case A4: identical bundle reuse is rejected when stale contribution keys are present", () => {
  const bundle = {
    primarySource: {
      sourceType: "website",
      url: "https://alpha.example",
    },
    sources: [
      {
        sourceType: "website",
        url: "https://alpha.example",
        isPrimary: true,
      },
    ],
  };

  const currentReview = {
    session: {
      id: "session-stale-contrib",
      metadata: {
        intakeBundleKey: importTest.buildIntakeBundleKey(bundle),
      },
    },
    draft: {
      sourceSummary: {
        primarySourceType: "website",
        primarySourceUrl: "https://alpha.example",
      },
      draftPayload: {
        sourceContributions: {
          "website|https://alpha.example": {
            businessProfile: {
              companyName: "Alpha Studio",
            },
            sourceSummary: {
              latestImport: {
                sourceType: "website",
                sourceUrl: "https://alpha.example",
              },
            },
          },
          "instagram|https://instagram.com/alpha": {
            businessProfile: {
              primaryPhone: "+994501112233",
            },
            sourceSummary: {
              latestImport: {
                sourceType: "instagram",
                sourceUrl: "https://instagram.com/alpha",
              },
            },
          },
        },
      },
    },
    sources: [],
  };

  const shouldReuse = importTest.shouldReuseSessionForImport({
    currentReview,
    incomingType: "website",
    incomingUrl: "https://alpha.example",
    allowSessionReuse: true,
    nextIntakeContext: bundle,
  });

  assert.equal(shouldReuse, false);
});

test("Case B: same-bundle re-import evicts unsupported source-derived fields", () => {
  const merged = importTest.mergeImportedDraftPatch({
    currentDraft: {
      businessProfile: {
        companyName: "Alpha Studio",
        summary: "Old summary that should be evicted",
        websiteUrl: "https://alpha.example",
      },
      capabilities: {
        bookingEnabled: true,
      },
      services: [
        {
          key: "branding",
          title: "Branding",
        },
      ],
      knowledgeItems: [
        {
          key: "faq_turnaround",
          title: "Turnaround",
          category: "faq",
        },
      ],
      warnings: ["old_warning"],
      channels: [{ type: "instagram" }],
      sourceSummary: {
        primarySourceType: "website",
        primarySourceUrl: "https://alpha.example",
      },
      draftPayload: {
        snapshot: { version: 1 },
      },
      diffFromCanonical: {
        changed: ["summary"],
      },
      lastSnapshotId: "11111111-1111-4111-8111-111111111111",
    },
    importedPatch: {
      businessProfile: {
        companyName: "Alpha Studio",
      },
      capabilities: {},
      services: [],
      knowledgeItems: [],
      warnings: [],
      channels: [{ type: "instagram" }],
      sourceSummary: {
        primarySourceType: "website",
        primarySourceUrl: "https://alpha.example",
      },
      draftPayload: {},
      diffFromCanonical: {},
      lastSnapshotId: null,
    },
  });

  assert.equal(merged.businessProfile.companyName, "Alpha Studio");
  assert.equal(
    merged.businessProfile.fieldSources.companyName.authorityRank,
    0
  );
  assert.deepEqual(merged.services, []);
  assert.deepEqual(merged.knowledgeItems, []);
  assert.deepEqual(merged.warnings, []);
  assert.deepEqual(merged.diffFromCanonical, {});
  assert.equal(merged.lastSnapshotId, null);
});

test("Case B1: first import seeds explicit source contribution state", () => {
  const merged = importTest.mergeImportedDraftPatch({
    currentDraft: {
      draftPayload: {},
      channels: [],
      sourceSummary: {},
    },
    importedPatch: {
      businessProfile: {
        companyName: "Alpha Studio",
        companySummaryLong: "Website summary",
      },
      capabilities: {
        primaryLanguage: "en",
      },
      services: [
        {
          key: "branding",
          title: "Branding",
          sourceType: "website",
        },
      ],
      knowledgeItems: [],
      warnings: [],
      diffFromCanonical: {},
      sourceSummary: {
        primarySourceType: "website",
        primarySourceUrl: "https://alpha.example/",
        latestImport: {
          sourceType: "website",
          sourceUrl: "https://alpha.example/",
        },
      },
      draftPayload: {
        profile: {
          companyName: "Alpha Studio",
        },
      },
      lastSnapshotId: null,
    },
    intakeContext: {
      primarySource: {
        sourceType: "website",
        url: "https://alpha.example/",
      },
      sources: [
        {
          sourceType: "website",
          url: "https://alpha.example/",
          isPrimary: true,
        },
      ],
    },
    incomingType: "website",
    incomingUrl: "https://alpha.example/",
  });

  assert.equal(merged.businessProfile.companyName, "Alpha Studio");
  assert.ok(
    merged.draftPayload.sourceContributions["website|https://alpha.example/"]
  );
  assert.equal(
    merged.draftPayload.sourceContributions["website|https://alpha.example/"].businessProfile
      .companyName,
    "Alpha Studio"
  );
});

test("Case B2: bundle-scoped merge drops stale contribution keys outside the active intake", () => {
  const merged = importTest.mergeImportedDraftPatch({
    currentDraft: {
      businessProfile: {
        companyName: "Alpha Studio",
        primaryPhone: "+994501112233",
      },
      capabilities: {},
      services: [],
      knowledgeItems: [],
      warnings: [],
      channels: [],
      sourceSummary: {
        primarySourceType: "website",
        primarySourceUrl: "https://alpha.example/",
      },
      draftPayload: {
        sourceContributions: {
          "website|https://alpha.example/": {
            businessProfile: {
              companyName: "Alpha Studio",
            },
            sourceSummary: {
              latestImport: {
                sourceType: "website",
                sourceUrl: "https://alpha.example/",
              },
            },
          },
          "instagram|https://instagram.com/alpha": {
            businessProfile: {
              primaryPhone: "+994501112233",
            },
            sourceSummary: {
              latestImport: {
                sourceType: "instagram",
                sourceUrl: "https://instagram.com/alpha",
              },
            },
          },
        },
      },
      diffFromCanonical: {},
      lastSnapshotId: null,
    },
    importedPatch: {
      businessProfile: {
        companyName: "Alpha Studio",
        companySummaryLong: "Only the website contribution should remain",
      },
      capabilities: {},
      services: [],
      knowledgeItems: [],
      warnings: [],
      diffFromCanonical: {},
      sourceSummary: {
        primarySourceType: "website",
        primarySourceUrl: "https://alpha.example/",
        latestImport: {
          sourceType: "website",
          sourceUrl: "https://alpha.example/",
        },
      },
      draftPayload: {},
      lastSnapshotId: null,
    },
    intakeContext: {
      primarySource: {
        sourceType: "website",
        url: "https://alpha.example/",
      },
      sources: [
        {
          sourceType: "website",
          url: "https://alpha.example/",
          isPrimary: true,
        },
      ],
    },
    incomingType: "website",
    incomingUrl: "https://alpha.example/",
  });

  assert.deepEqual(Object.keys(merged.draftPayload.sourceContributions), [
    "website|https://alpha.example/",
  ]);
  assert.equal(merged.businessProfile.primaryPhone, undefined);
  assert.equal(
    merged.businessProfile.companySummaryLong,
    "Only the website contribution should remain"
  );
});

test("Case C: finalize blocks on baseline drift", () => {
  const baseline = {
    tenantId: "tenant-1",
    projectionHash: "hash-a",
    synthesisSnapshotId: "11111111-1111-4111-8111-111111111111",
    capturedAt: "2026-03-24T00:00:00.000Z",
  };
  const current = {
    tenantId: "tenant-1",
    projectionHash: "hash-b",
    synthesisSnapshotId: "22222222-2222-4222-8222-222222222222",
    capturedAt: "2026-03-24T00:05:00.000Z",
  };

  assert.equal(hasCanonicalBaselineDrift(baseline, current), true);

  const err = createCanonicalBaselineDriftError(baseline, current);
  assert.equal(err.code, "SETUP_REVIEW_BASELINE_DRIFT");
  assert.deepEqual(err.baseline, {
    ...baseline,
    error: "",
  });
  assert.deepEqual(err.current, {
    ...current,
    error: "",
  });
});

test("Case C1: finalize fails cleanly when the projection callback returns no canonical result", async () => {
  const sessionRow = {
    id: "session-1",
    tenant_id: "tenant-1",
    status: "ready",
    mode: "setup",
    primary_source_type: "website",
    primary_source_id: null,
    started_by: null,
    current_step: "review",
    base_runtime_projection_id: null,
    title: "Alpha setup",
    notes: "",
    metadata: {},
    failure_payload: {},
    started_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
    finalized_at: null,
    discarded_at: null,
    failed_at: null,
  };

  const draftRow = {
    id: "draft-1",
    session_id: "session-1",
    tenant_id: "tenant-1",
    draft_payload: {},
    business_profile: {
      companyName: "Alpha Studio",
    },
    capabilities: {},
    services: [],
    knowledge_items: [],
    channels: [],
    source_summary: {
      primarySourceType: "website",
      primarySourceUrl: "https://alpha.example",
    },
    warnings: [],
    completeness: {},
    confidence_summary: {},
    diff_from_canonical: {},
    last_snapshot_id: null,
    version: 3,
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
  };

  const client = {
    async query(text) {
      const sql = String(text || "").toLowerCase();

      if (
        sql.includes("from public.tenant_setup_review_sessions") &&
        sql.includes("for update")
      ) {
        return {
          rows: [sessionRow],
        };
      }

      if (sql.includes("from public.tenant_setup_review_drafts")) {
        return {
          rows: [draftRow],
        };
      }

      if (sql.includes("from public.tenant_setup_review_session_sources")) {
        return {
          rows: [],
        };
      }

      if (sql.includes("update public.tenant_setup_review_sessions")) {
        return {
          rows: [
            {
              ...sessionRow,
              status: "processing",
              current_step: "finalize",
            },
          ],
        };
      }

      throw new Error(`Unhandled query in finalize test: ${text}`);
    },
  };

  await assert.rejects(
    () =>
      finalizeSetupReviewSession(
        {
          sessionId: "session-1",
          refreshRuntime: false,
          projectDraftToCanonical: async () => null,
        },
        client
      ),
    (error) => {
      assert.equal(error.code, "SETUP_REVIEW_PROJECTION_RESULT_REQUIRED");
      assert.match(
        error.message,
        /projectDraftToCanonical must return a projection result/i
      );
      return true;
    }
  );
});

test("Case D: setup business profile input is staged into the review draft only", () => {
  const staged = setupTest.buildBusinessProfileDraftPatch(
    {
      companyName: "Alpha Studio",
      description: "Brand strategy and design",
      timezone: "Asia/Baku",
      languages: ["az", "en"],
      tone: "confident",
    },
    {
      businessProfile: {},
      capabilities: {},
      draftPayload: {},
    }
  );

  assert.equal(staged.patch.businessProfile.companyName, "Alpha Studio");
  assert.equal(staged.patch.businessProfile.description, "Brand strategy and design");
  assert.equal(staged.patch.businessProfile.timezone, "Asia/Baku");
  assert.deepEqual(staged.patch.businessProfile.languages, ["az", "en"]);
  assert.equal(staged.patch.capabilities.primaryLanguage, "az");
  assert.deepEqual(staged.patch.capabilities.supportedLanguages, ["az", "en"]);
  assert.equal(
    staged.patch.draftPayload.stagedInputs.businessProfile.companyName,
    "Alpha Studio"
  );
});

test("Case E: setup runtime preferences input is staged without canonical writes", () => {
  const staged = setupTest.buildRuntimePreferencesDraftPatch(
    {
      defaultLanguage: "en",
      languages: ["en", "az"],
      tone: "warm",
      autoReplyEnabled: true,
      inboxApprovalMode: "manual",
      policies: {
        inboxPolicy: {
          quietHoursEnabled: true,
        },
      },
    },
    {
      businessProfile: {},
      capabilities: {},
      draftPayload: {},
    }
  );

  assert.equal(staged.patch.capabilities.primaryLanguage, "en");
  assert.deepEqual(staged.patch.capabilities.supportedLanguages, ["en", "az"]);
  assert.equal(staged.patch.businessProfile.tone, "warm");
  assert.equal(
    staged.patch.draftPayload.stagedInputs.runtimePreferences.autoReplyEnabled,
    true
  );
  assert.deepEqual(
    staged.patch.draftPayload.stagedInputs.runtimePreferences.policies,
    {
      inboxPolicy: {
        quietHoursEnabled: true,
      },
    }
  );
});

test("Case E2: setup runtime preferences stages niche-aware behavior into the review draft", () => {
  const staged = setupTest.buildRuntimePreferencesDraftPatch(
    {
      businessType: "clinic",
      niche: "clinic",
      subNiche: "cosmetic_dentistry",
      conversionGoal: "book_consultation",
      primaryCta: "book your consultation",
      leadQualificationMode: "service_booking_triage",
      qualificationQuestions: [
        "What treatment are you interested in?",
        "What day works best for you?",
      ],
      bookingFlowType: "appointment_request",
      handoffTriggers: ["human_request", "medical_urgency"],
      disallowedClaims: ["diagnosis_or_treatment_guarantees"],
      toneProfile: "warm_reassuring",
      channelBehavior: {
        voice: {
          primaryAction: "book_or_route_call",
        },
        content: {
          reviewBias: "strict",
        },
      },
    },
    {
      businessProfile: {
        nicheBehavior: {
          primaryCta: "contact us",
        },
      },
      capabilities: {},
      draftPayload: {},
    }
  );

  assert.equal(staged.patch.businessProfile.nicheBehavior.businessType, "clinic");
  assert.equal(staged.patch.businessProfile.nicheBehavior.subNiche, "cosmetic_dentistry");
  assert.equal(staged.patch.businessProfile.nicheBehavior.primaryCta, "book your consultation");
  assert.deepEqual(staged.patch.businessProfile.nicheBehavior.handoffTriggers, [
    "human_request",
    "medical_urgency",
  ]);
  assert.equal(
    staged.patch.businessProfile.nicheBehavior.channelBehavior.voice.primaryAction,
    "book_or_route_call"
  );
  assert.equal(
    staged.patch.draftPayload.stagedInputs.runtimePreferences.nicheBehavior.toneProfile,
    "warm_reassuring"
  );
});

test("Case F: setup service edits are represented as staged draft services", () => {
  const service = setupTest.normalizeSetupServiceDraftInput({
    title: "Brand Strategy",
    description: "Positioning and messaging",
    category: "consulting",
  });

  assert.equal(service.title, "Brand Strategy");
  assert.equal(service.key, "brand-strategy");
  assert.equal(service.serviceKey, "brand-strategy");
  assert.equal(service.metadataJson.stagedInSetupReview, true);
});

test("Case G: bundled intake represents website primary with Instagram supporting", () => {
  const bundle = importTest.buildBundleSources({
    websiteUrl: "https://alpha.example",
    instagramUrl: "https://instagram.com/alpha",
  });

  assert.equal(bundle.primarySource.sourceType, "website");
  assert.equal(bundle.primarySource.url, "https://alpha.example");
  assert.deepEqual(
    bundle.sources.map((item) => item.sourceType),
    ["website", "instagram"]
  );
});

test("Case H: merged draft keeps website and Instagram contributions in one temporary draft", () => {
  const merged = importTest.mergeImportedDraftPatch({
    currentDraft: {
      draftPayload: {},
      channels: [],
      sourceSummary: {},
    },
    importedPatch: {
      businessProfile: {
        companyName: "Alpha Studio",
        companySummaryLong: "Website summary",
        sourceType: "website",
        sourceUrl: "https://alpha.example/",
      },
      capabilities: {
        primaryLanguage: "en",
      },
      services: [
        {
          key: "branding",
          title: "Branding",
          sourceType: "website",
        },
      ],
      knowledgeItems: [],
      warnings: [],
      diffFromCanonical: {},
      sourceSummary: {
        primarySourceType: "website",
        primarySourceUrl: "https://alpha.example/",
        latestImport: {
          sourceType: "website",
          sourceUrl: "https://alpha.example/",
        },
      },
      draftPayload: {},
      lastSnapshotId: null,
    },
  });

  const mergedAgain = importTest.mergeImportedDraftPatch({
    currentDraft: merged,
    importedPatch: {
      businessProfile: {
        primaryPhone: "+994501112233",
        socialUrls: ["https://instagram.com/alpha"],
        sourceType: "instagram",
        sourceUrl: "https://instagram.com/alpha",
      },
      capabilities: {},
      services: [
        {
          key: "social-content",
          title: "Social Content",
          sourceType: "instagram",
        },
      ],
      knowledgeItems: [],
      warnings: [],
      diffFromCanonical: {},
      sourceSummary: {
        primarySourceType: "website",
        primarySourceUrl: "https://alpha.example/",
        latestImport: {
          sourceType: "instagram",
          sourceUrl: "https://instagram.com/alpha",
        },
      },
      draftPayload: {},
      lastSnapshotId: null,
    },
  });

  assert.equal(mergedAgain.businessProfile.companyName, "Alpha Studio");
  assert.equal(mergedAgain.businessProfile.companySummaryLong, "Website summary");
  assert.equal(mergedAgain.businessProfile.primaryPhone, "+994501112233");
  assert.equal(mergedAgain.services.length, 2);
  assert.ok(
    mergedAgain.draftPayload.sourceContributions["website|https://alpha.example/"]
  );
  assert.ok(
    mergedAgain.draftPayload.sourceContributions["instagram|https://instagram.com/alpha"]
  );
});

test("Case I: weaker Instagram facts do not overwrite stronger website facts by default", () => {
  const merged = importTest.recomputeDraftFromContributions({
    currentDraft: {
      draftPayload: {},
      channels: [],
      sourceSummary: {},
    },
    contributions: [
      {
        businessProfile: {
          companySummaryLong: "Website long summary",
          companyName: "Alpha Studio",
        },
        capabilities: {},
        services: [],
        knowledgeItems: [],
        warnings: [],
        diffFromCanonical: {},
        sourceSummary: {
          latestImport: {
            sourceType: "website",
            sourceUrl: "https://alpha.example/",
          },
        },
      },
      {
        businessProfile: {
          companySummaryLong: "Instagram bio summary",
          companyName: "Alpha on Instagram",
          primaryPhone: "+994501112233",
        },
        capabilities: {},
        services: [],
        knowledgeItems: [],
        warnings: [],
        diffFromCanonical: {},
        sourceSummary: {
          latestImport: {
            sourceType: "instagram",
            sourceUrl: "https://instagram.com/alpha",
          },
        },
      },
    ],
    importedPatch: {
      sourceSummary: {
        latestImport: {
          sourceType: "instagram",
          sourceUrl: "https://instagram.com/alpha",
        },
      },
      draftPayload: {},
    },
  });

  assert.equal(merged.businessProfile.companyName, "Alpha Studio");
  assert.equal(merged.businessProfile.companySummaryLong, "Website long summary");
  assert.equal(merged.businessProfile.primaryPhone, "+994501112233");
  assert.equal(
    merged.businessProfile.fieldSources.companySummaryLong.sourceType,
    "website"
  );
});

test("Case J: frontend review shape exposes bundle sources and contribution summary", () => {
  const shaped = setupTest.buildFrontendReviewShape({
    session: {
      id: "session-1",
      primarySourceId: "source-website",
      status: "ready",
    },
    draft: {
      businessProfile: {
        companyName: "Alpha Studio",
        fieldSources: {
          companyName: {
            sourceType: "website",
            sourceUrl: "https://alpha.example",
            authorityRank: 300,
          },
        },
      },
      services: [{ key: "branding", title: "Branding" }],
      knowledgeItems: [{ key: "faq", title: "FAQ", category: "faq" }],
      warnings: ["instagram_profile_sparse"],
      completeness: { score: 3, maxScore: 3 },
      confidenceSummary: { itemCount: 2, high: 1, medium: 1, low: 0 },
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
                sourceLabel: "Website",
                sourceAuthorityClass: "website",
                runId: "run-web",
              },
            },
          },
          "instagram|https://instagram.com/alpha": {
            businessProfile: { primaryPhone: "+994501112233" },
            services: [],
            knowledgeItems: [{ key: "faq", title: "FAQ", category: "faq" }],
            warnings: ["instagram_profile_sparse"],
            sourceSummary: {
              latestImport: {
                sourceType: "instagram",
                sourceUrl: "https://instagram.com/alpha",
                sourceLabel: "Instagram",
                sourceAuthorityClass: "official_connected",
                runId: "run-ig",
              },
            },
          },
        },
      },
      sourceSummary: {
        imports: [
          {
            sourceId: "source-website",
            sourceType: "website",
            sourceUrl: "https://alpha.example",
            sourceLabel: "Website",
            sourceAuthorityClass: "website",
            runId: "run-web",
          },
          {
            sourceId: "source-ig",
            sourceType: "instagram",
            sourceUrl: "https://instagram.com/alpha",
            sourceLabel: "Instagram",
            sourceAuthorityClass: "official_connected",
            runId: "run-ig",
          },
        ],
      },
    },
    sources: [
      {
        sourceId: "source-website",
        sourceType: "website",
        role: "primary",
        label: "Website",
      },
      {
        sourceId: "source-ig",
        sourceType: "instagram",
        role: "supporting",
        label: "Instagram",
      },
    ],
    events: [],
  });

  assert.equal(shaped.bundleSources.length, 2);
  assert.equal(shaped.bundleSources[0].sourceType, "website");
  assert.equal(shaped.contributionSummary.length, 2);
  assert.equal(shaped.contributionSummary[0].sourceType, "website");
});

test("Case K: frontend review shape exposes field provenance and merged draft summary", () => {
  const shaped = setupTest.buildFrontendReviewShape({
    session: { id: "session-1", status: "ready" },
    draft: {
      businessProfile: {
        companyName: "Alpha Studio",
        companySummaryLong: "Website long summary",
        fieldSources: {
          companyName: {
            sourceType: "website",
            sourceUrl: "https://alpha.example",
            authorityRank: 300,
          },
          companySummaryLong: {
            sourceType: "website",
            sourceUrl: "https://alpha.example",
            authorityRank: 300,
          },
        },
      },
      services: [{ key: "branding", title: "Branding" }],
      knowledgeItems: [],
      warnings: ["needs_manual_review"],
      completeness: { score: 2, maxScore: 3, hasBusinessProfile: true },
      confidenceSummary: { itemCount: 1, high: 1, medium: 0, low: 0 },
      draftPayload: {},
    },
    sources: [],
    events: [],
  });

  assert.equal(shaped.fieldProvenance.companyName.sourceType, "website");
  assert.equal(shaped.reviewDraftSummary.warningCount, 1);
  assert.equal(shaped.reviewDraftSummary.serviceCount, 1);
  assert.equal(shaped.reviewDraftSummary.hasBusinessProfile, true);
});

test("Case L: instagram extraction uses connected page metadata and recurring caption evidence", () => {
  const signals = buildInstagramSignals({
    account: {
      username: "acmeclinic",
      name: "Acme Clinic",
      biography:
        "Dental clinic in Baku. Book consultation on WhatsApp. Prices from 40 AZN. www.acme.az",
      website: "",
    },
    page: {
      name: "Acme Clinic",
      about:
        "Cosmetic dentistry, implants, whitening and pediatric dental services in Baku.",
      category: "Dental clinic",
      categoryList: [{ name: "Dentist" }],
      emails: ["hello@acme.az"],
      phone: "+994 50 111 22 33",
      website: "https://acme.az",
      location: {
        street: "Nizami street 10",
        city: "Baku",
        country: "Azerbaijan",
      },
    },
    media: [
      {
        caption: "Dental implants and whitening packages available. Book consultation today.",
      },
      {
        caption: "Whitening and cosmetic dentistry services with flexible package pricing.",
      },
    ],
  });

  const profile = synthesizeInstagramBusinessProfile(signals);

  assert.equal(profile.websiteUrl, "https://acme.az/");
  assert.equal(profile.primaryEmail, "hello@acme.az");
  assert.equal(profile.primaryPhone, "+994501112233");
  assert.match(profile.primaryAddress, /Baku/i);
  assert.ok(profile.services.some((item) => /dental/i.test(item)));
  assert.ok(profile.pricingHints.some((item) => /price|pricing|azn|package/i.test(item)));
});

test("Case M: merged review warnings soften when instagram fills website gaps", () => {
  const merged = importTest.recomputeDraftFromContributions({
    currentDraft: {},
    importedPatch: {
      sourceSummary: {
        latestImport: {
          sourceType: "instagram",
          sourceUrl: "https://instagram.com/acmeclinic",
        },
      },
    },
    contributions: [
      {
        businessProfile: {
          companyName: "Acme Clinic",
          websiteUrl: "https://acme.az",
        },
        services: [],
        knowledgeItems: [],
        warnings: [
          "missing_contact_signals",
          "missing_service_signals",
          "faq_help_content_not_detected",
        ],
        sourceSummary: {
          latestImport: {
            sourceType: "website",
            sourceUrl: "https://acme.az",
          },
        },
      },
      {
        businessProfile: {
          primaryEmail: "hello@acme.az",
          primaryPhone: "+994501112233",
        },
        services: [{ key: "svc-1", title: "Dental implants" }],
        knowledgeItems: [{ key: "faq-1", title: "Do you offer whitening?", category: "faq" }],
        warnings: [],
        sourceSummary: {
          latestImport: {
            sourceType: "instagram",
            sourceUrl: "https://instagram.com/acmeclinic",
          },
        },
      },
    ],
  });

  assert.ok(!merged.warnings.includes("missing_contact_signals"));
  assert.ok(!merged.warnings.includes("missing_service_signals"));
  assert.ok(!merged.warnings.includes("faq_help_content_not_detected"));
  assert.ok(
    merged.warnings.includes(
      "website_contact_signals_weak_but_supported_by_connected_instagram"
    )
  );
  assert.equal(merged.businessProfile.primaryEmail, "hello@acme.az");
  assert.equal(merged.services.length, 1);
});

test("Case N: website fetch plans retain richer browser header retries on the primary URL", () => {
  const plans = httpTest.prioritizeAttemptPlans(
    httpTest.buildAttemptPlans("https://saytpro.az", {}, "GET")
  );

  assert.ok(plans.length >= 5);
  assert.equal(plans[0].urlVariantIndex, 0);
  assert.equal(plans[1].urlVariantIndex, 0);
  assert.equal(plans[2].urlVariantIndex, 0);
  assert.equal(plans[3].urlVariantIndex, 0);
});

test("Case O: website fetch headers use root referer instead of path referer", () => {
  const headers = websiteFetchTest.buildFetchHeaders("https://saytpro.az/az/services", {});
  assert.equal(headers.referer, "https://saytpro.az/");
});

test("Case O2: website entry fetch budget no longer collapses into a 9000ms outer timeout", () => {
  const budget = websiteFetchTest.resolveEntryFetchBudget({
    totalTimeoutMs: 18000,
    attemptTimeoutMs: 14000,
  });

  assert.equal(budget.totalTimeoutBudgetMs, 18000);
  assert.equal(budget.entryAttemptTimeoutMs, 14000);
  assert.equal(budget.perCandidateTotalTimeoutMs, 18000);
});

test("Case P: auth DB health check fails closed instead of hanging on timeout", async () => {
  const db = {
    async query() {
      const err = new Error("Query read timed out");
      err.code = "QUERY_TIMEOUT";
      throw err;
    },
  };

  const ok = await checkDb(db);
  assert.equal(ok, false);
});

test("Case Q: auth login DB helper surfaces bounded timeout errors", async () => {
  const db = {
    async query() {
      const err = new Error("Query read timed out");
      err.code = "QUERY_TIMEOUT";
      throw err;
    },
  };

  await assert.rejects(
    () => queryDbWithTimeout(db, "select 1", [], { timeoutMs: 300 }),
    (err) => {
      assert.equal(isDbTimeoutError(err), true);
      assert.equal(err.code, "AUTH_DB_TIMEOUT");
      return true;
    }
  );
});

test("Case R: failed website processing stays sparse and strips placeholder identity fields", () => {
  const synthesis = normalizeSynthesisResult(
    {},
    {
      fallbackProfile: {
        companyName: "Google Maps",
        companySummaryShort:
          "Find local businesses, view maps and get driving directions in Google Maps.",
        companySummaryLong:
          "Find local businesses, view maps and get driving directions in Google Maps.",
        emails: ["info@company.com"],
        phones: ["+994 ..."],
        addresses: ["Primary address"],
      },
      sourceType: "website",
      sourceUrl: "https://saytpro.az",
      allowFallbackIdentity: false,
    }
  );

  const sanitized = sanitizeSetupReviewDraft({
    businessProfile: {
      ...synthesis.profile,
      companySummaryShort: synthesis.profile.summaryShort,
      companySummaryLong: synthesis.profile.summaryLong,
    },
    warnings: [
      "website_processing_failed_before_review",
      "website_review_data_partially_available_but_sync_could_not_complete",
    ],
  });

  assert.equal(sanitized.businessProfile.companyName, undefined);
  assert.equal(sanitized.businessProfile.primaryEmail, undefined);
  assert.equal(sanitized.businessProfile.primaryPhone, undefined);
  assert.equal(sanitized.businessProfile.primaryAddress, undefined);
  assert.equal(sanitized.businessProfile.companySummaryShort, undefined);
  assert.equal(sanitized.businessProfile.companySummaryLong, undefined);
  assert.deepEqual(sanitized.warnings, [
    "website_processing_failed_before_review",
    "website_review_data_partially_available_but_sync_could_not_complete",
  ]);
});

test("Case S: polluted failed active session is not silently reused", () => {
  const currentReview = {
    session: {
      id: "session-polluted",
      status: "ready",
      metadata: {
        intakeBundleKey: importTest.buildIntakeBundleKey({
          primarySource: {
            sourceType: "website",
            url: "https://saytpro.az",
          },
          sources: [
            {
              sourceType: "website",
              url: "https://saytpro.az",
              isPrimary: true,
            },
          ],
        }),
      },
    },
    draft: {
      warnings: ["website_processing_failed_before_review"],
      businessProfile: {
        companyName: "Google Maps",
        primaryEmail: "info@company.com",
        primaryPhone: "+994 ...",
        primaryAddress: "Primary address",
      },
      sourceSummary: {
        primarySourceType: "website",
        primarySourceUrl: "https://saytpro.az",
      },
    },
    sources: [],
  };

  assert.equal(importTest.isPollutedFailedReviewDraft(currentReview), true);

  const shouldReuse = importTest.shouldReuseSessionForImport({
    currentReview,
    incomingType: "website",
    incomingUrl: "https://saytpro.az",
    allowSessionReuse: true,
    nextIntakeContext: {
      primarySource: {
        sourceType: "website",
        url: "https://saytpro.az",
      },
      sources: [
        {
          sourceType: "website",
          url: "https://saytpro.az",
          isPrimary: true,
        },
      ],
    },
  });

  assert.equal(shouldReuse, false);
});

test("Case T: polluted draftPayload profile is sanitized and not recycled into analyze observations", () => {
  const draft = sanitizeSetupReviewDraft({
    draftPayload: {
      profile: {
        companyName: "Google Maps",
        primaryEmail: "info@company.com",
        primaryPhone: "+994 ...",
        primaryAddress: "Primary address",
        companySummaryLong:
          "Find local businesses, view maps and get driving directions in Google Maps.",
      },
    },
    businessProfile: {
      companyName: "Google Maps",
      primaryEmail: "info@company.com",
      primaryPhone: "+994 ...",
      primaryAddress: "Primary address",
    },
  });

  assert.deepEqual(sanitizeSetupBusinessProfile(draft.draftPayload.profile), {});

  const observations = intakeAnalyzeTest.buildReviewDraftSourceObservations({
    session: {
      primarySourceType: "website",
    },
    draft,
    sources: [],
  });

  assert.deepEqual(observations, []);
});

test("Case U: website draft shaping promotes valid fallback business/contact fields", () => {
  const shaped = draftTest.mapSynthesisProfileToBusinessProfile(
    {
      displayName: "Services",
      businessNames: ["Alpha Studio"],
      headings: ["Home", "Alpha Studio"],
      phones: ["Phone", "+994 50 111 22 33"],
      emails: ["info@company.com", "hello@alpha.az"],
      addresses: ["Address", "Nizami street 10, Baku"],
      aboutSection:
        "Alpha Studio helps local businesses with brand strategy and web design in Baku.",
      services: [],
      products: ["Brand strategy", "Web design"],
      supportedLanguages: ["en"],
    },
    "website",
    "https://alpha.az"
  );

  assert.equal(shaped.companyName, "Alpha Studio");
  assert.equal(shaped.primaryPhone, "+994 50 111 22 33");
  assert.equal(shaped.primaryEmail, "hello@alpha.az");
  assert.equal(shaped.primaryAddress, "Nizami street 10, Baku");
  assert.ok(/Alpha Studio/i.test(shaped.companySummaryShort));
  assert.deepEqual(shaped.services, ["Brand strategy", "Web design"]);
});

test("Case V: low-confidence website summary falls back to deterministic clean draft text", () => {
  const shaped = draftTest.mapSynthesisProfileToBusinessProfile(
    {
      companyName: "Alpha Studio",
      summaryShort: "Read more | Learn more | Contact us",
      summaryLong: "Read more | Learn more | Contact us",
      services: ["Brand strategy", "Web design"],
      primaryPhone: "+994501112233",
      fieldConfidence: {
        summaryShort: { score: 0.2, label: "low" },
        summaryLong: { score: 0.2, label: "low" },
      },
      reviewFlags: ["weak_summary"],
    },
    "website",
    "https://alpha.az"
  );

  assert.ok(!/read more|learn more|contact us/i.test(shaped.companySummaryShort));
  assert.ok(/Alpha Studio/i.test(shaped.companySummaryShort));
  assert.ok(/Brand strategy|Web design/i.test(shaped.companySummaryShort));
  assert.ok(/provides Brand strategy|provides Web design/i.test(shaped.companySummaryLong));
});

test("Case W: partial website barrier still seeds a usable setup review draft from extracted signals", () => {
  const barrierSeed = barrierTest.buildWebsiteBarrierSeedProfile({
    sourceUrl: "https://alpha.az",
    extracted: {
      sourceUrl: "https://alpha.az",
      finalUrl: "https://alpha.az/",
      site: {
        sourceUrl: "https://alpha.az",
        finalUrl: "https://alpha.az/",
        pagesScanned: 1,
        linksScanned: 8,
        socialLinks: [],
        whatsappLinks: [],
        bookingLinks: [],
        pageTypeCounts: {
          about: 1,
          contact: 1,
        },
        identitySignals: {
          nameCandidates: ["Alpha Studio"],
          descriptionCandidates: [
            "Alpha Studio helps local businesses with brand strategy and web design in Baku.",
          ],
          contactEmails: ["hello@alpha.az"],
          contactPhones: ["+994 50 111 22 33"],
          addresses: ["Nizami street 10, Baku"],
          hours: [],
          serviceHints: ["Brand strategy", "Web design"],
          pricingHints: [],
          faqPreview: [],
        },
        quality: {
          score: 32,
          band: "weak",
          warnings: ["website_processing_failed_before_review"],
        },
      },
      crawl: {
        warnings: ["website_processing_failed_before_review"],
      },
      pages: [
        {
          title: "Alpha Studio",
          metaDescription:
            "Brand strategy and web design for local businesses in Baku.",
          headings: ["Alpha Studio", "Brand strategy", "Web design"],
          paragraphs: [
            "Alpha Studio helps local businesses with brand strategy and web design in Baku.",
          ],
          sections: {
            about:
              "Alpha Studio helps local businesses with brand strategy and web design in Baku.",
          },
        },
      ],
    },
  });

  const shaped = draftTest.mapSynthesisProfileToBusinessProfile(
    barrierSeed,
    "website",
    "https://alpha.az"
  );

  assert.equal(shaped.companyName, "Alpha Studio");
  assert.equal(shaped.primaryEmail, "hello@alpha.az");
  assert.equal(shaped.primaryPhone, "+994 50 111 22 33");
  assert.equal(shaped.primaryAddress, "Nizami street 10, Baku");
  assert.ok(/Alpha Studio/i.test(shaped.companySummaryShort));
  assert.ok(shaped.services.some((item) => /web design/i.test(item)));
  assert.ok(shaped.services.length >= 1);
});

test("Case W1: clean structured website draft does not get downgraded to weak review posture", () => {
  const shaped = draftTest.mapSynthesisProfileToBusinessProfile(
    {
      companyName: "North Clinic",
      summaryShort: "North Clinic provides cosmetic dentistry and implant services in Baku.",
      summaryLong:
        "North Clinic provides cosmetic dentistry, implants, whitening, and family care in Baku.",
      primaryEmail: "hello@north.az",
      primaryPhone: "+994 50 222 33 44",
      primaryAddress: "14 Nizami Street, Baku",
      services: ["Cosmetic dentistry", "Dental implants"],
      faqItems: [
        {
          question: "Do you offer implants?",
          answer: "Yes, implant consultations are available.",
        },
      ],
      pricingHints: ["Consultation from 30 AZN"],
      hours: ["Mon-Fri 09:00-18:00"],
      supportedLanguages: ["az", "en"],
      primaryLanguage: "az",
    },
    "website",
    "https://north.az"
  );

  const warnings = importTest.buildWeakWebsiteDraftWarnings({
    businessProfile: shaped,
  });

  assert.equal(shaped.companyName, "North Clinic");
  assert.deepEqual(shaped.supportedLanguages, ["az", "en"]);
  assert.deepEqual(shaped.hours, ["Mon-Fri 09:00-18:00"]);
  assert.deepEqual(warnings, []);
  assert.equal(importTest.shouldForcePartialModeFromWarnings(warnings), false);
});

test("Case W2: thin website evidence stays explicitly weak and partial", () => {
  const warnings = importTest.buildWeakWebsiteDraftWarnings({
    businessProfile: {
      websiteUrl: "https://thin.example",
    },
  });

  assert.ok(warnings.includes("website_review_data_partially_available"));
  assert.ok(warnings.includes("website_identity_signals_weak"));
  assert.ok(warnings.includes("website_contact_signals_weak"));
  assert.ok(warnings.includes("website_service_signals_weak"));
  assert.equal(importTest.shouldForcePartialModeFromWarnings(warnings), true);
});

test("Case W3: website drafts do not invent pricing when no public pricing exists", () => {
  const shaped = draftTest.mapSynthesisProfileToBusinessProfile(
    {
      companyName: "Quiet Studio",
      summaryShort: "Quiet Studio provides therapy and coaching sessions.",
      primaryEmail: "hello@quiet.example",
      services: ["Therapy", "Coaching"],
      faqItems: [
        {
          question: "How do I book?",
          answer: "Contact the studio to arrange a consultation.",
        },
      ],
    },
    "website",
    "https://quiet.example"
  );

  assert.deepEqual(shaped.pricingHints || [], []);
  assert.equal(shaped.pricingPolicy, undefined);
  assert.equal(shaped.pricingText, undefined);
});

test("Case W4: missing public contact signals stay review-needed instead of looking complete", () => {
  const shaped = draftTest.mapSynthesisProfileToBusinessProfile(
    {
      companyName: "No Contact Studio",
      summaryShort: "Brand design and website systems for local businesses.",
      services: ["Brand design", "Website systems"],
      faqItems: [
        {
          question: "Do you work remotely?",
          answer: "Yes, remote delivery is available.",
        },
      ],
    },
    "website",
    "https://nocontact.example"
  );

  const warnings = importTest.buildWeakWebsiteDraftWarnings({
    businessProfile: shaped,
  });

  assert.ok(warnings.includes("website_contact_signals_weak"));
  assert.equal(importTest.shouldForcePartialModeFromWarnings(warnings), true);
});

test("Case W5: multilingual websites and messy hours stay as draft evidence, not false canonical polish", () => {
  const shaped = draftTest.mapSynthesisProfileToBusinessProfile(
    {
      companyName: "Harbor Clinic",
      summaryShort: "Harbor Clinic serves local and expat patients in Baku.",
      primaryEmail: "hello@harbor.example",
      primaryPhone: "+994 50 333 44 55",
      services: ["Consultation", "Ultrasound"],
      supportedLanguages: ["az", "en", "ru"],
      primaryLanguage: "az",
      hours: [
        "Mon-Fri 9ish until late",
        "Weekends by appointment",
      ],
    },
    "website",
    "https://harbor.example"
  );

  assert.deepEqual(shaped.supportedLanguages, ["az", "en", "ru"]);
  assert.deepEqual(shaped.hours, [
    "Mon-Fri 9ish until late",
    "Weekends by appointment",
  ]);
  assert.equal(shaped.mainLanguage, "az");
});

test("Case X: website draft shaping does not invent language fields without source support", () => {
  const shaped = draftTest.mapSynthesisProfileToBusinessProfile(
    {
      companyName: "Harbor Accounting",
      websiteUrl: "https://harbor.example",
      primaryPhone: "+442079460958",
      primaryEmail: "hello@harbor.example",
      services: ["Bookkeeping", "VAT filing"],
    },
    "website",
    "https://harbor.example"
  );

  assert.equal("mainLanguage" in shaped, false);
  assert.equal("primaryLanguage" in shaped, false);
  assert.equal("supportedLanguages" in shaped, false);
});

test("Case Y: requested review lock parsing and concurrency info use explicit draft version", () => {
  const lock = setupTest.normalizeRequestedReviewLock({
    metadata: {
      sessionId: "session-1",
      draftVersion: 7,
    },
  });

  assert.deepEqual(lock, {
    sessionId: "session-1",
    draftVersion: 7,
  });

  const concurrency = setupTest.buildReviewConcurrencyInfo({
    session: {
      id: "session-1",
      status: "ready",
      currentStep: "review",
      metadata: {
        canonicalBaseline: {
          capturedAt: "2026-03-25T00:00:00.000Z",
        },
      },
    },
    draft: {
      version: 7,
    },
  });

  assert.deepEqual(concurrency, {
    sessionId: "session-1",
    draftVersion: 7,
    sessionStatus: "ready",
    currentStep: "review",
    protectionMode: "canonical_baseline_drift",
    baselineCaptured: true,
  });
});

test("Case Y: canonical truth helpers expose approved truth fields, provenance, and version history", () => {
  const profile = setupTest.buildCanonicalTruthProfile({
    company_name: "Alpha Studio",
    summary_short: "Brand strategy",
    website_url: "https://alpha.example",
    primary_email: "hello@alpha.example",
    approved_by: "reviewer-1",
    approved_at: "2026-03-25T01:00:00.000Z",
    profile_json: {
      fieldSources: {
        companyName: {
          sourceType: "website",
          sourceUrl: "https://alpha.example",
          authorityRank: 300,
        },
      },
      services: ["Brand strategy"],
    },
  });

  assert.equal(profile.companyName, "Alpha Studio");
  assert.equal(profile.websiteUrl, "https://alpha.example");
  assert.deepEqual(profile.services, ["Brand strategy"]);

  const provenance = setupTest.buildCanonicalTruthFieldProvenance({
    profile_json: {
      fieldSources: {
        companyName: {
          sourceType: "website",
          sourceUrl: "https://alpha.example",
          authorityRank: 300,
        },
      },
    },
  });

  assert.deepEqual(provenance.companyName, {
    sourceType: "website",
    sourceUrl: "https://alpha.example",
    authorityRank: 300,
  });

  const enrichedProvenance = setupTest.buildCanonicalTruthFieldProvenance({
    profile_json: {
      fieldSources: {
        companyName: {
          sourceType: "website",
          sourceUrl: "https://alpha.example",
          authorityRank: 300,
          trustTier: "official_website",
          trustScore: 0.9,
          freshnessBucket: "fresh",
          conflictClassification: "stronger_source_wins",
        },
      },
    },
  });

  assert.equal(enrichedProvenance.companyName.trustTier, "official_website");
  assert.equal(enrichedProvenance.companyName.freshnessBucket, "fresh");
  assert.equal(
    enrichedProvenance.companyName.conflictClassification,
    "stronger_source_wins"
  );

  const history = setupTest.buildTruthVersionHistoryEntry({
    id: "version-1",
    approved_at: "2026-03-25T01:00:00.000Z",
    approved_by: "Reviewer",
    profile_snapshot_json: {
      companyName: "Alpha Studio",
    },
    field_provenance_json: {
      companyName: {
        sourceType: "website",
      },
    },
  });

  assert.equal(history.id, "version-1");
  assert.equal(history.approvedBy, "Reviewer");
  assert.equal(history.profile.companyName, "Alpha Studio");
  assert.equal(history.fieldProvenance.companyName.sourceType, "website");
});

test("Case Z: finalize projection writes a truth version snapshot from canonical rows", async () => {
  let versionInput = null;
  let serviceRows = [];

  const projected = await setupTest.projectSetupReviewDraftToCanonical(
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
          return { rows: [] };
        },
      },
      actor: {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        user: {
          name: "Reviewer",
        },
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
          fieldSources: {
            companyName: {
              sourceType: "website",
              sourceUrl: "https://alpha.example",
              authorityRank: 300,
            },
          },
        },
        capabilities: {
          supportsWhatsapp: true,
          primaryLanguage: "en",
        },
        sourceSummary: {
          primarySourceType: "website",
          primarySourceUrl: "https://alpha.example",
        },
        services: [],
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
            company_name: "Alpha Studio",
            summary_short: "Brand strategy and design",
            website_url: "https://alpha.example",
            profile_status: "approved",
            approved_by: "Reviewer",
            approved_at: "2026-03-25T02:00:00.000Z",
            profile_json: input.profileJson,
            source_summary_json: input.sourceSummaryJson,
          };
        },
        async upsertBusinessCapabilities(input) {
          return {
            id: "capabilities-1",
            approved_by: "Reviewer",
            supports_whatsapp: true,
            primary_language: "en",
            supported_languages: ["en"],
            capabilities_json: input.capabilitiesJson,
          };
        },
      },
      truthVersionHelper: {
        async createVersion(input) {
          versionInput = input;
          return {
            id: "version-1",
          };
        },
      },
    }
  );

  assert.equal(projected.projectedProfile, true);
    assert.equal(projected.projectedCapabilities, true);
    assert.equal(projected.truthVersion.id, "version-1");
    assert.ok(projected.impactSummary.canonicalAreas.includes("business_profile"));
    assert.ok(projected.impactSummary.runtimeAreas.includes("tenant_profile"));
    assert.equal(projected.approvalPolicy.strictestOutcome, "dual_approval_required");
    assert.ok(projected.approvalPolicy.requiredRoles.includes("admin_and_owner"));
    assert.equal(versionInput.reviewSessionId, "session-1");
  assert.equal(versionInput.businessProfileId, "profile-1");
  assert.equal(versionInput.businessCapabilitiesId, "capabilities-1");
  assert.equal(versionInput.profile.profile_json.companyName, "Alpha Studio");
  assert.equal(versionInput.capabilities.supports_whatsapp, true);
  assert.equal(
    versionInput.profile.source_summary_json.primarySourceUrl,
    "https://alpha.example"
  );
    assert.ok(
      versionInput.profile.source_summary_json.finalizeImpact.canonicalAreas.includes(
        "business_profile"
      )
    );
    assert.equal(
      versionInput.profile.source_summary_json.approvalPolicy.strictestOutcome,
      "dual_approval_required"
    );
      assert.ok(
        versionInput.metadataJson.finalizeImpact.runtimeAreas.includes("tenant_profile")
      );
      assert.equal(
        versionInput.metadataJson.approvalPolicy.strictestOutcome,
        "dual_approval_required"
      );
    assert.deepEqual(versionInput.services, []);
    });

test("Case Z1: finalize projection reuses the latest approved truth version when no new version is required", async () => {
  const projected = await setupTest.projectSetupReviewDraftToCanonical(
    {
      db: {
        async query(sql) {
          if (sql.includes("from tenant_setup_review_sessions")) {
            return {
              rows: [{ id: "session-1" }],
            };
          }
          if (sql.includes("from tenants")) {
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
              rows: [],
            };
          }
          return { rows: [] };
        },
      },
      actor: {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        user: {
          name: "Reviewer",
        },
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
        services: [],
        knowledgeItems: [],
      },
      sources: [],
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
            profile_status: "approved",
            approved_by: "Reviewer",
            approved_at: "2026-03-25T02:00:00.000Z",
            profile_json: input.profileJson,
            source_summary_json: input.sourceSummaryJson,
          };
        },
        async upsertBusinessCapabilities(input) {
          return {
            id: "capabilities-1",
            approved_by: "Reviewer",
            capabilities_json: input.capabilitiesJson,
          };
        },
      },
      truthVersionHelper: {
        async createVersion() {
          return null;
        },
        async getLatestVersion() {
          return {
            id: "version-existing-1",
            approved_at: "2026-03-25T02:00:00.000Z",
            approved_by: "Reviewer",
          };
        },
      },
    }
  );

  assert.equal(projected.truthVersionCreated, false);
  assert.equal(projected.truthVersion.id, "version-existing-1");
});

test("Case Z2: finalize preserves niche-aware behavior into approved truth and runtime", async () => {
  let versionInput = null;
  let savedProfile = null;
  let savedCapabilities = null;

  const projected = await setupTest.projectSetupReviewDraftToCanonical(
    {
      db: {
        async query(sql) {
          if (sql.includes("from tenant_setup_review_sessions")) {
            return {
              rows: [{ id: "session-1" }],
            };
          }
          if (sql.includes("from tenants")) {
            return {
              rows: [
                {
                  id: "tenant-1",
                  tenant_key: "alpha",
                  company_name: "North Clinic",
                },
              ],
            };
          }
          if (sql.includes("from tenant_services")) {
            return {
              rows: [],
            };
          }
          return { rows: [] };
        },
      },
      actor: {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        user: {
          name: "Reviewer",
        },
      },
      session: {
        id: "session-1",
        primarySourceType: "website",
      },
      draft: {
        version: 5,
        businessProfile: {
          companyName: "North Clinic",
          nicheBehavior: {
            businessType: "clinic",
            niche: "clinic",
            subNiche: "cosmetic_dentistry",
            conversionGoal: "book_consultation",
            primaryCta: "book your consultation",
            leadQualificationMode: "service_booking_triage",
            qualificationQuestions: [
              "What treatment are you interested in?",
              "What day works best for you?",
            ],
            bookingFlowType: "appointment_request",
            handoffTriggers: ["human_request", "medical_urgency"],
            disallowedClaims: ["diagnosis_or_treatment_guarantees"],
            toneProfile: "warm_reassuring",
            channelBehavior: {
              voice: {
                primaryAction: "book_or_route_call",
                qualificationDepth: "guided",
              },
              content: {
                reviewBias: "strict",
              },
            },
          },
        },
        capabilities: {
          supportsVoice: true,
          canOfferBooking: true,
          primaryLanguage: "en",
        },
        sourceSummary: {
          primarySourceType: "website",
          primarySourceUrl: "https://north.example",
        },
        services: [],
        knowledgeItems: [],
      },
      sources: [
        {
          sourceId: "source-1",
          sourceType: "website",
          role: "primary",
          sourceUrl: "https://north.example",
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
          savedProfile = {
            id: "profile-2",
            tenant_key: "alpha",
            company_name: "North Clinic",
            profile_status: "approved",
            approved_by: "Reviewer",
            approved_at: "2026-03-29T12:00:00.000Z",
            profile_json: input.profileJson,
            metadata_json: input.metadataJson,
            source_summary_json: input.sourceSummaryJson,
          };
          return savedProfile;
        },
        async upsertBusinessCapabilities(input) {
          savedCapabilities = {
            id: "capabilities-2",
            approved_by: "Reviewer",
            supports_voice: true,
            can_offer_booking: true,
            primary_language: "en",
            supported_languages: ["en"],
            capabilities_json: input.capabilitiesJson,
            metadata_json: input.metadataJson,
          };
          return savedCapabilities;
        },
      },
      truthVersionHelper: {
        async createVersion(input) {
          versionInput = input;
          return {
            id: "version-2",
          };
        },
      },
    }
  );

  assert.equal(
    versionInput.profile.profile_json.nicheBehavior.conversionGoal,
    "book_consultation"
  );
  assert.equal(
    versionInput.profile.profile_json.nicheBehavior.channelBehavior.voice.primaryAction,
    "book_or_route_call"
  );
  assert.equal(
    versionInput.capabilities.metadata_json.nicheBehavior.bookingFlowType,
    "appointment_request"
  );
  assert.ok(projected.impactSummary.runtimeAreas.includes("behavioral_policy"));
  assert.ok(projected.approvalPolicy.runtimeAreas.includes("behavioral_policy"));

  const runtimeProjection = buildTenantRuntimeProjection({
    tenant: {
      id: "tenant-1",
      tenant_key: "alpha",
      company_name: "North Clinic",
      default_language: "en",
    },
    profile: savedProfile,
    capabilities: savedCapabilities,
    contacts: [],
    locations: [],
    hours: [],
    services: [],
    products: [],
    faq: [],
    policies: [],
    socialAccounts: [],
    channels: [],
    mediaAssets: [],
    knowledge: [],
    facts: [],
    operationalFacts: [],
    publishedTruthFacts: [],
    channelPolicies: [],
    operationalChannelPolicies: [],
    synthesis: {},
  });

  assert.equal(runtimeProjection.behavior_json.businessType, "clinic");
  assert.equal(runtimeProjection.behavior_json.primaryCta, "book your consultation");
  assert.deepEqual(runtimeProjection.behavior_json.qualificationQuestions, [
    "What treatment are you interested in?",
    "What day works best for you?",
  ]);
  assert.equal(
    runtimeProjection.behavior_json.channelBehavior.voice.primaryAction,
    "book_or_route_call"
  );
});

test("Case AA: truth version change detection ignores approval-event metadata-only churn", () => {
  const unchanged = truthVersionTest.hasTruthVersionChanged(
    {
      approved_at: "2026-03-25T01:00:00.000Z",
      approved_by: "Reviewer A",
      source_summary_json: {
        primarySourceType: "website",
      },
      profile_snapshot_json: {
        companyName: "Alpha Studio",
      },
      capabilities_snapshot_json: {
        supportsWhatsapp: true,
      },
      field_provenance_json: {
        companyName: {
          sourceType: "website",
        },
      },
    },
    {
      approved_at: "2026-03-25T02:00:00.000Z",
      approved_by: "Reviewer B",
      source_summary_json: {
        primarySourceType: "website",
      },
      profile_snapshot_json: {
        companyName: "Alpha Studio",
      },
      capabilities_snapshot_json: {
        supportsWhatsapp: true,
      },
      field_provenance_json: {
        companyName: {
          sourceType: "website",
        },
      },
    }
  );

  assert.equal(unchanged, false);
});

test("Case AB: truth version compare exposes structured changed fields and safe summaries", () => {
  const diff = truthVersionTest.buildTruthVersionCompare(
    {
      id: "version-2",
      previous_version_id: "version-1",
      profile_snapshot_json: {
        companyName: "Alpha Studio",
        websiteUrl: "https://alpha.example",
      },
      capabilities_snapshot_json: {
        supportsWhatsapp: true,
        primaryLanguage: "en",
      },
      field_provenance_json: {
        companyName: {
          sourceType: "website",
        },
      },
      source_summary_json: {
        primarySourceType: "website",
      },
    },
    {
      id: "version-1",
      profile_snapshot_json: {
        companyName: "Alpha Labs",
        websiteUrl: "https://alpha.example",
      },
      capabilities_snapshot_json: {
        supportsWhatsapp: false,
        primaryLanguage: "en",
      },
      field_provenance_json: {},
      source_summary_json: {
        primarySourceType: "website",
      },
    }
  );

  assert.equal(diff.versionId, "version-2");
  assert.equal(diff.previousVersionId, "version-1");
  assert.deepEqual(diff.changedFields, [
    "profile.companyName",
    "capabilities.supportsWhatsapp",
    "fieldProvenance.companyName.sourceType",
  ]);
  assert.equal(diff.summary.totalChangedFields, 3);
  assert.deepEqual(diff.summary.profileChangedFields, ["profile.companyName"]);
  assert.equal(diff.fieldChanges[0].beforeSummary.kind, "string");
  assert.equal(diff.fieldChanges[0].afterSummary.value, "Alpha Studio");

  const versionDiff = truthVersionTest.buildTruthVersionDiffModel(
    {
      id: "version-2",
      previous_version_id: "version-1",
      approved_at: "2026-03-25T03:00:00.000Z",
      profile_snapshot_json: {
        companyName: "Alpha Studio",
        primaryPhone: "+15551112222",
      },
      capabilities_snapshot_json: {
        supportsWhatsapp: true,
      },
    },
    {
      id: "version-1",
      approved_at: "2026-03-25T02:00:00.000Z",
      profile_snapshot_json: {
        companyName: "Alpha Labs",
        primaryPhone: "+15550000000",
      },
      capabilities_snapshot_json: {
        supportsWhatsapp: false,
      },
    }
  );

  assert.deepEqual([...versionDiff.canonicalAreasChanged].sort(), [
    "business_capabilities",
    "business_profile",
  ]);
  assert.deepEqual([...versionDiff.runtimeAreasLikelyAffected].sort(), [
    "channel_capabilities",
    "contact_channels",
    "tenant_profile",
  ]);
  assert.ok(versionDiff.affectedSurfaces.includes("voice"));
});

test("Case AC: truth payload history carries version linkage and diff metadata", async () => {
  const payload = await setupTest.loadSetupTruthPayload(
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
          return {
            company_name: "Alpha Studio",
            approved_at: "2026-03-25T03:00:00.000Z",
            approved_by: "Reviewer",
            profile_json: {
              fieldSources: {
                companyName: {
                  sourceType: "website",
                },
              },
            },
            source_summary_json: {
              primarySourceType: "website",
            },
          };
        },
      },
      truthVersionHelper: {
        async listVersions() {
          return [
            {
              id: "version-2",
              previous_version_id: "version-1",
              approved_at: "2026-03-25T03:00:00.000Z",
              approved_by: "Reviewer",
              profile_snapshot_json: {
                companyName: "Alpha Studio",
              },
              capabilities_snapshot_json: {
                supportsWhatsapp: true,
              },
              field_provenance_json: {
                companyName: {
                  sourceType: "website",
                },
              },
              source_summary_json: {
                primarySourceType: "website",
              },
            },
            {
              id: "version-1",
              approved_at: "2026-03-25T02:00:00.000Z",
              approved_by: "Reviewer",
              profile_snapshot_json: {
                companyName: "Alpha Labs",
              },
              capabilities_snapshot_json: {
                supportsWhatsapp: false,
              },
              field_provenance_json: {},
              source_summary_json: {
                primarySourceType: "website",
              },
            },
          ];
        },
        buildHistoryEntries(versions) {
          return versions.map((item) =>
            truthVersionTest.buildTruthVersionHistoryEntry(
              item,
              item.id === "version-2"
                ? truthVersionTest.buildTruthVersionCompare(item, versions[1])
                : truthVersionTest.buildTruthVersionCompare(item, null)
            )
          );
        },
      },
      setupBuilder: async () => ({ status: "ready" }),
    }
  );

  assert.equal(payload.truth.history.length, 2);
  assert.equal(payload.truth.history[0].previousVersionId, "version-1");
  assert.deepEqual(payload.truth.history[0].diff.changedFields, [
    "profile.companyName",
    "capabilities.supportsWhatsapp",
    "fieldProvenance.companyName.sourceType",
  ]);
});

test("Case AD: truth version detail payload exposes compare data for a selected version", async () => {
  const payload = await setupTest.loadSetupTruthVersionPayload(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        role: "owner",
        tenant: null,
      },
      versionId: "version-2",
    },
    {
      truthVersionHelper: {
        async compareVersions() {
          return {
            version: {
              id: "version-2",
              previous_version_id: "version-1",
              approved_at: "2026-03-25T03:00:00.000Z",
              approved_by: "Reviewer",
              profile_snapshot_json: {
                companyName: "Alpha Studio",
              },
              capabilities_snapshot_json: {
                supportsWhatsapp: true,
              },
              field_provenance_json: {},
              source_summary_json: {},
            },
            previousVersion: {
              id: "version-1",
              approved_at: "2026-03-25T02:00:00.000Z",
              approved_by: "Reviewer",
              profile_snapshot_json: {
                companyName: "Alpha Labs",
              },
              capabilities_snapshot_json: {
                supportsWhatsapp: false,
              },
              field_provenance_json: {},
              source_summary_json: {},
            },
            currentVersion: {
              id: "version-3",
              approved_at: "2026-03-25T04:00:00.000Z",
              approved_by: "Reviewer",
              profile_snapshot_json: {
                companyName: "Alpha Studio HQ",
              },
              capabilities_snapshot_json: {
                supportsWhatsapp: true,
              },
              field_provenance_json: {},
              source_summary_json: {},
            },
            diff: {
              versionId: "version-2",
              previousVersionId: "version-1",
              changedFields: ["profile.companyName"],
              fieldChanges: [
                {
                  path: "profile.companyName",
                },
              ],
              summary: {
                totalChangedFields: 1,
              },
            },
            versionDiff: {
              canonicalAreasChanged: ["business_profile"],
              runtimeAreasLikelyAffected: ["tenant_profile"],
            },
            rollbackPreview: {
              rollbackDisposition: "follow_up_required",
              canonicalPathsChangedBack: ["profile.companyName"],
            },
            rollbackAction: {
              actionType: "execute_safe_rollback",
              allowed: false,
            },
          };
        },
      },
      setupBuilder: async () => ({ status: "ready" }),
    }
  );

  assert.equal(payload.truthVersion.id, "version-2");
  assert.equal(payload.previousTruthVersion.id, "version-1");
  assert.equal(payload.currentTruthVersion.id, "version-3");
  assert.deepEqual(payload.compare.changedFields, ["profile.companyName"]);
  assert.deepEqual(payload.versionDiff.canonicalAreasChanged, ["business_profile"]);
  assert.equal(payload.rollbackPreview.rollbackDisposition, "follow_up_required");
  assert.equal(payload.rollbackAction.actionType, "execute_safe_rollback");
});

test("Case AE: governed rollback is blocked for operator follow-up cases and emits audit context", async () => {
  const decisionEvents = [];
  const audits = [];

  const result = await executeTruthVersionRollbackInternal(
    {},
    {
      tenantId: "tenant-1",
      tenantKey: "alpha",
      targetVersionId: "version-3",
      actor: {
        role: "operator",
        user: {
          email: "operator@aihq.test",
        },
      },
    },
    {
      async resolveTenantIdentity() {
        return { tenant_id: "tenant-1", tenant_key: "alpha" };
      },
      async getTruthVersionByIdInternal() {
        return {
          id: "version-3",
          approved_at: "2026-03-25T03:00:00.000Z",
          approved_by: "Reviewer",
          profile_snapshot_json: {
            companyName: "North Clinic",
            primaryPhone: "+15551112222",
          },
          capabilities_snapshot_json: {
            supportsWhatsapp: true,
          },
        };
      },
      async getLatestTruthVersionInternal() {
        return {
          id: "version-4",
          approved_at: "2026-03-26T03:00:00.000Z",
          approved_by: "Reviewer",
          profile_snapshot_json: {
            companyName: "North Clinic HQ",
            primaryPhone: "+15550000000",
          },
          capabilities_snapshot_json: {
            supportsWhatsapp: true,
          },
        };
      },
      async safeAppendDecisionEvent(_db, event) {
        decisionEvents.push(event);
        return event;
      },
      async dbAudit(_db, actor, action, objectType, objectId, meta) {
        audits.push({ actor, action, objectType, objectId, meta });
      },
    }
  );

  assert.equal(result.blocked, true);
  assert.equal(result.rollbackReceipt.rollbackStatus, "blocked");
  assert.equal(result.rollbackAction.requiredRole, "admin");
  assert.match(result.rollbackAction.reason, /operator execution is not permitted/i);
  assert.equal(decisionEvents[0].eventType, "blocked_action_outcome");
  assert.equal(audits[0].action, "truth.rollback.blocked");
});

test("Case AF: owner governed rollback creates a new version, verifies runtime, and records rollback events", async () => {
  const decisionEvents = [];
  const audits = [];

  const result = await executeTruthVersionRollbackInternal(
    {},
    {
      tenantId: "tenant-1",
      tenantKey: "alpha",
      targetVersionId: "version-3",
      actor: {
        role: "owner",
        user: {
          email: "owner@aihq.test",
        },
      },
    },
    {
      async resolveTenantIdentity() {
        return { tenant_id: "tenant-1", tenant_key: "alpha" };
      },
      async getTruthVersionByIdInternal() {
        return {
          id: "version-3",
          approved_at: "2026-03-25T03:00:00.000Z",
          approved_by: "Reviewer",
          source_summary_json: {
            primarySourceType: "website",
          },
          profile_snapshot_json: {
            companyName: "North Clinic",
            primaryPhone: "+15551112222",
          },
          capabilities_snapshot_json: {
            supportsWhatsapp: true,
            handoffEnabled: true,
          },
          field_provenance_json: {
            companyName: {
              sourceType: "website",
            },
          },
          metadata_json: {},
        };
      },
      async getLatestTruthVersionInternal() {
        return {
          id: "version-4",
          approved_at: "2026-03-26T03:00:00.000Z",
          approved_by: "Reviewer",
          profile_snapshot_json: {
            companyName: "North Clinic HQ",
            primaryPhone: "+15550000000",
          },
          capabilities_snapshot_json: {
            supportsWhatsapp: false,
            handoffEnabled: false,
          },
          field_provenance_json: {},
          source_summary_json: {},
          metadata_json: {},
        };
      },
      async withTx(_db, fn) {
        return fn({});
      },
      async getBusinessProfileInternal() {
        return { id: "profile-current" };
      },
      async getBusinessCapabilitiesInternal() {
        return { id: "cap-current" };
      },
      async upsertBusinessProfileInternal(_db, input) {
        return {
          id: "profile-rollback",
          approved_at: "2026-03-28T10:20:00.000Z",
          approved_by: "owner@aihq.test",
          source_summary_json: input.sourceSummaryJson,
          profile_json: input.profileJson,
          company_name: input.companyName,
          primary_phone: input.primaryPhone,
        };
      },
      async upsertBusinessCapabilitiesInternal(_db, input) {
        return {
          id: "cap-rollback",
          approved_by: "owner@aihq.test",
          supports_whatsapp: input.supportsWhatsapp,
        };
      },
      async createTruthVersionInternal() {
        return {
          id: "version-5",
          approved_at: "2026-03-28T10:20:00.000Z",
          approved_by: "owner@aihq.test",
          profile_snapshot_json: {
            companyName: "North Clinic",
            primaryPhone: "+15551112222",
          },
          capabilities_snapshot_json: {
            supportsWhatsapp: true,
            handoffEnabled: true,
          },
          field_provenance_json: {
            companyName: {
              sourceType: "website",
            },
          },
          source_summary_json: {},
          metadata_json: {},
        };
      },
      async refreshRuntimeProjectionRequired() {
        return {
          id: "projection-rollback-1",
          status: "refreshed",
          affectedSurfaces: ["inbox", "voice"],
          health: {
            status: "healthy",
            warnings: [],
          },
        };
      },
      async safeAppendDecisionEvent(_db, event) {
        decisionEvents.push(event);
        return event;
      },
      async dbAudit(_db, actor, action, objectType, objectId, meta) {
        audits.push({ actor, action, objectType, objectId, meta });
      },
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.blocked, false);
  assert.equal(result.rollbackReceipt.rollbackStatus, "partial_success");
  assert.equal(result.rollbackReceipt.resultingTruthVersionId, "version-5");
  assert.equal(result.rollbackReceipt.runtimeProjectionId, "projection-rollback-1");
  assert.equal(result.rollbackReceipt.previewComparison.status, "partial_match");
  assert.equal(decisionEvents[0].reasonCodes[0], "rollback_requested");
  assert.equal(decisionEvents[1].reasonCodes[0], "rollback_executed");
  assert.equal(decisionEvents[2].eventType, "runtime_health_transition");
  assert.equal(audits[0].action, "truth.rollback.executed");
});
