import test from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import { executionsRoutes } from "../src/routes/api/executions/index.js";
import { resetInMemoryRateLimitsForTest } from "../src/utils/rateLimit.js";

function nowIso() {
  return new Date().toISOString();
}

function normalizeSql(sql = "") {
  return String(sql).trim().toLowerCase().replace(/\s+/g, " ");
}

function parseJsonLike(value) {
  if (typeof value === "string") {
    return JSON.parse(value);
  }
  return value;
}

class FakeExecutionDb {
  constructor() {
    this.jobs = new Map();
    this.content = new Map();
    this.proposals = new Map();
    this.notifications = [];
    this.audit = [];
    this.txSnapshot = null;
    this.failOnNotificationInsert = false;
  }

  clone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
  }

  seedJob(row = {}) {
    this.jobs.set(String(row.id), this.clone(row));
  }

  seedContent(row = {}) {
    this.content.set(String(row.id), this.clone(row));
  }

  seedProposal(row = {}) {
    this.proposals.set(String(row.id), this.clone(row));
  }

  async connect() {
    return this;
  }

  release() {}

  async query(sql, params = []) {
    const text = normalizeSql(sql);

    if (text === "begin") {
      this.txSnapshot = {
        jobs: this.clone([...this.jobs.entries()]),
        content: this.clone([...this.content.entries()]),
        proposals: this.clone([...this.proposals.entries()]),
        notifications: this.clone(this.notifications),
        audit: this.clone(this.audit),
      };
      return { rows: [] };
    }

    if (text === "commit") {
      this.txSnapshot = null;
      return { rows: [] };
    }

    if (text === "rollback") {
      if (this.txSnapshot) {
        this.jobs = new Map(this.txSnapshot.jobs);
        this.content = new Map(this.txSnapshot.content);
        this.proposals = new Map(this.txSnapshot.proposals);
        this.notifications = this.txSnapshot.notifications;
        this.audit = this.txSnapshot.audit;
        this.txSnapshot = null;
      }
      return { rows: [] };
    }

    if (text.includes("from jobs") && text.includes("where id = $1::uuid")) {
      return { rows: [this.clone(this.jobs.get(String(params[0])))].filter(Boolean) };
    }

    if (text.startsWith("update jobs set")) {
      const current = this.jobs.get(String(params[0]));
      if (!current) return { rows: [] };
      const row = {
        ...current,
        status: params[1] ?? current.status,
        output:
          params[2] == null
            ? current.output
            : { ...(current.output || {}), ...parseJsonLike(params[2]) },
        error: params[3] ?? current.error,
        started_at: params[4] ?? current.started_at,
        finished_at: params[5] ?? current.finished_at,
      };
      this.jobs.set(String(row.id), row);
      return { rows: [this.clone(row)] };
    }

    if (text.startsWith("insert into jobs")) {
      const row = {
        id: `job-${this.jobs.size + 1}`,
        tenant_id: params[0],
        tenant_key: params[1],
        proposal_id: params[2],
        type: params[3],
        status: params[4],
        input: parseJsonLike(params[5]),
        output: {},
        error: null,
        created_at: nowIso(),
        started_at: null,
        finished_at: null,
      };
      this.jobs.set(String(row.id), row);
      return { rows: [this.clone(row)] };
    }

    if (text.includes("from content_items") && text.includes("where id = $1::uuid")) {
      return { rows: [this.clone(this.content.get(String(params[0])))].filter(Boolean) };
    }

    if (text.startsWith("update content_items")) {
      const current = this.content.get(String(params[0]));
      if (!current) return { rows: [] };
      const row = {
        ...current,
        status: params[1] ?? current.status,
        version: params[2] ?? current.version,
        job_id: params[3] ?? current.job_id,
        last_feedback: params[4] ?? current.last_feedback,
        content_pack:
          params[5] == null ? current.content_pack : parseJsonLike(params[5]),
        publish:
          params[6] == null
            ? current.publish
            : { ...(current.publish || {}), ...parseJsonLike(params[6]) },
        updated_at: nowIso(),
      };
      this.content.set(String(row.id), row);
      return { rows: [this.clone(row)] };
    }

    if (text.includes("from proposals") && text.includes("where id::text = $1::text")) {
      return { rows: [this.clone(this.proposals.get(String(params[0])))].filter(Boolean) };
    }

    if (text.startsWith("update proposals")) {
      const current = this.proposals.get(String(params[0]));
      if (!current) return { rows: [] };
      const row = {
        ...current,
        status: String(params[1]),
        payload: { ...(current.payload || {}), ...parseJsonLike(params[2]) },
      };
      this.proposals.set(String(row.id), row);
      return { rows: [this.clone(row)] };
    }

    if (text.startsWith("insert into notifications")) {
      if (this.failOnNotificationInsert) {
        throw new Error("notifications_insert_failed");
      }
      const row = {
        id: `notif-${this.notifications.length + 1}`,
        recipient: params[0],
        type: params[1],
        title: params[2],
        body: params[3],
        payload: parseJsonLike(params[4]),
        read_at: null,
        created_at: nowIso(),
      };
      this.notifications.push(row);
      return { rows: [this.clone(row)] };
    }

    if (text.startsWith("insert into audit_log")) {
      this.audit.push({
        tenant_id: params[0],
        tenant_key: params[1],
        actor: params[2],
        action: params[3],
        object_type: params[4],
        object_id: params[5],
        meta: parseJsonLike(params[6]),
      });
      return { rows: [] };
    }

    throw new Error(`Unhandled SQL in FakeExecutionDb: ${text}`);
  }
}

function createMockRes() {
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
      return this;
    },
  };
}

async function invokeRoute(router, method, path, req = {}) {
  const layer = router.stack.find(
    (item) => item.route?.path === path && item.route.methods?.[method]
  );

  if (!layer) {
    throw new Error(`Route not found for ${method.toUpperCase()} ${path}`);
  }

  const handlers = layer.route.stack.map((item) => item.handle);
  const res = createMockRes();
  const fullReq = {
    method: method.toUpperCase(),
    path,
    originalUrl: path,
    url: path,
    headers: {},
    query: {},
    body: {},
    app: { locals: {} },
    ...req,
  };

  async function runAt(index) {
    if (index >= handlers.length || res.finished) return;
    const handler = handlers[index];

    if (handler.length >= 3) {
      await new Promise((resolve, reject) => {
        let settled = false;
        const next = (err) => {
          if (settled) return;
          settled = true;
          if (err) {
            reject(err);
            return;
          }
          resolve(runAt(index + 1));
        };

        Promise.resolve(handler(fullReq, res, next))
          .then(() => {
            if (!settled && res.finished) {
              settled = true;
              resolve();
            }
          })
          .catch(reject);
      });
      return;
    }

    await Promise.resolve(handler(fullReq, res));
    if (!res.finished) {
      await runAt(index + 1);
    }
  }

  await runAt(0);
  return { req: fullReq, res };
}

function seedVideoJobRows(db) {
  db.seedJob({
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "tenant-1",
    tenant_key: "acme",
    proposal_id: "22222222-2222-4222-8222-222222222222",
    type: "video.generate",
    status: "queued",
    input: {
      proposalId: "22222222-2222-4222-8222-222222222222",
      contentId: "33333333-3333-4333-8333-333333333333",
      tenantId: "tenant-1",
      automationMode: "manual",
      autoPublish: false,
    },
    output: {},
    error: null,
    created_at: "2026-03-30T10:00:00.000Z",
    started_at: null,
    finished_at: null,
  });

  db.seedProposal({
    id: "22222222-2222-4222-8222-222222222222",
    thread_id: "44444444-4444-4444-8444-444444444444",
    agent: "planner",
    type: "content",
    status: "approved",
    title: "Proposal",
    payload: {},
    created_at: "2026-03-30T09:00:00.000Z",
    decided_at: "2026-03-30T09:30:00.000Z",
    decision_by: "ceo",
  });

  db.seedContent({
    id: "33333333-3333-4333-8333-333333333333",
    proposal_id: "22222222-2222-4222-8222-222222222222",
    thread_id: "44444444-4444-4444-8444-444444444444",
    job_id: "11111111-1111-4111-8111-111111111111",
    status: "scene.queued",
    version: 1,
    content_pack: {
      format: "reel",
      media: {
        runQa: false,
      },
      videoPrompt: "make a reel",
    },
    publish: {},
    last_feedback: "",
    created_at: "2026-03-30T09:45:00.000Z",
    updated_at: "2026-03-30T09:45:00.000Z",
  });
}

test("execution callback applies once and ignores duplicate completed callbacks", async () => {
  const previousToken = cfg.n8n.callbackToken;
  const previousUrl = cfg.n8n.webhookUrl;
  const previousProposalUrl = cfg.n8n.webhookProposalApprovedUrl;
  const previousPublishUrl = cfg.n8n.webhookPublishUrl;
  const previousBase = cfg.n8n.webhookBase;
  const previousMax = cfg.rateLimit.executionCallbackMaxRequests;

  try {
    resetInMemoryRateLimitsForTest();
    cfg.n8n.callbackToken = "callback-secret";
    cfg.n8n.webhookUrl = "";
    cfg.n8n.webhookProposalApprovedUrl = "";
    cfg.n8n.webhookPublishUrl = "";
    cfg.n8n.webhookBase = "";
    cfg.rateLimit.executionCallbackMaxRequests = 1000;

    const db = new FakeExecutionDb();
    seedVideoJobRows(db);
    const sent = [];
    const router = executionsRoutes({
      db,
      wsHub: {
        broadcast(payload) {
          sent.push(payload);
          return true;
        },
      },
    });

    const body = {
      jobId: "11111111-1111-4111-8111-111111111111",
      status: "completed",
      result: {
        proposalId: "22222222-2222-4222-8222-222222222222",
        contentId: "33333333-3333-4333-8333-333333333333",
        tenantId: "tenant-1",
        tenantKey: "acme",
        videoUrl: "https://cdn.example/video.mp4",
        thumbnailUrl: "https://cdn.example/thumb.jpg",
      },
    };

    const first = await invokeRoute(router, "post", "/executions/callback", {
      headers: {
        "x-webhook-token": "callback-secret",
        "x-forwarded-for": "203.0.113.10",
      },
      body,
    });

    assert.equal(first.res.statusCode, 200);
    assert.equal(first.res.body?.mutationOutcome, "applied");
    assert.equal(first.res.body?.nextJobType, "assembly.render");
    assert.equal([...db.jobs.values()].length, 2);
    assert.equal(db.content.get("33333333-3333-4333-8333-333333333333")?.status, "render.queued");
    assert.equal(db.jobs.get("11111111-1111-4111-8111-111111111111")?.status, "completed");
    assert.equal(
      db.jobs.get("11111111-1111-4111-8111-111111111111")?.output?.callbackControl?.finalized,
      true
    );
    assert.equal(sent.filter((item) => item?.type === "execution.updated").length, 2);

    const second = await invokeRoute(router, "post", "/executions/callback", {
      headers: {
        "x-webhook-token": "callback-secret",
        "x-forwarded-for": "203.0.113.10",
      },
      body,
    });

    assert.equal(second.res.statusCode, 200);
    assert.equal(second.res.body?.mutationOutcome, "ignored");
    assert.equal(second.res.body?.duplicate, true);
    assert.equal([...db.jobs.values()].length, 2);
    assert.equal(db.notifications.length, 1);
    assert.equal(
      db.audit.some((entry) => entry.action === "execution.callback.ignored"),
      true
    );
  } finally {
    resetInMemoryRateLimitsForTest();
    cfg.n8n.callbackToken = previousToken;
    cfg.n8n.webhookUrl = previousUrl;
    cfg.n8n.webhookProposalApprovedUrl = previousProposalUrl;
    cfg.n8n.webhookPublishUrl = previousPublishUrl;
    cfg.n8n.webhookBase = previousBase;
    cfg.rateLimit.executionCallbackMaxRequests = previousMax;
  }
});

test("execution callback rejects conflicting terminal callbacks without overwriting truth", async () => {
  const previousToken = cfg.n8n.callbackToken;
  const previousMax = cfg.rateLimit.executionCallbackMaxRequests;

  try {
    resetInMemoryRateLimitsForTest();
    cfg.n8n.callbackToken = "callback-secret";
    cfg.rateLimit.executionCallbackMaxRequests = 1000;

    const db = new FakeExecutionDb();
    seedVideoJobRows(db);
    db.jobs.get("11111111-1111-4111-8111-111111111111").status = "completed";
    db.jobs.get("11111111-1111-4111-8111-111111111111").output = {
      callbackControl: {
        finalized: true,
        finalStatus: "completed",
        fingerprint: "fp-1",
      },
    };

    const router = executionsRoutes({ db, wsHub: null });
    const result = await invokeRoute(router, "post", "/executions/callback", {
      headers: {
        "x-webhook-token": "callback-secret",
        "x-forwarded-for": "203.0.113.10",
      },
      body: {
        jobId: "11111111-1111-4111-8111-111111111111",
        status: "failed",
        error: "provider failed",
      },
    });

    assert.equal(result.res.statusCode, 409);
    assert.equal(result.res.body?.error, "execution_callback_conflict");
    assert.equal(result.res.body?.mutationOutcome, "rejected");
    assert.equal(db.jobs.get("11111111-1111-4111-8111-111111111111")?.status, "completed");
    assert.equal([...db.jobs.values()].length, 1);
    assert.equal(
      db.audit.some((entry) => entry.action === "execution.callback.rejected"),
      true
    );
  } finally {
    resetInMemoryRateLimitsForTest();
    cfg.n8n.callbackToken = previousToken;
    cfg.rateLimit.executionCallbackMaxRequests = previousMax;
  }
});

test("execution callback rolls back job and content truth when later persistence fails", async () => {
  const previousToken = cfg.n8n.callbackToken;
  const previousUrl = cfg.n8n.webhookUrl;
  const previousMax = cfg.rateLimit.executionCallbackMaxRequests;

  try {
    resetInMemoryRateLimitsForTest();
    cfg.n8n.callbackToken = "callback-secret";
    cfg.n8n.webhookUrl = "";
    cfg.rateLimit.executionCallbackMaxRequests = 1000;

    const db = new FakeExecutionDb();
    seedVideoJobRows(db);
    db.failOnNotificationInsert = true;
    const router = executionsRoutes({ db, wsHub: null });

    const result = await invokeRoute(router, "post", "/executions/callback", {
      headers: {
        "x-webhook-token": "callback-secret",
        "x-forwarded-for": "203.0.113.10",
      },
      body: {
        jobId: "11111111-1111-4111-8111-111111111111",
        status: "completed",
        result: {
          proposalId: "22222222-2222-4222-8222-222222222222",
          contentId: "33333333-3333-4333-8333-333333333333",
          tenantId: "tenant-1",
          tenantKey: "acme",
          videoUrl: "https://cdn.example/video.mp4",
        },
      },
    });

    assert.equal(result.res.statusCode, 200);
    assert.equal(result.res.body?.ok, false);
    assert.equal(db.jobs.get("11111111-1111-4111-8111-111111111111")?.status, "queued");
    assert.equal(db.content.get("33333333-3333-4333-8333-333333333333")?.status, "scene.queued");
    assert.equal([...db.jobs.values()].length, 1);
    assert.equal(db.notifications.length, 0);
  } finally {
    resetInMemoryRateLimitsForTest();
    cfg.n8n.callbackToken = previousToken;
    cfg.n8n.webhookUrl = previousUrl;
    cfg.rateLimit.executionCallbackMaxRequests = previousMax;
  }
});
