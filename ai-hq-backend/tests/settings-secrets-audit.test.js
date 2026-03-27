import test from "node:test";
import assert from "node:assert/strict";

process.env.TENANT_SECRET_MASTER_KEY =
  process.env.TENANT_SECRET_MASTER_KEY ||
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const { cfg } = await import("../src/config.js");
cfg.security.tenantSecretMasterKey =
  cfg.security.tenantSecretMasterKey ||
  process.env.TENANT_SECRET_MASTER_KEY;

import { secretsSettingsRoutes } from "../src/routes/api/settings/secrets.js";

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

    if (handler.length >= 3) {
      await new Promise((resolve, reject) => {
        let settled = false;
        const next = (err) => {
          if (settled) return;
          settled = true;
          if (err) {
            reject(err);
            return;
          }
          resolve(runAt(index + 1));
        };

        Promise.resolve(handler(fullReq, res, next))
          .then(() => {
            if (!settled && res.finished) {
              settled = true;
              resolve();
            }
          })
          .catch(reject);
      });
      return;
    }

    await Promise.resolve(handler(fullReq, res));
    if (!res.finished) {
      await runAt(index + 1);
    }
  }

  await runAt(0);
  return { req: fullReq, res };
}

class FakeSecretsDb {
  constructor() {
    this.tenant = {
      id: "tenant-1",
      tenant_key: "acme",
      company_name: "Acme",
    };
    this.savedSecret = null;
    this.auditEntries = [];
  }

  async query(input, values = []) {
    const text = String(input?.text || input || "").trim().toLowerCase();
    const params = Array.isArray(input?.values) ? input.values : values;

    if (text.includes("from tenants") && text.includes("tenant_key")) {
      return { rows: [this.tenant] };
    }

    if (text.includes("insert into tenant_secrets")) {
      this.savedSecret = {
        id: "secret-1",
        tenant_id: params[0],
        provider: params[1],
        secret_key: params[2],
        is_active: true,
      };
      return { rows: [this.savedSecret] };
    }

    if (text.includes("insert into audit_log")) {
      this.auditEntries.unshift({
        tenant_id: params[0],
        tenant_key: params[1],
        actor: params[2],
        action: params[3],
        object_type: params[4],
        object_id: params[5],
        meta: params[6],
      });
      return { rows: [] };
    }

    if (text.includes("delete from tenant_secrets")) {
      return { rows: [] };
    }

    throw new Error(`Unhandled query: ${text}`);
  }
}

test("secret mutation writes durable audit without leaking secret value", async () => {
  const db = new FakeSecretsDb();
  const router = secretsSettingsRoutes({ db });

  const { res } = await invokeRoute(router, "post", "/settings/secrets/:provider/:key", {
    auth: {
      tenantKey: "acme",
      role: "owner",
      userId: "user-1",
      email: "ops@example.com",
    },
    requestId: "req-secret-1",
    correlationId: "corr-secret-1",
    params: {
      provider: "meta",
      key: "page_access_token",
    },
    body: {
      value: "super-secret-token-value",
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(db.auditEntries[0]?.action, "settings.secret.updated");
  assert.equal(db.auditEntries[0]?.meta?.outcome, "succeeded");
  assert.equal(db.auditEntries[0]?.meta?.provider, "meta");
  assert.equal(db.auditEntries[0]?.meta?.secretKey, "page_access_token");
  assert.equal(db.auditEntries[0]?.meta?.requestId, "req-secret-1");
  assert.equal(db.auditEntries[0]?.meta?.correlationId, "corr-secret-1");
  assert.equal(
    JSON.stringify(db.auditEntries[0]).includes("super-secret-token-value"),
    false
  );
});

test("secret mutation blocks non-admin operators and audits the denial safely", async () => {
  const db = new FakeSecretsDb();
  const router = secretsSettingsRoutes({ db });

  const { res } = await invokeRoute(router, "post", "/settings/secrets/:provider/:key", {
    auth: {
      tenantKey: "acme",
      role: "operator",
      userId: "user-2",
      email: "operator@example.com",
    },
    params: {
      provider: "meta",
      key: "page_access_token",
    },
    body: {
      value: "super-secret-token-value",
    },
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body?.error, "Only owner/admin can manage provider secrets");
  assert.equal(res.body?.reasonCode, "insufficient_role");
  assert.equal(db.auditEntries[0]?.action, "settings.secret.updated");
  assert.equal(db.auditEntries[0]?.meta?.outcome, "blocked");
  assert.equal(db.auditEntries[0]?.meta?.reasonCode, "insufficient_role");
  assert.equal(db.auditEntries[0]?.meta?.attemptedRole, "operator");
  assert.equal(
    JSON.stringify(db.auditEntries[0]).includes("super-secret-token-value"),
    false
  );
});
