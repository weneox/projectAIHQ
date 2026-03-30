import test from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import { proposalDecisionHandler } from "../src/routes/api/proposals/handlers.js";
import {
  approveHandler,
  publishHandler,
} from "../src/routes/api/content/handlers.js";

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

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function makeUuid(n) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

class FakeTenantOrchestrationDb {
  constructor() {
    this.jobs = new Map();
    this.proposals = new Map();
    this.content = new Map();
    this.notifications = [];
    this.audit = [];
    this.jobSeq = 1;
  }

  seedProposal(row = {}) {
    this.proposals.set(String(row.id), clone(row));
  }

  seedContent(row = {}) {
    this.content.set(String(row.id), clone(row));
  }

  async query(sql, params = []) {
    const text = normalizeSql(sql);

    if (text.includes("from proposals") && text.includes("where id::text = $1::text")) {
      return { rows: [clone(this.proposals.get(String(params[0])))].filter(Boolean) };
    }

    if (text.startsWith("update proposals")) {
      const current = this.proposals.get(String(params[0]));
      if (!current) return { rows: [] };
      const row = {
        ...current,
        status: String(params[3]),
        decision_by: params[1],
        decided_at: nowIso(),
        payload: { ...(current.payload || {}), ...parseJsonLike(params[2]) },
      };
      this.proposals.set(String(row.id), row);
      return { rows: [clone(row)] };
    }

    if (text.includes("from content_items") && text.includes("where id = $1::uuid")) {
      return { rows: [clone(this.content.get(String(params[0])))].filter(Boolean) };
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
      return { rows: [clone(row)] };
    }

    if (text.startsWith("insert into jobs")) {
      const row = {
        id: makeUuid(this.jobSeq++),
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
      return { rows: [clone(row)] };
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
      return { rows: [clone(row)] };
    }

    if (text.startsWith("insert into notifications")) {
      const row = {
        id: makeUuid(9000 + this.notifications.length + 1),
        recipient: params[0],
        type: params[1],
        title: params[2],
        body: params[3],
        payload: parseJsonLike(params[4]),
        read_at: null,
        created_at: nowIso(),
      };
      this.notifications.push(row);
      return { rows: [clone(row)] };
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

    throw new Error(`Unhandled SQL in FakeTenantOrchestrationDb: ${text}`);
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

function acceptedDispatch(overrides = {}) {
  return {
    ok: true,
    attempted: true,
    accepted: true,
    dispatchOutcome: "accepted",
    reasonCode: "dispatch_accepted",
    mappedEvent: "proposal.approved",
    action: "proposal.approved",
    workflowHint: "approved",
    webhookUrl: "https://hooks.example/aihq-approved",
    statusCode: 202,
    correlationId: "corr-1",
    idempotencyKey: "idem-1",
    attemptCount: 1,
    responsePreview: "{\"ok\":true}",
    error: null,
    ...overrides,
  };
}

test("proposal approval rejects mismatched request tenant instead of building outbound truth from it", async () => {
  const previousPush = cfg.PUSH_ENABLED;

  try {
    cfg.PUSH_ENABLED = false;

    const db = new FakeTenantOrchestrationDb();
    const proposalId = makeUuid(101);
    db.seedProposal({
      tenant_id: makeUuid(102),
      tenant_key: "acme",
      id: proposalId,
      thread_id: makeUuid(103),
      agent: "planner",
      type: "content",
      status: "pending",
      title: "Launch concept",
      payload: {},
      created_at: nowIso(),
      decided_at: null,
      decision_by: null,
    });

    const res = createMockRes();
    await proposalDecisionHandler(
      {
        params: { id: proposalId },
        body: { decision: "approved" },
        auth: { tenantId: makeUuid(999), tenantKey: "other-tenant" },
        headers: {},
      },
      res,
      { db, wsHub: null, dispatchWorkflow: async () => acceptedDispatch() }
    );

    assert.equal(res.statusCode, 409);
    assert.equal(res.body?.error, "tenant_truth_mismatch");
    assert.equal(db.jobs.size, 0);
    assert.equal(db.notifications.length, 0);
  } finally {
    cfg.PUSH_ENABLED = previousPush;
  }
});

test("content approve uses authoritative proposal tenant truth for runtime and dispatch payload assembly", async () => {
  const previousPush = cfg.PUSH_ENABLED;

  try {
    cfg.PUSH_ENABLED = false;

    const db = new FakeTenantOrchestrationDb();
    const proposalId = makeUuid(201);
    const contentId = makeUuid(202);
    db.seedProposal({
      tenant_id: makeUuid(203),
      tenant_key: "acme",
      id: proposalId,
      thread_id: makeUuid(204),
      agent: "planner",
      type: "content",
      status: "in_progress",
      title: "Reel idea",
      payload: {},
      created_at: nowIso(),
      decided_at: nowIso(),
      decision_by: "ceo",
    });
    db.seedContent({
      id: contentId,
      proposal_id: proposalId,
      thread_id: makeUuid(204),
      job_id: null,
      status: "draft.ready",
      version: 1,
      content_pack: {
        format: "reel",
        video: { provider: "runway" },
      },
      publish: {},
      last_feedback: "",
      created_at: nowIso(),
      updated_at: nowIso(),
    });

    let runtimeInput = null;
    let dispatchExtra = null;
    const res = createMockRes();
    await approveHandler(
      {
        params: { id: contentId },
        body: {},
        auth: {},
        headers: {},
      },
      res,
      {
        db,
        wsHub: null,
        resolveRuntimeBehavior: async (input) => {
          runtimeInput = input;
          return {
            ok: true,
            runtime: { assistantId: "assistant-1" },
            runtimeBehavior: { niche: "fitness", primaryCta: "contact" },
          };
        },
        dispatchWorkflow: async (_event, _proposal, extra = {}) => {
          dispatchExtra = extra;
          return acceptedDispatch({
            mappedEvent: "proposal.approved",
            action: "content.video.generate",
            workflowHint: "runway_reel",
          });
        },
      }
    );

    assert.equal(res.statusCode, 200);
    assert.equal(runtimeInput?.tenantId, makeUuid(203));
    assert.equal(runtimeInput?.tenantKey, "acme");
    assert.equal(dispatchExtra?.tenantId, makeUuid(203));
    assert.equal(dispatchExtra?.tenantKey, "acme");
    assert.equal(db.jobs.size, 1);
    assert.equal([...db.jobs.values()][0]?.tenant_id, makeUuid(203));
    assert.equal([...db.jobs.values()][0]?.tenant_key, "acme");
  } finally {
    cfg.PUSH_ENABLED = previousPush;
  }
});

test("content publish fails closed when authoritative proposal tenant truth is missing", async () => {
  const previousPush = cfg.PUSH_ENABLED;

  try {
    cfg.PUSH_ENABLED = false;

    const db = new FakeTenantOrchestrationDb();
    const proposalId = makeUuid(301);
    const contentId = makeUuid(302);
    db.seedProposal({
      tenant_id: null,
      tenant_key: "",
      id: proposalId,
      thread_id: makeUuid(303),
      agent: "planner",
      type: "content",
      status: "approved",
      title: "Publish post",
      payload: {},
      created_at: nowIso(),
      decided_at: nowIso(),
      decision_by: "ceo",
    });
    db.seedContent({
      id: contentId,
      proposal_id: proposalId,
      thread_id: makeUuid(303),
      job_id: null,
      status: "asset.ready",
      version: 1,
      content_pack: {
        format: "image",
        caption: "Ready",
        assets: [{ url: "https://cdn.example/post.jpg" }],
      },
      publish: {},
      last_feedback: "",
      created_at: nowIso(),
      updated_at: nowIso(),
    });

    const res = createMockRes();
    await publishHandler(
      {
        params: { id: contentId },
        body: {},
        auth: {},
        headers: {},
      },
      res,
      {
        db,
        wsHub: null,
        dispatchWorkflow: async () => acceptedDispatch(),
      }
    );

    assert.equal(res.statusCode, 409);
    assert.equal(res.body?.error, "tenant_truth_unavailable");
    assert.equal(db.jobs.size, 0);
    assert.equal(db.content.get(contentId)?.status, "asset.ready");
  } finally {
    cfg.PUSH_ENABLED = previousPush;
  }
});
