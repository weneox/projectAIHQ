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
    assert.match(String(dbIssue?.message || ""), /valid postgres/i);
  } finally {
    cfg.app.env = previousEnv;
    cfg.db.url = previousDbUrl;
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
