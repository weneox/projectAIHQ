import test from "node:test";
import assert from "node:assert/strict";

import { channelConnectRoutes } from "../src/routes/api/channelConnect/index.js";

function createMockRes(onFinish) {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    finished: false,
    redirectedTo: "",
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
    redirect(url) {
      this.redirectedTo = url;
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
      auth: req.auth || {
        userId: "user-1",
        identityId: "identity-1",
        membershipId: "membership-1",
        email: "owner@acme.test",
        tenantId: "tenant-1",
        tenantKey: "acme",
        role: "owner",
      },
      user: req.user || {
        id: "user-1",
        identityId: "identity-1",
        membershipId: "membership-1",
        email: "owner@acme.test",
        tenantId: "tenant-1",
        tenantKey: "acme",
        role: "owner",
      },
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

class FakeChannelConnectDb {
  constructor(planKey = "starter") {
    this.planKey = planKey;
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
            market_region: "AZ",
            plan_key: this.planKey,
            status: "active",
            active: true,
          },
        ],
      };
    }

    if (sql.includes("insert into audit_log")) {
      this.auditEntries.push({
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

test("starter plan blocks meta connect-url and audits the blocked attempt", async () => {
  const db = new FakeChannelConnectDb("starter");
  const router = channelConnectRoutes({ db });

  const result = await invokeRouter(router, "get", "/channels/meta/connect-url");

  assert.equal(result.res.statusCode, 403);
  assert.match(result.res.body?.error || "", /self-serve billing is not enabled/i);
  assert.equal(db.auditEntries[0]?.action, "settings.channel.meta.connected");
  assert.equal(db.auditEntries[0]?.meta?.reasonCode, "plan_capability_restricted");
  assert.equal(db.auditEntries[0]?.meta?.capabilityKey, "metaChannelConnect");
});
