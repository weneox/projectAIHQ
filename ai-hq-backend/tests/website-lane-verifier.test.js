import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWebsiteLaneHeaders,
  buildWebsiteLaneHealthUrl,
  classifyWebsiteLaneHealth,
} from "../../scripts/website-lane-verifier.mjs";

test("website lane verifier builds a scoped health URL and internal headers", () => {
  const url = buildWebsiteLaneHealthUrl("https://api.example.test/", {
    tenantKey: "acme",
    domain: "acme.example",
  });
  const headers = buildWebsiteLaneHeaders({
    internalToken: "token-1",
  });

  assert.equal(
    url,
    "https://api.example.test/health/website-lane?tenantKey=acme&domain=acme.example"
  );
  assert.deepEqual(headers, {
    "x-internal-token": "token-1",
    "x-internal-audience": "aihq-backend.health.website-lane",
  });
});

test("website lane verifier classifies a production-ready website lane", () => {
  const lane = classifyWebsiteLaneHealth({
    tenantKey: "acme",
    tenantId: "tenant-1",
    tenantFound: true,
    status: "production_ready",
    channelConfigured: true,
    configurationReady: true,
    widgetEnabled: true,
    launchEnabled: true,
    publicWidgetId: "ww_acme_widget",
    publicWidgetIdPresent: true,
    allowedOriginsPresent: true,
    allowedOriginCount: 1,
    allowedDomainsPresent: true,
    allowedDomainCount: 1,
    originRulesPresent: true,
    targetDomain: "acme.example",
    domainVerificationRequired: true,
    domainVerificationState: "verified",
    domainVerified: true,
    productionBlocked: false,
    productionLaunchAllowed: true,
    productionReady: true,
    testingOnly: false,
    testReady: true,
    installSurfaceReady: true,
    reasonCode: "",
    message:
      "Website chat is configured with a publishable install ID, trusted origin controls, and verified domain ownership.",
    blockerReasonCodes: [],
    handoffs: {
      developer: {
        ready: true,
        productionReady: true,
        testingOnly: false,
      },
      gtm: {
        ready: true,
        productionReady: true,
        testingOnly: false,
      },
      wordpress: {
        ready: true,
        productionReady: true,
        testingOnly: false,
      },
    },
  });

  assert.equal(lane.tenantFound, true);
  assert.equal(lane.status, "production_ready");
  assert.equal(lane.productionReady, true);
  assert.equal(lane.testingOnly, false);
  assert.equal(lane.installSurfaceReady, true);
  assert.equal(lane.handoffs.developer.ready, true);
  assert.equal(lane.handoffs.gtm.productionReady, true);
  assert.equal(lane.handoffs.wordpress.testingOnly, false);
});

test("website lane verifier classifies blocked and unavailable website lanes fail-closed", () => {
  const blocked = classifyWebsiteLaneHealth({
    tenantKey: "acme",
    tenantId: "tenant-1",
    tenantFound: true,
    status: "blocked",
    channelConfigured: true,
    configurationReady: true,
    widgetEnabled: true,
    publicWidgetId: "ww_acme_widget",
    publicWidgetIdPresent: true,
    targetDomain: "acme.example",
    domainVerificationState: "unverified",
    productionBlocked: true,
    productionLaunchAllowed: false,
    productionReady: false,
    testingOnly: false,
    testReady: false,
    installSurfaceReady: true,
    reasonCode: "website_domain_verification_missing",
    blockers: [
      {
        reasonCode: "website_domain_verification_missing",
      },
    ],
    handoffs: {
      developer: {
        ready: false,
        productionReady: false,
        testingOnly: false,
      },
      gtm: {
        ready: false,
        productionReady: false,
        testingOnly: false,
      },
      wordpress: {
        ready: false,
        productionReady: false,
        testingOnly: false,
      },
    },
  });

  const unavailable = classifyWebsiteLaneHealth({
    websiteLane: {
      tenantKey: "missing",
      tenantFound: false,
      status: "not_configured",
      reasonCode: "tenant_not_found",
      message: "Tenant not found for Website lane verification.",
      handoffs: {
        developer: {
          ready: false,
        },
        gtm: {
          ready: false,
        },
        wordpress: {
          ready: false,
        },
      },
    },
  });

  assert.equal(blocked.productionReady, false);
  assert.equal(blocked.productionBlocked, true);
  assert.deepEqual(blocked.blockerReasonCodes, [
    "website_domain_verification_missing",
  ]);
  assert.equal(blocked.handoffs.developer.ready, false);

  assert.equal(unavailable.tenantFound, false);
  assert.equal(unavailable.status, "not_configured");
  assert.equal(unavailable.reasonCode, "tenant_not_found");
  assert.equal(unavailable.handoffs.wordpress.ready, false);
});
