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

class FakeDispatchDb {
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

    throw new Error(`Unhandled SQL in FakeDispatchDb: ${text}`);
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

function failedDispatch(overrides = {}) {
  return {
    ok: false,
    attempted: true,
    accepted: false,
    dispatchOutcome: "failed",
    reasonCode: "dispatch_failed",
    mappedEvent: "proposal.approved",
    action: "proposal.approved",
    workflowHint: "approved",
    webhookUrl: "https://hooks.example/aihq-approved",
    statusCode: 503,
    correlationId: null,
    idempotencyKey: "idem-fail",
    attemptCount: 2,
    responsePreview: "{\"error\":\"downstream unavailable\"}",
    error: "downstream unavailable",
    ...overrides,
  };
}

function runtimeResolved() {
  return {
    ok: true,
    runtime: {
      assistantId: "assistant-1",
    },
    runtimeBehavior: {
      niche: "general_business",
      conversionGoal: "lead_capture",
      primaryCta: "contact",
      toneProfile: "professional",
    },
  };
}

test("proposal approval persists explicit accepted dispatch truth instead of only local queue truth", async () => {
  const previousPush = cfg.PUSH_ENABLED;

  try {
    cfg.PUSH_ENABLED = false;

    const db = new FakeDispatchDb();
    const proposalId = makeUuid(101);
    db.seedProposal({
      tenant_id: makeUuid(103),
      tenant_key: "acme",
      id: proposalId,
      thread_id: makeUuid(102),
      agent: "planner",
      type: "content",
      status: "pending",
      title: "Spring launch",
      payload: {},
      created_at: "2026-03-30T10:00:00.000Z",
      decided_at: null,
      decision_by: null,
    });

    const sent = [];
    const req = {
      params: { id: proposalId },
      body: { decision: "approved" },
      auth: { tenantId: makeUuid(103), tenantKey: "acme" },
      headers: {},
    };
    const res = createMockRes();

    await proposalDecisionHandler(req, res, {
      db,
      wsHub: {
        broadcast(payload) {
          sent.push(payload);
        },
      },
      dispatchWorkflow: async () => acceptedDispatch(),
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.ok, true);
    assert.equal(res.body?.dispatch?.accepted, true);
    assert.equal(res.body?.execution?.status, "queued");
    assert.equal(
      res.body?.execution?.output?.dispatchControl?.externalAccepted,
      true
    );
    assert.equal(
      res.body?.execution?.output?.dispatchControl?.dispatchState,
      "accepted"
    );
    assert.equal(db.notifications.at(-1)?.title, "Draft dispatch accepted");
    assert.equal(
      db.audit.at(-1)?.meta?.dispatchOutcome,
      "accepted"
    );
    assert.equal(
      sent.some((event) => event?.type === "execution.updated"),
      true
    );
  } finally {
    cfg.PUSH_ENABLED = previousPush;
  }
});

test("content feedback persists accepted dispatch truth using authoritative proposal tenant context", async () => {
  const previousPush = cfg.PUSH_ENABLED;

  try {
    cfg.PUSH_ENABLED = false;

    const db = new FakeDispatchDb();
    const proposalId = makeUuid(202);
    const contentId = makeUuid(201);
    db.seedProposal({
      tenant_id: makeUuid(204),
      tenant_key: "acme",
      id: proposalId,
      thread_id: makeUuid(203),
      agent: "planner",
      type: "content",
      status: "in_progress",
      title: "Draft refresh",
      payload: {},
      created_at: "2026-03-30T10:00:00.000Z",
      decided_at: "2026-03-30T10:05:00.000Z",
      decision_by: "ceo",
    });
    db.seedContent({
      id: contentId,
      proposal_id: proposalId,
      thread_id: makeUuid(203),
      job_id: null,
      tenant_id: makeUuid(204),
      status: "draft.ready",
      version: 1,
      content_pack: { format: "image" },
      publish: {},
      last_feedback: "",
      created_at: "2026-03-30T10:00:00.000Z",
      updated_at: "2026-03-30T10:00:00.000Z",
    });

    const sent = [];
    const req = {
      params: { id: contentId },
      body: { feedbackText: "Make it sharper" },
      auth: { tenantKey: "acme", tenantId: makeUuid(204) },
      headers: {},
    };
    const res = createMockRes();

    await feedbackHandler(req, res, {
      db,
      wsHub: {
        broadcast(payload) {
          sent.push(payload);
        },
      },
      dispatchWorkflow: async (_event, _proposal, extra = {}) =>
        acceptedDispatch({
          mappedEvent: "content.revise",
          action: "content.revise",
          workflowHint: "approved",
          tenantKey: extra.tenantKey,
          tenantId: extra.tenantId,
        }),
      resolveRuntimeBehavior: async () => runtimeResolved(),
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.ok, true);
    assert.equal(res.body?.dispatch?.dispatchOutcome, "accepted");
    assert.equal(res.body?.execution?.status, "queued");
    assert.equal(
      res.body?.execution?.output?.dispatchControl?.externalAccepted,
      true
    );
    assert.equal(db.notifications.at(-1)?.title, "Draft dispatch accepted");
    assert.equal(
      db.audit.at(-1)?.meta?.dispatchOutcome,
      "accepted"
    );
    assert.equal(
      sent.some(
        (event) =>
          event?.type === "execution.updated" &&
          event?.execution?.status === "queued"
      ),
      true
    );
  } finally {
    cfg.PUSH_ENABLED = previousPush;
  }
});

test("content approve persists failed media dispatch truth instead of implying render acceptance", async () => {
  const previousPush = cfg.PUSH_ENABLED;

  try {
    cfg.PUSH_ENABLED = false;

    const db = new FakeDispatchDb();
    const proposalId = makeUuid(301);
    const contentId = makeUuid(302);
    db.seedProposal({
      tenant_id: makeUuid(304),
      tenant_key: "acme",
      id: proposalId,
      thread_id: makeUuid(303),
      agent: "planner",
      type: "content",
      status: "in_progress",
      title: "Reel concept",
      payload: {},
      created_at: "2026-03-30T10:00:00.000Z",
      decided_at: "2026-03-30T10:05:00.000Z",
      decision_by: "ceo",
    });
    db.seedContent({
      id: contentId,
      proposal_id: proposalId,
      thread_id: makeUuid(303),
      job_id: null,
      tenant_id: makeUuid(304),
      status: "draft.ready",
      version: 1,
      content_pack: {
        format: "reel",
        video: {
          provider: "runway",
        },
      },
      publish: {},
      last_feedback: "",
      created_at: "2026-03-30T10:10:00.000Z",
      updated_at: "2026-03-30T10:10:00.000Z",
    });

    const req = {
      params: { id: contentId },
      body: {},
      auth: { tenantKey: "acme", tenantId: makeUuid(304) },
      headers: {},
    };
    const res = createMockRes();

    await approveHandler(req, res, {
      db,
      wsHub: null,
      dispatchWorkflow: async () =>
        failedDispatch({
          mappedEvent: "proposal.approved",
          action: "content.video.generate",
          workflowHint: "runway_reel",
        }),
      resolveRuntimeBehavior: async () => runtimeResolved(),
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.ok, true);
    assert.equal(res.body?.dispatch?.accepted, false);
    assert.equal(res.body?.execution?.status, "dispatch_failed");
    assert.equal(
      db.content.get(contentId)?.status,
      "asset.requested"
    );
    assert.equal(
      res.body?.execution?.output?.dispatchControl?.dispatchState,
      "failed"
    );
    assert.equal(
      res.body?.execution?.output?.dispatchControl?.workflowHint,
      "runway_reel"
    );
    assert.equal(db.notifications.at(-1)?.title, "Video dispatch failed");
    assert.equal(
      db.audit.at(-1)?.meta?.dispatchReasonCode,
      "dispatch_failed"
    );
  } finally {
    cfg.PUSH_ENABLED = previousPush;
  }
});

test("content publish persists failed publish dispatch truth on the job and response", async () => {
  const previousPush = cfg.PUSH_ENABLED;

  try {
    cfg.PUSH_ENABLED = false;

    const db = new FakeDispatchDb();
    const proposalId = makeUuid(401);
    const contentId = makeUuid(402);
    db.seedProposal({
      tenant_id: makeUuid(404),
      tenant_key: "acme",
      id: proposalId,
      thread_id: makeUuid(403),
      agent: "planner",
      type: "content",
      status: "approved",
      title: "Publishable post",
      payload: {},
      created_at: "2026-03-30T10:00:00.000Z",
      decided_at: "2026-03-30T10:05:00.000Z",
      decision_by: "ceo",
    });
    db.seedContent({
      id: contentId,
      proposal_id: proposalId,
      thread_id: makeUuid(403),
      job_id: null,
      tenant_id: makeUuid(404),
      status: "asset.ready",
      version: 1,
      content_pack: {
        format: "image",
        caption: "Launch post",
        assets: [{ url: "https://cdn.example/post.jpg" }],
      },
      publish: {},
      last_feedback: "",
      created_at: "2026-03-30T10:10:00.000Z",
      updated_at: "2026-03-30T10:10:00.000Z",
    });

    const req = {
      params: { id: contentId },
      body: {},
      auth: { tenantKey: "acme", tenantId: makeUuid(404) },
      headers: {},
    };
    const res = createMockRes();

    await publishHandler(req, res, {
      db,
      wsHub: null,
      dispatchWorkflow: async () =>
        failedDispatch({
          mappedEvent: "content.publish",
          action: "content.publish",
          workflowHint: "publish",
        }),
      resolveRuntimeBehavior: async () => runtimeResolved(),
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.ok, true);
    assert.equal(res.body?.dispatch?.dispatchOutcome, "failed");
    assert.equal(res.body?.execution?.status, "dispatch_failed");
    assert.equal(
      res.body?.execution?.output?.dispatchControl?.event,
      "content.publish"
    );
    assert.equal(db.notifications.at(-1)?.title, "Publish dispatch failed");
    assert.equal(
      db.audit.at(-1)?.meta?.dispatchOutcome,
      "failed"
    );
    assert.equal(db.content.get(contentId)?.status, "publish.requested");
  } finally {
    cfg.PUSH_ENABLED = previousPush;
  }
});
