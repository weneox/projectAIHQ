import test from "node:test";
import assert from "node:assert/strict";

import {
  isAihqDegradedForAcceptance,
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
