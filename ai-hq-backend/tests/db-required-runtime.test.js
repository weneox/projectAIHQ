import test from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import {
  getConfigIssues,
  isDbRequiredAppEnv,
} from "../src/config/validate.js";
import { __test__ as apiRouterTest } from "../src/routes/api/index.js";
import { getContentById } from "../src/routes/api/content/repository.js";

test("DB is required outside test environments", () => {
  assert.equal(isDbRequiredAppEnv("production"), true);
  assert.equal(isDbRequiredAppEnv("development"), true);
  assert.equal(isDbRequiredAppEnv("test"), false);
});

test("config validation rejects missing DATABASE_URL outside test", () => {
  const previousEnv = cfg.app.env;
  const previousDbUrl = cfg.db.url;

  try {
    cfg.app.env = "production";
    cfg.db.url = "";

    const dbIssue = getConfigIssues().find((item) => item.key === "db.url");
    assert.equal(dbIssue?.level, "error");
    assert.equal(dbIssue?.category, "database");
    assert.equal(dbIssue?.phase, "runtime");
    assert.ok(dbIssue?.envKeys?.includes("DATABASE_URL"));
  } finally {
    cfg.app.env = previousEnv;
    cfg.db.url = previousDbUrl;
  }
});

test("config validation rejects invalid DATABASE_URL outside test", () => {
  const previousEnv = cfg.app.env;
  const previousDbUrl = cfg.db.url;

  try {
    cfg.app.env = "production";
    cfg.db.url = "postgres://not a valid url";

    const dbIssue = getConfigIssues().find((item) => item.key === "db.url");
    assert.equal(dbIssue?.level, "error");
    assert.equal(dbIssue?.category, "database");
    assert.match(String(dbIssue?.message || ""), /valid postgres/i);
  } finally {
    cfg.app.env = previousEnv;
    cfg.db.url = previousDbUrl;
  }
});

test("production config validation rejects missing and weak tenant secret master keys", () => {
  const previousEnv = cfg.app.env;
  const previousTenantSecret = cfg.security.tenantSecretMasterKey;

  try {
    cfg.app.env = "production";

    for (const value of [
      "",
      "changeme",
      "tenant-secret-placeholder",
      "short-secret",
      "a".repeat(64),
      "not-hex-but-long-enough-to-look-like-a-secret-value-for-tests-only",
    ]) {
      cfg.security.tenantSecretMasterKey = value;
      const issue = getConfigIssues().find(
        (item) => item.key === "security.tenantSecretMasterKey"
      );
      assert.equal(issue?.level, "error", `${value || "<empty>"} must fail`);
      assert.equal(issue?.category, "secrets");
      assert.ok(issue?.envKeys?.includes("TENANT_SECRET_MASTER_KEY"));
    }
  } finally {
    cfg.app.env = previousEnv;
    cfg.security.tenantSecretMasterKey = previousTenantSecret;
  }
});

test("production config validation accepts a strong tenant secret master key", () => {
  const previousEnv = cfg.app.env;
  const previousTenantSecret = cfg.security.tenantSecretMasterKey;

  try {
    cfg.app.env = "production";
    cfg.security.tenantSecretMasterKey =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const issue = getConfigIssues().find(
      (item) => item.key === "security.tenantSecretMasterKey"
    );
    assert.equal(issue, undefined);
  } finally {
    cfg.app.env = previousEnv;
    cfg.security.tenantSecretMasterKey = previousTenantSecret;
  }
});

test("production config validation rejects disabled database SSL by default", () => {
  const previousEnv = cfg.app.env;
  const previousDbUrl = cfg.db.url;
  const previousDbSsl = process.env.DB_SSL;
  const previousPrivateTrust = process.env.DB_SSL_PRIVATE_NETWORK_TRUSTED;

  try {
    cfg.app.env = "production";
    cfg.db.url = "postgres://user:pass@db.example.test:5432/app";
    process.env.DB_SSL = "false";
    delete process.env.DB_SSL_PRIVATE_NETWORK_TRUSTED;

    const issue = getConfigIssues().find((item) => item.key === "db.ssl");
    assert.equal(issue?.level, "error");
    assert.equal(issue?.category, "database");
    assert.match(String(issue?.message || ""), /DB_SSL disables database TLS/);
  } finally {
    cfg.app.env = previousEnv;
    cfg.db.url = previousDbUrl;
    if (previousDbSsl === undefined) delete process.env.DB_SSL;
    else process.env.DB_SSL = previousDbSsl;
    if (previousPrivateTrust === undefined) delete process.env.DB_SSL_PRIVATE_NETWORK_TRUSTED;
    else process.env.DB_SSL_PRIVATE_NETWORK_TRUSTED = previousPrivateTrust;
  }
});

test("production config validation rejects DATABASE_URL sslmode=disable", () => {
  const previousEnv = cfg.app.env;
  const previousDbUrl = cfg.db.url;
  const previousDbSsl = process.env.DB_SSL;
  const previousPrivateTrust = process.env.DB_SSL_PRIVATE_NETWORK_TRUSTED;

  try {
    cfg.app.env = "production";
    cfg.db.url = "postgres://user:pass@db.example.test:5432/app?sslmode=disable";
    delete process.env.DB_SSL;
    delete process.env.DB_SSL_PRIVATE_NETWORK_TRUSTED;

    const issue = getConfigIssues().find((item) => item.key === "db.ssl");
    assert.equal(issue?.level, "error");
    assert.match(
      String(issue?.message || ""),
      /DATABASE_URL sslmode disables database TLS/
    );
  } finally {
    cfg.app.env = previousEnv;
    cfg.db.url = previousDbUrl;
    if (previousDbSsl === undefined) delete process.env.DB_SSL;
    else process.env.DB_SSL = previousDbSsl;
    if (previousPrivateTrust === undefined) delete process.env.DB_SSL_PRIVATE_NETWORK_TRUSTED;
    else process.env.DB_SSL_PRIVATE_NETWORK_TRUSTED = previousPrivateTrust;
  }
});

test("production DB SSL private-network exception is narrow and explicit", () => {
  const previousEnv = cfg.app.env;
  const previousDbUrl = cfg.db.url;
  const previousDbSsl = process.env.DB_SSL;
  const previousPrivateTrust = process.env.DB_SSL_PRIVATE_NETWORK_TRUSTED;

  try {
    cfg.app.env = "production";
    cfg.db.url = "postgres://user:pass@postgres.railway.internal:5432/app";
    delete process.env.DB_SSL;
    delete process.env.DB_SSL_PRIVATE_NETWORK_TRUSTED;

    const missingException = getConfigIssues().find((item) => item.key === "db.ssl");
    assert.equal(missingException?.level, "error");
    assert.match(String(missingException?.message || ""), /Railway private/);

    process.env.DB_SSL_PRIVATE_NETWORK_TRUSTED = "1";
    const allowed = getConfigIssues().find((item) => item.key === "db.ssl");
    assert.equal(allowed, undefined);

    cfg.db.url = "postgres://user:pass@db.example.test:5432/app";
    process.env.DB_SSL = "false";
    const publicDisabled = getConfigIssues().find((item) => item.key === "db.ssl");
    assert.equal(publicDisabled?.level, "error");
  } finally {
    cfg.app.env = previousEnv;
    cfg.db.url = previousDbUrl;
    if (previousDbSsl === undefined) delete process.env.DB_SSL;
    else process.env.DB_SSL = previousDbSsl;
    if (previousPrivateTrust === undefined) delete process.env.DB_SSL_PRIVATE_NETWORK_TRUSTED;
    else process.env.DB_SSL_PRIVATE_NETWORK_TRUSTED = previousPrivateTrust;
  }
});

test("authenticated runtime middleware fails closed when DB is unavailable", () => {
  const middleware = apiRouterTest.createRequireOperationalDbMiddleware({
    db: null,
    env: "production",
  });

  let nextCalled = false;
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  middleware({}, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body?.ok, false);
  assert.equal(res.body?.code, "DB_UNAVAILABLE");
});

test("content repository no longer falls back to in-memory runtime state", async () => {
  await assert.rejects(
    () => getContentById({ db: null, id: "content-1", dbReady: false }),
    (err) => {
      assert.equal(err?.code, "DB_UNAVAILABLE");
      return true;
    }
  );
});
