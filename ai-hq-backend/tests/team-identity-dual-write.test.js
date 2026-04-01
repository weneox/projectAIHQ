import test from "node:test";
import assert from "node:assert/strict";

import {
  createTenantUser,
  updateTenantUser,
  setTenantUserStatus,
  deleteTenantUser,
} from "../src/routes/api/team/repository.js";

class FakeTeamDb {
  constructor() {
    this.userCounter = 1;
    this.identityCounter = 1;
    this.membershipCounter = 1;
    this.tenantUsers = new Map();
    this.authIdentities = new Map();
    this.authIdentityMemberships = new Map();
  }

  nextId(prefix, counterKey) {
    const value = `${prefix}-${this[counterKey]++}`;
    return value;
  }

  findTenantUserByEmail(tenantId, email) {
    return Array.from(this.tenantUsers.values()).find(
      (row) =>
        String(row.tenant_id) === String(tenantId) &&
        String(row.user_email).toLowerCase() === String(email).toLowerCase()
    );
  }

  findMembership(identityId, tenantId) {
    return Array.from(this.authIdentityMemberships.values()).find(
      (row) =>
        String(row.identity_id) === String(identityId) &&
        String(row.tenant_id) === String(tenantId)
    );
  }

  async query(input, maybeValues = []) {
    const text = String(input?.text || input || "").trim().toLowerCase();
    const values = Array.isArray(input?.values) ? input.values : maybeValues;

    if (text === "begin" || text === "commit" || text === "rollback") {
      return { rowCount: 0, rows: [] };
    }

    if (text.includes("from tenant_users") && text.includes("lower(user_email)")) {
      const row = this.findTenantUserByEmail(values[0], values[1]) || null;
      return { rowCount: row ? 1 : 0, rows: row ? [{ ...row }] : [] };
    }

    if (text.includes("from tenant_users") && text.includes("and id = $2")) {
      const row = this.tenantUsers.get(String(values[1])) || null;
      if (!row || String(row.tenant_id) !== String(values[0])) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 1, rows: [{ ...row }] };
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
      this.tenantUsers.set(row.id, row);
      return { rowCount: 1, rows: [{ ...row }] };
    }

    if (text.startsWith("update tenant_users") && text.includes("set\n        user_email")) {
      const row = this.tenantUsers.get(String(values[0])) || null;
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
      const row = this.tenantUsers.get(String(values[0])) || null;
      if (!row || String(row.tenant_id) !== String(values[1])) {
        return { rowCount: 0, rows: [] };
      }
      row.status = values[2];
      row.updated_at = new Date().toISOString();
      return { rowCount: 1, rows: [{ ...row }] };
    }

    if (text.startsWith("delete from tenant_users")) {
      const row = this.tenantUsers.get(String(values[0])) || null;
      if (!row || String(row.tenant_id) !== String(values[1])) {
        return { rowCount: 0, rows: [] };
      }
      this.tenantUsers.delete(String(values[0]));
      return { rowCount: 1, rows: [] };
    }

    if (text.includes("from auth_identities") && text.includes("where normalized_email = $1")) {
      const row =
        Array.from(this.authIdentities.values()).find(
          (item) => String(item.normalized_email) === String(values[0])
        ) || null;
      return { rowCount: row ? 1 : 0, rows: row ? [{ ...row }] : [] };
    }

    if (text.includes("from auth_identities") && text.includes("where id = $1")) {
      const row = this.authIdentities.get(String(values[0])) || null;
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
      this.authIdentities.set(row.id, row);
      return { rowCount: 1, rows: [{ ...row }] };
    }

    if (text.startsWith("update auth_identities")) {
      const row = this.authIdentities.get(String(values[0])) || null;
      if (!row) {
        return { rowCount: 0, rows: [] };
      }
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
        this.authIdentityMemberships.set(row.id, row);
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

    throw new Error(`Unhandled query in FakeTeamDb: ${text}`);
  }
}

function buildInput(overrides = {}) {
  return {
    user_email: "owner@acme.test",
    full_name: "Owner",
    role: "owner",
    status: "active",
    password_hash: "hash-1",
    auth_provider: "local",
    email_verified: true,
    session_version: 1,
    permissions: { manage: true },
    meta: { source: "test" },
    last_seen_at: null,
    last_login_at: null,
    ...overrides,
  };
}

test("creating a tenant user dual-writes canonical identity and membership", async () => {
  const db = new FakeTeamDb();

  const user = await createTenantUser(db, "tenant-a", buildInput());

  assert.equal(user.user_email, "owner@acme.test");
  assert.equal(db.authIdentities.size, 1);
  assert.equal(db.authIdentityMemberships.size, 1);

  const identity = Array.from(db.authIdentities.values())[0];
  const membership = Array.from(db.authIdentityMemberships.values())[0];

  assert.equal(identity.normalized_email, "owner@acme.test");
  assert.equal(membership.tenant_id, "tenant-a");
  assert.equal(membership.role, "owner");
});

test("same email across multiple tenants reuses canonical identity and creates a second membership", async () => {
  const db = new FakeTeamDb();

  await createTenantUser(db, "tenant-a", buildInput());
  await createTenantUser(
    db,
    "tenant-b",
    buildInput({ role: "operator", full_name: "Operator" })
  );

  assert.equal(db.authIdentities.size, 1);
  assert.equal(db.authIdentityMemberships.size, 2);
});

test("updating tenant user role and status syncs canonical membership", async () => {
  const db = new FakeTeamDb();
  const created = await createTenantUser(db, "tenant-a", buildInput());

  const updated = await updateTenantUser(db, "tenant-a", created.id, {
    ...created,
    role: "admin",
    status: "disabled",
  });

  const identity = Array.from(db.authIdentities.values())[0];
  const membership = db.findMembership(identity.id, "tenant-a");

  assert.equal(updated.role, "admin");
  assert.equal(updated.status, "disabled");
  assert.equal(membership.role, "admin");
  assert.equal(membership.status, "disabled");
});

test("status updates preserve current product behavior and sync canonical membership", async () => {
  const db = new FakeTeamDb();
  const created = await createTenantUser(db, "tenant-a", buildInput({ status: "invited" }));

  const updated = await setTenantUserStatus(db, "tenant-a", created.id, "active");
  const identity = Array.from(db.authIdentities.values())[0];
  const membership = db.findMembership(identity.id, "tenant-a");

  assert.equal(updated.status, "active");
  assert.equal(membership.status, "active");
});

test("deleting one tenant user does not destroy a shared canonical identity", async () => {
  const db = new FakeTeamDb();
  const first = await createTenantUser(db, "tenant-a", buildInput());
  await createTenantUser(db, "tenant-b", buildInput({ role: "member" }));

  const deleted = await deleteTenantUser(db, "tenant-a", first.id);

  assert.equal(deleted, true);
  assert.equal(db.authIdentities.size, 1);

  const identity = Array.from(db.authIdentities.values())[0];
  const membershipA = db.findMembership(identity.id, "tenant-a");
  const membershipB = db.findMembership(identity.id, "tenant-b");

  assert.equal(membershipA.status, "removed");
  assert.equal(membershipB.status, "active");
});
