import test from "node:test";
import assert from "node:assert/strict";

import { checkAihqOperationalBootReadiness } from "../src/services/bootReadiness.js";

function mockFetchJson(json, { ok = true, status = 200 } = {}) {
  return async () => ({
    ok,
    status,
    async text() {
      return JSON.stringify(json);
    },
  });
}

test("meta boot readiness fails closed on malformed AI HQ operational readiness contract", async () => {
  const readiness = await checkAihqOperationalBootReadiness({
    fetchFn: mockFetchJson({
      ok: true,
      service: "ai-hq-backend",
      env: "test",
      db: { enabled: true },
      operationalReadiness: {
        enabled: true,
        blockers: {
          total: 1,
          items: [{ category: "meta" }],
        },
      },
    }),
    baseUrl: "https://aihq.example.test",
    internalToken: "internal-token",
    appEnv: "production",
    requireOnBoot: true,
    throwOnBlocked: false,
  });

  assert.equal(readiness.ok, false);
  assert.equal(readiness.status, "blocked");
  assert.equal(readiness.reasonCode, "aihq_operational_readiness_contract_invalid");
  assert.equal(readiness.error, "operational_readiness_blocker_invalid");
});

test("meta boot readiness still honors valid blocker reason codes", async () => {
  const readiness = await checkAihqOperationalBootReadiness({
    fetchFn: mockFetchJson({
      ok: true,
      service: "ai-hq-backend",
      env: "test",
      db: { enabled: true },
      operationalReadiness: {
        ok: false,
        enabled: true,
        enforced: true,
        status: "blocked",
        blockerReasonCodes: ["channel_identifiers_missing"],
        blockers: {
          total: 1,
          items: [
            {
              category: "meta",
              dependencyType: "channel_identifier",
              reasonCode: "channel_identifiers_missing",
              suggestedRepairActionId: "repair_channel_identifiers",
              repairAction: {
                id: "repair_channel_identifiers",
                kind: "focus",
                label: "Repair channel identifiers",
                requiredRole: "operator",
                allowed: true,
              },
            },
          ],
        },
      },
    }),
    baseUrl: "https://aihq.example.test",
    internalToken: "internal-token",
    appEnv: "production",
    requireOnBoot: true,
    throwOnBlocked: false,
  });

  assert.equal(readiness.ok, false);
  assert.equal(readiness.reasonCode, "channel_identifiers_missing");
  assert.equal(readiness.blockersTotal, 1);
});
