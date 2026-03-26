import test from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import { adminSessionRoutes } from "../src/routes/api/adminAuth/session.js";
import { workspaceSettingsRoutes } from "../src/routes/api/settings/workspace.js";
import { tenantInternalRoutes } from "../src/routes/api/tenants/internal.js";

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    cookiesCleared: [],
    finished: false,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    clearCookie(name, options = {}) {
      this.cookiesCleared.push({ name, options });
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

class FakeUserSessionDb {
  constructor() {
    this.authSessions = new Map();
  }

  seedRevokedSession(tokenHash) {
    this.authSessions.set(tokenHash, {
      revoked_at: new Date().toISOString(),
    });
  }

  async query(input) {
    const text = String(input?.text || input || "").trim().toLowerCase();
    const values = Array.isArray(input?.values) ? input.values : [];

    if (text === "select 1 as ok") {
      return { rows: [{ ok: 1 }] };
    }

    if (text.includes("from auth_sessions s") && text.includes("join tenant_users")) {
      const row = this.authSessions.get(String(values[0])) || null;
      if (!row || row.revoked_at) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    }

    throw new Error(`Unhandled auth route query: ${text}`);
  }
}

class FakeTenantInternalDb {
  constructor(options = {}) {
    this.options = options;
  }

  async query(input, values = []) {
    const text = String(input?.text || input || "").trim().toLowerCase();
    const params = Array.isArray(input?.values) ? input.values : values;

    if (text.includes("from tenant_channels tc") && text.includes("join tenants t")) {
      const missingIds = this.options.missingChannelIds === true;
      return {
        rows: [
          {
            id: "channel-1",
            tenant_id: "tenant-1",
            channel_type: "instagram",
            provider: "meta",
            display_name: "IG",
            external_account_id: "acct-1",
            external_page_id: missingIds ? "" : "page-1",
            external_user_id: missingIds ? "" : "ig-1",
            external_username: "brand",
            status: "connected",
            is_primary: true,
            config: {},
            secrets_ref: "meta",
            health: {},
            last_sync_at: null,
            created_at: null,
            updated_at: null,
            tenant_key: "acme",
            company_name: "Acme",
            legal_name: "Acme LLC",
            industry_key: "beauty",
            country_code: "AZ",
            timezone: "Asia/Baku",
            default_language: "az",
            enabled_languages: ["az"],
            market_region: "AZ",
            plan_key: "pro",
            tenant_status: "active",
            tenant_active: true,
          },
        ],
      };
    }

    if (text.includes("from tenant_voice_settings")) {
      return { rows: [] };
    }

    if (text.includes("from tenant_secrets")) {
      if (this.options.missingProviderSecret === true) {
        return { rows: [] };
      }
      return {
        rows: [
          {
            id: "secret-1",
            tenant_id: params[0],
            provider: "meta",
            secret_key: "page_access_token",
            secret_value_enc: "enc",
            secret_value_iv: "iv",
            secret_value_tag: "tag",
            version: 1,
            is_active: true,
            created_by: "system",
            updated_by: "system",
            created_at: null,
            updated_at: null,
          },
        ],
      };
    }

    throw new Error(`Unhandled tenant internal query: ${text}`);
  }
}

test("route-level /auth/me clears cookie and reports unauthenticated for invalid session", async () => {
  const router = adminSessionRoutes({
    db: new FakeUserSessionDb(),
    wsHub: null,
  });

  const { res } = await invokeRoute(router, "get", "/auth/me", {
    headers: {
      cookie: "aihq_user=invalid-session-token",
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.authenticated, false);
  assert.equal(res.body?.reason, "session not found");
  assert.ok(res.cookiesCleared.some((item) => item.name === "aihq_user"));
});

test("route-level settings debug auth is gated in production", async () => {
  const previousEnv = cfg.app.env;
  const previousDebugToken = cfg.security.debugApiToken;
  const previousInternalToken = cfg.security.aihqInternalToken;

  try {
    cfg.app.env = "production";
    cfg.security.debugApiToken = "";
    cfg.security.aihqInternalToken = "";

    const router = workspaceSettingsRoutes({ db: null });
    const { res } = await invokeRoute(router, "get", "/settings/__debug-auth");

    assert.equal(res.statusCode, 404);
    assert.equal(res.body?.ok, false);
  } finally {
    cfg.app.env = previousEnv;
    cfg.security.debugApiToken = previousDebugToken;
    cfg.security.aihqInternalToken = previousInternalToken;
  }
});

test("route-level internal tenant resolve keeps secret metadata but strips raw values", async () => {
  const previousInternalToken = cfg.security.aihqInternalToken;
  const previousMasterKey = cfg.security.tenantSecretMasterKey;

  try {
    cfg.security.aihqInternalToken = "internal-secret";
    cfg.security.tenantSecretMasterKey =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const router = tenantInternalRoutes({
      db: new FakeTenantInternalDb(),
      getRuntime: async () => ({
        authority: {
          mode: "strict",
          required: true,
          available: true,
          source: "approved_runtime_projection",
          tenantId: "tenant-1",
          tenantKey: "acme",
          runtimeProjectionId: "projection-1",
          runtimeProjectionStatus: "ready",
          projectionHash: "hash-1",
        },
        raw: {
          projection: {
            projection_hash: "hash-1",
            readiness_label: "ready",
            confidence_label: "high",
            identity_json: {
              tenantId: "tenant-1",
              tenantKey: "acme",
              companyName: "Acme",
              displayName: "Acme",
              industryKey: "beauty",
              mainLanguage: "az",
              supportedLanguages: ["az"],
            },
            profile_json: {
              summaryShort: "Acme summary",
              toneProfile: "premium",
            },
            contacts_json: [
              {
                channel: "phone",
                isPrimary: true,
                value: "+994555000000",
              },
            ],
            services_json: [
              {
                serviceKey: "hair",
                title: "Hair care",
                description: "Hair service",
              },
            ],
            inbox_json: {
              enabled: true,
            },
            comments_json: {
              enabled: true,
            },
            voice_json: {
              enabled: true,
              supportsCalls: true,
              primaryPhone: "+994555000000",
            },
            lead_capture_json: {
              enabled: true,
              contactCaptureMode: "guided",
            },
            handoff_json: {
              enabled: true,
              escalationMode: "manual",
            },
            channels_json: [
              {
                channelType: "instagram",
                label: "IG",
                endpoint: "instagram",
                isPrimary: true,
                status: "active",
              },
            ],
          },
        },
      }),
    });

    const { res } = await invokeRoute(router, "get", "/tenants/resolve-channel", {
      headers: {
        "x-internal-token": "internal-secret",
      },
      query: {
        channel: "instagram",
        pageId: "page-1",
      },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.tenantKey, "acme");
    assert.equal(res.body?.providerSecrets?.rawValuesExposed, false);
    assert.deepEqual(res.body?.providerSecrets?.secretKeys, ["page_access_token"]);
    assert.equal(res.body?.providerSecrets?.secrets?.[0]?.value, undefined);
    assert.equal(res.body?.providerSecrets?.secrets?.[0]?.present, false);
    assert.equal(
      res.body?.projectedRuntime?.authority?.source,
      "approved_runtime_projection"
    );
    assert.equal(res.body?.projectedRuntime?.tenant?.tenantKey, "acme");
    assert.equal(res.body?.projectedRuntime?.channels?.meta?.pageId, "page-1");
    assert.equal(res.body?.operationalChannels?.meta?.pageId, "page-1");
  } finally {
    cfg.security.aihqInternalToken = previousInternalToken;
    cfg.security.tenantSecretMasterKey = previousMasterKey;
  }
});

test("route-level internal tenant resolve rejects missing internal token", async () => {
  const previousInternalToken = cfg.security.aihqInternalToken;

  try {
    cfg.security.aihqInternalToken = "internal-secret";

    const router = tenantInternalRoutes({
      db: new FakeTenantInternalDb(),
      getRuntime: async () => ({
        authority: {
          mode: "strict",
          required: true,
          available: true,
          source: "approved_runtime_projection",
          tenantId: "tenant-1",
          tenantKey: "acme",
        },
        raw: {
          projection: {
            identity_json: {
              tenantId: "tenant-1",
              tenantKey: "acme",
              companyName: "Acme",
            },
          },
        },
      }),
    });

    const { res } = await invokeRoute(router, "get", "/tenants/resolve-channel", {
      query: {
        channel: "instagram",
        pageId: "page-1",
      },
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.body?.ok, false);
    assert.equal(res.body?.reason, "invalid internal token");
  } finally {
    cfg.security.aihqInternalToken = previousInternalToken;
  }
});

test("route-level internal tenant resolve fails closed when internal auth is misconfigured", async () => {
  const previousEnv = cfg.app.env;
  const previousInternalToken = cfg.security.aihqInternalToken;

  try {
    cfg.app.env = "development";
    cfg.security.aihqInternalToken = "";

    const router = tenantInternalRoutes({
      db: new FakeTenantInternalDb(),
      getRuntime: async () => ({
        authority: {
          mode: "strict",
          required: true,
          available: true,
          source: "approved_runtime_projection",
          tenantId: "tenant-1",
          tenantKey: "acme",
        },
        raw: {
          projection: {
            identity_json: {
              tenantId: "tenant-1",
              tenantKey: "acme",
              companyName: "Acme",
            },
          },
        },
      }),
    });

    const { res } = await invokeRoute(router, "get", "/tenants/resolve-channel", {
      query: {
        channel: "instagram",
        pageId: "page-1",
      },
    });

    assert.equal(res.statusCode, 500);
    assert.equal(res.body?.ok, false);
    assert.equal(res.body?.error, "InternalAuthMisconfigured");
    assert.equal(res.body?.reason, "internal auth token is not configured");
  } finally {
    cfg.app.env = previousEnv;
    cfg.security.aihqInternalToken = previousInternalToken;
  }
});

test("route-level internal meta provider access returns secret-backed internal access", async () => {
  const previousInternalToken = cfg.security.aihqInternalToken;
  const previousMasterKey = cfg.security.tenantSecretMasterKey;

  try {
    cfg.security.aihqInternalToken = "internal-secret";
    cfg.security.tenantSecretMasterKey =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const router = tenantInternalRoutes({
      db: new FakeTenantInternalDb(),
      getRuntime: async () => ({
        authority: {
          mode: "strict",
          required: true,
          available: true,
          source: "approved_runtime_projection",
          tenantId: "tenant-1",
          tenantKey: "acme",
          runtimeProjectionId: "projection-1",
        },
        raw: {
          projection: {
            identity_json: {
              tenantId: "tenant-1",
              tenantKey: "acme",
              companyName: "Acme",
            },
            profile_json: {},
            contacts_json: [],
            services_json: [],
            inbox_json: {},
            comments_json: {},
            voice_json: {},
            lead_capture_json: {},
            handoff_json: {},
            channels_json: [],
          },
        },
      }),
    });

    const { res } = await invokeRoute(
      router,
      "get",
      "/internal/providers/meta-channel-access",
      {
        headers: {
          "x-internal-token": "internal-secret",
        },
        query: {
          channel: "instagram",
          pageId: "page-1",
        },
      }
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.providerAccess?.provider, "meta");
    assert.equal(res.body?.providerAccess?.available, true);
    assert.equal(res.body?.providerAccess?.pageId, "page-1");
    assert.equal(res.body?.providerAccess?.pageAccessToken.length > 0, true);
    assert.equal(res.body?.operationalChannels?.meta?.pageId, "page-1");
  } finally {
    cfg.security.aihqInternalToken = previousInternalToken;
    cfg.security.tenantSecretMasterKey = previousMasterKey;
  }
});

test("route-level internal meta provider access fails closed when channel ids are missing", async () => {
  const previousInternalToken = cfg.security.aihqInternalToken;
  const previousMasterKey = cfg.security.tenantSecretMasterKey;

  try {
    cfg.security.aihqInternalToken = "internal-secret";
    cfg.security.tenantSecretMasterKey =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const router = tenantInternalRoutes({
      db: new FakeTenantInternalDb({ missingChannelIds: true }),
      getRuntime: async () => ({
        authority: {
          mode: "strict",
          required: true,
          available: true,
          source: "approved_runtime_projection",
          tenantId: "tenant-1",
          tenantKey: "acme",
        },
        raw: {
          projection: {
            identity_json: {
              tenantId: "tenant-1",
              tenantKey: "acme",
              companyName: "Acme",
            },
            profile_json: {},
            contacts_json: [],
            services_json: [],
            inbox_json: {},
            comments_json: {},
            voice_json: {},
            lead_capture_json: {},
            handoff_json: {},
            channels_json: [],
          },
        },
      }),
    });

    const { res } = await invokeRoute(
      router,
      "get",
      "/internal/providers/meta-channel-access",
      {
        headers: {
          "x-internal-token": "internal-secret",
        },
        query: {
          channel: "instagram",
          pageId: "page-1",
        },
      }
    );

    assert.equal(res.statusCode, 409);
    assert.equal(res.body?.error, "meta_operational_unavailable");
    assert.equal(res.body?.reasonCode, "channel_identifiers_missing");
  } finally {
    cfg.security.aihqInternalToken = previousInternalToken;
    cfg.security.tenantSecretMasterKey = previousMasterKey;
  }
});

test("route-level internal meta provider access fails closed when provider secret rows are missing", async () => {
  const previousInternalToken = cfg.security.aihqInternalToken;
  const previousMasterKey = cfg.security.tenantSecretMasterKey;

  try {
    cfg.security.aihqInternalToken = "internal-secret";
    cfg.security.tenantSecretMasterKey =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const router = tenantInternalRoutes({
      db: new FakeTenantInternalDb({ missingProviderSecret: true }),
      getRuntime: async () => ({
        authority: {
          mode: "strict",
          required: true,
          available: true,
          source: "approved_runtime_projection",
          tenantId: "tenant-1",
          tenantKey: "acme",
        },
        raw: {
          projection: {
            identity_json: {
              tenantId: "tenant-1",
              tenantKey: "acme",
              companyName: "Acme",
            },
            profile_json: {},
            contacts_json: [],
            services_json: [],
            inbox_json: {},
            comments_json: {},
            voice_json: {},
            lead_capture_json: {},
            handoff_json: {},
            channels_json: [],
          },
        },
      }),
    });

    const { res } = await invokeRoute(
      router,
      "get",
      "/internal/providers/meta-channel-access",
      {
        headers: {
          "x-internal-token": "internal-secret",
        },
        query: {
          channel: "instagram",
          pageId: "page-1",
        },
      }
    );

    assert.equal(res.statusCode, 409);
    assert.equal(res.body?.error, "provider_access_unavailable");
    assert.equal(res.body?.reasonCode, "provider_secret_missing");
  } finally {
    cfg.security.aihqInternalToken = previousInternalToken;
    cfg.security.tenantSecretMasterKey = previousMasterKey;
  }
});
