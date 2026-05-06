import test from "node:test";
import assert from "node:assert/strict";

import {
  getPasswordRuleResults,
  validateStrongUserPassword,
} from "../auth.js";

test("password policy accepts normal SaaS-level launch passwords", () => {
  for (const password of ["Weneox2026", "Smoke2026", "Business2026"]) {
    const result = getPasswordRuleResults(password, {
      email: "owner@acme.test",
      companyName: "Acme Clinic",
      fullName: "Owner One",
    });

    assert.equal(result.ok, true, `${password} should be accepted`);
    assert.deepEqual(result.failures, []);
    assert.equal(
      validateStrongUserPassword(password, {
        email: "owner@acme.test",
      }).ok,
      true
    );
  }
});

test("password policy still accepts the previous launch smoke strong password", () => {
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

test("password policy rejects weak, common, and email-equal passwords with stable codes", () => {
  const weak = getPasswordRuleResults("password", {
    email: "owner@acme.test",
    companyName: "Acme Clinic",
    fullName: "Owner One",
  });

  assert.equal(weak.ok, false);
  assert.ok(weak.failures.includes("number_required"));
  assert.ok(weak.failures.includes("common_pattern"));

  const digitsOnly = validateStrongUserPassword("12345678");
  assert.equal(digitsOnly.ok, false);
  assert.ok(digitsOnly.failures.includes("letter_required"));
  assert.ok(digitsOnly.failures.includes("common_pattern"));

  const keyboardPattern = validateStrongUserPassword("qwerty123");
  assert.equal(keyboardPattern.ok, false);
  assert.ok(keyboardPattern.failures.includes("common_pattern"));

  const sameAsEmail = validateStrongUserPassword("owner@acme.test", {
    email: "owner@acme.test",
    companyName: "Acme Clinic",
    fullName: "Owner One",
  });

  assert.equal(sameAsEmail.ok, false);
  assert.ok(sameAsEmail.failures.includes("must_not_equal_email"));
});
