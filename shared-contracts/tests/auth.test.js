import test from "node:test";
import assert from "node:assert/strict";

import {
  getPasswordRuleResults,
  validateStrongUserPassword,
} from "../auth.js";

test("password policy accepts the launch smoke strong password", () => {
  const result = getPasswordRuleResults("WeneoxSmokeTest@2026#A1", {
    email: "owner@acme.test",
    companyName: "Acme Clinic",
    fullName: "Owner One",
  });

  assert.equal(result.ok, true);
  assert.equal(result.strengthLabel, "Strong");
  assert.deepEqual(result.failures, []);
  assert.equal(validateStrongUserPassword("WeneoxSmokeTest@2026#A1").ok, true);
});

test("password policy rejects weak, similar, and common passwords with stable codes", () => {
  const weak = getPasswordRuleResults("password", {
    email: "owner@acme.test",
    companyName: "Acme Clinic",
    fullName: "Owner One",
  });

  assert.equal(weak.ok, false);
  assert.ok(weak.failures.includes("minimum_length"));
  assert.ok(weak.failures.includes("uppercase_required"));
  assert.ok(weak.failures.includes("number_required"));
  assert.ok(weak.failures.includes("symbol_required"));
  assert.ok(weak.failures.includes("common_pattern"));

  const similar = validateStrongUserPassword("OwnerAcme2026!A", {
    email: "owner@acme.test",
    companyName: "Acme Clinic",
    fullName: "Owner One",
  });

  assert.equal(similar.ok, false);
  assert.ok(similar.failures.includes("must_not_contain_email"));
  assert.ok(similar.failures.includes("must_not_contain_company"));
  assert.ok(similar.failures.includes("must_not_contain_full_name"));
});
