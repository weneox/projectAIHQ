import test from "node:test";
import assert from "node:assert/strict";

import { projectSetupReviewDraftToCanonical } from "../src/services/workspace/setup/projection.js";

test("setup finalize projection drops legacy behavior metadata", async () => {
  const profileCalls = [];
  const capabilityCalls = [];
  const createdVersions = [];

  const result = await projectSetupReviewDraftToCanonical(
    {
      db: {
        async query(sql) {
          if (sql.includes("from tenant_setup_review_sessions")) {
            return { rows: [{ id: "session-1" }] };
          }
          if (sql.includes("from tenants")) {
            return { rows: [{ id: "tenant-1", tenant_key: "alpha" }] };
          }
          return { rows: [] };
        },
      },
      actor: {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        role: "owner",
        tenant: null,
        user: { name: "Ops" },
      },
      session: {
        id: "session-1",
        primarySourceType: "website",
      },
      draft: {
        version: 12,
        businessProfile: {
          companyName: "Runtime Dental",
          description: "Dental clinic in Baku",
          websiteUrl: "https://runtime.az",
          nicheBehavior: {
            tone: "friendly",
            greetingStyle: "warm",
            afterHoursBehavior: "take a message",
          },
        },
        services: [],
        knowledgeItems: [],
        sourceSummary: {
          primarySourceType: "website",
          primarySourceUrl: "https://runtime.az",
        },
      },
      sources: [
        {
          sourceType: "website",
          role: "primary",
          label: "Official website",
          sourceUrl: "https://runtime.az",
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
          profileCalls.push(input);
          return {
            id: "profile-1",
            profileJson: input.profileJson,
            approved_at: "2026-05-17T00:00:00.000Z",
            approved_by: "Ops",
          };
        },
        async upsertBusinessCapabilities(input) {
          capabilityCalls.push(input);
          return { id: "capabilities-1" };
        },
      },
      truthVersionHelper: {
        async getLatestVersion() {
          return { truth_facts_snapshot_json: [] };
        },
        async createVersion(input) {
          createdVersions.push(input);
          return { id: "truth-version-1", approvedAt: input.approvedAt, approvedBy: input.approvedBy };
        },
      },
    }
  );

  assert.equal(result.truthVersion.id, "truth-version-1");
  assert.equal(profileCalls.length, 1);
  assert.equal(capabilityCalls.length, 1);
  assert.equal(createdVersions.length, 1);

  const serialized = JSON.stringify({
    profile: profileCalls[0],
    capabilities: capabilityCalls[0],
    truthVersion: createdVersions[0],
    projectionSummary: result,
  });

  assert.doesNotMatch(
    serialized,
    /nicheBehavior|assistantBehaviorDraft|pricingBehavior|locationBehavior|bookingBehavior|contactBehavior|handoffBehavior|greetingStyle|afterHoursBehavior/
  );
});
