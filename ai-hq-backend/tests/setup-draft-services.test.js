import test from "node:test";
import assert from "node:assert/strict";

import {
  stageSetupBusinessProfileMutation,
  stageSetupRuntimePreferencesMutation,
} from "../src/services/workspace/setup/draftProfile.js";
import {
  listSetupServicesFromDraftOrCanonical,
  stageSetupServiceMutation,
} from "../src/services/workspace/setup/draftServices.js";
import {
  buildImportArgs,
  enrichImportDataWithReview,
} from "../src/services/workspace/setup/importFlow.js";

test("business profile draft mutation stays staged and reloads current review payload", async () => {
  const patchCalls = [];
  const result = await stageSetupBusinessProfileMutation({
    db: { name: "db" },
    actor: {
      tenantId: "tenant-1",
      tenantKey: "alpha",
    },
    body: {
      companyName: "Alpha Studio",
      languages: ["az", "en"],
    },
    async getOrCreateSetupDraftSession() {
      return {
        session: {
          id: "session-1",
          currentStep: "review",
        },
        draft: {
          businessProfile: {},
          capabilities: {},
          draftPayload: {},
        },
      };
    },
    async patchSetupReviewDraft(input) {
      patchCalls.push(input);
      return { version: 4 };
    },
    async loadCurrentReviewPayload() {
      return {
        review: {
          draft: { version: 4 },
          session: { id: "session-1", currentStep: "review" },
        },
        setup: { status: "review_required" },
      };
    },
  });

  assert.equal(result.current.session.id, "session-1");
  assert.equal(result.draft.version, 4);
  assert.equal(patchCalls.length, 1);
  assert.equal(patchCalls[0].patch.businessProfile.companyName, "Alpha Studio");
  assert.deepEqual(patchCalls[0].patch.capabilities.supportedLanguages, ["az", "en"]);
  assert.equal(result.data.setup.status, "review_required");
});

test("runtime preferences draft mutation keeps canonical writes deferred in staged payload", async () => {
  const patchCalls = [];
  const result = await stageSetupRuntimePreferencesMutation({
    db: { name: "db" },
    actor: {
      tenantId: "tenant-1",
    },
    body: {
      defaultLanguage: "en",
      tone: "warm",
      policies: {
        inboxPolicy: {
          quietHoursEnabled: true,
        },
      },
    },
    async getOrCreateSetupDraftSession() {
      return {
        session: {
          id: "session-1",
        },
        draft: {
          businessProfile: {},
          capabilities: {},
          draftPayload: {},
        },
      };
    },
    async patchSetupReviewDraft(input) {
      patchCalls.push(input);
      return { version: 8 };
    },
    async loadCurrentReviewPayload() {
      return {
        review: {
          draft: { version: 8 },
          session: { id: "session-1" },
        },
        setup: { status: "review_required" },
      };
    },
  });

  assert.equal(result.staged.saved.defaultLanguage, "en");
  assert.equal(result.staged.saved.tone, "warm");
  assert.equal(
    patchCalls[0].patch.draftPayload.stagedInputs.runtimePreferences.policies.inboxPolicy
      .quietHoursEnabled,
    true
  );
});

test("service draft mutation edits only review draft services and preserves staged metadata", async () => {
  const patchCalls = [];
  const result = await stageSetupServiceMutation({
    db: { name: "db" },
    actor: {
      tenantId: "tenant-1",
    },
    mode: "create",
    body: {
      title: "Brand Strategy",
    },
    async getOrCreateSetupDraftSession() {
      return {
        session: {
          id: "session-1",
        },
        draft: {
          services: [],
          draftPayload: {},
        },
      };
    },
    async patchSetupReviewDraft(input) {
      patchCalls.push(input);
      return { version: 6 };
    },
    async loadCurrentReviewPayload() {
      return {
        review: {
          draft: { version: 6 },
          session: { id: "session-1" },
        },
        setup: { status: "review_required" },
      };
    },
  });

  assert.equal(result.review.session.id, "session-1");
  assert.equal(patchCalls.length, 1);
  assert.equal(patchCalls[0].patch.services[0].title, "Brand Strategy");
  assert.equal(patchCalls[0].patch.services[0].metadataJson.stagedInSetupReview, true);
  assert.equal(patchCalls[0].patch.draftPayload.stagedInputs.services.count, 1);
});

test("service listing prefers staged review draft over canonical catalog when session exists", async () => {
  const result = await listSetupServicesFromDraftOrCanonical({
    db: {},
    actor: {
      tenantId: "tenant-1",
    },
    async getCurrentSetupReview() {
      return {
        session: { id: "session-1" },
        draft: {
          services: [{ id: "draft_branding", title: "Branding" }],
        },
      };
    },
  });

  assert.equal(result.staged, true);
  assert.equal(result.canonicalWriteDeferred, true);
  assert.equal(result.services[0].title, "Branding");
});

test("import args and review enrichment stay isolated from canonical writes", async () => {
  const args = buildImportArgs({
    actor: {
      tenantId: "tenant-1",
      tenantKey: "alpha",
      role: "owner",
      user: {
        email: "ops@example.com",
        name: "Ops",
      },
    },
    body: {
      note: "refresh",
      metadataJson: {
        source: "manual",
      },
    },
    requestId: "req-1",
  });

  assert.equal(args.requestedBy, "ops@example.com");
  assert.equal(args.requestId, "req-1");
  assert.deepEqual(args.metadataJson, { source: "manual" });

  const enriched = await enrichImportDataWithReview(
    {
      actor: {
        tenantId: "tenant-1",
      },
      data: {
        ok: true,
        draft: {
          businessProfile: {
            companyName: "Alpha Studio",
          },
          services: [],
        },
      },
    },
    {
      async getCurrentSetupReview() {
        return {
          session: { id: "session-1", status: "ready" },
          draft: {
            businessProfile: {
              companyName: "Alpha Studio",
            },
            services: [],
            knowledgeItems: [],
            warnings: [],
            draftPayload: {},
          },
          sources: [],
        };
      },
      async listSetupReviewEvents() {
        return [{ eventType: "draft_patched" }];
      },
    }
  );

  assert.equal(enriched.review.session.id, "session-1");
  assert.equal(enriched.review.events.length, 1);
  assert.equal(enriched.profile.companyName, "Alpha Studio");
});
