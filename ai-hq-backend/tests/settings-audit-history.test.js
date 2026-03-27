import test from "node:test";
import assert from "node:assert/strict";

import { auditHistorySettingsRoutes } from "../src/routes/api/settings/auditHistory.js";

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    finished: false,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.finished = true;
      return this;
    },
  };
}

async function invokeRoute(router, method, path, req = {}) {
  const layer = router.stack.find(
    (item) => item.route?.path === path && item.route.methods?.[method]
  );

  if (!layer) {
    throw new Error(`Route not found for ${method.toUpperCase()} ${path}`);
  }

  const handlers = layer.route.stack.map((item) => item.handle);
  const res = createMockRes();
  const fullReq = {
    method: method.toUpperCase(),
    path,
    originalUrl: path,
    url: path,
    headers: {},
    query: {},
    body: {},
    app: { locals: {} },
    ...req,
  };

  async function runAt(index) {
    if (index >= handlers.length || res.finished) return;
    const handler = handlers[index];
    await Promise.resolve(handler(fullReq, res));
    if (!res.finished) {
      await runAt(index + 1);
    }
  }

  await runAt(0);
  return { req: fullReq, res };
}

class FakeAuditHistoryDb {
  constructor() {
    this.tenant = {
      id: "tenant-1",
      tenant_key: "acme",
      company_name: "Acme",
    };
  }

  async query(input, values = []) {
    const text = String(input?.text || input || "").trim().toLowerCase();
    const params = Array.isArray(input?.values) ? input.values : values;

    if (text.includes("from tenants") && text.includes("tenant_key")) {
      return { rows: [this.tenant] };
    }

    if (text.includes("from audit_log")) {
      assert.ok(Array.isArray(params[2]));
      return {
        rows: [
          {
            id: "audit-1",
            tenant_id: "tenant-1",
            tenant_key: "acme",
            actor: "owner@acme.test",
            action: "settings.secret.updated",
            object_type: "tenant_secret",
            object_id: "meta:page_access_token",
            meta: {
              outcome: "succeeded",
              targetArea: "provider_secret",
              provider: "meta",
              secretKey: "page_access_token",
              tokenValue: "[redacted]",
            },
            created_at: "2026-03-27T09:00:00.000Z",
          },
          {
            id: "audit-2",
            tenant_id: "tenant-1",
            tenant_key: "acme",
            actor: "admin@acme.test",
            action: "settings.operational.channel.updated",
            object_type: "tenant_channel",
            object_id: "instagram",
            meta: {
              outcome: "blocked",
              reasonCode: "insufficient_role",
              targetArea: "operational_channel",
              channelType: "instagram",
            },
            created_at: "2026-03-27T08:00:00.000Z",
          },
        ],
      };
    }

    throw new Error(`Unhandled query: ${text}`);
  }
}

test("audit history route returns safe sensitive change history for authorized readers", async () => {
  const router = auditHistorySettingsRoutes({ db: new FakeAuditHistoryDb() });
  const { res } = await invokeRoute(router, "get", "/settings/audit-history", {
    auth: {
      tenantKey: "acme",
      role: "admin",
    },
    query: {
      limit: "20",
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.items?.length, 2);
  assert.equal(res.body?.summary?.outcomes?.succeeded, 1);
  assert.equal(res.body?.summary?.outcomes?.blocked, 1);
  assert.equal(res.body?.items?.[0]?.area, "secrets");
  assert.equal(
    res.body?.items?.[0]?.details?.some((detail) => String(detail.value).includes("[redacted]")),
    false
  );
  assert.equal(
    JSON.stringify(res.body).includes("tokenValue"),
    false
  );
});

test("audit history route blocks insufficient roles", async () => {
  const router = auditHistorySettingsRoutes({ db: new FakeAuditHistoryDb() });
  const { res } = await invokeRoute(router, "get", "/settings/audit-history", {
    auth: {
      tenantKey: "acme",
      role: "operator",
    },
  });

  assert.equal(res.statusCode, 403);
  assert.equal(
    res.body?.error,
    "Only owner/admin/analyst can read control-plane audit history"
  );
  assert.equal(res.body?.reasonCode, "insufficient_role");
});
