import test from "node:test";
import assert from "node:assert/strict";

process.env.AIHQ_BASE_URL = "https://aihq.example.test";
process.env.AIHQ_INTERNAL_TOKEN = "internal-token";

const originalFetch = global.fetch;

const { resolveTenantContextFromMetaEvent } = await import(
  "../src/services/tenantResolver.js"
);
const { forwardToAiHq } = await import("../src/services/aihqClient.js");
const { getTenantMetaConfigByChannel } = await import(
  "../src/services/tenantProviderSecrets.js"
);
const {
  checkAihqOperationalBootReadiness,
} = await import("../src/services/bootReadiness.js");
const {
  buildRuntimeSignalsResponse,
  createHealthHandler,
} = await import("../src/services/healthRoute.js");
const {
  getRuntimeMetricsSnapshot,
  listRuntimeSignals,
  configureRuntimeSignalPersistence,
  recordExecutionFailure,
  recordRuntimeSignal,
  resetRuntimeReliability,
} = await import("../src/services/runtimeReliability.js");
const { createAihqRuntimeIncidentClient } = await import(
  "../src/services/aihqRuntimeIncidentClient.js"
);

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

test.beforeEach(() => {
  resetRuntimeReliability();
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
      checkedAt: "2026-03-26T00:00:00.000Z",
      enforced: true,
      status: "blocked",
      reasonCode: "channel_identifiers_missing",
      blockerReasonCodes: ["channel_identifiers_missing"],
      blockersTotal: 1,
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
  assert.equal(res.body.readiness.checkedAt, "2026-03-26T00:00:00.000Z");
  assert.equal(res.body.readiness.enforced, true);
  assert.equal(res.body.readiness.reasonCode, "channel_identifiers_missing");
  assert.deepEqual(res.body.readiness.blockerReasonCodes, [
    "channel_identifiers_missing",
  ]);
  assert.equal(res.body.readiness.blockersTotal, 1);
  assert.equal(res.body.readiness.intentionallyUnavailable, true);
});

test("meta runtime signals response exposes sanitized failures and counters", () => {
  recordExecutionFailure({
    type: "reply",
    channel: "instagram",
    tenantKey: "acme",
    threadId: "thread-1",
    recipientId: "user-1",
    status: 503,
    failureClass: "retryable",
    retryable: true,
    error: "provider timeout",
  });

  const response = buildRuntimeSignalsResponse({
    service: "meta-bot-backend",
    bootReadiness: {
      status: "ok",
      checkedAt: "2026-03-26T00:00:00.000Z",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.service, "meta-bot-backend");
  assert.equal(typeof response.body.runtime.checkedAt, "string");
  assert.deepEqual(response.body.runtime.metrics, getRuntimeMetricsSnapshot());
  assert.equal(response.body.runtime.recentExecutionFailures[0]?.tenantKey, "acme");
  assert.equal(response.body.runtime.recentExecutionFailures[0]?.error, "provider timeout");
  assert.ok(Array.isArray(response.body.runtime.recentSignals));
});

test("meta runtime reliability retains recent signal history", () => {
  recordExecutionFailure({
    type: "reply",
    channel: "instagram",
    tenantKey: "acme",
    status: 500,
    failureClass: "retryable",
    retryable: true,
    error: "gateway timeout",
  });

  const signals = listRuntimeSignals();
  assert.equal(signals[0]?.category, "execution");
  assert.equal(signals[0]?.code, "meta_execution_failure");
  assert.equal(signals[0]?.tenantKey, "acme");
});

test("meta runtime signals retain correlation identifiers in triage output", () => {
  recordRuntimeSignal({
    level: "warn",
    category: "provider_access",
    code: "meta_provider_access_unavailable",
    reasonCode: "provider_access_unavailable",
    requestId: "req-meta-2",
    correlationId: "corr-meta-2",
    tenantKey: "acme",
    status: 503,
    error: "provider unavailable",
  });

  const response = buildRuntimeSignalsResponse({
    service: "meta-bot-backend",
    bootReadiness: {
      status: "ok",
      checkedAt: "2026-03-26T00:00:00.000Z",
    },
  });

  assert.equal(response.body.runtime.recentSignals[0]?.requestId, "req-meta-2");
  assert.equal(response.body.runtime.recentSignals[0]?.correlationId, "corr-meta-2");
});

test("meta durable incident client posts sanitized incident payload to AI HQ", async () => {
  let seenUrl = "";
  let seenHeaders = null;
  let seenBody = null;
  const client = createAihqRuntimeIncidentClient({
    fetchFn: async (url, options = {}) => {
      seenUrl = url;
      seenHeaders = options.headers || {};
      seenBody = JSON.parse(options.body || "{}");
      return {
        ok: true,
        status: 202,
        async text() {
          return JSON.stringify({
            ok: true,
            incident: {
              id: "incident-1",
            },
          });
        },
      };
    },
    baseUrl: "https://aihq.example.test",
    internalToken: "internal-token",
  });

  const result = await client.recordIncident({
    service: "meta-bot-backend",
    area: "execution",
    severity: "error",
    code: "meta_execution_failure",
    reasonCode: "retryable",
    requestId: "req-meta-3",
    correlationId: "corr-meta-3",
    tenantKey: "ACME",
    detailSummary: "provider timeout",
    context: {
      status: 503,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(seenUrl, "https://aihq.example.test/api/internal/runtime-signals/incidents");
  assert.equal(seenHeaders["x-request-id"], "req-meta-3");
  assert.equal(seenHeaders["x-correlation-id"], "corr-meta-3");
  assert.equal(seenBody.tenantKey, "acme");
  assert.equal(seenBody.code, "meta_execution_failure");
});

test("meta runtime reliability forwards only durable-worthy signals", async () => {
  const forwarded = [];
  configureRuntimeSignalPersistence(async (entry) => {
    forwarded.push(entry);
  });

  recordRuntimeSignal({
    level: "info",
    category: "runtime",
    code: "meta_runtime_heartbeat",
  });
  recordRuntimeSignal({
    level: "warn",
    category: "provider_access",
    code: "meta_provider_access_unavailable",
    reasonCode: "provider_access_unavailable",
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0]?.code, "meta_provider_access_unavailable");
});

test("meta AI HQ client forwards correlation headers", async () => {
  let seenHeaders = null;
  global.fetch = async (_url, options = {}) => {
    seenHeaders = options.headers || {};
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ ok: true });
      },
    };
  };

  const out = await forwardToAiHq(
    { tenantKey: "acme", message: { text: "hello" } },
    { requestId: "req-meta-1", correlationId: "corr-meta-1" }
  );

  assert.equal(out.ok, true);
  assert.equal(seenHeaders["x-request-id"], "req-meta-1");
  assert.equal(seenHeaders["x-correlation-id"], "corr-meta-1");
});
