import test from "node:test";
import assert from "node:assert/strict";

import {
  getCommercialPlan,
  normalizeCommercialPlanKey,
} from "../src/services/commercialPlans.js";
import { enforceTenantQuota } from "../src/services/tenantQuota.js";
import { apiVersionMiddleware } from "../src/utils/apiVersioning.js";
import { createStructuredLogEntry } from "../src/utils/logger.js";
import { assertTenantQueryAllowed } from "../src/db/tenantContext.js";

test("commercial plans expose free/basic/pro without breaking legacy aliases", () => {
  assert.equal(normalizeCommercialPlanKey("free"), "free");
  assert.equal(normalizeCommercialPlanKey("basic"), "basic");
  assert.equal(normalizeCommercialPlanKey("pro"), "pro");
  assert.equal(normalizeCommercialPlanKey("starter"), "free");
  assert.equal(normalizeCommercialPlanKey("growth"), "pro");

  const plan = getCommercialPlan("growth");
  assert.equal(plan.key, "pro");
  assert.equal(plan.limits.aiUnitsPerDay > 0, true);
});

test("tenant guard treats commercial usage tables as tenant scoped", () => {
  assert.throws(
    () =>
      assertTenantQueryAllowed("select * from tenant_usage_daily", [], {
        context: {},
      }),
    /tenant context/i
  );

  assert.doesNotThrow(() =>
    assertTenantQueryAllowed(
      "select * from tenant_usage_daily where tenant_id = $1",
      ["tenant-1"],
      {
        context: {
          tenantId: "tenant-1",
          tenantKey: "acme",
          source: "test",
        },
      }
    )
  );
});

test("quota enforcement returns a metadata-rich 429 decision", async () => {
  const queries = [];
  const db = {
    async query(query, values = []) {
      const text = typeof query === "string" ? query : query?.text || "";
      queries.push({ text, values });
      if (/from tenant_usage_daily/i.test(text)) {
        return {
          rows: [
            {
              tenant_id: "tenant-1",
              tenant_key: "acme",
              api_calls: 2_000,
              ai_units: 0,
              messages_in: 0,
              messages_out: 0,
              webhook_events: 0,
              quota_rejections: 0,
            },
          ],
        };
      }
      return { rows: [{ id: "usage-row" }] };
    },
  };
  const headers = {};
  const req = {
    method: "POST",
    originalUrl: "/api/chat",
    requestId: "req-quota-1",
    auth: {
      tenantId: "tenant-1",
      tenantKey: "acme",
      planKey: "free",
    },
    log: {
      warn() {},
    },
  };
  const res = {
    setHeader(name, value) {
      headers[name] = value;
    },
  };

  const result = await enforceTenantQuota({
    db,
    req,
    res,
    profile: {
      metric: "ai_units",
      cost: 1,
      class: "ai_execution",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 429);
  assert.equal(result.code, "tenant_quota_exceeded");
  assert.equal(result.quota.metric, "api_calls");
  assert.equal(headers["X-Quota-Plan"], "free");
  assert.equal(queries.some((q) => /quota_rejections/i.test(q.text)), true);
});

test("api version middleware establishes stable v1 response headers", () => {
  const headers = {};
  const req = {
    originalUrl: "/api/v1/chat",
  };
  const res = {
    setHeader(name, value) {
      headers[name] = value;
    },
  };
  let nextCalled = false;

  apiVersionMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.apiVersion, "v1");
  assert.equal(headers["X-API-Version"], "v1");
  assert.equal(headers["X-API-Stability"], "stable");
});

test("structured logger redacts sensitive metadata but preserves tenant keys", () => {
  const entry = createStructuredLogEntry({
    event: "security.redaction.test",
    data: {
      tenantKey: "acme",
      authorization: "Bearer secret",
      nested: {
        apiKey: "sk-test",
        password: "hunter2",
      },
    },
  });

  assert.equal(entry.tenantKey, "acme");
  assert.equal(entry.authorization, "[REDACTED]");
  assert.equal(entry.nested.apiKey, "[REDACTED]");
  assert.equal(entry.nested.password, "[REDACTED]");
});
