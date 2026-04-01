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
    this.users = new Map();
    this.authSessions = new Map();
    this.loginAttempts = new Map();
  }

  seedTenant(tenant) {
    this.tenants.set(String(tenant.id), { ...tenant });
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

    if (text.includes("from tenant_users tu") && text.includes("join tenants t")) {
      const email = String(values[0] || "").toLowerCase();
      const tenantKey = String(values[1] || "").toLowerCase();
      const rows = Array.from(this.users.values())
        .filter((user) => String(user.user_email || "").toLowerCase() === email)
        .map((user) => {
          const tenant = this.tenants.get(String(user.tenant_id)) || {};
          return {
            ...user,
            tenant_key: tenant.tenant_key,
            company_name: tenant.company_name || "",
          };
        })
        .filter((row) => !tenantKey || String(row.tenant_key || "").toLowerCase() === tenantKey)
        .sort((a, b) => {
          const aRank = String(a.status) === "active" ? 0 : 1;
          const bRank = String(b.status) === "active" ? 0 : 1;
          if (aRank !== bRank) return aRank - bRank;
          return String(b.updated_at).localeCompare(String(a.updated_at));
        });

      return { rowCount: rows.length, rows };
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
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
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
      const row = this.loginAttempts.get(
        this._loginAttemptKey(values[0], values[1], values[2])
      );
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

function seedTenantUser(db, {
  tenantId,
  tenantKey,
  companyName,
  userId,
  email,
  password,
  status = "active",
  role = "member",
  authProvider = "local",
}) {
  db.seedTenant({
    id: tenantId,
    tenant_key: tenantKey,
    company_name: companyName || tenantKey,
  });
  db.seedUser({
    id: userId,
    tenant_id: tenantId,
    user_email: email,
    full_name: `${tenantKey} User`,
    role,
    status,
    auth_provider: authProvider,
    password_hash: password ? hashUserPassword(password) : "",
    session_version: 2,
  });
}

const previousUserSessionSecret = cfg.auth.userSessionSecret;
cfg.auth.userSessionSecret = previousUserSessionSecret || "test-user-session-secret";
after(() => {
  cfg.auth.userSessionSecret = previousUserSessionSecret;
});

test("single-account tenant user login succeeds and /auth/me resolves the session", async () => {
  const db = new FakeLoginDb();
  seedTenantUser(db, {
    tenantId: "tenant-1",
    tenantKey: "acme",
    companyName: "Acme Clinic",
    userId: "user-1",
    email: "owner@acme.test",
    password: "secret-pass",
    role: "owner",
  });

  const loginRouter = userLoginRoutes({ db });
  const sessionRouter = adminSessionRoutes({ db, wsHub: null });

  const login = await invokeRoute(loginRouter, "post", "/auth/login", {
    body: {
      email: "owner@acme.test",
      password: "secret-pass",
    },
    headers: { host: "app.weneox.com" },
  });

  assert.equal(login.res.statusCode, 200);
  assert.equal(login.res.body?.authenticated, true);
  assert.equal(login.res.body?.user?.tenantKey, "acme");
  const sessionCookie = login.res.cookies.find((cookie) => cookie.name === "aihq_user");
  assert.ok(sessionCookie?.value);

  const me = await invokeRoute(sessionRouter, "get", "/auth/me", {
    headers: { cookie: `aihq_user=${sessionCookie.value}` },
  });

  assert.equal(me.res.statusCode, 200);
  assert.equal(me.res.body?.authenticated, true);
  assert.equal(me.res.body?.user?.email, "owner@acme.test");
});

test("host tenant context deterministically constrains login when same email exists in multiple workspaces", async () => {
  const db = new FakeLoginDb();
  seedTenantUser(db, {
    tenantId: "tenant-1",
    tenantKey: "acme",
    companyName: "Acme Clinic",
    userId: "user-1",
    email: "shared@company.test",
    password: "acme-pass",
  });
  seedTenantUser(db, {
    tenantId: "tenant-2",
    tenantKey: "globex",
    companyName: "Globex",
    userId: "user-2",
    email: "shared@company.test",
    password: "globex-pass",
  });

  const router = userLoginRoutes({ db });
  const login = await invokeRoute(router, "post", "/auth/login", {
    body: {
      email: "shared@company.test",
      password: "acme-pass",
    },
    headers: { host: "acme.weneox.com:3000" },
  });

  assert.equal(login.res.statusCode, 200);
  assert.equal(login.res.body?.user?.tenantKey, "acme");
});

test("wrong password fails closed", async () => {
  const db = new FakeLoginDb();
  seedTenantUser(db, {
    tenantId: "tenant-1",
    tenantKey: "acme",
    userId: "user-1",
    email: "owner@acme.test",
    password: "secret-pass",
  });

  const router = userLoginRoutes({ db });
  const login = await invokeRoute(router, "post", "/auth/login", {
    body: {
      email: "owner@acme.test",
      password: "wrong-pass",
    },
  });

  assert.equal(login.res.statusCode, 401);
  assert.equal(login.res.body?.error, "Invalid credentials");
});

test("inactive tenant users are rejected explicitly", async () => {
  const db = new FakeLoginDb();
  seedTenantUser(db, {
    tenantId: "tenant-1",
    tenantKey: "acme",
    userId: "user-1",
    email: "owner@acme.test",
    password: "secret-pass",
    status: "invited",
  });

  const router = userLoginRoutes({ db });
  const login = await invokeRoute(router, "post", "/auth/login", {
    body: {
      email: "owner@acme.test",
      password: "secret-pass",
    },
  });

  assert.equal(login.res.statusCode, 403);
  assert.equal(login.res.body?.error, "User is not active");
});

test("ambiguous email returns explicit workspace choices instead of guessing", async () => {
  const db = new FakeLoginDb();
  seedTenantUser(db, {
    tenantId: "tenant-1",
    tenantKey: "acme",
    companyName: "Acme Clinic",
    userId: "user-1",
    email: "shared@company.test",
    password: "shared-pass",
  });
  seedTenantUser(db, {
    tenantId: "tenant-2",
    tenantKey: "globex",
    companyName: "Globex",
    userId: "user-2",
    email: "shared@company.test",
    password: "shared-pass",
    role: "operator",
  });

  const router = userLoginRoutes({ db });
  const login = await invokeRoute(router, "post", "/auth/login", {
    body: {
      email: "shared@company.test",
      password: "shared-pass",
    },
    headers: { host: "app.weneox.com" },
  });

  assert.equal(login.res.statusCode, 409);
  assert.equal(login.res.body?.code, "multiple_accounts");
  assert.equal(login.res.body?.accounts?.length, 2);
  assert.ok(login.res.body?.accounts?.every((account) => account.selectionToken));
});

test("explicit workspace selection token completes ambiguous login safely", async () => {
  const db = new FakeLoginDb();
  seedTenantUser(db, {
    tenantId: "tenant-1",
    tenantKey: "acme",
    companyName: "Acme Clinic",
    userId: "user-1",
    email: "shared@company.test",
    password: "shared-pass",
  });
  seedTenantUser(db, {
    tenantId: "tenant-2",
    tenantKey: "globex",
    companyName: "Globex",
    userId: "user-2",
    email: "shared@company.test",
    password: "shared-pass",
  });

  const router = userLoginRoutes({ db });
  const ambiguous = await invokeRoute(router, "post", "/auth/login", {
    body: {
      email: "shared@company.test",
      password: "shared-pass",
    },
  });

  const selected = ambiguous.res.body?.accounts?.find((account) => account.tenantKey === "globex");
  assert.ok(selected?.selectionToken);

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

test("logout revokes the session and /auth/me becomes unauthenticated", async () => {
  const db = new FakeLoginDb();
  seedTenantUser(db, {
    tenantId: "tenant-1",
    tenantKey: "acme",
    userId: "user-1",
    email: "owner@acme.test",
    password: "secret-pass",
  });

  const loginRouter = userLoginRoutes({ db });
  const sessionRouter = adminSessionRoutes({ db, wsHub: null });

  const login = await invokeRoute(loginRouter, "post", "/auth/login", {
    body: {
      email: "owner@acme.test",
      password: "secret-pass",
    },
  });
  const sessionCookie = login.res.cookies.find((cookie) => cookie.name === "aihq_user");
  assert.ok(sessionCookie?.value);

  const logout = await invokeRoute(loginRouter, "post", "/auth/logout", {
    headers: { cookie: `aihq_user=${sessionCookie.value}` },
  });

  assert.equal(logout.res.statusCode, 200);
  assert.equal(logout.res.body?.loggedOut, true);

  const me = await invokeRoute(sessionRouter, "get", "/auth/me", {
    headers: { cookie: `aihq_user=${sessionCookie.value}` },
  });

  assert.equal(me.res.statusCode, 200);
  assert.equal(me.res.body?.authenticated, false);
});
