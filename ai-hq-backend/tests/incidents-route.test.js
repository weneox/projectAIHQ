// ai-hq-backend/tests/incidents-route.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { incidentsRoutes } from "../src/routes/api/incidents/index.js";

function createResponse(onSend) {
  return {
    statusCode: 200,
    body: null,
    finished: false,
    headersSent: false,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(payload) {
      this.body = payload;
      this.headersSent = true;
      this.finished = true;
      if (typeof onSend === "function") onSend(this);
      return this;
    },

    send(payload) {
      this.body = payload;
      this.headersSent = true;
      this.finished = true;
      if (typeof onSend === "function") onSend(this);
      return this;
    },

    end(payload) {
      if (payload !== undefined && this.body === null) {
        this.body = payload;
      }
      this.headersSent = true;
      this.finished = true;
      if (typeof onSend === "function") onSend(this);
      return this;
    },
  };
}

async function invokeRouter(router, req) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const done = (res) => {
      if (settled) return;
      settled = true;
      resolve(res);
    };

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const res = createResponse(done);

    try {
      router.handle(req, res, (error) => {
        if (error) {
          fail(error);
          return;
        }

        if (res.finished || res.body !== null) {
          done(res);
          return;
        }

        fail(new Error("Router completed without sending a response"));
      });
    } catch (error) {
      fail(error);
    }
  });
}

test("incidents route returns filtered recent incidents with explicit retention policy", async () => {
  const db = {
    async query(sql, args = []) {
      if (/select \*/i.test(sql)) {
        assert.equal(args[0], "twilio-voice-backend");
        assert.equal(args[1], "error");
        assert.equal(args[2], "request_failed");
        assert.equal(args[3], 24);
        assert.equal(args[4], 25);

        return {
          rows: [
            {
              id: "incident-1",
              service: "twilio-voice-backend",
              area: "voice_sync",
              severity: "error",
              code: "voice_sync_request_failed",
              reason_code: "request_failed",
              request_id: "req-1",
              correlation_id: "corr-1",
              tenant_id: null,
              tenant_key: "acme",
              detail_summary: "AI HQ request failed",
              context: { status: 504 },
              occurred_at: "2026-03-26T00:00:00.000Z",
              created_at: "2026-03-26T00:00:00.000Z",
            },
          ],
        };
      }

      return { rows: [] };
    },
  };

  const router = incidentsRoutes({ db });

  const res = await invokeRouter(router, {
    method: "GET",
    url: "/incidents",
    path: "/incidents",
    originalUrl: "/incidents",
    query: {
      service: "twilio-voice-backend",
      severity: "error",
      reasonCode: "request_failed",
      sinceHours: "24",
      limit: "25",
    },
    auth: {
      userId: "user-1",
      role: "operator",
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.incidents.length, 1);
  assert.equal(res.body.incidents[0].service, "twilio-voice-backend");
  assert.deepEqual(res.body.retentionPolicy, {
    retainDays: 14,
    maxRows: 5000,
    pruneIntervalHours: 6,
  });
});