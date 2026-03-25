import test from "node:test";
import assert from "node:assert/strict";

import { voiceRoutes } from "../src/routes/api/voice/public.js";

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
    auth: {
      userId: `${role}-user`,
      email: `${role}@acme.test`,
      tenantId: "tenant-1",
      tenantKey: "acme",
      role,
    },
    user: {
      id: `${role}-user`,
      email: `${role}@acme.test`,
      tenantId: "tenant-1",
      tenantKey: "acme",
      role,
    },
  };
}

test("voice settings mutation denies tenant members", async () => {
  const router = voiceRoutes({ db: null, dbDisabled: false, audit: null });
  const result = await invokeRouter(router, "post", "/voice/settings", {
    ...buildAuth("member"),
    body: { enabled: true },
  });

  assert.equal(result.res.statusCode, 403);
});

test("voice call join mutation denies tenant members", async () => {
  const router = voiceRoutes({ db: null, dbDisabled: false, audit: null });
  const result = await invokeRouter(router, "post", "/voice/calls/call-1/join", {
    ...buildAuth("member"),
    body: { sessionId: "session-1" },
  });

  assert.equal(result.res.statusCode, 403);
});

test("voice mutations allow operator roles through authorization guard", async () => {
  const router = voiceRoutes({ db: null, dbDisabled: false, audit: null });

  const settingsResult = await invokeRouter(router, "post", "/voice/settings", {
    ...buildAuth("operator"),
    body: { enabled: true },
  });
  assert.equal(settingsResult.res.statusCode, 503);

  const joinResult = await invokeRouter(router, "post", "/voice/calls/call-1/join", {
    ...buildAuth("admin"),
    body: { sessionId: "session-1" },
  });
  assert.equal(joinResult.res.statusCode, 503);
});
