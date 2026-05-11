import test from "node:test";
import assert from "node:assert/strict";

import { __test__ } from "../src/routes/api/channelConnect/public.js";

function createReq({
  body = {},
  query = {},
  headers = {},
  ip = "127.0.0.1",
} = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      String(key).toLowerCase(),
      value,
    ])
  );

  return {
    body,
    query,
    headers: normalizedHeaders,
    ip,
    get(name) {
      return normalizedHeaders[String(name || "").toLowerCase()];
    },
  };
}

test("public webchat origin guard accepts configured domains and rejects unknown origins", () => {
  const config = {
    allowedDomains: ["acme.com"],
    allowedOrigins: ["https://www.acme.com"],
  };

  assert.equal(
    __test__.originAllowedForWidget("https://www.acme.com/pricing", config),
    true
  );

  assert.equal(
    __test__.originAllowedForWidget("https://acme.com/contact", config),
    true
  );

  assert.equal(
    __test__.originAllowedForWidget("https://evil.example.com", config),
    false
  );

  assert.equal(__test__.normalizeOriginHost("https://www.acme.com/a?b=c"), "acme.com");
});

test("public webchat message normalization builds safe website inbox ingest payload", () => {
  const req = createReq({
    body: {
      tenantKey: "acme",
      widgetId: "ww_test",
      origin: "https://www.acme.com",
      text: "Do you have pricing?",
      sessionId: "session_123",
    },
    headers: {
      "user-agent": "vitest",
    },
  });

  const normalized = __test__.normalizeWebsiteWidgetMessage(req);

  assert.equal(normalized.ok, true);
  assert.equal(normalized.tenantKey, "acme");
  assert.equal(normalized.widgetId, "ww_test");
  assert.equal(normalized.origin, "https://www.acme.com");
  assert.equal(normalized.sessionId, "session_123");
  assert.equal(normalized.ingest.channel, "website");
  assert.equal(normalized.ingest.provider, "website");
  assert.equal(normalized.ingest.platform, "website");
  assert.equal(normalized.ingest.text, "Do you have pricing?");
  assert.equal(normalized.ingest.customerName, "Website visitor");
  assert.match(normalized.ingest.externalThreadId, /^website-thread:acme:ww_test:session_123/);
  assert.match(normalized.ingest.externalUserId, /^website-user:session_123/);
  assert.match(normalized.ingest.externalMessageId, /^website:/);
  assert.equal(normalized.ingest.meta.source, "website");
  assert.equal(normalized.ingest.leadContext.source, "website_widget");
});

test("public webchat message normalization fails closed for empty and oversized text", () => {
  const empty = __test__.normalizeWebsiteWidgetMessage(
    createReq({
      body: {
        tenantKey: "acme",
        widgetId: "ww_test",
        text: "",
      },
    })
  );

  assert.equal(empty.ok, false);
  assert.equal(empty.reasonCode, "website_widget_message_text_required");

  const tooLong = __test__.normalizeWebsiteWidgetMessage(
    createReq({
      body: {
        tenantKey: "acme",
        widgetId: "ww_test",
        text: "x".repeat(2001),
      },
    })
  );

  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.reasonCode, "website_widget_message_too_long");
});

test("public webchat fail-closed payload stays safe for public clients", () => {
  const payload = __test__.buildPublicWidgetFailClosed({
    reasonCode: "website_widget_origin_not_allowed",
    message: "This website origin is not allowed to load the widget.",
  });

  assert.equal(payload.ok, false);
  assert.equal(payload.live, false);
  assert.equal(payload.status, 200);
  assert.equal(payload.reasonCode, "website_widget_origin_not_allowed");
  assert.equal(payload.assistant.statusLabel, "Setup required");
});
