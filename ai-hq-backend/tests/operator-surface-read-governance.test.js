import test from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import { leadsRoutes } from "../src/routes/api/leads/index.js";
import { commentsRoutes } from "../src/routes/api/comments/index.js";
import { voiceRoutes, voiceInternalRoutes } from "../src/routes/api/voice/index.js";
import { executionsRoutes } from "../src/routes/api/executions/index.js";
import { proposalsRoutes } from "../src/routes/api/proposals/index.js";
import { workspaceSettingsRoutes } from "../src/routes/api/settings/workspace.js";

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

function buildAuth(role = "member") {
  return {
    userId: "user-1",
    email: `${role}@acme.test`,
    tenantId: "tenant-1",
    tenantKey: "acme",
    role,
  };
}

test("operator-only read surfaces reject ordinary authenticated members", async () => {
  const leadRouter = leadsRoutes({ db: null, wsHub: null });
  const commentsRouter = commentsRoutes({ db: null, wsHub: null });
  const voiceRouter = voiceRoutes({ db: null, dbDisabled: false, audit: null });
  const executionsRouter = executionsRoutes({ db: null, wsHub: null });
  const proposalsRouter = proposalsRoutes({ db: null, wsHub: null });

  const memberAuth = buildAuth("member");

  const leadList = await invokeRouter(leadRouter, "get", "/leads", { auth: memberAuth });
  assert.equal(leadList.res.statusCode, 403);

  const commentList = await invokeRouter(commentsRouter, "get", "/comments", { auth: memberAuth });
  assert.equal(commentList.res.statusCode, 403);

  const voiceOverview = await invokeRouter(voiceRouter, "get", "/voice/overview", {
    auth: memberAuth,
    user: {
      id: "user-1",
      email: "member@acme.test",
      role: "member",
      tenantId: "tenant-1",
      tenantKey: "acme",
    },
  });
  assert.equal(voiceOverview.res.statusCode, 403);

  const executionList = await invokeRouter(executionsRouter, "get", "/executions", {
    auth: memberAuth,
  });
  assert.equal(executionList.res.statusCode, 403);

  const proposalList = await invokeRouter(proposalsRouter, "get", "/proposals", {
    auth: memberAuth,
  });
  assert.equal(proposalList.res.statusCode, 403);
});

test("owner admin and operator can still reach operator-read surfaces", async () => {
  const leadRouter = leadsRoutes({ db: null, wsHub: null });
  const commentsRouter = commentsRoutes({ db: null, wsHub: null });
  const voiceRouter = voiceRoutes({ db: null, dbDisabled: false, audit: null });
  const executionsRouter = executionsRoutes({ db: null, wsHub: null });
  const proposalsRouter = proposalsRoutes({ db: null, wsHub: null });

  const operatorAuth = buildAuth("operator");
  const adminAuth = buildAuth("admin");

  const leadList = await invokeRouter(leadRouter, "get", "/leads", { auth: operatorAuth });
  assert.notEqual(leadList.res.statusCode, 403);

  const commentList = await invokeRouter(commentsRouter, "get", "/comments", { auth: operatorAuth });
  assert.notEqual(commentList.res.statusCode, 403);

  const voiceOverview = await invokeRouter(voiceRouter, "get", "/voice/overview", {
    auth: operatorAuth,
    user: {
      id: "user-1",
      email: "operator@acme.test",
      role: "operator",
      tenantId: "tenant-1",
      tenantKey: "acme",
    },
  });
  assert.equal(voiceOverview.res.statusCode, 200);

  const executionList = await invokeRouter(executionsRouter, "get", "/executions", {
    auth: adminAuth,
  });
  assert.notEqual(executionList.res.statusCode, 403);

  const proposalList = await invokeRouter(proposalsRouter, "get", "/proposals", {
    auth: operatorAuth,
  });
  assert.notEqual(proposalList.res.statusCode, 403);
});

test("internal-only server-to-server flows remain available", async () => {
  const previousEnv = cfg.app.env;
  const previousInternalToken = cfg.security.aihqInternalToken;

  try {
    cfg.app.env = "development";
    cfg.security.aihqInternalToken = "internal-secret";

    const router = voiceInternalRoutes({ db: null });

    const result = await invokeRouter(router, "post", "/internal/voice/report", {
      headers: {
        "x-internal-token": "internal-secret",
        "x-internal-service": "twilio-voice-backend",
        "x-internal-audience": "aihq-backend.voice.internal",
      },
    });

    assert.equal(result.res.statusCode, 200);
    assert.equal(result.res.body?.ok, true);
  } finally {
    cfg.app.env = previousEnv;
    cfg.security.aihqInternalToken = previousInternalToken;
  }
});

test("launch-core workspace read routes stay unaffected", async () => {
  const router = workspaceSettingsRoutes({ db: null });

  const result = await invokeRouter(router, "get", "/settings/workspace", {
    auth: buildAuth("member"),
    user: {
      id: "user-1",
      email: "member@acme.test",
      role: "member",
      tenantId: "tenant-1",
      tenantKey: "acme",
    },
  });

  assert.notEqual(result.res.statusCode, 403);
});
