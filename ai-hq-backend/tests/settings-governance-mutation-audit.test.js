import test from "node:test";
import assert from "node:assert/strict";

import { workspaceSettingsRoutes } from "../src/routes/api/settings/workspace.js";
import { agentsSettingsRoutes } from "../src/routes/api/settings/agents.js";

function createMockRes(onFinish) {
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
      onFinish?.();
      return this;
    },
  };
}

async function invokeRouter(router, method, path, req = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve({ req: fullReq, res });
    };

    const normalizedHeaders = Object.fromEntries(
      Object.entries(req.headers || {}).map(([key, value]) => [String(key).toLowerCase(), value])
    );

    const fullReq = {
      method: String(method || "GET").toUpperCase(),
      path,
      originalUrl: path,
      url: path,
      headers: normalizedHeaders,
      query: req.query || {},
      body: req.body || {},
      protocol: req.protocol || "https",
      app: req.app || { locals: {} },
      get(name) {
        return this.headers[String(name || "").toLowerCase()];
      },
      ...req,
    };

    const res = createMockRes(finish);

    try {
      router.handle(fullReq, res, (err) => {
        if (settled) return;
        if (err) {
          settled = true;
          reject(err);
          return;
        }
        settled = true;
        resolve({ req: fullReq, res });
      });
    } catch (err) {
      reject(err);
    }
  });
}

function buildTenantAuth(role = "member") {
  return {
    userId: "user-1",
    email: `${role}@acme.test`,
    tenantId: "tenant-1",
    tenantKey: "acme",
    role,
  };
}

class FakeSettingsAuditDb {
  constructor() {
    this.auditEntries = [];
  }

  async query(text, values = []) {
    const sql = String(text || "").toLowerCase();

    if (sql.includes("from tenants") && sql.includes("where lower(tenant_key)")) {
      return {
        rows: [
          {
            id: "tenant-1",
            tenant_key: "acme",
            company_name: "Acme",
            legal_name: "Acme LLC",
            industry_key: "generic_business",
            country_code: "AZ",
            timezone: "Asia/Baku",
            default_language: "az",
            enabled_languages: ["az"],
            supported_languages: ["az"],
            market_region: "AZ",
            plan_key: "starter",
            status: "active",
            active: true,
          },
        ],
      };
    }

    if (sql.includes("insert into audit_log")) {
      this.auditEntries.push({
        actor: values[2],
        action: values[3],
        objectType: values[4],
        objectId: values[5],
        meta: values[6],
      });
      return { rows: [] };
    }

    throw new Error(`Unhandled query: ${sql}`);
  }
}

test("workspace mutation denial is audited through the shared settings mutation guard", async () => {
  const db = new FakeSettingsAuditDb();
  const router = workspaceSettingsRoutes({ db });

  const result = await invokeRouter(router, "post", "/settings/workspace", {
    auth: buildTenantAuth("operator"),
    body: {
      tenant: {
        company_name: "Acme Updated",
      },
    },
  });

  assert.equal(result.res.statusCode, 403);
  assert.equal(db.auditEntries[0]?.action, "settings.workspace.updated");
  assert.equal(db.auditEntries[0]?.meta?.outcome, "blocked");
  assert.equal(db.auditEntries[0]?.meta?.attemptedRole, "operator");
  assert.deepEqual(db.auditEntries[0]?.meta?.requiredRoles, ["owner", "admin"]);
});

test("agent mutation denial is audited through the shared settings mutation guard", async () => {
  const db = new FakeSettingsAuditDb();
  const router = agentsSettingsRoutes({ db });

  const result = await invokeRouter(router, "post", "/settings/agents/support", {
    auth: buildTenantAuth("member"),
    params: {
      key: "support",
    },
    body: {
      displayName: "Support Agent",
    },
  });

  assert.equal(result.res.statusCode, 403);
  assert.equal(db.auditEntries[0]?.action, "settings.agent.updated");
  assert.equal(db.auditEntries[0]?.meta?.outcome, "blocked");
  assert.equal(db.auditEntries[0]?.meta?.attemptedRole, "member");
  assert.deepEqual(db.auditEntries[0]?.meta?.requiredRoles, ["owner", "admin"]);
});

test("starter plan agent mutation denial is audited through the shared entitlement guard", async () => {
  const db = new FakeSettingsAuditDb();
  const router = agentsSettingsRoutes({ db });

  const result = await invokeRouter(router, "post", "/settings/agents/support", {
    auth: buildTenantAuth("owner"),
    params: {
      key: "support",
    },
    body: {
      displayName: "Support Agent",
    },
  });

  assert.equal(result.res.statusCode, 403);
  assert.equal(db.auditEntries[0]?.action, "settings.agent.updated");
  assert.equal(db.auditEntries[0]?.meta?.outcome, "blocked");
  assert.equal(db.auditEntries[0]?.meta?.reasonCode, "plan_capability_restricted");
  assert.equal(db.auditEntries[0]?.meta?.capabilityKey, "agentConfigMutation");
  assert.equal(db.auditEntries[0]?.meta?.normalizedPlanKey, "starter");
});
