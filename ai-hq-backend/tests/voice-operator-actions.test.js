import test from "node:test";
import assert from "node:assert/strict";

import { voiceRoutes } from "../src/routes/api/voice/public.js";

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeSql(sql = "") {
  return String(sql).trim().toLowerCase().replace(/\s+/g, " ");
}

function buildVoiceCall(overrides = {}) {
  return {
    id: "call-1",
    tenant_id: "tenant-1",
    tenant_key: "acme",
    provider: "twilio",
    provider_call_sid: "CA123",
    provider_stream_sid: null,
    direction: "inbound",
    status: "completed",
    from_number: "+15550000001",
    to_number: "+15550000002",
    caller_name: "Customer",
    started_at: "2026-03-30T01:00:00.000Z",
    answered_at: "2026-03-30T01:01:00.000Z",
    ended_at: "2026-03-30T01:05:00.000Z",
    duration_seconds: 240,
    language: "en",
    agent_mode: "assistant",
    handoff_requested: false,
    handoff_completed: false,
    handoff_target: null,
    callback_requested: false,
    callback_phone: null,
    lead_id: null,
    inbox_thread_id: null,
    transcript: "hello",
    summary: "summary",
    outcome: "unknown",
    intent: null,
    sentiment: null,
    cost_amount: 0,
    cost_currency: "USD",
    metrics: {},
    extraction: {
      existingExtraction: true,
    },
    meta: {
      existingMeta: true,
      operator: {
        existingOperatorField: "keep",
      },
    },
    created_at: "2026-03-30T01:00:00.000Z",
    updated_at: "2026-03-30T01:05:00.000Z",
    ...overrides,
  };
}

class FakeVoiceDb {
  constructor() {
    this.calls = new Map();
    this.events = [];
    this.tenantScopedLookups = [];
    this.tenantScopedUpdates = [];
  }

  seedCall(row = {}) {
    this.calls.set(String(row.id), clone(row));
  }

  async query(sql, params = []) {
    const text = normalizeSql(sql);

    if (
      text.includes("from voice_calls") &&
      text.includes("where id = $1 and tenant_id = $2")
    ) {
      this.tenantScopedLookups.push({
        id: params[0],
        tenantId: params[1],
      });
      const row = this.calls.get(String(params[0]));
      if (!row || String(row.tenant_id) !== String(params[1])) {
        return { rows: [] };
      }
      return { rows: [clone(row)] };
    }

    if (text.startsWith("update voice_calls set")) {
      this.tenantScopedUpdates.push({
        id: params[0],
        tenantId: params[1],
      });
      const current = this.calls.get(String(params[0]));
      if (!current || String(current.tenant_id) !== String(params[1])) {
        return { rows: [] };
      }
      const row = {
        ...current,
        tenant_id: params[1],
        tenant_key: params[2],
        provider: params[3],
        provider_call_sid: params[4],
        provider_stream_sid: params[5],
        direction: params[6],
        status: params[7],
        from_number: params[8],
        to_number: params[9],
        caller_name: params[10],
        started_at: params[11],
        answered_at: params[12],
        ended_at: params[13],
        duration_seconds: params[14],
        language: params[15],
        agent_mode: params[16],
        handoff_requested: params[17],
        handoff_completed: params[18],
        handoff_target: params[19],
        callback_requested: params[20],
        callback_phone: params[21],
        lead_id: params[22],
        inbox_thread_id: params[23],
        transcript: params[24],
        summary: params[25],
        outcome: params[26],
        intent: params[27],
        sentiment: params[28],
        cost_amount: params[29],
        cost_currency: params[30],
        metrics: JSON.parse(params[31]),
        extraction: JSON.parse(params[32]),
        meta: JSON.parse(params[33]),
        updated_at: nowIso(),
      };
      this.calls.set(String(row.id), clone(row));
      return { rows: [clone(row)] };
    }

    if (text.startsWith("insert into voice_call_events")) {
      const row = {
        id: params[0],
        call_id: params[1],
        tenant_id: params[2],
        tenant_key: params[3],
        event_type: params[4],
        actor: params[5],
        payload: JSON.parse(params[6]),
        created_at: nowIso(),
      };
      this.events.push(clone(row));
      return { rows: [clone(row)] };
    }

    throw new Error(`Unhandled SQL in FakeVoiceDb: ${text}`);
  }
}

function createMockRes(onFinish) {
  return {
    statusCode: 200,
    body: null,
    finished: false,
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
      Object.entries(req.headers || {}).map(([key, value]) => [
        String(key).toLowerCase(),
        value,
      ])
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

function buildAuth(role = "operator") {
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

function buildAudit() {
  return {
    entries: [],
    async log(payload) {
      this.entries.push(clone(payload));
    },
  };
}

async function postOperatorAction({
  call = buildVoiceCall(),
  body = {},
  audit = buildAudit(),
} = {}) {
  const db = new FakeVoiceDb();
  db.seedCall(call);
  const router = voiceRoutes({ db, dbDisabled: false, audit });
  const result = await invokeRouter(
    router,
    "post",
    `/voice/calls/${call.id}/operator-actions`,
    {
      ...buildAuth("operator"),
      body,
    }
  );
  return {
    ...result,
    db,
    audit,
  };
}

test("mark_reviewed updates operator state and appends event", async () => {
  const { res, db, audit } = await postOperatorAction({
    body: {
      action: "mark_reviewed",
      note: "Checked queue item",
      reasonCode: "qa_done",
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.action, "mark_reviewed");
  assert.equal(res.body.operatorState.operatorStatus, "reviewed");
  assert.equal(res.body.operatorState.reviewedBy, "operator@acme.test");
  assert.match(res.body.operatorState.reviewedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(res.body.operatorState.lastAction, "mark_reviewed");
  assert.equal(res.body.operatorState.note, "Checked queue item");
  assert.equal(res.body.operatorState.reasonCode, "qa_done");
  assert.equal(res.body.call.meta.existingMeta, true);
  assert.equal(res.body.call.meta.operator.existingOperatorField, "keep");
  assert.equal(res.body.call.extraction.existingExtraction, true);
  assert.equal(db.events.length, 1);
  assert.equal(db.events[0].event_type, "voice.operator.action_recorded");
  assert.equal(db.events[0].actor, "operator@acme.test");
  assert.equal(db.events[0].payload.action, "mark_reviewed");
  assert.equal(db.events[0].payload.note, "Checked queue item");
  assert.equal(db.events[0].payload.reasonCode, "qa_done");
  assert.equal(db.events[0].payload.operatorState.operatorStatus, "reviewed");
  assert.deepEqual(db.tenantScopedUpdates, [
    {
      id: "call-1",
      tenantId: "tenant-1",
    },
  ]);
  assert.ok(db.tenantScopedLookups.length >= 2);
  assert.ok(
    db.tenantScopedLookups.every((item) => item.tenantId === "tenant-1")
  );
  assert.equal(audit.entries[0].action, "voice.operator.mark_reviewed");
});

test("assign sets assigneeId and appends event", async () => {
  const { res, db } = await postOperatorAction({
    body: {
      action: "assign",
      assigneeId: "operator-2",
      note: "Route to specialist",
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.operatorState.operatorStatus, "assigned");
  assert.equal(res.body.operatorState.assigneeId, "operator-2");
  assert.equal(res.body.operatorState.assignedBy, "operator@acme.test");
  assert.match(res.body.operatorState.assignedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(db.events[0].payload.action, "assign");
  assert.equal(db.events[0].payload.operatorState.assigneeId, "operator-2");
});

test("follow_up_needed sets followUpNeeded", async () => {
  const { res, db } = await postOperatorAction({
    body: {
      action: "follow_up_needed",
      reasonCode: "needs_callback",
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.operatorState.operatorStatus, "follow_up_needed");
  assert.equal(res.body.operatorState.followUpNeeded, true);
  assert.equal(db.events[0].payload.reasonCode, "needs_callback");
});

test("resolve sets resolved fields", async () => {
  const { res } = await postOperatorAction({
    body: {
      action: "resolve",
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.operatorState.operatorStatus, "resolved");
  assert.equal(res.body.operatorState.resolvedBy, "operator@acme.test");
  assert.match(res.body.operatorState.resolvedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("reopen sets open state without clearing followUpNeeded implicitly", async () => {
  const { res } = await postOperatorAction({
    call: buildVoiceCall({
      meta: {
        operator: {
          followUpNeeded: true,
          operatorStatus: "resolved",
        },
      },
    }),
    body: {
      action: "reopen",
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.operatorState.operatorStatus, "open");
  assert.equal(res.body.operatorState.reopenedBy, "operator@acme.test");
  assert.equal(res.body.operatorState.followUpNeeded, true);
  assert.match(res.body.operatorState.reopenedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("invalid action returns safe 400", async () => {
  const { res, db } = await postOperatorAction({
    body: {
      action: "delete_everything",
    },
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error, "voice_operator_action_invalid");
  assert.equal(res.body.action, "delete_everything");
  assert.ok(res.body.allowedActions.includes("resolve"));
  assert.equal(db.events.length, 0);
  assert.equal(db.tenantScopedUpdates.length, 0);
});

test("tenant-scoped call lookup blocks cross-tenant action", async () => {
  const { res, db } = await postOperatorAction({
    call: buildVoiceCall({
      tenant_id: "tenant-2",
      tenant_key: "other",
    }),
    body: {
      action: "resolve",
    },
  });

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, "voice_call_not_found");
  assert.deepEqual(db.tenantScopedLookups, [
    {
      id: "call-1",
      tenantId: "tenant-1",
    },
  ]);
  assert.equal(db.tenantScopedUpdates.length, 0);
  assert.equal(db.events.length, 0);
});
