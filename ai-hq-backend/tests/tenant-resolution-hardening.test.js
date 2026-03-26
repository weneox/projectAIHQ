import test from "node:test";
import assert from "node:assert/strict";

import {
  getAuthTenantKey,
  getAuthTenantId,
  getRequestedTenantKey,
  getRequestedTenantId,
} from "../src/utils/auth.js";
import {
  getDefaultTenantKey,
  resolveTenantKeyFromReq,
  resolveTenantIdFromReq,
} from "../src/tenancy/index.js";
import { resolveTenantKey as resolveSettingsTenantKey } from "../src/routes/api/settings/utils.js";
import { cfg } from "../src/config.js";

test("authenticated tenant helpers ignore body/query/header overrides", () => {
  const req = {
    auth: {
      tenantKey: "tenant-auth",
      tenantId: "tenant-id-auth",
    },
    headers: {
      "x-tenant-key": "tenant-header",
      "x-tenant-id": "tenant-id-header",
    },
    body: {
      tenantKey: "tenant-body",
      tenantId: "tenant-id-body",
    },
    query: {
      tenantKey: "tenant-query",
      tenantId: "tenant-id-query",
    },
  };

  assert.equal(getAuthTenantKey(req), "tenant-auth");
  assert.equal(getAuthTenantId(req), "tenant-id-auth");
  assert.equal(resolveTenantKeyFromReq(req), "tenant-auth");
  assert.equal(resolveTenantIdFromReq(req), "tenant-id-auth");
});

test("request tenant helpers remain available for explicit internal/public flows", () => {
  const req = {
    headers: {
      "x-tenant-key": "tenant-header",
      "x-tenant-id": "tenant-id-header",
    },
    body: {
      tenantKey: "tenant-body",
      tenantId: "tenant-id-body",
    },
    query: {
      tenantKey: "tenant-query",
      tenantId: "tenant-id-query",
    },
  };

  assert.equal(getRequestedTenantKey(req), "tenant-header");
  assert.equal(getRequestedTenantId(req), "tenant-id-header");
  assert.equal(resolveTenantKeyFromReq(req), "tenant-header");
  assert.equal(resolveTenantIdFromReq(req), "tenant-id-header");
});

test("settings internal tenant resolution still works only through internal-token path", () => {
  const previousToken = cfg.security.aihqInternalToken;

  try {
    cfg.security.aihqInternalToken = "internal-secret";

    const internalReq = {
      headers: {
        "x-internal-token": "internal-secret",
        "x-tenant-key": "tenant-internal",
      },
      body: {},
      query: {},
      auth: {
        tenantKey: "tenant-auth",
      },
    };

    const userReq = {
      headers: {
        "x-tenant-key": "tenant-header",
      },
      body: {
        tenantKey: "tenant-body",
      },
      query: {
        tenantKey: "tenant-query",
      },
      auth: {
        tenantKey: "tenant-auth",
      },
    };

    assert.equal(resolveSettingsTenantKey(internalReq), "tenant-internal");
    assert.equal(resolveSettingsTenantKey(userReq), "tenant-auth");
  } finally {
    cfg.security.aihqInternalToken = previousToken;
  }
});

test("default tenant key is sourced from cfg.tenant.defaultTenantKey consistently", () => {
  const previousTenantDefault = cfg.tenant.defaultTenantKey;
  const previousLegacyAlias = cfg.DEFAULT_TENANT_KEY;

  try {
    cfg.tenant.defaultTenantKey = "authority-default";
    cfg.DEFAULT_TENANT_KEY = "stale-legacy-value";

    assert.equal(getDefaultTenantKey(), "authority-default");
  } finally {
    cfg.tenant.defaultTenantKey = previousTenantDefault;
    cfg.DEFAULT_TENANT_KEY = previousLegacyAlias;
  }
});
