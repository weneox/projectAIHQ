import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyAihqReadiness,
  classifyIncidentAcceptance,
  isAihqDegradedForAcceptance,
  resolveBackendReleaseShaRequirement,
  summarizeIncidents,
} from "../../scripts/prod-spine-smoke.mjs";

test("prod spine smoke gates on active incidents, not stale history", () => {
  const incidents = summarizeIncidents({
    incidents: {
      status: "clear",
      total: 0,
      errorCount: 0,
      warnCount: 0,
      activeWindowStartedAt: "2026-03-29T10:00:00.000Z",
      history: {
        status: "degraded",
        total: 10,
        errorCount: 10,
        warnCount: 0,
        latestOccurredAt: "2026-03-29T09:50:00.000Z",
        staleBeforeActiveWindowCount: 10,
      },
    },
  });

  assert.equal(incidents.status, "clear");
  assert.equal(incidents.errorCount, 0);
  assert.equal(incidents.historyStatus, "degraded");
  assert.equal(incidents.historyErrorCount, 10);
  assert.equal(
    isAihqDegradedForAcceptance({
      status: "ready",
      readinessPolicy: { tolerableOnly: false },
      workers: { status: "ready" },
      incidents,
    }),
    false
  );
  assert.deepEqual(
    classifyIncidentAcceptance({
      incidents,
      readinessPolicy: { effectiveBlockersTotal: 0 },
      dbOk: true,
      workers: { status: "ready", requiredUnavailableCount: 0 },
      status: "ready",
    }),
    {
      activeIncidentDegraded: false,
      activeIncidentAttention: false,
      staleIncidentHistoryIgnored: true,
      decision: "accept",
    }
  );
});

test("prod spine smoke still blocks active degraded incidents", () => {
  const incidents = summarizeIncidents({
    incidents: {
      status: "degraded",
      total: 1,
      errorCount: 1,
      activeWindowStartedAt: "2026-03-29T10:00:00.000Z",
    },
  });

  assert.equal(
    isAihqDegradedForAcceptance({
      status: "ready",
      readinessPolicy: { tolerableOnly: false },
      workers: { status: "ready" },
      incidents,
    }),
    true
  );
});

test("prod spine smoke treats active incident counts as failure even if status is malformed", () => {
  const incidents = summarizeIncidents({
    incidents: {
      status: "clear",
      total: 1,
      errorCount: 1,
      activeWindowStartedAt: "2026-03-29T10:00:00.000Z",
    },
  });

  const acceptance = classifyIncidentAcceptance({
    incidents,
    readinessPolicy: { effectiveBlockersTotal: 0 },
    dbOk: true,
    workers: { status: "ready", requiredUnavailableCount: 0 },
    status: "ready",
  });

  assert.equal(acceptance.activeIncidentDegraded, true);
  assert.equal(acceptance.decision, "fail_active_incident");
});

test("prod spine smoke fails production truth projection and authority blockers", () => {
  const readiness = classifyAihqReadiness({
    status: "blocked",
    blockersTotal: 3,
    blockerReasonCodes: [
      "approved_truth_unavailable",
      "projection_missing",
      "runtime_authority_unavailable",
    ],
  });

  assert.equal(readiness.tolerableOnly, false);
  assert.equal(readiness.productionBlockersEnforced, true);
  assert.equal(readiness.effectiveBlockersTotal, 3);
  assert.deepEqual(readiness.fatalBlockerReasonCodes, [
    "approved_truth_unavailable",
    "projection_missing",
    "runtime_authority_unavailable",
  ]);
  assert.equal(
    isAihqDegradedForAcceptance({
      status: "degraded",
      readinessPolicy: readiness,
      workers: { status: "ready" },
      incidents: { status: "clear" },
    }),
    true
  );
});

test("prod spine requires backend release identity unless explicitly non-production", () => {
  assert.equal(resolveBackendReleaseShaRequirement({}), true);
  assert.equal(
    resolveBackendReleaseShaRequirement({
      PROD_SPINE_REQUIRE_BACKEND_RELEASE_SHA: "0",
    }),
    true
  );
  assert.equal(
    resolveBackendReleaseShaRequirement({
      PROD_SPINE_ENV: "development",
      PROD_SPINE_REQUIRE_BACKEND_RELEASE_SHA: "0",
    }),
    false
  );
});
