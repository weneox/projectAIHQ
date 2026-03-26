import test from "node:test";
import assert from "node:assert/strict";
import { validateAihqHealthEnvelope } from "@aihq/shared-contracts/health";
import { cfg } from "../src/config.js";

import {
  buildApiHealthResponse,
  buildRootHealthResponse,
} from "../src/routes/api/health/builders.js";

class FakeHealthDb {
  async query(sql) {
    const text = String(sql || "").toLowerCase();

    if (text.includes("select 1 as ok")) {
      return { rows: [{ ok: 1 }] };
    }

    if (text.includes("with voice_tenants")) {
      return {
        rows: [
          {
            missing_settings: 0,
            disabled_settings: 0,
            missing_phone_number: 1,
            samples: [
              {
                tenantKey: "acme",
                tenantId: "tenant-1",
                reasonCode: "voice_phone_number_missing",
              },
            ],
          },
        ],
      };
    }

    if (text.includes("with meta_channels")) {
      return {
        rows: [
          {
            missing_channel_ids: 0,
            missing_page_access_token: 1,
            samples: [
              {
                tenantKey: "acme",
                tenantId: "tenant-1",
                channelType: "instagram",
                reasonCode: "provider_secret_missing",
              },
            ],
          },
        ],
      };
    }

    throw new Error(`Unhandled query: ${text}`);
  }
}

test("root and api health derive operational readiness from the same blocker logic", async () => {
  const db = new FakeHealthDb();

  const apiHealth = await buildApiHealthResponse({ db });
  const rootHealth = await buildRootHealthResponse({
    db,
    providers: {},
    workers: {},
    operational: {},
  });

  assert.equal(apiHealth.operationalReadiness.status, "blocked");
  assert.equal(rootHealth.operationalReadiness.status, "blocked");
  assert.deepEqual(
    rootHealth.operationalReadiness.blockerReasonCodes,
    apiHealth.operationalReadiness.blockerReasonCodes
  );
  assert.deepEqual(
    rootHealth.operationalReadiness.blockers.items.map((item) => item.reasonCode),
    apiHealth.operationalReadiness.blockers.items.map((item) => item.reasonCode)
  );
  assert.equal(rootHealth.operationalReadiness.repairActions.length, 2);
  assert.equal(validateAihqHealthEnvelope(apiHealth).ok, true);
  assert.equal(validateAihqHealthEnvelope(rootHealth).ok, true);
});

test("api health does not advertise debug endpoints when debug routes are disabled", async () => {
  const previousEnv = cfg.app.env;
  const previousDebugRoutesEnabled = cfg.security.debugRoutesEnabled;

  try {
    cfg.app.env = "production";
    cfg.security.debugRoutesEnabled = false;

    const health = await buildApiHealthResponse({ db: null });
    assert.equal(health.endpoints.includes("POST /api/debug/openai"), false);

    cfg.security.debugRoutesEnabled = true;
    const debugHealth = await buildApiHealthResponse({ db: null });
    assert.equal(debugHealth.endpoints.includes("POST /api/debug/openai"), true);
  } finally {
    cfg.app.env = previousEnv;
    cfg.security.debugRoutesEnabled = previousDebugRoutesEnabled;
  }
});
