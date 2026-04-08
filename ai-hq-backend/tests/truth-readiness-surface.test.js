import test from "node:test";
import assert from "node:assert/strict";

import { __test__ as setupTest } from "../src/routes/api/workspace/setup.js";

test("truth payload exposes unified readiness language when approved truth is unavailable", async () => {
  const data = await setupTest.loadSetupTruthPayload(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
        tenantKey: "acme",
      },
    },
    {
      knowledgeHelper: {
        async getBusinessProfile() {
          return {};
        },
      },
      truthVersionHelper: {
        async listVersions() {
          return [];
        },
      },
      setupBuilder: async () => ({
        progress: {
          nextRoute: "/setup/runtime",
          nextStep: "runtime",
        },
      }),
    }
  );

  assert.equal(data.truth.readiness.status, "blocked");
  assert.equal(data.truth.readiness.reasonCode, "approved_truth_unavailable");
  assert.equal(
    data.truth.readiness.blockers[0].reasonCode,
    "approved_truth_unavailable"
  );
  assert.equal(
    data.truth.readiness.blockers[0].nextAction.id,
    "open_setup_route"
  );
  assert.equal(
    data.truth.readiness.blockers[0].nextAction.target.path,
    "/truth"
  );
});