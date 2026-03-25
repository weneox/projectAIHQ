import test from "node:test";
import assert from "node:assert/strict";

import {
  checkLoginRateLimit,
  clearLoginAttempts,
  createAdminSessionRecord,
  createUserSessionRecord,
  loadAdminSessionFromRequest,
  loadUserSessionFromRequest,
  registerFailedLoginAttempt,
  revokeAdminSessionByToken,
  revokeUserSessionByToken,
} from "../src/utils/adminAuth.js";

class FakeAuthDb {
  constructor() {
    this.users = new Map();
    this.tenants = new Map();
    this.authSessions = new Map();
    this.adminSessions = new Map();
    this.loginAttempts = new Map();
  }

  seedTenant(tenant) {
    this.tenants.set(String(tenant.id), { ...tenant });
  }

  seedUser(user) {
    this.users.set(String(user.id), { ...user });
  }

  _loginAttemptKey(actorType, scopeKey, ip) {
    return `${actorType}|${scopeKey}|${ip}`;
  }

  async query(input) {
    const text = String(input?.text || input || "").trim().toLowerCase();
    const values = Array.isArray(input?.values) ? input.values : [];

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

    if (text.startsWith("insert into admin_auth_sessions")) {
      const row = {
        id: `admin-session-${this.adminSessions.size + 1}`,
        session_token_hash: values[0],
        ip: values[1],
        user_agent: values[2],
        expires_at: values[3],
        revoked_at: null,
        created_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };
      this.adminSessions.set(row.session_token_hash, row);
      return { rowCount: 1, rows: [] };
    }

    if (text.includes("from admin_auth_sessions")) {
      const row = this.adminSessions.get(String(values[0])) || null;
      if (!row || row.revoked_at) return { rowCount: 0, rows: [] };
      if (new Date(row.expires_at).getTime() <= Date.now()) return { rowCount: 0, rows: [] };
      return { rowCount: 1, rows: [{ ...row }] };
    }

    if (text.startsWith("update admin_auth_sessions") && text.includes("set revoked_at = now()")) {
      const row = this.adminSessions.get(String(values[0])) || null;
      if (!row || row.revoked_at) return { rowCount: 0, rows: [] };
      row.revoked_at = new Date().toISOString();
      row.last_seen_at = new Date().toISOString();
      return { rowCount: 1, rows: [] };
    }

    if (text.startsWith("update admin_auth_sessions") && text.includes("set last_seen_at = now()")) {
      for (const row of this.adminSessions.values()) {
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

function buildCookieReq(cookie) {
  return {
    headers: {
      cookie,
    },
  };
}

test("revoked user sessions no longer validate and session truth is DB-backed", async () => {
  const db = new FakeAuthDb();
  db.seedTenant({ id: "tenant-1", tenant_key: "acme" });
  db.seedUser({
    id: "user-1",
    tenant_id: "tenant-1",
    user_email: "owner@acme.test",
    full_name: "Owner",
    role: "owner",
    status: "active",
    session_version: 3,
  });

  const created = await createUserSessionRecord(
    db,
    {
      id: "user-1",
      tenant_id: "tenant-1",
      session_version: 3,
    },
    {
      ip: "127.0.0.1",
      ua: "test-agent",
    }
  );

  const valid = await loadUserSessionFromRequest(
    buildCookieReq(`aihq_user=${created.token}`),
    { db, touch: false }
  );

  assert.equal(valid.ok, true);
  assert.equal(valid.payload.userId, "user-1");
  assert.equal(valid.payload.tenantKey, "acme");

  await revokeUserSessionByToken(db, created.token);

  const revoked = await loadUserSessionFromRequest(
    buildCookieReq(`aihq_user=${created.token}`),
    { db, touch: false }
  );

  assert.equal(revoked.ok, false);
  assert.equal(revoked.error, "session not found");
});

test("revoked admin sessions no longer validate", async () => {
  const db = new FakeAuthDb();
  const created = await createAdminSessionRecord(db, {
    ip: "127.0.0.1",
    ua: "test-agent",
  });

  const valid = await loadAdminSessionFromRequest(
    buildCookieReq(`aihq_admin=${created.token}`),
    { db, touch: false }
  );

  assert.equal(valid.ok, true);
  assert.equal(valid.payload.sessionType, "admin");

  await revokeAdminSessionByToken(db, created.token);

  const revoked = await loadAdminSessionFromRequest(
    buildCookieReq(`aihq_admin=${created.token}`),
    { db, touch: false }
  );

  assert.equal(revoked.ok, false);
  assert.equal(revoked.error, "session not found");
});

test("DB-backed login throttling blocks repeated failed attempts and can be cleared", async () => {
  const db = new FakeAuthDb();
  const params = {
    actorType: "user",
    scopeKey: "user:acme:owner@acme.test",
    ip: "127.0.0.1",
    windowMs: 60_000,
    maxAttempts: 2,
    blockMs: 60_000,
  };

  const before = await checkLoginRateLimit(db, params);
  assert.equal(before.ok, true);

  await registerFailedLoginAttempt(db, params);
  const afterOne = await checkLoginRateLimit(db, params);
  assert.equal(afterOne.ok, true);
  assert.equal(afterOne.remaining, 1);

  await registerFailedLoginAttempt(db, params);
  const blocked = await checkLoginRateLimit(db, params);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.remaining, 0);

  await clearLoginAttempts(db, params);
  const cleared = await checkLoginRateLimit(db, params);
  assert.equal(cleared.ok, true);
});
