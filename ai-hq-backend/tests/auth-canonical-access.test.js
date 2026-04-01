import test, { after } from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import { hashUserPassword } from "../src/utils/adminAuth.js";
import { userLoginRoutes } from "../src/routes/api/adminAuth/user.js";
import { userSignupRoutes } from "../src/routes/api/adminAuth/signup.js";

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    cookies: [],
    cookiesCleared: [],
    finished: false,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    clearCookie(name, options = {}) {
      this.cookiesCleared.push({ name, options });
    },
    cookie(name, value, options = {}) {
      this.cookies.push({ name, value, options });
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
    get(name) {
      return this.headers?.[String(name || "").toLowerCase()] || "";
    },
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

class FakeCanonicalAuthDb {
  constructor() {
    this.tenantCounter = 1;
    this.userCounter = 1;
    this.identityCounter = 1;
    this.membershipCounter = 1;
    this.sessionCounter = 1;
    this.tenants = new Map();
    this.tenantProfiles = new Map();
    this.tenantAiPolicies = new Map();
    this.users = new Map();
    this.identities = new Map();
    this.memberships = new Map();
    this.authSessions = new Map();
    this.loginAttempts = new Map();
  }

  nextId(prefix, counterKey) {
    const value = `${prefix}-${this[counterKey]++}`;
    return value;
  }

  seedTenant(tenant) {
    this.tenants.set(String(tenant.id), {
      id: tenant.id,
      tenant_key: tenant.tenant_key,
      company_name: tenant.company_name,
      ...tenant,
    });
  }

  seedIdentity(identity) {
    this.identities.set(String(identity.id), {
      auth_provider: "local",
      email_verified: true,
      status: "active",
      meta: {},
      ...identity,
    });
  }

  seedMembership(membership) {
    this.memberships.set(String(membership.id), {
      role: "member",
      status: "active",
      permissions: {},
      meta: {},
      ...membership,
    });
  }

  seedUser(user) {
    this.users.set(String(user.id), {
      session_version: 1,
      auth_provider: "local",
      email_verified: true,
      permissions: {},
      meta: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...user,
    });
  }

  findIdentityByEmail(email) {
    return (
      Array.from(this.identities.values()).find(
        (row) => String(row.normalized_email).toLowerCase() === String(email).toLowerCase()
      ) || null
    );
  }

  findTenantByKey(tenantKey) {
    return (
      Array.from(this.tenants.values()).find(
        (row) => String(row.tenant_key).toLowerCase() === String(tenantKey).toLowerCase()
      ) || null
    );
  }

  findTenantUserByEmail(tenantId, email) {
    return (
      Array.from(this.users.values()).find(
        (row) =>
          String(row.tenant_id) === String(tenantId) &&
          String(row.user_email).toLowerCase() === String(email).toLowerCase()
      ) || null
    );
  }

  findMembership(identityId, tenantId) {
    return (
      Array.from(this.memberships.values()).find(
        (row) =>
          String(row.identity_id) === String(identityId) &&
          String(row.tenant_id) === String(tenantId)
      ) || null
    );
  }

  _loginAttemptKey(actorType, scopeKey, ip) {
    return `${actorType}|${scopeKey}|${ip}`;
  }

  async query(input, maybeValues = []) {
    const text = String(input?.text || input || "").trim().toLowerCase();
    const values = Array.isArray(input?.values) ? input.values : maybeValues;

    if (text === "begin" || text === "commit" || text === "rollback") {
      return { rowCount: 0, rows: [] };
    }

    if (text.includes("from tenants") && text.includes("where lower(tenant_key) = $1")) {
      const row = this.findTenantByKey(values[0]) || null;
      return { rowCount: row ? 1 : 0, rows: row ? [{ ...row }] : [] };
    }

    if (text.startsWith("insert into tenants")) {
      let row = this.findTenantByKey(values[0]) || null;
      if (!row) {
        row = {
          id: this.nextId("tenant", "tenantCounter"),
          tenant_key: values[0],
          company_name: values[1],
          legal_name: values[2],
          industry_key: values[3],
          country_code: values[4],
          timezone: values[5],
          default_language: values[6],
          enabled_languages: JSON.parse(values[7]),
          market_region: values[8],
          plan_key: "starter",
          status: "active",
          active: true,
          onboarding_completed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        this.tenants.set(row.id, row);
      } else {
        Object.assign(row, {
          company_name: values[1],
          legal_name: values[2] || row.legal_name,
          industry_key: values[3],
          country_code: values[4],
          timezone: values[5],
          default_language: values[6],
          enabled_languages: JSON.parse(values[7]),
          market_region: values[8],
          updated_at: new Date().toISOString(),
        });
      }
      return { rowCount: 1, rows: [{ ...row }] };
    }

    if (text.startsWith("insert into tenant_profiles")) {
      const row = {
        tenant_id: values[0],
        brand_name: values[1],
        website_url: values[2],
      };
      this.tenantProfiles.set(String(values[0]), row);
      return { rowCount: 1, rows: [{ ...row }] };
    }

    if (text.startsWith("insert into tenant_ai_policies")) {
      const row = { tenant_id: values[0] };
      this.tenantAiPolicies.set(String(values[0]), row);
      return { rowCount: 1, rows: [{ ...row }] };
    }

    if (
      text.includes("from tenant_users tu") &&
      text.includes("join tenants t") &&
      text.includes("where lower(tu.user_email) = $1")
    ) {
      const email = String(values[0]).toLowerCase();
      const tenantKey = String(values[1] || "").toLowerCase();
      const rows = Array.from(this.users.values())
        .filter((row) => String(row.user_email).toLowerCase() === email)
        .map((row) => {
          const tenant = this.tenants.get(String(row.tenant_id)) || {};
          return {
            ...row,
            tenant_key: tenant.tenant_key || "",
            company_name: tenant.company_name || "",
          };
        })
        .filter((row) => !tenantKey || String(row.tenant_key).toLowerCase() === tenantKey);
      return { rowCount: rows.length, rows };
    }

    if (text.includes("from tenant_users") && text.includes("lower(user_email)")) {
      const row = this.findTenantUserByEmail(values[0], values[1]) || null;
      return { rowCount: row ? 1 : 0, rows: row ? [{ ...row }] : [] };
    }

    if (text.includes("from tenant_users") && text.includes("and id = $2")) {
      const row = this.users.get(String(values[1])) || null;
      if (!row || String(row.tenant_id) !== String(values[0])) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 1, rows: [{ ...row }] };
    }

    if (
      text.includes("from tenant_users tu") &&
      text.includes("join tenants t") &&
      text.includes("where tu.tenant_id = $1")
    ) {
      const tenantId = String(values[0]);
      const email = String(values[1]).toLowerCase();
      const user = this.findTenantUserByEmail(tenantId, email);
      if (!user) return { rowCount: 0, rows: [] };
      const tenant = this.tenants.get(String(tenantId)) || {};
      return {
        rowCount: 1,
        rows: [
          {
            ...user,
            tenant_key: tenant.tenant_key || "",
            company_name: tenant.company_name || "",
          },
        ],
      };
    }

    if (text.startsWith("insert into tenant_users")) {
      const row = {
        id: this.nextId("tenant-user", "userCounter"),
        tenant_id: values[0],
        user_email: values[1],
        full_name: values[2],
        role: values[3],
        status: values[4],
        password_hash: values[5],
        auth_provider: values[6],
        email_verified: values[7],
        session_version: values[8],
        permissions: JSON.parse(values[9]),
        meta: JSON.parse(values[10]),
        last_seen_at: values[11],
        last_login_at: values[12],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.users.set(row.id, row);
      return { rowCount: 1, rows: [{ ...row }] };
    }

    if (text.startsWith("update tenant_users") && text.includes("set\n          full_name")) {
      const row = this.users.get(String(values[0])) || null;
      if (!row) {
        return { rowCount: 0, rows: [] };
      }
      Object.assign(row, {
        full_name: values[1],
        role: values[2],
        status: values[3],
        password_hash: values[4],
        auth_provider: values[5],
        email_verified: values[6],
        session_version: values[7],
        permissions: JSON.parse(values[8]),
        meta: JSON.parse(values[9]),
        last_seen_at: values[10] || row.last_seen_at,
        last_login_at: values[11] || row.last_login_at,
        updated_at: new Date().toISOString(),
      });
      return { rowCount: 1, rows: [{ ...row }] };
    }

    if (text.startsWith("update tenant_users") && text.includes("set\n        user_email")) {
      const row = this.users.get(String(values[0])) || null;
      if (!row || String(row.tenant_id) !== String(values[13])) {
        return { rowCount: 0, rows: [] };
      }
      Object.assign(row, {
        user_email: values[1],
        full_name: values[2],
        role: values[3],
        status: values[4],
        password_hash: values[5],
        auth_provider: values[6],
        email_verified: values[7],
        session_version: values[8],
        permissions: JSON.parse(values[9]),
        meta: JSON.parse(values[10]),
        last_seen_at: values[11],
        last_login_at: values[12],
        updated_at: new Date().toISOString(),
      });
      return { rowCount: 1, rows: [{ ...row }] };
    }

    if (text.startsWith("update tenant_users") && text.includes("set status = $3")) {
      const row = this.users.get(String(values[0])) || null;
      if (!row || String(row.tenant_id) !== String(values[1])) {
        return { rowCount: 0, rows: [] };
      }
      row.status = values[2];
      row.updated_at = new Date().toISOString();
      return { rowCount: 1, rows: [{ ...row }] };
    }

    if (text.startsWith("delete from tenant_users")) {
      const row = this.users.get(String(values[0])) || null;
      if (!row || String(row.tenant_id) !== String(values[1])) {
        return { rowCount: 0, rows: [] };
      }
      this.users.delete(String(values[0]));
      return { rowCount: 1, rows: [] };
    }

    if (text.includes("from auth_identities") && text.includes("where normalized_email = $1")) {
      const row = this.findIdentityByEmail(values[0]) || null;
      return { rowCount: row ? 1 : 0, rows: row ? [{ ...row }] : [] };
    }

    if (text.includes("from auth_identities") && text.includes("where id = $1")) {
      const row = this.identities.get(String(values[0])) || null;
      return { rowCount: row ? 1 : 0, rows: row ? [{ ...row }] : [] };
    }

    if (text.startsWith("insert into auth_identities")) {
      const row = {
        id: this.nextId("identity", "identityCounter"),
        primary_email: values[0],
        normalized_email: values[1],
        password_hash: values[2],
        auth_provider: values[3],
        provider_subject: values[4],
        email_verified: values[5],
        status: values[6],
        meta: JSON.parse(values[7]),
        last_login_at: values[8],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.identities.set(row.id, row);
      return { rowCount: 1, rows: [{ ...row }] };
    }

    if (text.startsWith("update auth_identities") && text.includes("primary_email = $2")) {
      const row = this.identities.get(String(values[0])) || null;
      if (!row) return { rowCount: 0, rows: [] };
      Object.assign(row, {
        primary_email: values[1],
        normalized_email: values[2],
        password_hash: values[3],
        auth_provider: values[4],
        provider_subject: values[5],
        email_verified: values[6],
        status: values[7],
        meta: JSON.parse(values[8]),
        last_login_at: values[9],
        updated_at: new Date().toISOString(),
      });
      return { rowCount: 1, rows: [{ ...row }] };
    }

    if (
      text.includes("from auth_identity_memberships") &&
      text.includes("where identity_id = $1") &&
      text.includes("tenant_id = $2")
    ) {
      const row = this.findMembership(values[0], values[1]) || null;
      return { rowCount: row ? 1 : 0, rows: row ? [{ ...row }] : [] };
    }

    if (text.startsWith("insert into auth_identity_memberships")) {
      let row = this.findMembership(values[0], values[1]) || null;
      if (!row) {
        row = {
          id: this.nextId("membership", "membershipCounter"),
          identity_id: values[0],
          tenant_id: values[1],
          role: values[2],
          status: values[3],
          permissions: JSON.parse(values[4]),
          meta: JSON.parse(values[5]),
          last_seen_at: values[6],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        this.memberships.set(row.id, row);
      } else {
        Object.assign(row, {
          role: values[2],
          status: values[3],
          permissions: JSON.parse(values[4]),
          meta: JSON.parse(values[5]),
          last_seen_at: values[6] || row.last_seen_at,
          updated_at: new Date().toISOString(),
        });
      }
      return { rowCount: 1, rows: [{ ...row }] };
    }

    if (text.includes("from auth_identity_memberships m") && text.includes("join tenants t")) {
      const identityId = String(values[0]);
      const tenantKey = String(values[1] || "").toLowerCase();
      const rows = Array.from(this.memberships.values())
        .filter(
          (membership) =>
            String(membership.identity_id) === identityId &&
            String(membership.status).toLowerCase() === "active"
        )
        .map((membership) => {
          const tenant = this.tenants.get(String(membership.tenant_id)) || {};
          return {
            ...membership,
            tenant_key: tenant.tenant_key || "",
            company_name: tenant.company_name || "",
          };
        })
        .filter((membership) => !tenantKey || String(membership.tenant_key).toLowerCase() === tenantKey);
      return { rowCount: rows.length, rows };
    }

    if (text.startsWith("insert into auth_identity_sessions")) {
      const row = {
        id: `session-${this.sessionCounter++}`,
        identity_id: values[0],
        active_tenant_id: values[1],
        active_membership_id: values[2],
        session_token_hash: values[3],
        session_version: values[4],
        ip: values[5],
        user_agent: values[6],
        expires_at: values[7],
        revoked_at: null,
        created_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };
      this.authSessions.set(row.session_token_hash, row);
      return { rowCount: 1, rows: [] };
    }

    if (text.startsWith("update tenant_users") && text.includes("last_login_at = now()")) {
      const row = this.users.get(String(values[0])) || null;
      if (!row) return { rowCount: 0, rows: [] };
      row.last_login_at = new Date().toISOString();
      row.last_seen_at = new Date().toISOString();
      row.updated_at = new Date().toISOString();
      return { rowCount: 1, rows: [] };
    }

    if (text.startsWith("update auth_identities") && text.includes("last_login_at = now()")) {
      const row = this.identities.get(String(values[0])) || null;
      if (!row) return { rowCount: 0, rows: [] };
      row.last_login_at = new Date().toISOString();
      row.updated_at = new Date().toISOString();
      return { rowCount: 1, rows: [] };
    }

    if (text.startsWith("select attempt_count")) {
      const row = this.loginAttempts.get(this._loginAttemptKey(values[0], values[1], values[2]));
      return { rowCount: row ? 1 : 0, rows: row ? [{ ...row }] : [] };
    }

    if (text.startsWith("insert into auth_login_attempts")) {
      const key = this._loginAttemptKey(values[0], values[1], values[2]);
      const existing = this.loginAttempts.get(key) || null;
      const now = Date.now();
      const staleBefore = new Date(values[5]).getTime();
      const maxAttempts = Number(values[3]);
      const blockMs = Number(values[4]);

      if (!existing || new Date(existing.first_attempt_at).getTime() < staleBefore) {
        this.loginAttempts.set(key, {
          actor_type: values[0],
          scope_key: values[1],
          ip: values[2],
          attempt_count: 1,
          first_attempt_at: new Date(now).toISOString(),
          blocked_until: maxAttempts <= 1 ? new Date(now + blockMs).toISOString() : null,
        });
      } else {
        existing.attempt_count += 1;
        if (existing.attempt_count >= maxAttempts) {
          existing.blocked_until = new Date(now + blockMs).toISOString();
        }
      }

      return { rowCount: 1, rows: [] };
    }

    if (text.startsWith("delete from auth_login_attempts")) {
      const key = this._loginAttemptKey(values[0], values[1], values[2]);
      this.loginAttempts.delete(key);
      return { rowCount: 1, rows: [] };
    }

    throw new Error(`Unhandled fake canonical auth query: ${text}`);
  }
}

function createLoginRouter(db, workspaceStates = {}) {
  const resolveWorkspaceState = async ({ tenantId, tenantKey, membershipId, role, tenant }) => {
    const override = workspaceStates[String(tenantKey || "").toLowerCase()] || {};
    return {
      tenantId,
      tenantKey,
      companyName: tenant?.company_name || "",
      membershipId,
      role,
      setupCompleted: false,
      setupRequired: true,
      workspaceReady: false,
      activeSetupSessionId: "",
      routeHint: "/setup/studio",
      destination: { kind: "setup", path: "/setup/studio" },
      readinessLabel: "setup_required",
      missingSteps: [],
      primaryMissingStep: "",
      ...override,
    };
  };

  return userLoginRoutes({ db, resolveWorkspaceState });
}

function createSignupRouter(db, workspaceStates = {}) {
  const resolveWorkspaceState = async ({ tenantId, tenantKey, membershipId, role, tenant }) => {
    const override = workspaceStates[String(tenantKey || "").toLowerCase()] || {};
    return {
      tenantId,
      tenantKey,
      companyName: tenant?.company_name || "",
      membershipId,
      role,
      setupCompleted: false,
      setupRequired: true,
      workspaceReady: false,
      activeSetupSessionId: "",
      routeHint: "/setup/studio",
      destination: { kind: "setup", path: "/setup/studio" },
      readinessLabel: "setup_required",
      missingSteps: [],
      primaryMissingStep: "",
      ...override,
    };
  };

  return userSignupRoutes({ db, resolveWorkspaceState });
}

const previousUserSessionSecret = cfg.auth.userSessionSecret;
cfg.auth.userSessionSecret = previousUserSessionSecret || "test-user-session-secret";
after(() => {
  cfg.auth.userSessionSecret = previousUserSessionSecret;
});

test("signup creates canonical identity, membership, bridge user, and authenticated setup destination", async () => {
  const db = new FakeCanonicalAuthDb();
  const router = createSignupRouter(db, {
    "acme-clinic": {
      setupCompleted: false,
      setupRequired: true,
      workspaceReady: false,
      destination: { kind: "setup", path: "/setup/studio" },
      routeHint: "/setup/studio",
    },
  });

  const signup = await invokeRoute(router, "post", "/auth/signup", {
    body: {
      companyName: "Acme Clinic",
      fullName: "Owner One",
      email: "owner@acme.test",
      password: "secret-pass",
    },
    headers: { host: "app.weneox.com" },
  });

  assert.equal(signup.res.statusCode, 201);
  assert.equal(signup.res.body?.authenticated, true);
  assert.equal(signup.res.body?.destination?.path, "/setup/studio");
  assert.equal(db.tenants.size, 1);
  assert.equal(db.identities.size, 1);
  assert.equal(db.memberships.size, 1);
  assert.equal(db.users.size, 1);
  assert.equal(db.authSessions.size, 1);
  const identity = Array.from(db.identities.values())[0];
  assert.equal(identity.normalized_email, "owner@acme.test");
  assert.ok(identity.password_hash.startsWith("s2u:"));
});

test("login repairs a legacy-only user into canonical identity auth and succeeds", async () => {
  const db = new FakeCanonicalAuthDb();
  db.seedTenant({
    id: "tenant-1",
    tenant_key: "acme",
    company_name: "Acme",
  });
  db.seedUser({
    id: "tenant-user-1",
    tenant_id: "tenant-1",
    user_email: "owner@acme.test",
    full_name: "Owner",
    role: "owner",
    status: "active",
    password_hash: hashUserPassword("secret-pass"),
  });

  const router = createLoginRouter(db, {
    acme: {
      setupCompleted: true,
      setupRequired: false,
      workspaceReady: true,
      destination: { kind: "workspace", path: "/workspace" },
      routeHint: "/workspace",
    },
  });

  const login = await invokeRoute(router, "post", "/auth/login", {
    body: { email: "owner@acme.test", password: "secret-pass" },
    headers: { host: "app.weneox.com" },
  });

  assert.equal(login.res.statusCode, 200);
  assert.equal(login.res.body?.user?.tenantKey, "acme");
  assert.equal(db.identities.size, 1);
  assert.equal(db.memberships.size, 1);
});

test("login repairs stale canonical password hashes from the legacy bridge and succeeds", async () => {
  const db = new FakeCanonicalAuthDb();
  db.seedTenant({
    id: "tenant-1",
    tenant_key: "acme",
    company_name: "Acme",
  });
  db.seedIdentity({
    id: "identity-1",
    primary_email: "owner@acme.test",
    normalized_email: "owner@acme.test",
    password_hash: hashUserPassword("old-pass"),
  });
  db.seedMembership({
    id: "membership-1",
    identity_id: "identity-1",
    tenant_id: "tenant-1",
    role: "owner",
    status: "active",
  });
  db.seedUser({
    id: "tenant-user-1",
    tenant_id: "tenant-1",
    user_email: "owner@acme.test",
    full_name: "Owner",
    role: "owner",
    status: "active",
    password_hash: hashUserPassword("new-pass"),
  });

  const router = createLoginRouter(db, {
    acme: {
      setupCompleted: true,
      setupRequired: false,
      workspaceReady: true,
      destination: { kind: "workspace", path: "/workspace" },
      routeHint: "/workspace",
    },
  });
  const login = await invokeRoute(router, "post", "/auth/login", {
    body: { email: "owner@acme.test", password: "new-pass" },
  });

  assert.equal(login.res.statusCode, 200);
  assert.equal(login.res.body?.destination?.path, "/workspace");
});

test("login repairs missing tenant_users bridge rows from canonical memberships and succeeds", async () => {
  const db = new FakeCanonicalAuthDb();
  db.seedTenant({
    id: "tenant-1",
    tenant_key: "acme",
    company_name: "Acme",
  });
  db.seedIdentity({
    id: "identity-1",
    primary_email: "owner@acme.test",
    normalized_email: "owner@acme.test",
    password_hash: hashUserPassword("secret-pass"),
    meta: { fullName: "Owner" },
  });
  db.seedMembership({
    id: "membership-1",
    identity_id: "identity-1",
    tenant_id: "tenant-1",
    role: "owner",
    status: "active",
  });

  const router = createLoginRouter(db, {
    acme: {
      setupCompleted: true,
      setupRequired: false,
      workspaceReady: true,
      destination: { kind: "workspace", path: "/workspace" },
      routeHint: "/workspace",
    },
  });
  const login = await invokeRoute(router, "post", "/auth/login", {
    body: { email: "owner@acme.test", password: "secret-pass" },
  });

  assert.equal(login.res.statusCode, 200);
  assert.equal(db.users.size, 1);
  assert.equal(login.res.body?.user?.tenantKey, "acme");
});

test("missing identity and missing legacy user still returns 401 invalid credentials", async () => {
  const db = new FakeCanonicalAuthDb();
  const router = createLoginRouter(db);

  const login = await invokeRoute(router, "post", "/auth/login", {
    body: { email: "nobody@acme.test", password: "secret-pass" },
  });

  assert.equal(login.res.statusCode, 401);
  assert.equal(login.res.body?.error, "Invalid credentials");
});
