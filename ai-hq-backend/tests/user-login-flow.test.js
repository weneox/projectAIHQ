import test, { after } from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import { userLoginRoutes } from "../src/routes/api/adminAuth/user.js";
import { adminSessionRoutes } from "../src/routes/api/adminAuth/session.js";
import { hashUserPassword } from "../src/utils/adminAuth.js";

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

class FakeLoginDb {
  constructor() {
    this.tenants = new Map();
    this.identities = new Map();
    this.memberships = new Map();
    this.users = new Map();
    this.authSessions = new Map();
    this.loginAttempts = new Map();
  }

  seedTenant(tenant) {
    this.tenants.set(String(tenant.id), { ...tenant });
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
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      session_version: 1,
      auth_provider: "local",
      email_verified: true,
      ...user,
    });
  }

  _loginAttemptKey(actorType, scopeKey, ip) {
    return `${actorType}|${scopeKey}|${ip}`;
  }

  async query(input) {
    const text = String(input?.text || input || "").trim().toLowerCase();
    const values = Array.isArray(input?.values) ? input.values : [];

    if (text.includes("from auth_identities") && text.includes("where normalized_email = $1")) {
      const identity =
        Array.from(this.identities.values()).find(
          (row) => String(row.normalized_email).toLowerCase() === String(values[0]).toLowerCase()
        ) || null;
      return { rowCount: identity ? 1 : 0, rows: identity ? [{ ...identity }] : [] };
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

    if (text.includes("from tenant_users tu") && text.includes("join tenants t")) {
      const tenantId = String(values[0]);
      const email = String(values[1]).toLowerCase();
      const user =
        Array.from(this.users.values()).find(
          (row) =>
            String(row.tenant_id) === tenantId &&
            String(row.user_email).toLowerCase() === email
        ) || null;
      if (!user) return { rowCount: 0, rows: [] };
      const tenant = this.tenants.get(String(user.tenant_id)) || {};
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

    if (text.startsWith("insert into auth_sessions")) {
      const row = {
        id: `session-${this.authSessions.size + 1}`,
        tenant_user_id: values[0],
        tenant_id: values[1],
        session_token_hash: values[2],
        session_version: values[3],
        ip: values[4],
        user_agent: values[5],
        expires_at: values[6],
        revoked_at: null,
        created_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };
      this.authSessions.set(row.session_token_hash, row);
      return { rowCount: 1, rows: [] };
    }

    if (text.includes("from auth_sessions s") && text.includes("join tenant_users")) {
      const row = this.authSessions.get(String(values[0])) || null;
      if (!row || row.revoked_at) return { rowCount: 0, rows: [] };
      if (new Date(row.expires_at).getTime() <= Date.now()) return { rowCount: 0, rows: [] };
      const user = this.users.get(String(row.tenant_user_id)) || null;
      const tenant = this.tenants.get(String(row.tenant_id)) || null;
      if (!user || !tenant) return { rowCount: 0, rows: [] };
      return {
        rowCount: 1,
        rows: [
          {
            ...row,
            user_id: user.id,
            user_email: user.user_email,
            full_name: user.full_name,
            role: user.role,
            user_status: user.status,
            user_session_version: user.session_version,
            tenant_key: tenant.tenant_key,
          },
        ],
      };
    }

    if (text.startsWith("update tenant_users")) {
      const user = this.users.get(String(values[0])) || null;
      if (user) {
        user.last_login_at = new Date().toISOString();
        user.last_seen_at = new Date().toISOString();
        user.updated_at = new Date().toISOString();
      }
      return { rowCount: user ? 1 : 0, rows: [] };
    }

    if (text.startsWith("update auth_identities")) {
      const identity = this.identities.get(String(values[0])) || null;
      if (identity) {
        identity.last_login_at = new Date().toISOString();
        identity.updated_at = new Date().toISOString();
      }
      return { rowCount: identity ? 1 : 0, rows: [] };
    }

    if (text.startsWith("update auth_sessions") && text.includes("set revoked_at = now()")) {
      const row = this.authSessions.get(String(values[0])) || null;
      if (!row || row.revoked_at) return { rowCount: 0, rows: [] };
      row.revoked_at = new Date().toISOString();
      row.last_seen_at = new Date().toISOString();
      return { rowCount: 1, rows: [] };
    }

    if (text.startsWith("update auth_sessions") && text.includes("set last_seen_at = now()")) {
      for (const row of this.authSessions.values()) {
        if (String(row.id) === String(values[0])) {
          row.last_seen_at = new Date().toISOString();
          return { rowCount: 1, rows: [] };
        }
      }
      return { rowCount: 0, rows: [] };
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

    throw new Error(`Unhandled fake auth query: ${text}`);
  }
}

function seedIdentityWithMembership(db, {
  identityId,
  email,
  password,
  identityStatus = "active",
  tenantId,
  tenantKey,
  companyName,
  membershipId,
  membershipStatus = "active",
  userId,
  userStatus = "active",
  role = "member",
}) {
  db.seedTenant({
    id: tenantId,
    tenant_key: tenantKey,
    company_name: companyName || tenantKey,
  });
  if (identityId && !db.identities.has(identityId)) {
    db.seedIdentity({
      id: identityId,
      primary_email: email,
      normalized_email: String(email).toLowerCase(),
      password_hash: password ? hashUserPassword(password) : "",
      status: identityStatus,
      email_verified: true,
    });
  }
  db.seedMembership({
    id: membershipId,
    identity_id: identityId,
    tenant_id: tenantId,
    role,
    status: membershipStatus,
  });
  if (userId) {
    db.seedUser({
      id: userId,
      tenant_id: tenantId,
      user_email: email,
      full_name: `${tenantKey} User`,
      role,
      status: userStatus,
      password_hash: "legacy-ignored",
      session_version: 2,
    });
  }
}

function createLoginRouter(db, workspaceStates = {}) {
  return userLoginRoutes({
    db,
    resolveWorkspaceState: async ({
      tenantId,
      tenantKey,
      membershipId,
      role,
      tenant,
    }) => {
      const override = workspaceStates[String(tenantKey || "").toLowerCase()] || {};

      return {
        tenantId,
        tenantKey,
        companyName: tenant?.company_name || "",
        membershipId,
        role,
        setupCompleted: true,
        setupRequired: false,
        workspaceReady: true,
        activeSetupSessionId: "",
        routeHint: "/workspace",
        destination: { kind: "workspace", path: "/workspace" },
        readinessLabel: "ready",
        missingSteps: [],
        primaryMissingStep: "",
        ...override,
      };
    },
  });
}

const previousUserSessionSecret = cfg.auth.userSessionSecret;
cfg.auth.userSessionSecret = previousUserSessionSecret || "test-user-session-secret";
after(() => {
  cfg.auth.userSessionSecret = previousUserSessionSecret;
});

test("single identity + one membership logs in successfully", async () => {
  const db = new FakeLoginDb();
  seedIdentityWithMembership(db, {
    identityId: "identity-1",
    email: "owner@acme.test",
    password: "secret-pass",
    tenantId: "tenant-1",
    tenantKey: "acme",
    companyName: "Acme Clinic",
    membershipId: "membership-1",
    userId: "user-1",
    role: "owner",
  });

  const loginRouter = createLoginRouter(db);
  const sessionRouter = adminSessionRoutes({ db, wsHub: null });
  const login = await invokeRoute(loginRouter, "post", "/auth/login", {
    body: { email: "owner@acme.test", password: "secret-pass" },
    headers: { host: "app.weneox.com" },
  });

  assert.equal(login.res.statusCode, 200);
  assert.equal(login.res.body?.user?.identityId, "identity-1");
  assert.equal(login.res.body?.user?.membershipId, "membership-1");
  assert.equal(login.res.body?.user?.tenantKey, "acme");
  assert.equal(login.res.body?.destination?.path, "/workspace");

  const sessionCookie = login.res.cookies.find((cookie) => cookie.name === "aihq_user");
  const me = await invokeRoute(sessionRouter, "get", "/auth/me", {
    headers: { cookie: `aihq_user=${sessionCookie.value}` },
  });
  assert.equal(me.res.body?.authenticated, true);
  assert.equal(me.res.body?.user?.tenantKey, "acme");
});

test("single workspace with setup incomplete returns setup destination", async () => {
  const db = new FakeLoginDb();
  seedIdentityWithMembership(db, {
    identityId: "identity-1",
    email: "owner@acme.test",
    password: "secret-pass",
    tenantId: "tenant-1",
    tenantKey: "acme",
    companyName: "Acme Clinic",
    membershipId: "membership-1",
    userId: "user-1",
    role: "owner",
  });

  const router = createLoginRouter(db, {
    acme: {
      setupCompleted: false,
      setupRequired: true,
      workspaceReady: false,
      routeHint: "/setup/studio",
      destination: { kind: "setup", path: "/setup/studio" },
      activeSetupSessionId: "setup-session-1",
    },
  });
  const login = await invokeRoute(router, "post", "/auth/login", {
    body: { email: "owner@acme.test", password: "secret-pass" },
    headers: { host: "app.weneox.com" },
  });

  assert.equal(login.res.statusCode, 200);
  assert.equal(login.res.body?.workspace?.setupRequired, true);
  assert.equal(login.res.body?.destination?.path, "/setup/studio");
});

test("single identity + multiple memberships returns explicit chooser response", async () => {
  const db = new FakeLoginDb();
  seedIdentityWithMembership(db, {
    identityId: "identity-1",
    email: "shared@company.test",
    password: "shared-pass",
    tenantId: "tenant-1",
    tenantKey: "acme",
    companyName: "Acme Clinic",
    membershipId: "membership-1",
    userId: "user-1",
  });
  seedIdentityWithMembership(db, {
    identityId: "identity-1",
    email: "shared@company.test",
    password: "shared-pass",
    tenantId: "tenant-2",
    tenantKey: "globex",
    companyName: "Globex",
    membershipId: "membership-2",
    userId: "user-2",
    role: "operator",
  });

  const router = createLoginRouter(db);
  const login = await invokeRoute(router, "post", "/auth/login", {
    body: { email: "shared@company.test", password: "shared-pass" },
    headers: { host: "app.weneox.com" },
  });

  assert.equal(login.res.statusCode, 409);
  assert.equal(login.res.body?.code, "multiple_memberships");
  assert.equal(login.res.body?.memberships?.length, 2);
  assert.ok(login.res.body?.memberships?.every((membership) => membership.selectionToken));
});

test("explicit membership selection completes login deterministically", async () => {
  const db = new FakeLoginDb();
  seedIdentityWithMembership(db, {
    identityId: "identity-1",
    email: "shared@company.test",
    password: "shared-pass",
    tenantId: "tenant-1",
    tenantKey: "acme",
    companyName: "Acme Clinic",
    membershipId: "membership-1",
    userId: "user-1",
  });
  seedIdentityWithMembership(db, {
    identityId: "identity-1",
    email: "shared@company.test",
    password: "shared-pass",
    tenantId: "tenant-2",
    tenantKey: "globex",
    companyName: "Globex",
    membershipId: "membership-2",
    userId: "user-2",
  });

  const router = createLoginRouter(db);
  const ambiguous = await invokeRoute(router, "post", "/auth/login", {
    body: { email: "shared@company.test", password: "shared-pass" },
  });
  const selected = ambiguous.res.body?.memberships?.find((membership) => membership.tenantKey === "globex");

  const login = await invokeRoute(router, "post", "/auth/login", {
    body: {
      email: "shared@company.test",
      password: "shared-pass",
      accountSelectionToken: selected.selectionToken,
    },
  });

  assert.equal(login.res.statusCode, 200);
  assert.equal(login.res.body?.user?.tenantKey, "globex");
});

test("workspace selection endpoint completes login with per-workspace destination", async () => {
  const db = new FakeLoginDb();
  seedIdentityWithMembership(db, {
    identityId: "identity-1",
    email: "shared@company.test",
    password: "shared-pass",
    tenantId: "tenant-1",
    tenantKey: "acme",
    companyName: "Acme Clinic",
    membershipId: "membership-1",
    userId: "user-1",
  });
  seedIdentityWithMembership(db, {
    identityId: "identity-1",
    email: "shared@company.test",
    password: "shared-pass",
    tenantId: "tenant-2",
    tenantKey: "globex",
    companyName: "Globex",
    membershipId: "membership-2",
    userId: "user-2",
  });

  const router = createLoginRouter(db, {
    globex: {
      setupCompleted: false,
      setupRequired: true,
      workspaceReady: false,
      routeHint: "/setup/studio",
      destination: { kind: "setup", path: "/setup/studio" },
    },
  });
  const ambiguous = await invokeRoute(router, "post", "/auth/login", {
    body: { email: "shared@company.test", password: "shared-pass" },
  });
  const selected = ambiguous.res.body?.memberships?.find((membership) => membership.tenantKey === "globex");

  const login = await invokeRoute(router, "post", "/auth/select-workspace", {
    body: {
      email: "shared@company.test",
      password: "shared-pass",
      accountSelectionToken: selected.selectionToken,
    },
  });

  assert.equal(login.res.statusCode, 200);
  assert.equal(login.res.body?.user?.tenantKey, "globex");
  assert.equal(login.res.body?.destination?.path, "/setup/studio");
});

test("workspace selection endpoint rejects unauthorized selection tokens", async () => {
  const db = new FakeLoginDb();
  seedIdentityWithMembership(db, {
    identityId: "identity-1",
    email: "shared@company.test",
    password: "shared-pass",
    tenantId: "tenant-1",
    tenantKey: "acme",
    companyName: "Acme Clinic",
    membershipId: "membership-1",
    userId: "user-1",
  });
  seedIdentityWithMembership(db, {
    identityId: "identity-1",
    email: "shared@company.test",
    password: "shared-pass",
    tenantId: "tenant-2",
    tenantKey: "globex",
    companyName: "Globex",
    membershipId: "membership-2",
    userId: "user-2",
  });

  const router = createLoginRouter(db);
  const ambiguous = await invokeRoute(router, "post", "/auth/login", {
    body: { email: "shared@company.test", password: "shared-pass" },
  });
  const selected = ambiguous.res.body?.memberships?.find((membership) => membership.tenantKey === "globex");

  const login = await invokeRoute(router, "post", "/auth/select-workspace", {
    body: {
      email: "shared@company.test",
      password: "shared-pass",
      accountSelectionToken: `${selected.selectionToken}tampered`,
    },
  });

  assert.equal(login.res.statusCode, 400);
  assert.equal(login.res.body?.code, "invalid_membership_selection");
});

test("host tenant constraint signs in directly when matching membership exists", async () => {
  const db = new FakeLoginDb();
  seedIdentityWithMembership(db, {
    identityId: "identity-1",
    email: "shared@company.test",
    password: "shared-pass",
    tenantId: "tenant-1",
    tenantKey: "acme",
    companyName: "Acme Clinic",
    membershipId: "membership-1",
    userId: "user-1",
  });
  seedIdentityWithMembership(db, {
    identityId: "identity-1",
    email: "shared@company.test",
    password: "shared-pass",
    tenantId: "tenant-2",
    tenantKey: "globex",
    companyName: "Globex",
    membershipId: "membership-2",
    userId: "user-2",
  });

  const router = createLoginRouter(db);
  const login = await invokeRoute(router, "post", "/auth/login", {
    body: { email: "shared@company.test", password: "shared-pass" },
    headers: { host: "acme.weneox.com" },
  });

  assert.equal(login.res.statusCode, 200);
  assert.equal(login.res.body?.user?.tenantKey, "acme");
});

test("explicit tenant context signs in directly when matching membership exists", async () => {
  const db = new FakeLoginDb();
  seedIdentityWithMembership(db, {
    identityId: "identity-1",
    email: "shared@company.test",
    password: "shared-pass",
    tenantId: "tenant-1",
    tenantKey: "acme",
    companyName: "Acme Clinic",
    membershipId: "membership-1",
    userId: "user-1",
  });
  seedIdentityWithMembership(db, {
    identityId: "identity-1",
    email: "shared@company.test",
    password: "shared-pass",
    tenantId: "tenant-2",
    tenantKey: "globex",
    companyName: "Globex",
    membershipId: "membership-2",
    userId: "user-2",
  });

  const router = createLoginRouter(db);
  const login = await invokeRoute(router, "post", "/auth/login", {
    body: {
      email: "shared@company.test",
      password: "shared-pass",
      tenantKey: "acme",
    },
    headers: { host: "localhost:5173" },
  });

  assert.equal(login.res.statusCode, 200);
  assert.equal(login.res.body?.user?.tenantKey, "acme");
});

test("host tenant constraint fails closed when membership does not exist", async () => {
  const db = new FakeLoginDb();
  seedIdentityWithMembership(db, {
    identityId: "identity-1",
    email: "shared@company.test",
    password: "shared-pass",
    tenantId: "tenant-2",
    tenantKey: "globex",
    companyName: "Globex",
    membershipId: "membership-2",
    userId: "user-2",
  });

  const router = createLoginRouter(db);
  const login = await invokeRoute(router, "post", "/auth/login", {
    body: { email: "shared@company.test", password: "shared-pass" },
    headers: { host: "acme.weneox.com" },
  });

  assert.equal(login.res.statusCode, 403);
  assert.equal(login.res.body?.code, "membership_not_found");
});

test("wrong password fails against canonical identity", async () => {
  const db = new FakeLoginDb();
  seedIdentityWithMembership(db, {
    identityId: "identity-1",
    email: "owner@acme.test",
    password: "secret-pass",
    tenantId: "tenant-1",
    tenantKey: "acme",
    companyName: "Acme Clinic",
    membershipId: "membership-1",
    userId: "user-1",
  });

  const router = createLoginRouter(db);
  const login = await invokeRoute(router, "post", "/auth/login", {
    body: { email: "owner@acme.test", password: "wrong-pass" },
  });

  assert.equal(login.res.statusCode, 401);
  assert.equal(login.res.body?.error, "Invalid credentials");
});

test("disabled identity fails closed", async () => {
  const db = new FakeLoginDb();
  seedIdentityWithMembership(db, {
    identityId: "identity-1",
    email: "owner@acme.test",
    password: "secret-pass",
    identityStatus: "disabled",
    tenantId: "tenant-1",
    tenantKey: "acme",
    companyName: "Acme Clinic",
    membershipId: "membership-1",
    userId: "user-1",
  });

  const router = userLoginRoutes({ db });
  const login = await invokeRoute(router, "post", "/auth/login", {
    body: { email: "owner@acme.test", password: "secret-pass" },
  });

  assert.equal(login.res.statusCode, 403);
  assert.equal(login.res.body?.error, "Identity is not active");
});

test("logout and session invalidation still work", async () => {
  const db = new FakeLoginDb();
  seedIdentityWithMembership(db, {
    identityId: "identity-1",
    email: "owner@acme.test",
    password: "secret-pass",
    tenantId: "tenant-1",
    tenantKey: "acme",
    companyName: "Acme Clinic",
    membershipId: "membership-1",
    userId: "user-1",
  });

  const loginRouter = createLoginRouter(db);
  const sessionRouter = adminSessionRoutes({ db, wsHub: null });
  const login = await invokeRoute(loginRouter, "post", "/auth/login", {
    body: { email: "owner@acme.test", password: "secret-pass" },
  });
  const sessionCookie = login.res.cookies.find((cookie) => cookie.name === "aihq_user");

  const logout = await invokeRoute(loginRouter, "post", "/auth/logout", {
    headers: { cookie: `aihq_user=${sessionCookie.value}` },
  });
  assert.equal(logout.res.body?.loggedOut, true);

  const me = await invokeRoute(sessionRouter, "get", "/auth/me", {
    headers: { cookie: `aihq_user=${sessionCookie.value}` },
  });
  assert.equal(me.res.body?.authenticated, false);
});

test("compatibility bridge fails clearly instead of guessing when legacy tenant user is missing", async () => {
  const db = new FakeLoginDb();
  db.seedTenant({
    id: "tenant-1",
    tenant_key: "acme",
    company_name: "Acme Clinic",
  });
  db.seedIdentity({
    id: "identity-1",
    primary_email: "owner@acme.test",
    normalized_email: "owner@acme.test",
    password_hash: hashUserPassword("secret-pass"),
    status: "active",
    email_verified: true,
  });
  db.seedMembership({
    id: "membership-1",
    identity_id: "identity-1",
    tenant_id: "tenant-1",
    role: "owner",
    status: "active",
  });

  const router = createLoginRouter(db);
  const login = await invokeRoute(router, "post", "/auth/login", {
    body: { email: "owner@acme.test", password: "secret-pass" },
  });

  assert.equal(login.res.statusCode, 403);
  assert.equal(login.res.body?.code, "legacy_membership_bridge_missing");
});
