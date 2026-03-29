import test from "node:test";
import assert from "node:assert/strict";

import {
  listSetupBusinessTruthFactsFromDraftOrPublished,
  stageBusinessTruthFactMutationInMaintenanceSession,
} from "../src/services/workspace/setup/draftBusinessFacts.js";

test("business truth fact mutation stages into maintenance review instead of mutating live facts", async () => {
  const captured = {
    sessionInput: null,
    patchInput: null,
  };

  const staged = await stageBusinessTruthFactMutationInMaintenanceSession({
    db: {},
    actor: {
      tenantId: "tenant-1",
      tenantKey: "alpha",
    },
    mode: "upsert",
    body: {
      fact_key: "company_summary",
      fact_group: "general",
      title: "Company Summary",
      value_text: "Trusted operator console for business truth.",
    },
    async getCurrentSetupReview() {
      return {
        session: null,
        draft: null,
      };
    },
    async getOrCreateActiveSetupReviewSession(input) {
      captured.sessionInput = input;
      return {
        id: "session-facts-1",
        mode: "refresh",
        status: "draft",
        currentStep: "maintenance_review",
        metadata: {},
      };
    },
    async patchSetupReviewDraft(input) {
      captured.patchInput = input;
      return {
        version: 6,
        businessFacts: input.patch.businessFacts,
        sourceSummary: input.patch.sourceSummary,
      };
    },
    async updateSetupReviewSession(sessionId, patch) {
      return {
        id: sessionId,
        ...patch,
      };
    },
    truthVersionHelper: {
      async getLatestVersion() {
        return {
          id: "truth-version-9",
          truth_facts_snapshot_json: [],
          metadata_json: {
            truthFactsSnapshot: [],
          },
        };
      },
    },
  });

  assert.equal(captured.sessionInput?.mode, "refresh");
  assert.equal(captured.patchInput?.patch?.businessFacts?.length, 1);
  assert.equal(captured.patchInput?.patch?.businessFacts?.[0]?.factKey, "company_summary");
  assert.equal(staged.publishStatus, "review_required");
  assert.equal(staged.reviewRequired, true);
  assert.equal(staged.liveMutationDeferred, true);
  assert.equal(staged.runtimeProjectionRefreshed, false);
});

test("business truth fact reads prefer staged draft and then published truth snapshot", async () => {
  const staged = await listSetupBusinessTruthFactsFromDraftOrPublished({
    db: {},
    actor: {
      tenantId: "tenant-1",
      tenantKey: "alpha",
    },
    async getCurrentSetupReview() {
      return {
        session: { id: "session-1" },
        draft: {
          businessFacts: [{ factKey: "company_summary", title: "Summary" }],
        },
      };
    },
  });

  assert.equal(staged.staged, true);
  assert.equal(staged.facts[0].factKey, "company_summary");

  const published = await listSetupBusinessTruthFactsFromDraftOrPublished({
    db: {},
    actor: {
      tenantId: "tenant-1",
      tenantKey: "alpha",
    },
    async getCurrentSetupReview() {
      return {
        session: null,
        draft: null,
      };
    },
    truthVersionHelper: {
      async getLatestVersion() {
        return {
          id: "truth-version-10",
          metadata_json: {
            truthFactsSnapshot: [{ factKey: "company_summary", title: "Summary" }],
          },
        };
      },
    },
  });

  assert.equal(published.staged, false);
  assert.equal(published.source, "published_truth_version");
  assert.equal(published.facts[0].factKey, "company_summary");
});
