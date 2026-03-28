import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTenantEntitlements,
  getTenantCapability,
} from "../src/services/tenantEntitlements.js";

test("starter plan keeps optional connect and agent mutation surfaces explicit and blocked", () => {
  const entitlements = buildTenantEntitlements({ plan_key: "starter" });

  assert.equal(entitlements.plan.normalizedKey, "starter");
  assert.equal(entitlements.billing.selfServeAvailable, false);
  assert.equal(entitlements.capabilities.workspaceCore.allowed, true);
  assert.equal(entitlements.capabilities.metaChannelConnect.allowed, false);
  assert.equal(entitlements.capabilities.agentConfigMutation.allowed, false);
  assert.match(
    entitlements.capabilities.metaChannelConnect.message,
    /self-serve billing is not enabled/i
  );
});

test("growth aliases unlock optional tenant channel and agent configuration surfaces", () => {
  const capability = getTenantCapability({ plan_key: "pro" }, "agentConfigMutation");

  assert.equal(capability.allowed, true);
  assert.equal(capability.normalizedPlanKey, "growth");
});
