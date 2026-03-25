import test from "node:test";
import assert from "node:assert/strict";

import { __test__ } from "./truth.js";

test("normalizeTruthResponse maps approved truth metadata, provenance, and history", () => {
  const normalized = __test__.normalizeTruthResponse(
    {
      truth: {
        profile: {
          companyName: "North Clinic",
          websiteUrl: "https://north.example",
        },
        fieldProvenance: {
          companyName: {
            sourceLabel: "Website",
            sourceUrl: "https://north.example/about",
            authorityRank: 1,
          },
        },
        approvedAt: "2026-03-25T10:00:00.000Z",
        approvedBy: "reviewer@aihq.test",
        profileStatus: "approved",
        history: [
          {
            id: "approval-1",
            version: "v3",
            versionLabel: "Truth version v3",
            approvedAt: "2026-03-24T09:00:00.000Z",
            approvedBy: "owner@aihq.test",
            sourceSummary: {
              primaryLabel: "Website",
              primaryUrl: "https://north.example/about",
              supportingCount: 2,
            },
            changedFields: ["companyName", "websiteUrl", "services"],
          },
        ],
      },
    },
    "/api/setup/truth/current"
  );

  assert.equal(normalized.source, "/api/setup/truth/current");
  assert.equal(normalized.hasTruth, true);
  assert.equal(normalized.hasApprovalMeta, true);
  assert.equal(normalized.hasHistory, true);
  assert.equal(normalized.hasProvenance, true);
  assert.equal(normalized.approval.approvedAt, "2026-03-25T10:00:00.000Z");
  assert.equal(normalized.approval.approvedBy, "reviewer@aihq.test");
  assert.equal(normalized.approval.version, "approved");
  assert.equal(normalized.history.length, 1);
  assert.equal(normalized.history[0].version, "v3");
  assert.equal(normalized.history[0].versionLabel, "Truth version v3");
  assert.match(normalized.history[0].sourceSummary, /Website/);
  assert.match(normalized.history[0].diffSummary, /companyName/);
  assert.match(normalized.fields[0].provenance, /Website/);
});

test("normalizeCompareResponse maps backend truth version compare detail", () => {
  const normalized = __test__.normalizeCompareResponse(
    {
      version: {
        id: "v3",
        version: "v3",
        versionLabel: "Truth version v3",
        approvedAt: "2026-03-25T10:00:00.000Z",
        approvedBy: "reviewer@aihq.test",
        sourceSummary: {
          primaryLabel: "Website",
          primaryUrl: "https://north.example/about",
        },
      },
      previousVersion: {
        id: "v2",
        version: "v2",
        versionLabel: "Truth version v2",
        approvedAt: "2026-03-24T09:00:00.000Z",
        approvedBy: "owner@aihq.test",
      },
      diff: {
        changedFields: ["companyName", "websiteUrl"],
        fieldChanges: [
          {
            key: "companyName",
            label: "Company name",
            before: { value: "Old Clinic" },
            after: { value: "North Clinic" },
          },
        ],
        sectionChanges: [
          {
            key: "identity",
            label: "Identity",
            summary: "Core business identity was refreshed.",
          },
        ],
      },
    },
    "v3",
    "v2"
  );

  assert.equal(normalized.selectedVersion.version, "v3");
  assert.equal(normalized.comparedVersion.version, "v2");
  assert.equal(normalized.changedFields.length, 2);
  assert.equal(normalized.fieldChanges.length, 1);
  assert.equal(normalized.fieldChanges[0].beforeSummary, "Old Clinic");
  assert.equal(normalized.fieldChanges[0].afterSummary, "North Clinic");
  assert.equal(normalized.sectionChanges.length, 1);
  assert.equal(normalized.hasStructuredDiff, true);
});
