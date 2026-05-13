import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveTenantContext,
  getDefaultTenantKey,
} from "../src/platform/tenancy/index.js";

function makeDb(row = null) {
  return {
    async query() {
      return {
        rows: row ? [row] : [],
      };
    },
  };
}

test("resolveTenantContext uses authenticated tenant over request tenant", async () => {
  const ctx = await resolveTenantContext(
    {
      auth: {
        tenantId: "auth-tenant-id",
        tenantKey: "auth-tenant",
        role: "admin",
        email: "owner@example.com",
      },
      query: {
        tenantKey: "query-tenant",
      },
    },
    {
      db: makeDb({
        id: "auth-tenant-id",
        tenant_key: "auth-tenant",
        company_name: "Auth Tenant",
      }),
    }
  );

  assert.equal(ctx.ok, true);
  assert.equal(ctx.tenantId, "auth-tenant-id");
  assert.equal(ctx.tenantKey, "auth-tenant");
  assert.equal(ctx.source, "auth");
  assert.equal(ctx.hasDbTenant, true);
});

test("resolveTenantContext does not trust request tenant when authenticated tenant is missing", async () => {
  const ctx = await resolveTenantContext(
    {
      auth: {
        role: "member",
        email: "user@example.com",
      },
      query: {
        tenantKey: "query-tenant",
      },
      headers: {
        "x-tenant-key": "header-tenant",
      },
    },
    {
      db: makeDb(null),
    }
  );

  assert.equal(ctx.ok, false);
  assert.equal(ctx.tenantId, "");
  assert.equal(ctx.tenantKey, "");
  assert.equal(ctx.source, "none");
});

test("resolveTenantContext can use request tenant for unauthenticated internal/public style requests", async () => {
  const ctx = await resolveTenantContext(
    {
      query: {
        tenantKey: "public-tenant",
      },
    },
    {
      db: makeDb({
        id: "public-tenant-id",
        tenant_key: "public-tenant",
        company_name: "Public Tenant",
      }),
    }
  );

  assert.equal(ctx.ok, true);
  assert.equal(ctx.tenantId, "public-tenant-id");
  assert.equal(ctx.tenantKey, "public-tenant");
  assert.equal(ctx.source, "request");
  assert.equal(ctx.hasDbTenant, true);
});

test("resolveTenantContext only uses default tenant when explicitly allowed", async () => {
  const withoutDefault = await resolveTenantContext({}, { db: makeDb(null) });

  assert.equal(withoutDefault.ok, false);
  assert.equal(withoutDefault.tenantKey, "");

  const withDefault = await resolveTenantContext(
    {},
    {
      db: makeDb(null),
      allowDefaultTenant: true,
    }
  );

  assert.equal(withDefault.ok, true);
  assert.equal(withDefault.tenantKey, getDefaultTenantKey());
  assert.equal(withDefault.source, "default");
});
