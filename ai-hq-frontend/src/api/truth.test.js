import { describe, expect, it } from "vitest";

import { __test__ } from "./truth.js";

describe("truth api normalization", () => {
it("normalizeTruthResponse maps approved truth metadata, provenance, and history", () => {
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
        sourceSummary: {
          governance: {
            disposition: "quarantined",
            quarantinedClaimCount: 2,
          },
          finalizeImpact: {
            canonicalAreas: ["profile"],
            runtimeAreas: ["voice"],
            affectedSurfaces: ["voice", "inbox"],
          },
        },
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

  expect(normalized.source).toBe("/api/setup/truth/current");
  expect(normalized.hasTruth).toBe(true);
  expect(normalized.hasApprovalMeta).toBe(true);
  expect(normalized.hasHistory).toBe(true);
  expect(normalized.hasProvenance).toBe(true);
  expect(normalized.approval.approvedAt).toBe("2026-03-25T10:00:00.000Z");
  expect(normalized.approval.approvedBy).toBe("reviewer@aihq.test");
  expect(normalized.approval.version).toBe("approved");
  expect(normalized.history).toHaveLength(1);
  expect(normalized.history[0].version).toBe("v3");
  expect(normalized.history[0].versionLabel).toBe("Truth version v3");
  expect(normalized.history[0].sourceSummary).toMatch(/Website/);
  expect(normalized.history[0].diffSummary).toMatch(/companyName/);
  expect(normalized.fields[0].provenance).toMatch(/Website/);
  expect(normalized.governance.quarantinedClaimCount).toBe(2);
  expect(normalized.finalizeImpact.runtimeAreas).toEqual(["voice"]);
});

it("normalizeCompareResponse maps backend truth version compare detail", () => {
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

  expect(normalized.selectedVersion.version).toBe("v3");
  expect(normalized.comparedVersion.version).toBe("v2");
  expect(normalized.changedFields).toHaveLength(2);
  expect(normalized.fieldChanges).toHaveLength(1);
  expect(normalized.fieldChanges[0].beforeSummary).toBe("Old Clinic");
  expect(normalized.fieldChanges[0].afterSummary).toBe("North Clinic");
  expect(normalized.sectionChanges).toHaveLength(1);
  expect(normalized.hasStructuredDiff).toBe(true);
});

it("approved truth unavailable snapshot refuses non-approved fallback data", () => {
  const snapshot = __test__.buildApprovedTruthUnavailableSnapshot();

  expect(snapshot.hasTruth).toBe(false);
  expect(snapshot.approvedTruthUnavailable).toBe(true);
  expect(snapshot.unavailableReasonCode).toBe("approved_truth_unavailable");
  expect(snapshot.notices[0]).toMatch(/no non-approved fallback data is being shown/i);
});
});
