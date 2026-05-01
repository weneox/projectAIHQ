import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWebsiteChatInstallPlan,
  detectWebsiteInstallEnvironment,
  normalizeWebsiteInstallUrl,
} from "../src/services/websiteChatInstallMethods.js";

test("normalizes plain website domains to https URLs", () => {
  const result = normalizeWebsiteInstallUrl("example.com");

  assert.equal(result.ok, true);
  assert.equal(result.href, "https://example.com/");
  assert.equal(result.origin, "https://example.com");
  assert.equal(result.hostname, "example.com");
});

test("detects WordPress from public website signals", () => {
  const detected = detectWebsiteInstallEnvironment({
    websiteUrl: "https://example.com",
    html: '<link href="/wp-content/themes/site/style.css"><meta name="generator" content="WordPress">',
  });

  assert.equal(detected.primaryPlatform.id, "wordpress");
  assert.equal(detected.primaryPlatform.confidence, "high");
  assert.equal(detected.signals.includes("wordpress_signal"), true);
});

test("detects Shopify and Google Tag Manager signals", () => {
  const detected = detectWebsiteInstallEnvironment({
    websiteUrl: "https://shop.example",
    html: '<script src="https://cdn.shopify.com/theme.js"></script><script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC"></script>',
  });

  assert.equal(detected.primaryPlatform.id, "shopify");
  assert.equal(detected.hasGoogleTagManager, true);
});

test("recommends no-code WordPress plugin instead of snippet", () => {
  const plan = buildWebsiteChatInstallPlan({
    websiteUrl: "https://example.com",
    html: '<meta name="generator" content="WordPress"><link href="/wp-content/site.css">',
    access: {
      cmsAdmin: true,
    },
  });

  assert.equal(plan.status, "installable");
  assert.equal(plan.recommendedMethod.id, "wordpress_plugin");
  assert.equal(plan.recommendedMethod.noCode, true);
  assert.equal(plan.recommendedMethod.requiresCodeAccess, false);
  assert.equal(plan.snippetIsFallbackOnly, true);
  assert.notEqual(plan.recommendedMethod.id, "manual_snippet");
});

test("recommends Cloudflare automatic install for custom sites with Cloudflare access", () => {
  const plan = buildWebsiteChatInstallPlan({
    websiteUrl: "https://custom.example",
    headers: {
      server: "cloudflare",
      "cf-ray": "abc",
    },
    access: {
      cloudflare: true,
      dns: true,
    },
  });

  assert.equal(plan.recommendedMethod.id, "cloudflare_auto_injection");
  assert.equal(plan.recommendedMethod.noCode, true);
  assert.equal(plan.recommendedMethod.requiresCodeAccess, false);
});

test("recommends developer invite before manual snippet for unmanaged custom sites", () => {
  const plan = buildWebsiteChatInstallPlan({
    websiteUrl: "https://custom.example",
    developer: {
      email: "developer@example.com",
    },
  });

  assert.equal(plan.recommendedMethod.id, "developer_invite");
  assert.equal(plan.recommendedMethod.noCode, true);
  assert.equal(plan.fallbackMethods.some((method) => method.id === "manual_snippet"), true);
});

test("uses managed support when the user does not know website access details", () => {
  const plan = buildWebsiteChatInstallPlan({
    websiteUrl: "https://unknown.example",
  });

  assert.equal(plan.recommendedMethod.id, "managed_support");
  assert.equal(plan.status, "needs_install_help");
  assert.equal(plan.recommendedMethod.noCode, true);
});

test("always includes security baseline for public website chat", () => {
  const plan = buildWebsiteChatInstallPlan({
    websiteUrl: "https://example.com",
    html: "wordpress wp-content",
  });

  const ids = plan.securityRequirements.map((item) => item.id);

  assert.equal(ids.includes("domain_or_origin_allowlist"), true);
  assert.equal(ids.includes("bootstrap_session_tokens"), true);
  assert.equal(ids.includes("rate_limit"), true);
  assert.equal(ids.includes("truth_runtime_gate"), true);
  assert.equal(ids.includes("manual_first_launch"), true);
});
