import test from "node:test";
import assert from "node:assert/strict";

import {
  __test__,
  channelConnectPublicRoutes,
} from "../src/routes/api/channelConnect/public.js";

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

test("legacy public webchat message route is registered at module scope", () => {
  const router = channelConnectPublicRoutes({});
  const routes = router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: layer.route.methods,
    }));

  assert.equal(
    routes.some(
      (route) =>
        route.path === "/channels/webchat/message" &&
        route.methods?.post === true
    ),
    true
  );
});


test("approved truth public reply uses only approved runtime facts", () => {
  const reply = __test__.buildApprovedTruthPublicReplyFromRuntime({
    text: "What is your pricing?",
    runtime: {
      authority: {
        available: true,
        stale: false,
        source: "approved_runtime_projection",
        runtimeProjectionId: "proj_approved_1",
        projectionHash: "hash_approved_1",
      },
      businessContext: "Acme helps businesses automate customer messaging.",
      serviceCatalog: [
        {
          name: "Pricing",
          description: "Plans start after a short business fit review.",
          pricing: "Starter packages begin from approved quoted plans.",
        },
        {
          name: "Implementation",
          description: "Setup includes website chat, inbox routing, and review-first automation.",
        },
      ],
      knowledgeEntries: [],
      responsePlaybooks: [],
    },
  });

  assert.equal(reply.ok, true);
  assert.equal(reply.mode, "approved_truth_answer");
  assert.match(reply.text, /approved business information/i);
  assert.match(reply.text, /pricing/i);
  assert.equal(reply.source.authority.source, "approved_runtime_projection");
  assert.equal(reply.source.authority.runtimeProjectionId, "proj_approved_1");
});

test("approved truth public reply falls back safely when no relevant approved fact exists", () => {
  const reply = __test__.buildApprovedTruthPublicReplyFromRuntime({
    text: "Do you sell cars?",
    runtime: {
      authority: {
        available: true,
        stale: false,
        source: "approved_runtime_projection",
        runtimeProjectionId: "proj_approved_2",
        projectionHash: "hash_approved_2",
      },
      serviceCatalog: [
        {
          name: "Website chat",
          description: "AIHQ captures website messages and routes them into the inbox.",
        },
      ],
      knowledgeEntries: [],
      responsePlaybooks: [],
    },
  });

  assert.equal(reply.ok, true);
  assert.equal(reply.mode, "approved_truth_fallback");
  assert.equal(reply.reasonCode, "approved_truth_no_relevant_fact");
  assert.match(reply.text, /do not have approved information/i);
});

test("approved truth public reply stays manual-first without approved runtime authority", () => {
  const reply = __test__.buildApprovedTruthPublicReplyFromRuntime({
    text: "What is your pricing?",
    runtime: {
      authority: {
        available: false,
        stale: false,
        source: "",
        reasonCode: "runtime_authority_unavailable",
      },
      serviceCatalog: [
        {
          name: "Pricing",
          description: "This should not be used without authority.",
        },
      ],
    },
  });

  assert.equal(reply.ok, false);
  assert.equal(reply.mode, "manual_first");
  assert.equal(reply.reasonCode, "approved_runtime_projection_unavailable");
  assert.match(reply.text, /message was received/i);
});

test("approved truth public reply refuses stale runtime authority", () => {
  const reply = __test__.buildApprovedTruthPublicReplyFromRuntime({
    text: "What is your pricing?",
    runtime: {
      authority: {
        available: true,
        stale: true,
        source: "approved_runtime_projection",
        runtimeProjectionId: "proj_stale",
        projectionHash: "hash_stale",
      },
      serviceCatalog: [
        {
          name: "Pricing",
          description: "This stale projection must not be used.",
        },
      ],
    },
  });

  assert.equal(reply.ok, false);
  assert.equal(reply.mode, "manual_first");
  assert.equal(reply.reasonCode, "approved_runtime_projection_unavailable");
});
