import test from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import { settingsSourcesRoutes } from "../src/routes/api/settings/sources.js";
import { workspaceKnowledgeRoutes } from "../src/routes/api/workspace/knowledge.js";
import { proposalsRoutes } from "../src/routes/api/proposals/index.js";
import { contentRoutes } from "../src/routes/api/content/index.js";
import { notificationsRoutes } from "../src/routes/api/notifications/index.js";
import { apiRouter } from "../src/routes/api/index.js";

function createMockRes(onFinish) {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    finished: false,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.finished = true;
      onFinish?.();
      return this;
    },
  };
}

async function invokeRouter(router, method, path, req = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve({ req: fullReq, res });
    };

    const normalizedHeaders = Object.fromEntries(
      Object.entries(req.headers || {}).map(([key, value]) => [String(key).toLowerCase(), value])
    );

    const fullReq = {
      method: String(method || "GET").toUpperCase(),
      path,
      originalUrl: path,
      url: path,
      headers: normalizedHeaders,
      query: req.query || {},
      body: req.body || {},
      protocol: req.protocol || "https",
      app: req.app || { locals: {} },
      get(name) {
        return this.headers[String(name || "").toLowerCase()];
      },
      ...req,
    };

    const res = createMockRes(finish);

    try {
      router.handle(fullReq, res, (err) => {
        if (settled) return;
        if (err) {
          settled = true;
          reject(err);
          return;
        }
        settled = true;
        resolve({ req: fullReq, res });
      });
    } catch (err) {
      reject(err);
    }
  });
}

function buildTenantAuth(role = "member") {
  return {
    userId: "user-1",
    email: `${role}@acme.test`,
    tenantId: "tenant-1",
    tenantKey: "acme",
    role,
  };
}

function assertNotForbidden(result) {
  assert.notEqual(result.res.statusCode, 403);
}

test("settings source management mutations require owner/admin while reads remain available", async () => {
  const router = settingsSourcesRoutes({ db: null });

  const memberRead = await invokeRouter(router, "get", "/sources", {
    auth: buildTenantAuth("member"),
  });
  assert.equal(memberRead.res.statusCode, 503);

  const memberWrite = await invokeRouter(router, "post", "/sources", {
    auth: buildTenantAuth("member"),
    body: { sourceType: "website" },
  });
  assert.equal(memberWrite.res.statusCode, 403);

  const ownerWrite = await invokeRouter(router, "post", "/sources", {
    auth: buildTenantAuth("owner"),
    body: { sourceType: "website" },
  });
  assert.equal(ownerWrite.res.statusCode, 503);
});

test("workspace knowledge review mutations require workspace-manage authority while list stays readable", async () => {
  const router = workspaceKnowledgeRoutes({ db: null });

  const memberList = await invokeRouter(router, "get", "/knowledge/candidates", {
    user: {
      id: "user-1",
      email: "member@acme.test",
      role: "member",
      tenantId: "tenant-1",
      tenantKey: "acme",
    },
    auth: buildTenantAuth("member"),
  });
  assertNotForbidden(memberList);

  const memberApprove = await invokeRouter(router, "post", "/knowledge/candidates/candidate-1/approve", {
    user: {
      id: "user-1",
      email: "member@acme.test",
      role: "member",
      tenantId: "tenant-1",
      tenantKey: "acme",
    },
    auth: buildTenantAuth("member"),
  });
  assert.equal(memberApprove.res.statusCode, 403);

  const ownerApprove = await invokeRouter(router, "post", "/knowledge/candidates/candidate-1/approve", {
    user: {
      id: "user-1",
      email: "owner@acme.test",
      role: "owner",
      tenantId: "tenant-1",
      tenantKey: "acme",
    },
    auth: buildTenantAuth("owner"),
  });
  assertNotForbidden(ownerApprove);
});

test("proposal mutations enforce marketer/admin split and gate proposal reads to operator roles", async () => {
  const router = proposalsRoutes({ db: null, wsHub: null });
  const uuid = "11111111-1111-4111-8111-111111111111";

  const memberList = await invokeRouter(router, "get", "/proposals", {
    auth: buildTenantAuth("member"),
  });
  assert.equal(memberList.res.statusCode, 403);

  const marketerRequestChanges = await invokeRouter(
    router,
    "post",
    `/proposals/${uuid}/request-changes`,
    {
      auth: buildTenantAuth("marketer"),
      body: { feedbackText: "Please revise the hook." },
    }
  );
  assert.equal(marketerRequestChanges.res.statusCode, 503);

  const memberDecision = await invokeRouter(router, "post", `/proposals/${uuid}/decision`, {
    auth: buildTenantAuth("member"),
    body: { decision: "approved" },
  });
  assert.equal(memberDecision.res.statusCode, 403);

  const adminDecision = await invokeRouter(router, "post", `/proposals/${uuid}/decision`, {
    auth: buildTenantAuth("admin"),
    body: { decision: "approved" },
  });
  assert.equal(adminDecision.res.statusCode, 503);

  const memberPublish = await invokeRouter(router, "post", `/proposals/${uuid}/publish`, {
    auth: buildTenantAuth("member"),
  });
  assert.equal(memberPublish.res.statusCode, 403);
});

test("content mutations enforce write vs approve/publish authority and preserve content reads", async () => {
  const router = contentRoutes({ db: null, wsHub: null });
  const uuid = "22222222-2222-4222-8222-222222222222";

  const memberRead = await invokeRouter(router, "get", "/content", {
    auth: buildTenantAuth("member"),
    query: { proposalId: uuid },
  });
  assertNotForbidden(memberRead);

  const marketerFeedback = await invokeRouter(router, "post", `/content/${uuid}/feedback`, {
    auth: buildTenantAuth("marketer"),
    body: { feedbackText: "Tighten the CTA." },
  });
  assertNotForbidden(marketerFeedback);

  const marketerAnalyze = await invokeRouter(router, "post", `/content/${uuid}/analyze`, {
    auth: buildTenantAuth("marketer"),
  });
  assertNotForbidden(marketerAnalyze);

  const memberApprove = await invokeRouter(router, "post", `/content/${uuid}/approve`, {
    auth: buildTenantAuth("member"),
  });
  assert.equal(memberApprove.res.statusCode, 403);

  const adminApprove = await invokeRouter(router, "post", `/content/${uuid}/approve`, {
    auth: buildTenantAuth("admin"),
  });
  assertNotForbidden(adminApprove);

  const memberPublish = await invokeRouter(router, "post", `/content/${uuid}/publish`, {
    auth: buildTenantAuth("member"),
  });
  assert.equal(memberPublish.res.statusCode, 403);
});

test("notifications stay restricted to operator-governance roles because the feed is global", async () => {
  const router = notificationsRoutes({ db: null, wsHub: null });

  const memberList = await invokeRouter(router, "get", "/notifications", {
    auth: buildTenantAuth("member"),
    query: { recipient: "ceo" },
  });
  assert.equal(memberList.res.statusCode, 403);

  const adminList = await invokeRouter(router, "get", "/notifications", {
    auth: buildTenantAuth("admin"),
    query: { recipient: "ceo" },
  });
  assertNotForbidden(adminList);

  const memberRead = await invokeRouter(router, "post", "/notifications/33333333-3333-4333-8333-333333333333/read", {
    auth: buildTenantAuth("member"),
  });
  assert.equal(memberRead.res.statusCode, 403);
});

test("tenant roles are not conflated with global admin session routes", async () => {
  const previousCors = cfg.urls.corsOrigin;
  const previousPublicBaseUrl = cfg.urls.publicBaseUrl;

  try {
    cfg.urls.corsOrigin = "https://app.example.com";
    cfg.urls.publicBaseUrl = "https://app.example.com";

    const router = apiRouter({
      db: null,
      wsHub: { broadcast() {} },
      audit: null,
      dbDisabled: true,
    });

    const tenantOwnerTryingAdminWrite = await invokeRouter(router, "post", "/tenants", {
      auth: buildTenantAuth("owner"),
      user: {
        id: "user-1",
        email: "owner@acme.test",
        role: "owner",
        tenantId: "tenant-1",
        tenantKey: "acme",
      },
      headers: {
        host: "api.example.com",
        origin: "https://app.example.com",
      },
      protocol: "https",
    });

    assert.equal(tenantOwnerTryingAdminWrite.res.statusCode, 401);
    assert.equal(tenantOwnerTryingAdminWrite.res.body?.error, "Unauthorized");
  } finally {
    cfg.urls.corsOrigin = previousCors;
    cfg.urls.publicBaseUrl = previousPublicBaseUrl;
  }
});
