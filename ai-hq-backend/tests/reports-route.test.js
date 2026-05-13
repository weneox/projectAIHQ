import test from "node:test";
import assert from "node:assert/strict";

import { reportsRoutes } from "../src/routes/api/reports/index.js";

function createMockRes(onFinish) {
  return {
    statusCode: 200,
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

    const fullReq = {
      method: String(method || "GET").toUpperCase(),
      path,
      originalUrl: path,
      url: path,
      headers: {},
      query: req.query || {},
      body: req.body || {},
      auth: req.auth || {},
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

function buildAuth(role = "operator") {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    tenantKey: "acme",
    role,
  };
}

test("reports overview aggregates product activity for the authenticated tenant", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const seenQueries = [];
  const db = {
    async query(sql, values = []) {
      seenQueries.push({ sql, values });
      assert.equal(values[0], "acme");

      if (/tenant_usage_daily/i.test(sql)) {
        return {
          rows: [
            {
              date: today,
              api_calls: 10,
              ai_units: 4,
              messages_in: 2,
              messages_out: 1,
              webhook_events: 3,
            },
          ],
        };
      }

      if (/from inbox_messages m/i.test(sql)) {
        return {
          rows: [
            {
              channel: "website",
              messages_in: 5,
              messages_out: 4,
              ai_replies: 3,
            },
          ],
        };
      }

      if (/with first_inbound/i.test(sql)) {
        return {
          rows: [
            {
              conversations: 5,
              waiting_first_response: 1,
              avg_first_response_seconds: 120,
            },
          ],
        };
      }

      if (/from inbox_messages/i.test(sql)) {
        return {
          rows: [
            {
              date: today,
              messages_in: 3,
              messages_out: 2,
              ai_replies: 2,
            },
          ],
        };
      }

      if (/group by created_at::date/i.test(sql)) {
        return {
          rows: [
            {
              date: today,
              leads: 2,
            },
          ],
        };
      }

      if (/group by coalesce\(nullif\(btrim\(owner\)/i.test(sql)) {
        return {
          rows: [
            {
              owner: "sales@acme.test",
              total: 3,
              open: 2,
              won: 1,
              lost: 0,
              pipeline_value_azn: 1200,
              followups_due: 1,
            },
          ],
        };
      }

      if (/count\(distinct coalesce/i.test(sql)) {
        return {
          rows: [
            {
              total_leads: 4,
              customers: 3,
              won_leads: 1,
              active_leads: 2,
              pipeline_value_azn: 1500,
              followups_due: 1,
            },
          ],
        };
      }

      if (/from tenant_users u/i.test(sql)) {
        return {
          rows: [
            {
              id: "user-1",
              name: "Sales Owner",
              email: "sales@acme.test",
              role: "owner",
              status: "active",
              last_seen_at: today,
              open_threads: 2,
              handoffs: 1,
              owned_leads: 3,
              won_leads: 1,
            },
          ],
        };
      }

      if (/group by lower\(coalesce\(stage/i.test(sql)) {
        return {
          rows: [
            {
              stage: "qualified",
              count: 2,
            },
          ],
        };
      }

      if (/from inbox_threads/i.test(sql)) {
        return {
          rows: [
            {
              open_threads: 4,
              unread_messages: 1,
              handoffs: 1,
            },
          ],
        };
      }

      throw new Error(`unexpected reports query: ${sql}`);
    },
  };

  const router = reportsRoutes({ db });
  const result = await invokeRouter(router, "get", "/reports/overview", {
    auth: buildAuth("operator"),
    query: { range: "7d" },
  });

  assert.equal(result.res.statusCode, 200);
  assert.equal(result.res.body?.ok, true);
  assert.equal(result.res.body?.tenantKey, "acme");
  assert.equal(result.res.body?.range, "7d");
  assert.equal(result.res.body?.summary?.apiCalls, 10);
  assert.equal(result.res.body?.summary?.messagesIn, 5);
  assert.equal(result.res.body?.summary?.messagesOut, 3);
  assert.equal(result.res.body?.summary?.aiReplies, 2);
  assert.equal(result.res.body?.summary?.leads, 2);
  assert.equal(result.res.body?.summary?.openThreads, 4);
  assert.equal(result.res.body?.summary?.unreadMessages, 1);
  assert.equal(result.res.body?.summary?.customers, 3);
  assert.equal(result.res.body?.summary?.pipelineValueAzn, 1500);
  assert.equal(result.res.body?.summary?.activeTeamMembers, 1);
  assert.equal(result.res.body?.summary?.waitingFirstResponse, 1);
  assert.equal(result.res.body?.channels?.[0]?.channel, "website");
  assert.equal(result.res.body?.leadStages?.[0]?.stage, "qualified");
  assert.equal(result.res.body?.leadOwners?.[0]?.owner, "sales@acme.test");
  assert.equal(result.res.body?.customers?.customers, 3);
  assert.equal(result.res.body?.team?.members?.[0]?.name, "Sales Owner");
  assert.equal(result.res.body?.inboxSla?.avgFirstResponseSeconds, 120);
  assert.equal(seenQueries.length, 10);
});
