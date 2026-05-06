import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEmailVerificationUrl,
  sendVerificationEmail,
} from "../src/services/auth/emailVerification.js";

function restoreEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

test("buildEmailVerificationUrl supports fallback magic link tokens", () => {
  const snapshot = {
    AUTH_PUBLIC_APP_URL: process.env.AUTH_PUBLIC_APP_URL,
  };

  try {
    process.env.AUTH_PUBLIC_APP_URL = "https://app.example.com/";

    const url = buildEmailVerificationUrl("token with spaces+symbols");

    assert.equal(
      url,
      "https://app.example.com/verify-email?token=token%20with%20spaces%2Bsymbols"
    );
  } finally {
    restoreEnv(snapshot);
  }
});

test("sendVerificationEmail skips external delivery when Resend is not configured", async () => {
  const snapshot = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  };

  try {
    delete process.env.RESEND_API_KEY;
    delete process.env.AUTH_EMAIL_FROM;
    delete process.env.RESEND_FROM_EMAIL;

    const result = await sendVerificationEmail({
      email: "User@Example.com",
      verificationCode: "123456",
      verificationUrl: "https://app.example.com/verify-email?token=safe-token",
    });

    assert.equal(result.ok, false);
    assert.equal(result.provider, "resend");
    assert.equal(result.skipped, true);
    assert.equal(result.reason, "resend_not_configured");
  } finally {
    restoreEnv(snapshot);
  }
});

test("sendVerificationEmail rejects malformed verification payload before provider call", async () => {
  const result = await sendVerificationEmail({
    email: "user@example.com",
    verificationCode: "123",
    verificationUrl: "https://app.example.com/verify-email?token=safe-token",
  });

  assert.equal(result.ok, false);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "missing_email_verification_code_or_url");
});
