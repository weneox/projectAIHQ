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

test("voice boot readiness fails closed on malformed AI HQ operational readiness contract", async () => {
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
          items: [{ category: "voice" }],
        },
      },
    }),
    baseUrl: "https://aihq.example.test",
    internalToken: "voice-internal-token",
    appEnv: "production",
    requireOnBoot: true,
    throwOnBlocked: false,
  });

  assert.equal(readiness.ok, false);
  assert.equal(readiness.status, "blocked");
  assert.equal(readiness.reasonCode, "aihq_operational_readiness_contract_invalid");
  assert.equal(readiness.error, "operational_readiness_blocker_invalid");
});

test("voice boot readiness still honors valid blocker reason codes", async () => {
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
        blockerReasonCodes: ["voice_phone_number_missing"],
        blockers: {
          total: 1,
          items: [
            {
              category: "voice",
              dependencyType: "phone_number",
              reasonCode: "voice_phone_number_missing",
              suggestedRepairActionId: "repair_voice_number",
              repairAction: {
                id: "repair_voice_number",
                kind: "focus",
                label: "Repair voice number",
                requiredRole: "operator",
                allowed: true,
              },
            },
          ],
        },
      },
    }),
    baseUrl: "https://aihq.example.test",
    internalToken: "voice-internal-token",
    appEnv: "production",
    requireOnBoot: true,
    throwOnBlocked: false,
  });

  assert.equal(readiness.ok, false);
  assert.equal(readiness.reasonCode, "voice_phone_number_missing");
  assert.equal(readiness.blockersTotal, 1);
});
