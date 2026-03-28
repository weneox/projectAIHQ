import test from "node:test";
import assert from "node:assert/strict";
import { validateAihqHealthEnvelope } from "@aihq/shared-contracts/health";

import { cfg } from "../src/config.js";
import { adminAuthRoutes } from "../src/routes/api/adminAuth/index.js";
import { apiRouter } from "../src/routes/api/index.js";
import {
  getBrowserOriginProtectionResult,
  userCookieOptions,
} from "../src/utils/adminAuth.js";

function createMockRes(onFinish) {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    cookiesCleared: [],
    cookiesSet: [],
    finished: false,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    clearCookie(name, options = {}) {
      this.cookiesCleared.push({ name, options });
    },
    cookie(name, value, options = {}) {
      this.cookiesSet.push({ name, value, options });
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

test("browser origin protection denies missing origin headers even in test mode", () => {
  const previousEnv = cfg.app.env;
  const previousCors = cfg.urls.corsOrigin;

  try {
    cfg.app.env = "test";
    cfg.urls.corsOrigin = "https://app.example.com";

    const result = getBrowserOriginProtectionResult({
      method: "POST",
      headers: {
        host: "api.example.com",
      },
      protocol: "https",
    });

    assert.equal(result.ok, false);
    assert.equal(result.code, "csrf_origin_required");
  } finally {
    cfg.app.env = previousEnv;
    cfg.urls.corsOrigin = previousCors;
  }
});

test("admin auth browser mutations allow trusted origin, block cross-site origin, and keep GET unaffected", async () => {
  const previousCors = cfg.urls.corsOrigin;
  const previousPublicBaseUrl = cfg.urls.publicBaseUrl;

  try {
    cfg.urls.corsOrigin = "https://app.example.com";
    cfg.urls.publicBaseUrl = "https://app.example.com";

    const router = adminAuthRoutes({ db: null, wsHub: null });

    const trusted = await invokeRouter(router, "post", "/auth/logout", {
      headers: {
        host: "api.example.com",
        origin: "https://app.example.com",
      },
      protocol: "https",
    });

    assert.equal(trusted.res.statusCode, 200);
    assert.equal(trusted.res.body?.ok, true);

    const blocked = await invokeRouter(router, "post", "/auth/logout", {
      headers: {
        host: "api.example.com",
        origin: "https://evil.example.com",
      },
      protocol: "https",
    });

    assert.equal(blocked.res.statusCode, 403);
    assert.equal(blocked.res.body?.ok, false);
    assert.equal(blocked.res.body?.reason, "csrf_origin_mismatch");

    const adminTrusted = await invokeRouter(router, "post", "/admin-auth/logout", {
      headers: {
        host: "api.example.com",
        origin: "https://app.example.com",
      },
      protocol: "https",
    });

    assert.equal(adminTrusted.res.statusCode, 200);
    assert.equal(adminTrusted.res.body?.ok, true);

    const adminBlocked = await invokeRouter(router, "post", "/admin-auth/logout", {
      headers: {
        host: "api.example.com",
        origin: "https://evil.example.com",
      },
      protocol: "https",
    });

    assert.equal(adminBlocked.res.statusCode, 403);
    assert.equal(adminBlocked.res.body?.reason, "csrf_origin_mismatch");

    const getRoute = await invokeRouter(router, "get", "/auth/me", {
      headers: {
        host: "api.example.com",
      },
      protocol: "https",
    });

    assert.equal(getRoute.res.statusCode, 200);
    assert.equal(getRoute.res.body?.ok, true);
  } finally {
    cfg.urls.corsOrigin = previousCors;
    cfg.urls.publicBaseUrl = previousPublicBaseUrl;
  }
});

test("api router protects user and admin cookie mutations while leaving internal-token routes untouched", async () => {
  const previousCors = cfg.urls.corsOrigin;
  const previousPublicBaseUrl = cfg.urls.publicBaseUrl;
  const previousInternalToken = cfg.security.aihqInternalToken;

  try {
    cfg.urls.corsOrigin = "https://app.example.com";
    cfg.urls.publicBaseUrl = "https://app.example.com";
    cfg.security.aihqInternalToken = "internal-secret";

    const router = apiRouter({
      db: null,
      wsHub: { broadcast() {} },
      audit: null,
      dbDisabled: true,
    });

    const userSameOrigin = await invokeRouter(router, "post", "/settings/workspace", {
      headers: {
        host: "api.example.com",
        origin: "https://app.example.com",
      },
      protocol: "https",
    });

    assert.equal(userSameOrigin.res.statusCode, 401);
    assert.equal(userSameOrigin.res.body?.error, "Unauthorized");

    const userCrossOrigin = await invokeRouter(router, "post", "/settings/workspace", {
      headers: {
        host: "api.example.com",
        origin: "https://evil.example.com",
      },
      protocol: "https",
    });

    assert.equal(userCrossOrigin.res.statusCode, 403);
    assert.equal(userCrossOrigin.res.body?.reason, "csrf_origin_mismatch");

    const adminSameOrigin = await invokeRouter(router, "post", "/tenants", {
      headers: {
        host: "api.example.com",
        origin: "https://app.example.com",
      },
      protocol: "https",
    });

    assert.equal(adminSameOrigin.res.statusCode, 401);
    assert.equal(adminSameOrigin.res.body?.error, "Unauthorized");

    const adminCrossOrigin = await invokeRouter(router, "post", "/tenants", {
      headers: {
        host: "api.example.com",
        origin: "https://evil.example.com",
      },
      protocol: "https",
    });

    assert.equal(adminCrossOrigin.res.statusCode, 403);
    assert.equal(adminCrossOrigin.res.body?.reason, "csrf_origin_mismatch");

    const internalRoute = await invokeRouter(router, "post", "/internal/voice/report", {
      headers: {
        host: "api.example.com",
        "x-internal-token": "internal-secret",
        "x-internal-service": "twilio-voice-backend",
        "x-internal-audience": "aihq-backend.voice.internal",
      },
      protocol: "https",
    });

    assert.equal(internalRoute.res.statusCode, 200);
    assert.equal(internalRoute.res.body?.ok, true);
    assert.equal(internalRoute.res.body?.accepted, true);
  } finally {
    cfg.urls.corsOrigin = previousCors;
    cfg.urls.publicBaseUrl = previousPublicBaseUrl;
    cfg.security.aihqInternalToken = previousInternalToken;
  }
});

test("api health uses internal token auth instead of falling through to session cookie auth", async () => {
  const previousInternalToken = cfg.security.aihqInternalToken;

  try {
    cfg.security.aihqInternalToken = "internal-secret";

    const router = apiRouter({
      db: null,
      wsHub: { broadcast() {} },
      audit: null,
      dbDisabled: true,
    });

    const denied = await invokeRouter(router, "get", "/health", {
      headers: {
        host: "api.example.com",
      },
      protocol: "https",
    });

    assert.equal(denied.res.statusCode, 401);
    assert.equal(denied.res.body?.ok, false);
    assert.equal(denied.res.body?.error, "Unauthorized");
    assert.equal(denied.res.body?.reason, "invalid internal token");

    const allowed = await invokeRouter(router, "get", "/health", {
      headers: {
        host: "api.example.com",
        "x-internal-token": "internal-secret",
        "x-internal-service": "meta-bot-backend",
        "x-internal-audience": "aihq-backend.health",
      },
      protocol: "https",
    });

    assert.equal(allowed.res.statusCode, 200);
    assert.equal(validateAihqHealthEnvelope(allowed.res.body || {}).ok, true);
  } finally {
    cfg.security.aihqInternalToken = previousInternalToken;
  }
});

test("trusted Cloudflare Pages preview origins pass csrf checks and receive cross-site cookie settings", () => {
  const previousCors = cfg.urls.corsOrigin;

  try {
    cfg.urls.corsOrigin = "https://hq.weneox.com, https://*.hq.pages.dev";

    const req = {
      method: "POST",
      headers: {
        host: "api.hq.weneox.com",
        origin: "https://feature-123.hq.pages.dev",
      },
      protocol: "https",
      get(name) {
        return this.headers[String(name || "").toLowerCase()];
      },
    };

    const result = getBrowserOriginProtectionResult(req);
    assert.equal(result.ok, true);

    const cookie = userCookieOptions(req);
    assert.equal(cookie.sameSite, "none");
    assert.equal(cookie.secure, true);
  } finally {
    cfg.urls.corsOrigin = previousCors;
  }
});
