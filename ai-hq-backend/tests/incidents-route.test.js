import test from "node:test";
import assert from "node:assert/strict";

import { incidentsRoutes } from "../src/routes/api/incidents/index.js";

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function invokeRouter(router, req) {
  return new Promise((resolve, reject) => {
    const res = createResponse();
    router.handle(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(res);
    });
    if (res.body !== null) {
      resolve(res);
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
