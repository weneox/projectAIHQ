import test from "node:test";
import assert from "node:assert/strict";

import { __test__ as publicTest } from "../src/routes/api/channelConnect/public.js";
import { __test__ as telegramTest } from "../src/routes/api/channelConnect/telegram.js";

const { evaluateTelegramWebhookSecretCheck } = publicTest;
const { isTelegramWebhookDeliveryFailing } = telegramTest;

test("telegram webhook secret check rejects mismatched secret by default", () => {
  const result = evaluateTelegramWebhookSecretCheck({
    headerSecret: "incoming-secret",
    storedHeaderSecret: "stored-secret",
    strictSecretHeaderVerification: true,
    allowRouteTokenFallback: false,
  });

  assert.equal(result.secretHeaderMatched, false);
  assert.equal(result.shouldReject, true);
  assert.equal(result.accepted, false);
  assert.equal(result.verificationMode, "strict_secret_header");
});

test("telegram webhook secret check accepts mismatch when strict verification is disabled", () => {
  const result = evaluateTelegramWebhookSecretCheck({
    headerSecret: "",
    storedHeaderSecret: "stored-secret",
    strictSecretHeaderVerification: false,
    allowRouteTokenFallback: false,
  });

  assert.equal(result.secretHeaderMatched, false);
  assert.equal(result.shouldReject, false);
  assert.equal(result.accepted, true);
  assert.equal(result.verificationMode, "route_token_only");
});

test("telegram webhook secret check accepts mismatch when route-token fallback is enabled", () => {
  const result = evaluateTelegramWebhookSecretCheck({
    headerSecret: "",
    storedHeaderSecret: "stored-secret",
    strictSecretHeaderVerification: true,
    allowRouteTokenFallback: true,
  });

  assert.equal(result.secretHeaderMatched, false);
  assert.equal(result.shouldReject, false);
  assert.equal(result.accepted, true);
  assert.equal(
    result.verificationMode,
    "strict_secret_header_with_route_token_fallback"
  );
});

test("telegram webhook secret check accepts matching secrets in strict mode", () => {
  const result = evaluateTelegramWebhookSecretCheck({
    headerSecret: "same-secret",
    storedHeaderSecret: "same-secret",
    strictSecretHeaderVerification: true,
    allowRouteTokenFallback: false,
  });

  assert.equal(result.secretHeaderMatched, true);
  assert.equal(result.shouldReject, false);
  assert.equal(result.accepted, true);
  assert.equal(result.verificationMode, "strict_secret_header");
});

test("telegram webhook delivery failure helper only flags live 403 backlog states", () => {
  assert.equal(
    isTelegramWebhookDeliveryFailing({
      pending_update_count: 23,
      last_error_message: "Wrong response from the webhook: 403 Forbidden",
    }),
    true
  );

  assert.equal(
    isTelegramWebhookDeliveryFailing({
      pending_update_count: 0,
      last_error_message: "Wrong response from the webhook: 403 Forbidden",
    }),
    false
  );

  assert.equal(
    isTelegramWebhookDeliveryFailing({
      pending_update_count: 8,
      last_error_message: "Wrong response from the webhook: 500 Internal Server Error",
    }),
    false
  );

  assert.equal(
    isTelegramWebhookDeliveryFailing({
      pending_update_count: 5,
      last_error_message: "",
    }),
    false
  );
});