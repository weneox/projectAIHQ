import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveTenantAutonomyMode,
  __test__,
} from "../src/routes/api/inbox/internal/autonomyGates.js";

test("autonomous launch gate blocks auto mode when approval is missing", async () => {
  const result = await resolveTenantAutonomyMode({
    tenantKey: "acme",
    db: {
      query: async () => ({
        rows: [
          {
            tenant_key: "acme",
            mode: "auto",
            publish_policy: {},
          },
        ],
      }),
    },
  });

  assert.equal(result.requestedMode, "auto");
  assert.equal(result.mode, "manual");
  assert.equal(result.reasonCode, "autonomous_launch_gate_required");
  assert.equal(result.launchGate.approved, false);
});

test("autonomous launch gate allows auto mode when launchApproved is true", async () => {
  const result = await resolveTenantAutonomyMode({
    tenantKey: "acme",
    db: {
      query: async () => ({
        rows: [
          {
            tenant_key: "acme",
            mode: "auto",
            publish_policy: {
              launchApproved: true,
              launchApprovedBy: "owner",
              launchApprovedAt: "2026-05-01T00:00:00.000Z",
            },
          },
        ],
      }),
    },
  });

  assert.equal(result.requestedMode, "auto");
  assert.equal(result.mode, "auto");
  assert.equal(result.reasonCode, "tenant_mode_resolved");
  assert.equal(result.launchGate.approved, true);
  assert.equal(result.launchGate.approvedBy, "owner");
});

test("autonomous launch gate accepts nested launchGate approval", () => {
  const gate = __test__.resolveAutonomousLaunchGate({
    publish_policy: {
      launchGate: {
        status: "approved",
        approvedBy: "admin",
      },
    },
  });

  assert.equal(gate.approved, true);
  assert.equal(gate.reasonCode, "autonomous_launch_gate_approved");
  assert.equal(gate.approvedBy, "admin");
});
