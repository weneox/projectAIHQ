import test from "node:test";
import assert from "node:assert/strict";

import {
  __test__ as healthTest,
} from "../src/db/helpers/tenantRuntimeProjection/health.js";
import {
  __test__ as runtimeProjectionObservabilityTest,
} from "../src/services/runtimeProjectionObservability.js";
import { getApprovedRuntimeAuthorityFailure } from "../../shared-contracts/runtime.js";

const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

function captureConsoleEvents(work) {
  const entries = [];
  const capture =
    (level) =>
    (...args) => {
      const [event, payload] = args;
      entries.push({
        level,
        event: String(event || ""),
        payload:
          payload && typeof payload === "object" && !Array.isArray(payload)
            ? payload
            : {},
      });
    };

  console.info = capture("info");
  console.warn = capture("warn");
  console.error = capture("error");

  return Promise.resolve()
    .then(() => work(entries))
    .finally(() => {
      console.info = originalConsoleInfo;
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
    });
}

test.beforeEach(() => {
  runtimeProjectionObservabilityTest.resetRuntimeProjectionHealthState();
});

test.after(() => {
  console.info = originalConsoleInfo;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

test("runtime projection health classifies missing projections consistently", () => {
  const health = healthTest.buildRuntimeProjectionHealthModel({
    runtimeProjection: null,
    freshness: {
      stale: true,
      reasons: ["missing_runtime_projection"],
      tenantId: "tenant-1",
      tenantKey: "acme",
    },
    latestTruthVersion: {
      id: "truth-v1",
    },
  });

  assert.equal(health.status, "missing");
  assert.equal(health.primaryReasonCode, "projection_missing");
  assert.equal(health.autonomousOperation, "stop");
  assert.ok(health.affectedSurfaces.includes("inbox"));
  assert.ok(health.affectedSurfaces.includes("twilio"));
  assert.equal(health.lastKnownGood, null);
});

test("runtime projection health classifies drift as stale with refresh repair", () => {
  const health = healthTest.buildRuntimeProjectionHealthModel({
    runtimeProjection: {
      id: "projection-1",
      status: "stale",
      channels_json: [{ channelType: "instagram" }],
      lead_capture_json: { enabled: true },
    },
    freshness: {
      stale: true,
      reasons: ["projection_hash_mismatch", "source_snapshot_mismatch"],
    },
    latestTruthVersion: {
      id: "truth-v2",
    },
    latestSuccessRun: {
      id: "run-success-1",
      finished_at: "2026-03-28T00:00:00.000Z",
      runtime_projection_id: "projection-0",
    },
  });

  assert.equal(health.status, "stale");
  assert.deepEqual(health.reasonCodes.slice(0, 2), [
    "projection_stale",
    "truth_version_drift",
  ]);
  assert.equal(health.nextRecommendedRepair?.action, "refresh_projection");
  assert.equal(health.lastKnownGood?.diagnosticOnly, true);
  assert.equal(health.lastKnownGood?.usableAsAuthority, false);
});

test("runtime projection health marks blocked approval states distinctly", () => {
  const health = healthTest.buildRuntimeProjectionHealthModel({
    runtimeProjection: {
      id: "projection-1",
      status: "ready",
    },
    freshness: {
      stale: false,
      reasons: [],
    },
    latestTruthVersion: {},
    activeReviewSession: {
      id: "review-1",
    },
  });

  assert.equal(health.status, "blocked");
  assert.equal(health.primaryReasonCode, "approval_required");
  assert.equal(health.repairActions[0]?.action, "re-run_finalize");
});

test("runtime projection health tracks dependency failures as degraded when authority still exists", () => {
  const health = healthTest.buildRuntimeProjectionHealthModel({
    runtimeProjection: {
      id: "projection-1",
      status: "ready",
      confidence: 0.82,
      voice_json: { enabled: true },
      channels_json: [],
    },
    freshness: {
      stale: false,
      reasons: [],
    },
    latestTruthVersion: {
      id: "truth-v1",
    },
    latestSuccessRun: {
      id: "run-success-1",
      finished_at: "2026-03-27T00:00:00.000Z",
      runtime_projection_id: "projection-1",
    },
    latestFailureRun: {
      id: "run-failed-1",
      finished_at: "2026-03-28T00:00:00.000Z",
      error_code: "source_dependency_failed",
      error_message: "meta provider unavailable",
    },
  });

  assert.equal(health.status, "degraded");
  assert.equal(health.primaryReasonCode, "source_dependency_failed");
  assert.equal(health.autonomousOperation, "degrade");
  assert.ok(health.affectedSurfaces.includes("voice"));
});

test("runtime projection health emits searchable healthy to stale transition logs", async () => {
  await captureConsoleEvents(async (entries) => {
    healthTest.buildRuntimeProjectionHealthModel({
      runtimeProjection: {
        id: "projection-1",
        tenant_id: "tenant-1",
        tenant_key: "acme",
        status: "ready",
      },
      freshness: {
        stale: false,
        reasons: [],
        tenantId: "tenant-1",
        tenantKey: "acme",
      },
      latestTruthVersion: {
        id: "truth-v1",
      },
    });

    healthTest.buildRuntimeProjectionHealthModel({
      runtimeProjection: {
        id: "projection-1",
        tenant_id: "tenant-1",
        tenant_key: "acme",
        status: "stale",
      },
      freshness: {
        stale: true,
        reasons: ["projection_hash_mismatch", "published_truth_version_mismatch"],
        tenantId: "tenant-1",
        tenantKey: "acme",
        runtimeProjectionId: "projection-1",
        runtimeStatus: "stale",
        currentPublishedTruthVersionId: "truth-v1",
        expectedPublishedTruthVersionId: "truth-v2",
      },
      latestTruthVersion: {
        id: "truth-v2",
      },
    });

    const transitions = entries.filter(
      (entry) => entry.event === "runtime.projection.health.transition"
    );

    assert.equal(transitions.length, 2);
    assert.equal(transitions[0]?.payload?.nextStatus, "healthy");
    assert.equal(transitions[1]?.payload?.previousStatus, "healthy");
    assert.equal(transitions[1]?.payload?.nextStatus, "stale");
    assert.equal(
      transitions[1]?.payload?.previousPrimaryReasonCode,
      ""
    );
    assert.equal(
      transitions[1]?.payload?.nextPrimaryReasonCode,
      "projection_stale"
    );
    assert.deepEqual(transitions[1]?.payload?.freshnessReasonCodes, [
      "projection_hash_mismatch",
      "published_truth_version_mismatch",
    ]);
    assert.equal(transitions[1]?.payload?.projectionHashMismatch, true);
    assert.equal(transitions[1]?.payload?.truthVersionChanged, true);
    assert.equal(transitions[1]?.payload?.tenantKey, "acme");
    assert.equal(transitions[1]?.payload?.tenantId, "tenant-1");
    assert.equal(transitions[1]?.payload?.latestTruthVersionId, "truth-v2");
    assert.equal(transitions[1]?.payload?.runtimeProjectionId, "projection-1");
    assert.equal(transitions[1]?.payload?.didStatusChange, true);
    assert.equal(transitions[1]?.payload?.didReasonChange, true);
  });
});

test("runtime projection health suppresses repeated identical transition spam", async () => {
  await captureConsoleEvents(async (entries) => {
    const input = {
      runtimeProjection: {
        id: "projection-2",
        tenant_id: "tenant-2",
        tenant_key: "beta",
        status: "ready",
      },
      freshness: {
        stale: false,
        reasons: [],
        tenantId: "tenant-2",
        tenantKey: "beta",
      },
      latestTruthVersion: {
        id: "truth-v1",
      },
    };

    healthTest.buildRuntimeProjectionHealthModel(input);
    healthTest.buildRuntimeProjectionHealthModel(input);
    healthTest.buildRuntimeProjectionHealthModel(input);

    const transitions = entries.filter(
      (entry) => entry.event === "runtime.projection.health.transition"
    );

    assert.equal(transitions.length, 1);
    assert.equal(transitions[0]?.payload?.nextStatus, "healthy");
    assert.equal(
      entries.some(
        (entry) => entry.event === "runtime.projection.advisory.changed"
      ),
      false
    );
  });
});

test("runtime projection health emits searchable stale to healthy recovery transitions", async () => {
  await captureConsoleEvents(async (entries) => {
    healthTest.buildRuntimeProjectionHealthModel({
      runtimeProjection: {
        id: "projection-3",
        tenant_id: "tenant-3",
        tenant_key: "gamma",
        status: "stale",
      },
      freshness: {
        stale: true,
        reasons: ["projection_hash_mismatch"],
        tenantId: "tenant-3",
        tenantKey: "gamma",
        runtimeProjectionId: "projection-3",
        runtimeStatus: "stale",
      },
      latestTruthVersion: {
        id: "truth-v1",
      },
    });

    healthTest.buildRuntimeProjectionHealthModel({
      runtimeProjection: {
        id: "projection-3",
        tenant_id: "tenant-3",
        tenant_key: "gamma",
        status: "ready",
      },
      freshness: {
        stale: false,
        reasons: [],
        tenantId: "tenant-3",
        tenantKey: "gamma",
        runtimeProjectionId: "projection-3",
        runtimeStatus: "ready",
      },
      latestTruthVersion: {
        id: "truth-v1",
      },
    });

    const transitions = entries.filter(
      (entry) => entry.event === "runtime.projection.health.transition"
    );

    assert.equal(transitions.length, 2);
    assert.equal(transitions[0]?.payload?.nextStatus, "stale");
    assert.equal(transitions[1]?.payload?.previousStatus, "stale");
    assert.equal(transitions[1]?.payload?.nextStatus, "healthy");
    assert.equal(
      transitions[1]?.payload?.previousPrimaryReasonCode,
      "projection_stale"
    );
    assert.equal(transitions[1]?.payload?.nextPrimaryReasonCode, "");
    assert.equal(transitions[1]?.payload?.didStatusChange, true);
    assert.equal(transitions[1]?.payload?.didReasonChange, true);
  });
});

test("runtime projection health emits advisory change events for healthy-only advisory drift", async () => {
  await captureConsoleEvents(async (entries) => {
    const baseInput = {
      runtimeProjection: {
        id: "projection-4",
        tenant_id: "tenant-4",
        tenant_key: "delta",
        status: "ready",
      },
      freshness: {
        stale: false,
        reasons: [],
        tenantId: "tenant-4",
        tenantKey: "delta",
        runtimeProjectionId: "projection-4",
        runtimeStatus: "ready",
      },
      latestTruthVersion: {
        id: "truth-v1",
      },
    };

    healthTest.buildRuntimeProjectionHealthModel(baseInput);
    healthTest.buildRuntimeProjectionHealthModel({
      ...baseInput,
      activeReviewSession: {
        id: "review-4",
      },
    });

    const transitions = entries.filter(
      (entry) => entry.event === "runtime.projection.health.transition"
    );
    const advisory = entries.filter(
      (entry) => entry.event === "runtime.projection.advisory.changed"
    );

    assert.equal(transitions.length, 1);
    assert.equal(transitions[0]?.payload?.nextStatus, "healthy");
    assert.equal(advisory.length, 1);
    assert.equal(advisory[0]?.payload?.tenantKey, "delta");
    assert.equal(advisory[0]?.payload?.tenantId, "tenant-4");
    assert.equal(advisory[0]?.payload?.latestTruthVersionId, "truth-v1");
    assert.equal(advisory[0]?.payload?.runtimeProjectionId, "projection-4");
    assert.deepEqual(advisory[0]?.payload?.previousRepairActions, []);
    assert.deepEqual(advisory[0]?.payload?.nextRepairActions, [
      "review_conflicts",
    ]);
    assert.equal(
      advisory[0]?.payload?.previousActiveReviewSessionId,
      ""
    );
    assert.equal(
      advisory[0]?.payload?.nextActiveReviewSessionId,
      "review-4"
    );
    assert.equal(
      advisory[0]?.payload?.previousReviewConflictPresent,
      false
    );
    assert.equal(
      advisory[0]?.payload?.nextReviewConflictPresent,
      true
    );
    assert.equal(advisory[0]?.payload?.didRepairActionsChange, true);
    assert.equal(advisory[0]?.payload?.didReviewSessionChange, true);
    assert.equal(advisory[0]?.payload?.didReviewConflictChange, true);
  });
});

test("shared runtime authority checker treats last known good as diagnostic only", () => {
  const blocked = getApprovedRuntimeAuthorityFailure({
    authority: {
      mode: "strict",
      required: true,
      available: true,
      source: "approved_runtime_projection",
      tenantId: "tenant-1",
      tenantKey: "acme",
      runtimeProjectionId: "projection-1",
      health: {
        status: "stale",
        primaryReasonCode: "projection_stale",
        lastKnownGood: {
          runtimeProjectionId: "projection-0",
          diagnosticOnly: true,
          usableAsAuthority: false,
        },
      },
    },
    tenant: {
      tenantId: "tenant-1",
      tenantKey: "acme",
    },
  });

  assert.equal(blocked?.reasonCode, "projection_stale");
  assert.equal(
    blocked?.authority?.health?.lastKnownGood?.usableAsAuthority,
    false
  );
});
