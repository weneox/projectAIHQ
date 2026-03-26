import test from "node:test";
import assert from "node:assert/strict";

import { settingsTrustRoutes } from "../src/routes/api/settings/trust.js";

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

class FakeTrustDb {
  async query(input, values = []) {
    const text = String(input?.text || input || "").trim().toLowerCase();
    const params = Array.isArray(input?.values) ? input.values : values;

    if (text.includes("from tenants")) {
      return {
        rows: [
          {
            id: "tenant-1",
            tenant_key: params[0] || "acme",
          },
        ],
      };
    }

    if (text.includes("from tenant_sources")) {
      return { rows: [] };
    }

    if (text.includes("from v_tenant_knowledge_review_queue")) {
      return { rows: [] };
    }

    if (text.includes("from tenant_source_sync_runs")) {
      return { rows: [] };
    }

    if (text.includes("from tenant_business_profile_versions")) {
      return { rows: [] };
    }

    if (text.includes("from public.tenant_setup_review_sessions")) {
      return { rows: [] };
    }

    if (text.includes("from tenant_business_runtime_projection")) {
      return { rows: [] };
    }

    if (text.includes("from audit_log")) {
      return { rows: [] };
    }

    throw new Error(`Unhandled trust query: ${text}`);
  }
}

test("settings trust route exposes normalized trust readiness blockers", async () => {
  const router = settingsTrustRoutes({ db: new FakeTrustDb() });
  const { res } = await invokeRoute(router, "get", "/settings/trust", {
    auth: {
      tenantId: "tenant-1",
      tenantKey: "acme",
      role: "operator",
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.summary?.readiness?.status, "blocked");
  assert.equal(
    res.body?.summary?.runtimeProjection?.readiness?.blockers?.[0]?.reasonCode,
    "runtime_projection_missing"
  );
  assert.equal(
    res.body?.summary?.runtimeProjection?.readiness?.blockers?.[0]?.nextAction?.id,
    "open_setup_route"
  );
  assert.equal(
    res.body?.summary?.truth?.readiness?.blockers?.[0]?.reasonCode,
    "approved_truth_unavailable"
  );
});
