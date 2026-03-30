import test from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import { proposalDecisionHandler } from "../src/routes/api/proposals/handlers.js";
import {
  approveHandler,
  feedbackHandler,
  publishHandler,
} from "../src/routes/api/content/handlers.js";

function nowIso() {
  return new Date().toISOString();
}

function normalizeSql(sql = "") {
  return String(sql).trim().toLowerCase().replace(/\s+/g, " ");
}

function parseJsonLike(value) {
  if (typeof value === "string") return JSON.parse(value);
  return value;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function makeUuid(n) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

class FakeReplayDb {
  constructor() {
    this.jobs = new Map();
    this.proposals = new Map();
    this.content = new Map();
    this.notifications = [];
    this.audit = [];
    this.jobSeq = 1;
  }

  seedJob(row = {}) {
    this.jobs.set(String(row.id), clone(row));
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

    if (
      text.includes("from jobs") &&
      text.includes("where proposal_id = $1::uuid") &&
      text.includes("and type = $2::text")
    ) {
      const rows = [...this.jobs.values()]
        .filter(
          (row) =>
            String(row.proposal_id || "") === String(params[0] || "") &&
            String(row.type || "") === String(params[1] || "")
        )
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
      return { rows: rows.length ? [clone(rows[0])] : [] };
    }

    if (text.includes("from jobs") && text.includes("where id = $1::uuid")) {
      return { rows: [clone(this.jobs.get(String(params[0])))].filter(Boolean) };
    }

    if (text.startsWith("insert into jobs")) {
      const row = {
        id: makeUuid(900 + this.jobSeq++),
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

    if (text.startsWith("insert into notifications")) {
      const row = {
        id: makeUuid(8000 + this.notifications.length + 1),
        recipient: params[0],
        type: params[1],
        title: params[2],
        body: params[3],
        payload: parseJsonLike(params[4]),
        created_at: nowIso(),
        read_at: null,
      };
      this.notifications.push(row);
      return { rows: [clone(row)] };
    }

    if (text.startsWith("insert into audit_log")) {
      this.audit.push({
        actor: params[2],
        action: params[3],
        object_type: params[4],
        object_id: params[5],
        meta: parseJsonLike(params[6]),
      });
      return { rows: [] };
    }

    throw new Error(`Unhandled SQL in FakeReplayDb: ${text}`);
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
    webhookUrl: "https://hooks.example/accepted",
    statusCode: 202,
    correlationId: "corr-1",
    idempotencyKey: "idem-1",
    attemptCount: 1,
    responsePreview: "{\"ok\":true}",
    error: null,
    ...overrides,
  };
}

function runtimeResolved() {
  return {
    ok: true,
    runtime: { assistantId: "assistant-1" },
    runtimeBehavior: { niche: "general_business", primaryCta: "contact" },
  };
}

test("proposal approval rejects replay against an already-open draft.generate job", async () => {
  const previousPush = cfg.PUSH_ENABLED;
  try {
    cfg.PUSH_ENABLED = false;
    const db = new FakeReplayDb();
    const proposalId = makeUuid(101);
    const jobId = makeUuid(102);
    db.seedProposal({
      tenant_id: makeUuid(103),
      tenant_key: "acme",
      id: proposalId,
      thread_id: makeUuid(104),
      agent: "planner",
      type: "content",
      status: "pending",
      title: "Proposal",
      payload: {},
      created_at: "2026-03-30T10:00:00.000Z",
      decided_at: null,
      decision_by: null,
    });
    db.seedJob({
      id: jobId,
      tenant_id: makeUuid(103),
      tenant_key: "acme",
      proposal_id: proposalId,
      type: "draft.generate",
      status: "queued",
      input: {},
      output: {},
      error: null,
      created_at: "2026-03-30T10:05:00.000Z",
      started_at: null,
      finished_at: null,
    });

    const res = createMockRes();
    await proposalDecisionHandler(
      {
        params: { id: proposalId },
        body: { decision: "approved" },
        auth: { tenantId: makeUuid(103), tenantKey: "acme" },
        headers: {},
      },
      res,
      { db, wsHub: null, dispatchWorkflow: async () => acceptedDispatch() }
    );

    assert.equal(res.statusCode, 409);
    assert.equal(res.body?.error, "dispatch_attempt_conflict");
    assert.equal(res.body?.mutationOutcome, "rejected");
    assert.equal(res.body?.execution?.id, jobId);
    assert.equal(
      db.jobs.get(jobId)?.output?.dispatchReplayControl?.replayPrevented,
      true
    );
    assert.equal(db.jobs.size, 1);
  } finally {
    cfg.PUSH_ENABLED = previousPush;
  }
});

test("proposal approval creates a new authoritative retry job only after a retryable dispatch failure", async () => {
  const previousPush = cfg.PUSH_ENABLED;
  try {
    cfg.PUSH_ENABLED = false;
    const db = new FakeReplayDb();
    const proposalId = makeUuid(201);
    const previousJobId = makeUuid(202);
    db.seedProposal({
      tenant_id: makeUuid(203),
      tenant_key: "acme",
      id: proposalId,
      thread_id: makeUuid(204),
      agent: "planner",
      type: "content",
      status: "pending",
      title: "Proposal",
      payload: {},
      created_at: "2026-03-30T10:00:00.000Z",
      decided_at: null,
      decision_by: null,
    });
    db.seedJob({
      id: previousJobId,
      tenant_id: makeUuid(203),
      tenant_key: "acme",
      proposal_id: proposalId,
      type: "draft.generate",
      status: "dispatch_failed",
      input: {},
      output: {
        dispatchControl: { dispatchState: "failed" },
      },
      error: "dispatch failed",
      created_at: "2026-03-30T10:05:00.000Z",
      started_at: null,
      finished_at: null,
    });

    const sent = [];
    const res = createMockRes();
    await proposalDecisionHandler(
      {
        params: { id: proposalId },
        body: { decision: "approved" },
        auth: { tenantId: makeUuid(203), tenantKey: "acme" },
        headers: {},
      },
      res,
      {
        db,
        wsHub: {
          broadcast(payload) {
            sent.push(payload);
          },
        },
        dispatchWorkflow: async () => acceptedDispatch(),
      }
    );

    assert.equal(res.statusCode, 200);
    assert.equal(db.jobs.size, 2);
    const newJob = [...db.jobs.values()].find((row) => row.id !== previousJobId);
    assert.equal(
      newJob?.output?.dispatchReplayControl?.attemptMode,
      "retry"
    );
    assert.equal(
      newJob?.output?.dispatchReplayControl?.previousJobId,
      previousJobId
    );
    assert.equal(db.notifications.at(-1)?.title, "Draft retry dispatch accepted");
    assert.equal(db.audit.at(-1)?.meta?.dispatchAttemptMode, "retry");
    assert.equal(
      sent.some((event) => event?.type === "notification.created"),
      true
    );
  } finally {
    cfg.PUSH_ENABLED = previousPush;
  }
});

test("content asset retry emits retry-visible notification, realtime, and audit side effects", async () => {
  const previousPush = cfg.PUSH_ENABLED;
  try {
    cfg.PUSH_ENABLED = false;
    const db = new FakeReplayDb();
    const proposalId = makeUuid(250);
    const contentId = makeUuid(251);
    const previousJobId = makeUuid(252);
    db.seedProposal({
      tenant_id: makeUuid(253),
      tenant_key: "acme",
      id: proposalId,
      thread_id: makeUuid(254),
      agent: "planner",
      type: "content",
      status: "in_progress",
      title: "Proposal",
      payload: {},
      created_at: nowIso(),
      decided_at: nowIso(),
      decision_by: "ceo",
    });
    db.seedContent({
      id: contentId,
      proposal_id: proposalId,
      thread_id: makeUuid(254),
      job_id: previousJobId,
      status: "asset.requested",
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
    db.seedJob({
      id: previousJobId,
      tenant_id: makeUuid(253),
      tenant_key: "acme",
      proposal_id: proposalId,
      type: "video.generate",
      status: "dispatch_failed",
      input: {},
      output: {
        dispatchControl: { dispatchState: "failed" },
      },
      error: "dispatch failed",
      created_at: nowIso(),
      started_at: null,
      finished_at: null,
    });

    const sent = [];
    const res = createMockRes();
    await approveHandler(
      {
        params: { id: contentId },
        body: {},
        auth: { tenantId: makeUuid(253), tenantKey: "acme" },
        headers: {},
      },
      res,
      {
        db,
        wsHub: {
          broadcast(payload) {
            sent.push(payload);
          },
        },
        dispatchWorkflow: async () =>
          acceptedDispatch({
            mappedEvent: "proposal.approved",
            action: "content.video.generate",
            workflowHint: "runway_reel",
          }),
        resolveRuntimeBehavior: async () => runtimeResolved(),
      }
    );

    assert.equal(res.statusCode, 200);
    assert.equal(db.notifications.at(-1)?.title, "Video retry dispatch accepted");
    assert.equal(db.audit.at(-1)?.meta?.dispatchAttemptMode, "retry");
    assert.equal(db.audit.at(-1)?.meta?.retryOfJobId, previousJobId);
    assert.equal(
      sent.some((event) => event?.type === "execution.updated"),
      true
    );
    assert.equal(
      sent.some((event) => event?.type === "notification.created"),
      true
    );
  } finally {
    cfg.PUSH_ENABLED = previousPush;
  }
});

test("content feedback rejects replay while the linked draft.regen job is still open", async () => {
  const previousPush = cfg.PUSH_ENABLED;
  try {
    cfg.PUSH_ENABLED = false;
    const db = new FakeReplayDb();
    const proposalId = makeUuid(301);
    const contentId = makeUuid(302);
    const jobId = makeUuid(303);
    db.seedProposal({
      tenant_id: makeUuid(304),
      tenant_key: "acme",
      id: proposalId,
      thread_id: makeUuid(305),
      agent: "planner",
      type: "content",
      status: "in_progress",
      title: "Proposal",
      payload: {},
      created_at: nowIso(),
      decided_at: nowIso(),
      decision_by: "ceo",
    });
    db.seedContent({
      id: contentId,
      proposal_id: proposalId,
      thread_id: makeUuid(305),
      job_id: jobId,
      status: "draft.regenerating",
      version: 1,
      content_pack: { format: "image" },
      publish: {},
      last_feedback: "old",
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    db.seedJob({
      id: jobId,
      tenant_id: makeUuid(304),
      tenant_key: "acme",
      proposal_id: proposalId,
      type: "draft.regen",
      status: "queued",
      input: {},
      output: {},
      error: null,
      created_at: nowIso(),
      started_at: null,
      finished_at: null,
    });

    const res = createMockRes();
    await feedbackHandler(
      {
        params: { id: contentId },
        body: { feedbackText: "try again" },
        auth: { tenantId: makeUuid(304), tenantKey: "acme" },
        headers: {},
      },
      res,
      {
        db,
        wsHub: null,
        dispatchWorkflow: async () => acceptedDispatch(),
        resolveRuntimeBehavior: async () => runtimeResolved(),
      }
    );

    assert.equal(res.statusCode, 409);
    assert.equal(res.body?.error, "dispatch_attempt_conflict");
    assert.equal(res.body?.execution?.id, jobId);
    assert.equal(db.jobs.size, 1);
  } finally {
    cfg.PUSH_ENABLED = previousPush;
  }
});

test("content publish creates a new authoritative retry job only after a retryable publish dispatch failure", async () => {
  const previousPush = cfg.PUSH_ENABLED;
  try {
    cfg.PUSH_ENABLED = false;
    const db = new FakeReplayDb();
    const proposalId = makeUuid(401);
    const contentId = makeUuid(402);
    const previousJobId = makeUuid(403);
    db.seedProposal({
      tenant_id: makeUuid(404),
      tenant_key: "acme",
      id: proposalId,
      thread_id: makeUuid(405),
      agent: "planner",
      type: "content",
      status: "approved",
      title: "Proposal",
      payload: {},
      created_at: nowIso(),
      decided_at: nowIso(),
      decision_by: "ceo",
    });
    db.seedContent({
      id: contentId,
      proposal_id: proposalId,
      thread_id: makeUuid(405),
      job_id: previousJobId,
      status: "publish.requested",
      version: 1,
      content_pack: {
        format: "image",
        caption: "Caption",
        assets: [{ url: "https://cdn.example/post.jpg" }],
      },
      publish: {},
      last_feedback: "",
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    db.seedJob({
      id: previousJobId,
      tenant_id: makeUuid(404),
      tenant_key: "acme",
      proposal_id: proposalId,
      type: "publish",
      status: "dispatch_failed",
      input: {},
      output: {
        dispatchControl: { dispatchState: "failed" },
      },
      error: "dispatch failed",
      created_at: nowIso(),
      started_at: null,
      finished_at: null,
    });

    const sent = [];
    const res = createMockRes();
    await publishHandler(
      {
        params: { id: contentId },
        body: {},
        auth: { tenantId: makeUuid(404), tenantKey: "acme" },
        headers: {},
      },
      res,
      {
        db,
        wsHub: {
          broadcast(payload) {
            sent.push(payload);
          },
        },
        dispatchWorkflow: async () =>
          acceptedDispatch({
            mappedEvent: "content.publish",
            action: "content.publish",
            workflowHint: "publish",
          }),
        resolveRuntimeBehavior: async () => runtimeResolved(),
      }
    );

    assert.equal(res.statusCode, 200);
    assert.equal(db.jobs.size, 2);
    const newJob = [...db.jobs.values()].find((row) => row.id !== previousJobId);
    assert.equal(newJob?.type, "publish");
    assert.equal(
      newJob?.output?.dispatchReplayControl?.attemptMode,
      "retry"
    );
    assert.equal(
      newJob?.output?.dispatchReplayControl?.previousJobId,
      previousJobId
    );
    assert.equal(db.notifications.at(-1)?.title, "Publish retry dispatch accepted");
    assert.equal(db.audit.at(-1)?.meta?.dispatchAttemptMode, "retry");
    assert.equal(
      sent.some((event) => event?.type === "notification.created"),
      true
    );
  } finally {
    cfg.PUSH_ENABLED = previousPush;
  }
});
