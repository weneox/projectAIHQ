import test from "node:test";
import assert from "node:assert/strict";

import {
  getTenantBrainRuntime,
  getTenantProjectedRuntimeStrict,
  inspectTenantBusinessRuntime,
  inspectTenantBrainRuntime,
} from "../src/services/businessBrain/getTenantBrainRuntime.js";
import {
  buildInspectionFallbackRuntime,
  buildLegacyFallbackRuntime,
  buildUnresolvedTenantFallback,
} from "../src/services/businessBrain/runtimeAssembler.js";

test("strict runtime stays fail-closed when tenant cannot be resolved", async () => {
  await assert.rejects(
    () =>
      getTenantBrainRuntime({
        tenantKey: "",
      }),
    (error) => {
      assert.equal(error?.code, "TENANT_RUNTIME_AUTHORITY_UNAVAILABLE");
      assert.equal(error?.runtimeAuthority?.required, true);
      assert.equal(error?.runtimeAuthority?.reasonCode, "tenant_not_resolved");
      return true;
    }
  );
});

test("tolerant inspection runtime returns unresolved fallback when tenant cannot be resolved", async () => {
  const runtime = await inspectTenantBusinessRuntime({
    tenantKey: "",
  });

  assert.equal(runtime.authority.available, false);
  assert.equal(runtime.authority.required, false);
  assert.equal(runtime.authority.reasonCode, "tenant_not_resolved");
  assert.equal(runtime.raw.mode, "fallback_empty");
  assert.deepEqual(runtime.languages, ["az"]);
});

test("strict and inspection aliases remain stable", async () => {
  assert.equal(getTenantBrainRuntime, getTenantProjectedRuntimeStrict);
  assert.equal(inspectTenantBrainRuntime, inspectTenantBusinessRuntime);
});

test("legacy fallback assembler alias remains wired to inspection fallback builder", () => {
  assert.equal(buildLegacyFallbackRuntime, buildInspectionFallbackRuntime);

  const runtime = buildUnresolvedTenantFallback({
    authorityMode: "tolerant",
    tenantIdInput: "",
    fallbackKey: "default",
    input: {},
  });

  assert.equal(runtime.authority.reasonCode, "tenant_not_resolved");
  assert.equal(runtime.raw.mode, "fallback_empty");
});
