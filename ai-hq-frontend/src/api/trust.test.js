import test from "node:test";
import assert from "node:assert/strict";

import { __test__ } from "./trust.js";

test("normalizeTrustViewResponse produces a stable trust view-model", () => {
  const normalized = __test__.normalizeTrustViewResponse({
    tenantId: "tenant-1",
    tenantKey: "acme",
    summary: {
      readiness: {
        status: "blocked",
        blockers: [
          {
            blocked: true,
            category: "runtime",
            dependencyType: "runtime_projection",
            reasonCode: "runtime_projection_missing",
            title: "Runtime projection blocker",
            nextAction: {
              id: "open_setup_route",
              kind: "route",
              label: "Open runtime setup",
              requiredRole: "operator",
              allowed: true,
              target: {
                path: "/setup/runtime",
              },
            },
          },
        ],
      },
      sources: {
        total: 2,
        connected: 1,
        enabled: 2,
      },
      runtimeProjection: {
        id: "projection-1",
        status: "ready",
        stale: false,
        readiness: {
          status: "ready",
          blockers: [],
        },
      },
      truth: {
        latestVersionId: "truth-v1",
        approvedAt: "2026-03-25T10:00:00.000Z",
        readiness: {
          status: "ready",
          blockers: [],
        },
      },
      setupReview: {
        active: false,
        readiness: {
          status: "ready",
          blockers: [],
        },
      },
      reviewQueue: {
        pending: 1,
        conflicts: 0,
      },
    },
    recentRuns: [
      {
        id: "run-1",
        sourceDisplayName: "Main Website",
        status: "completed",
      },
    ],
    audit: [
      {
        id: "audit-1",
        action: "settings.source.sync.requested",
        actor: "owner@example.com",
      },
    ],
  });

  assert.equal(normalized.tenantKey, "acme");
  assert.equal(normalized.summary.readiness.blocked, true);
  assert.equal(normalized.summary.readiness.blockedItems[0].reasonCode, "runtime_projection_missing");
  assert.equal(normalized.summary.sources.total, 2);
  assert.equal(normalized.recentRuns[0].sourceDisplayName, "Main Website");
  assert.equal(normalized.audit[0].action, "settings.source.sync.requested");
});
