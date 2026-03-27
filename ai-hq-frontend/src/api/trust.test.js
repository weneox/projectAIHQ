import { describe, expect, it } from "vitest";

import { __test__ } from "./trust.js";

describe("trust api normalization", () => {
it("normalizeTrustViewResponse produces a stable trust view-model", () => {
  const normalized = __test__.normalizeTrustViewResponse({
    tenantId: "tenant-1",
    tenantKey: "acme",
    viewerRole: "admin",
    permissions: {
      auditHistoryRead: {
        allowed: true,
      },
    },
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
        health: {
          present: true,
          usable: true,
          stale: false,
          status: "ready",
          reasonCode: "",
          canRepair: true,
        },
        repair: {
          canRepair: true,
          action: {
            id: "rebuild_runtime_projection",
            kind: "api",
            label: "Rebuild runtime projection",
            target: {
              path: "/api/settings/trust/runtime-projection/repair",
              method: "POST",
            },
          },
          latestRun: {
            id: "repair-1",
            status: "success",
          },
        },
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

  expect(normalized.tenantKey).toBe("acme");
  expect(normalized.viewerRole).toBe("admin");
  expect(normalized.permissions.auditHistoryRead.allowed).toBe(true);
  expect(normalized.summary.readiness.blocked).toBe(true);
  expect(normalized.summary.readiness.blockedItems[0].reasonCode).toBe("runtime_projection_missing");
  expect(normalized.summary.sources.total).toBe(2);
  expect(normalized.summary.runtimeProjection.health.usable).toBe(true);
  expect(normalized.summary.runtimeProjection.repair.action?.id).toBe(
    "rebuild_runtime_projection"
  );
  expect(normalized.recentRuns[0].sourceDisplayName).toBe("Main Website");
  expect(normalized.audit[0].action).toBe("settings.source.sync.requested");
});
});
