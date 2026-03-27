import test from "node:test";
import assert from "node:assert/strict";

import {
  __test__ as healthTest,
} from "../src/db/helpers/tenantRuntimeProjection/health.js";
import { getApprovedRuntimeAuthorityFailure } from "../../shared-contracts/runtime.js";

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
