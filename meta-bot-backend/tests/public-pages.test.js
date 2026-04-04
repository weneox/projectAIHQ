import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import express from "express";

process.env.META_APP_SECRET = "meta-secret";

const { registerPublicPages } = await import("../src/routes/publicPages.js");

function createMockRes(onFinish) {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    finished: false,
    set(key, value) {
      this.headers[key] = value;
      return this;
    },
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
    send(payload) {
      this.body = payload;
      this.finished = true;
      onFinish?.();
      return this;
    },
  };
}

async function invokeHandler(appOrRouter, method, path, req = {}) {
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
      requestId: req.requestId || "req-1",
      correlationId: req.correlationId || "corr-1",
      get(name) {
        return this.headers[String(name || "").toLowerCase()];
      },
      ...req,
    };

    const res = createMockRes(finish);
    appOrRouter.handle(fullReq, res, (err) => {
      if (settled) return;
      if (err) {
        settled = true;
        reject(err);
        return;
      }
      settled = true;
      resolve({ req: fullReq, res });
    });
  });
}

function createSignedRequest(payload = {}) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const encodedSig = crypto
    .createHmac("sha256", "meta-secret")
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedSig}.${encodedPayload}`;
}

test("instagram deauthorize callback forwards lifecycle change into AIHQ", async () => {
  const app = express();
  const lifecycleClient = {
    signalDeauthorize: async (payload) => ({
      ok: true,
      status: 200,
      json: {
        ok: true,
        tenantKey: "acme",
        tenantId: "tenant-1",
        received: payload,
      },
    }),
  };

  registerPublicPages(app, { lifecycleClient });

  const signedRequest = createSignedRequest({
    algorithm: "HMAC-SHA256",
    issued_at: 1_776_000_000,
    user_id: "meta-user-1",
    page_id: "page-1",
  });

  const { res } = await invokeHandler(app, "post", "/instagram/deauthorize", {
    body: {
      signed_request: signedRequest,
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.processed, true);
  assert.equal(res.body?.tenantMatched, true);
  assert.equal(res.body?.reasonCode, "meta_app_deauthorized");
});

test("instagram deauthorize rejects invalid signed requests", async () => {
  const app = express();
  registerPublicPages(app, {
    lifecycleClient: {
      signalDeauthorize: async () => ({ ok: true, status: 200, json: { ok: true } }),
    },
  });

  const { res } = await invokeHandler(app, "post", "/instagram/deauthorize", {
    body: {
      signed_request: "bad.payload",
    },
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body?.ok, false);
  assert.match(String(res.body?.error || ""), /invalid_signed_request/i);
});
