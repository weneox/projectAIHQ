import test from "node:test";
import assert from "node:assert/strict";

process.env.AIHQ_BASE_URL = "https://aihq.example.test";
process.env.AIHQ_INTERNAL_TOKEN = "internal-token";

const originalFetch = global.fetch;

const { resolveTenantContextFromMetaEvent } = await import(
  "../src/services/tenantResolver.js"
);
const { getTenantMetaConfigByChannel } = await import(
  "../src/services/tenantProviderSecrets.js"
);
const {
  checkAihqOperationalBootReadiness,
} = await import("../src/services/bootReadiness.js");
const { createHealthHandler } = await import("../src/services/healthRoute.js");

function mockFetchJson(json, { ok = true, status = 200 } = {}) {
  global.fetch = async () => ({
    ok,
    status,
    async text() {
      return JSON.stringify(json);
    },
  });
}

test.after(() => {
  global.fetch = originalFetch;
});

test("meta tenant resolution returns projected runtime contract from AI HQ", async () => {
  mockFetchJson({
    ok: true,
    tenantKey: "acme",
    tenantId: "tenant-1",
    resolvedChannel: "instagram",
    tenant: {
      id: "tenant-1",
      tenant_key: "acme",
    },
    channelConfig: {
      channelType: "instagram",
    },
    projectedRuntime: {
      authority: {
        mode: "strict",
        required: true,
        available: true,
        source: "approved_runtime_projection",
        tenantId: "tenant-1",
        tenantKey: "acme",
      },
      tenant: {
        tenantId: "tenant-1",
        tenantKey: "acme",
        companyName: "Acme",
      },
      channels: {
        meta: {
          channelType: "instagram",
          pageId: "page-1",
          igUserId: "ig-1",
        },
      },
    },
  });

  const resolved = await resolveTenantContextFromMetaEvent({
    channel: "instagram",
    pageId: "page-1",
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.projectedRuntime?.tenant?.tenantKey, "acme");
  assert.equal(resolved.projectedRuntime?.channels?.meta?.pageId, "page-1");
});

test("meta provider resolve prefers projected runtime channel ids", async () => {
  mockFetchJson({
    ok: true,
    tenantKey: "acme",
    tenantId: "tenant-1",
    projectedRuntime: {
      authority: {
        mode: "strict",
        required: true,
        available: true,
        source: "approved_runtime_projection",
        tenantId: "tenant-1",
        tenantKey: "acme",
      },
      tenant: {
        tenantId: "tenant-1",
        tenantKey: "acme",
        companyName: "Acme",
      },
      channels: {
        meta: {
          pageId: "page-1",
          igUserId: "ig-1",
        },
      },
    },
    operationalChannels: {
      meta: {
        available: true,
        ready: true,
        provider: "meta",
        channelType: "instagram",
        pageId: "page-1",
        igUserId: "ig-1",
      },
    },
    providerAccess: {
      provider: "meta",
      tenantKey: "acme",
      tenantId: "tenant-1",
      available: true,
      pageId: "page-1",
      igUserId: "ig-1",
      pageAccessToken: "token-1",
      appSecret: "app-secret",
      secretKeys: ["page_access_token", "app_secret"],
    },
  });

  const resolved = await getTenantMetaConfigByChannel({
    channel: "instagram",
    pageId: "page-1",
  });

  assert.equal(resolved.tenantKey, "acme");
  assert.equal(resolved.pageId, "page-1");
  assert.equal(resolved.igUserId, "ig-1");
  assert.equal(resolved.pageAccessToken, "token-1");
  assert.equal(resolved.projectedRuntime?.tenant?.tenantKey, "acme");
});

test("meta provider resolve fails closed when operational meta contract is not ready", async () => {
  mockFetchJson({
    ok: true,
    tenantKey: "acme",
    tenantId: "tenant-1",
    projectedRuntime: {
      authority: {
        mode: "strict",
        required: true,
        available: true,
        source: "approved_runtime_projection",
        tenantId: "tenant-1",
        tenantKey: "acme",
      },
      tenant: {
        tenantId: "tenant-1",
        tenantKey: "acme",
        companyName: "Acme",
      },
    },
    operationalChannels: {
      meta: {
        available: true,
        ready: false,
        reasonCode: "channel_identifiers_missing",
        provider: "meta",
        channelType: "instagram",
        pageId: "",
        igUserId: "",
      },
    },
    providerAccess: {
      provider: "meta",
      tenantKey: "acme",
      tenantId: "tenant-1",
      available: true,
      pageId: "",
      igUserId: "",
      pageAccessToken: "token-1",
      appSecret: "app-secret",
      secretKeys: ["page_access_token", "app_secret"],
    },
  });

  const resolved = await getTenantMetaConfigByChannel({
    channel: "instagram",
    pageId: "page-1",
  });

  assert.equal(resolved.source, "none");
  assert.equal(resolved.error, "channel_identifiers_missing");
  assert.equal(resolved.pageAccessToken, "");
});

test("meta boot readiness blocks prod-like startup when AI HQ has blockers", async () => {
  mockFetchJson(
    {
      ok: true,
      operationalReadiness: {
        blockers: {
          total: 1,
        },
      },
    },
    { ok: true, status: 200 }
  );

  await assert.rejects(
    () =>
      checkAihqOperationalBootReadiness({
        fetchFn: global.fetch,
        baseUrl: "https://aihq.example.test",
        internalToken: "internal-token",
        appEnv: "production",
        requireOnBoot: true,
      }),
    /aihq_operational_readiness_blocked:1/
  );
});

test("meta boot readiness reports structured blocker reason codes when requested", async () => {
  mockFetchJson(
    {
      ok: true,
      operationalReadiness: {
        blockerReasonCodes: ["channel_identifiers_missing"],
        blockers: {
          total: 1,
        },
      },
    },
    { ok: true, status: 200 }
  );

  const readiness = await checkAihqOperationalBootReadiness({
    fetchFn: global.fetch,
    baseUrl: "https://aihq.example.test",
    internalToken: "internal-token",
    appEnv: "production",
    requireOnBoot: true,
    throwOnBlocked: false,
  });

  assert.equal(readiness.ok, false);
  assert.equal(readiness.status, "blocked");
  assert.equal(readiness.reasonCode, "channel_identifiers_missing");
  assert.equal(readiness.intentionallyUnavailable, true);
});

test("meta health route response exposes direct structured readiness", () => {
  const handler = createHealthHandler({
    service: "meta-bot-backend",
    bootReadiness: {
      status: "blocked",
      reasonCode: "channel_identifiers_missing",
      blockerReasonCodes: ["channel_identifiers_missing"],
      intentionallyUnavailable: true,
      dependency: {
        aihqReady: false,
      },
      aihq: {
        ok: false,
      },
      localDecision: {
        failClosed: true,
      },
    },
  });
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  handler({}, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.service, "meta-bot-backend");
  assert.equal(res.body.readiness.status, "blocked");
  assert.equal(res.body.readiness.reasonCode, "channel_identifiers_missing");
  assert.deepEqual(res.body.readiness.blockerReasonCodes, [
    "channel_identifiers_missing",
  ]);
  assert.equal(res.body.readiness.intentionallyUnavailable, true);
});
