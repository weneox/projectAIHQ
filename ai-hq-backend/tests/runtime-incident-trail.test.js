import test from "node:test";
import assert from "node:assert/strict";

import {
  summarizeRuntimeIncidentHealthWindow,
  summarizeRuntimeIncidents,
} from "../src/services/runtimeIncidentTrail.js";

test("runtime incident summary exposes degraded posture and recent reason codes", () => {
  const summary = summarizeRuntimeIncidents(
    [
      {
        service: "ai-hq-backend",
        severity: "error",
        reasonCode: "worker_heartbeat_stale",
        occurredAt: "2026-03-29T10:00:00.000Z",
      },
      {
        service: "twilio-voice-backend",
        severity: "warn",
        reasonCode: "voice_sync_request_failed",
        occurredAt: "2026-03-29T09:50:00.000Z",
      },
    ],
    { sinceHours: 6 }
  );

  assert.equal(summary.status, "degraded");
  assert.equal(summary.total, 2);
  assert.equal(summary.errorCount, 1);
  assert.equal(summary.warnCount, 1);
  assert.equal(summary.latestOccurredAt, "2026-03-29T10:00:00.000Z");
  assert.deepEqual(summary.services, ["ai-hq-backend", "twilio-voice-backend"]);
  assert.deepEqual(summary.reasonCodes, [
    "worker_heartbeat_stale",
    "voice_sync_request_failed",
  ]);
});

test("runtime incident health window ignores stale incidents before current boot", () => {
  const summary = summarizeRuntimeIncidentHealthWindow(
    [
      {
        service: "ai-hq-backend",
        severity: "error",
        reasonCode: "draft_schedule_tick_failed",
        occurredAt: "2026-03-29T09:50:00.000Z",
      },
      {
        service: "ai-hq-backend",
        severity: "warn",
        reasonCode: "post_boot_warning",
        occurredAt: "2026-03-29T10:05:00.000Z",
      },
    ],
    {
      activeWindowStartedAt: "2026-03-29T10:00:00.000Z",
      sinceHours: 6,
    }
  );

  assert.equal(summary.scope, "current_runtime");
  assert.equal(summary.status, "attention");
  assert.equal(summary.total, 1);
  assert.equal(summary.errorCount, 0);
  assert.equal(summary.warnCount, 1);
  assert.equal(summary.history.status, "degraded");
  assert.equal(summary.history.errorCount, 1);
  assert.equal(summary.history.staleBeforeActiveWindowCount, 1);
});
