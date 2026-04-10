import test from "node:test";
import assert from "node:assert/strict";

import { voiceRoutes } from "../src/routes/api/voice/public.js";

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

function buildApprovedRuntime() {
  return {
    tenant: {
      tenantId: "tenant-1",
      tenant_id: "tenant-1",
      tenantKey: "acme",
      tenant_key: "acme",
      mainLanguage: "en",
    },
    authority: {
      mode: "strict",
      source: "approved_runtime_projection",
      available: true,
      runtimeProjectionId: "projection-1",
      projectionHash: "hash-1",
      truthVersionId: "truth-v1",
      tenantId: "tenant-1",
      tenantKey: "acme",
    },
    behavior: {
      conversionGoal: "answer_and_route",
      primaryCta: "book_consult",
      toneProfile: "warm_confident",
      handoffTriggers: ["pricing"],
      qualificationQuestions: ["Which service do you need?"],
      channelBehavior: {
        voice: {
          handoffBias: "conditional",
          qualificationDepth: "guided",
        },
      },
    },
    aiPolicy: {
      autoReplyEnabled: true,
      createLeadEnabled: true,
      handoffEnabled: true,
    },
  };
}

async function getApprovedRuntime() {
  return clone(buildApprovedRuntime());
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeSql(sql = "") {
  return String(sql).trim().toLowerCase().replace(/\s+/g, " ");
}

class FakeVoiceDb {
  constructor() {
    this.calls = new Map();
    this.sessions = new Map();
    this.events = [];
    this.txSnapshot = null;
    this.failOnInsertEvent = false;
  }

  clone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
  }

  seedCall(row = {}) {
    this.calls.set(String(row.id), this.clone(row));
  }

  seedSession(row = {}) {
    this.sessions.set(String(row.id), this.clone(row));
  }

  async connect() {
    return this;
  }

  release() {}

  async query(sql, params = []) {
    const text = normalizeSql(sql);

    if (text === "begin") {
      this.txSnapshot = {
        calls: this.clone([...this.calls.entries()]),
        sessions: this.clone([...this.sessions.entries()]),
        events: this.clone(this.events),
      };
      return { rows: [] };
    }

    if (text === "commit") {
      this.txSnapshot = null;
      return { rows: [] };
    }

    if (text === "rollback") {
      if (this.txSnapshot) {
        this.calls = new Map(this.txSnapshot.calls);
        this.sessions = new Map(this.txSnapshot.sessions);
        this.events = this.txSnapshot.events;
        this.txSnapshot = null;
      }
      return { rows: [] };
    }

    if (text.includes("from voice_calls where id = $1")) {
      return { rows: [this.clone(this.calls.get(String(params[0])))].filter(Boolean) };
    }

    if (text.includes("from voice_call_sessions where id = $1")) {
      return { rows: [this.clone(this.sessions.get(String(params[0])))].filter(Boolean) };
    }

    if (text.includes("from voice_call_events") && text.includes("where call_id = $1")) {
      return {
        rows: this.events
          .filter((row) => String(row.call_id) === String(params[0]))
          .map((row) => this.clone(row)),
      };
    }

    if (text.startsWith("update voice_calls set")) {
      const current = this.calls.get(String(params[0]));
      if (!current) return { rows: [] };
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
      this.calls.set(String(row.id), row);
      return { rows: [this.clone(row)] };
    }

    if (text.startsWith("update voice_call_sessions set")) {
      const current = this.sessions.get(String(params[0]));
      if (!current) return { rows: [] };
      const row = {
        ...current,
        tenant_id: params[1],
        tenant_key: params[2],
        voice_call_id: params[3],
        provider: params[4],
        provider_call_sid: params[5],
        provider_conference_sid: params[6],
        conference_name: params[7],
        customer_number: params[8],
        customer_name: params[9],
        direction: params[10],
        status: params[11],
        requested_department: params[12],
        resolved_department: params[13],
        operator_user_id: params[14],
        operator_name: params[15],
        operator_join_mode: params[16],
        bot_active: params[17],
        operator_join_requested: params[18],
        operator_joined: params[19],
        whisper_active: params[20],
        takeover_active: params[21],
        lead_payload: JSON.parse(params[22]),
        transcript_live: JSON.parse(params[23]),
        summary: params[24],
        meta: JSON.parse(params[25]),
        started_at: params[26],
        operator_requested_at: params[27],
        operator_joined_at: params[28],
        ended_at: params[29],
        updated_at: nowIso(),
      };
      this.sessions.set(String(row.id), row);
      return { rows: [this.clone(row)] };
    }

    if (text.startsWith("insert into voice_call_events")) {
      if (this.failOnInsertEvent) {
        throw new Error("voice_call_events_insert_failed");
      }
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
      this.events.push(row);
      return { rows: [this.clone(row)] };
    }

    throw new Error(`Unhandled SQL in FakeVoiceDb: ${text}`);
  }
}

function seedTerminalVoiceRows(db) {
  db.seedCall({
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
    answered_at: "2026-03-30T01:00:05.000Z",
    ended_at: "2026-03-30T01:10:00.000Z",
    duration_seconds: 595,
    language: "en",
    agent_mode: "assistant",
    handoff_requested: true,
    handoff_completed: true,
    handoff_target: "sales",
    callback_requested: false,
    callback_phone: null,
    lead_id: null,
    inbox_thread_id: null,
    transcript: "[customer] hello",
    summary: "Completed cleanly",
    outcome: "unknown",
    intent: null,
    sentiment: null,
    cost_amount: 0,
    cost_currency: "USD",
    metrics: {},
    extraction: {},
    meta: {},
    created_at: "2026-03-30T01:00:00.000Z",
    updated_at: "2026-03-30T01:10:00.000Z",
  });

  db.seedSession({
    id: "session-1",
    tenant_id: "tenant-1",
    tenant_key: "acme",
    voice_call_id: "call-1",
    provider: "twilio",
    provider_call_sid: "CA123",
    provider_conference_sid: null,
    conference_name: "acme:CA123",
    customer_number: "+15550000001",
    customer_name: "Customer",
    direction: "inbound",
    status: "completed",
    requested_department: "sales",
    resolved_department: "sales",
    operator_user_id: "operator-1",
    operator_name: "Op One",
    operator_join_mode: "live",
    bot_active: false,
    operator_join_requested: true,
    operator_joined: true,
    whisper_active: false,
    takeover_active: false,
    lead_payload: {},
    transcript_live: [],
    summary: "Completed cleanly",
    meta: {},
    started_at: "2026-03-30T01:00:00.000Z",
    operator_requested_at: "2026-03-30T01:02:00.000Z",
    operator_joined_at: "2026-03-30T01:03:00.000Z",
    ended_at: "2026-03-30T01:10:00.000Z",
    created_at: "2026-03-30T01:00:00.000Z",
    updated_at: "2026-03-30T01:10:00.000Z",
  });
}

function seedActiveVoiceRows(db) {
  db.seedCall({
    id: "call-2",
    tenant_id: "tenant-1",
    tenant_key: "acme",
    provider: "twilio",
    provider_call_sid: "CA456",
    provider_stream_sid: null,
    direction: "inbound",
    status: "in_progress",
    from_number: "+15550000009",
    to_number: "+15550000002",
    caller_name: "Caller",
    started_at: "2026-03-30T02:00:00.000Z",
    answered_at: "2026-03-30T02:00:03.000Z",
    ended_at: null,
    duration_seconds: 120,
    language: "en",
    agent_mode: "assistant",
    handoff_requested: false,
    handoff_completed: false,
    handoff_target: null,
    callback_requested: false,
    callback_phone: null,
    lead_id: null,
    inbox_thread_id: null,
    transcript: "",
    summary: "",
    outcome: "unknown",
    intent: null,
    sentiment: null,
    cost_amount: 0,
    cost_currency: "USD",
    metrics: {},
    extraction: {},
    meta: {},
    created_at: "2026-03-30T02:00:00.000Z",
    updated_at: "2026-03-30T02:02:00.000Z",
  });

  db.seedSession({
    id: "session-2",
    tenant_id: "tenant-1",
    tenant_key: "acme",
    voice_call_id: "call-2",
    provider: "twilio",
    provider_call_sid: "CA456",
    provider_conference_sid: null,
    conference_name: "acme:CA456",
    customer_number: "+15550000009",
    customer_name: "Caller",
    direction: "inbound",
    status: "bot_active",
    requested_department: "support",
    resolved_department: null,
    operator_user_id: null,
    operator_name: null,
    operator_join_mode: "live",
    bot_active: true,
    operator_join_requested: false,
    operator_joined: false,
    whisper_active: false,
    takeover_active: false,
    lead_payload: {},
    transcript_live: [],
    summary: "",
    meta: {},
    started_at: "2026-03-30T02:00:00.000Z",
    operator_requested_at: null,
    operator_joined_at: null,
    ended_at: null,
    created_at: "2026-03-30T02:00:00.000Z",
    updated_at: "2026-03-30T02:02:00.000Z",
  });
}

function createMockRes(onFinish) {
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

function buildAuth(role = "member") {
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

test("voice settings mutation denies tenant members", async () => {
  const router = voiceRoutes({ db: null, dbDisabled: false, audit: null });
  const result = await invokeRouter(router, "post", "/voice/settings", {
    ...buildAuth("member"),
    body: { enabled: true },
  });

  assert.equal(result.res.statusCode, 403);
});

test("voice call join mutation denies tenant members", async () => {
  const router = voiceRoutes({ db: null, dbDisabled: false, audit: null });
  const result = await invokeRouter(router, "post", "/voice/calls/call-1/join", {
    ...buildAuth("member"),
    body: { sessionId: "session-1" },
  });

  assert.equal(result.res.statusCode, 403);
});

test("voice mutations allow operator roles through authorization guard", async () => {
  const router = voiceRoutes({ db: null, dbDisabled: false, audit: null });

  const settingsResult = await invokeRouter(router, "post", "/voice/settings", {
    ...buildAuth("operator"),
    body: { enabled: true },
  });
  assert.equal(settingsResult.res.statusCode, 503);

  const joinResult = await invokeRouter(router, "post", "/voice/calls/call-1/join", {
    ...buildAuth("admin"),
    body: { sessionId: "session-1" },
  });
  assert.equal(joinResult.res.statusCode, 503);
});

test("voice public routes log structured failures through request logger", async () => {
  const entries = [];
  const requestLogger = {
    child(extra = {}) {
      return {
        ...this,
        extra,
      };
    },
    error(event, error, data = {}) {
      entries.push({
        event,
        error: String(error?.message || error),
        data,
      });
    },
  };

  const router = voiceRoutes({
    db: {
      async query() {
        throw new Error("db exploded");
      },
    },
    dbDisabled: false,
    audit: null,
  });

  const result = await invokeRouter(router, "get", "/voice/settings", {
    ...buildAuth("operator"),
    log: requestLogger,
  });

  assert.equal(result.res.statusCode, 500);
  assert.equal(result.res.body?.error, "voice_settings_read_failed");
  assert.equal(entries[0]?.event, "voice.settings.get.failed");
  assert.equal(entries[0]?.error, "db exploded");
});

test("voice call join persists durable event truth and emits operator realtime", async () => {
  const db = new FakeVoiceDb();
  seedActiveVoiceRows(db);
  const sent = [];
  const router = voiceRoutes({
    db,
    audit: null,
    getRuntime: getApprovedRuntime,
    wsHub: {
      broadcast(payload) {
        sent.push(payload);
        return true;
      },
    },
  });

  const result = await invokeRouter(router, "post", "/voice/calls/call-2/join", {
    ...buildAuth("operator"),
    body: {
      sessionId: "session-2",
      joinMode: "live",
      operatorName: "Alice",
      operatorUserId: "user-42",
    },
  });

  assert.equal(result.res.statusCode, 200);
  assert.equal(result.res.body?.ok, true);
  assert.equal(result.res.body?.mutationOutcome, "applied");
  assert.equal(result.res.body?.session?.status, "agent_live");
  assert.equal(db.sessions.get("session-2")?.status, "agent_live");
  assert.equal(db.calls.get("call-2")?.handoff_completed, true);
  assert.equal(db.calls.get("call-2")?.agent_mode, "human");
  assert.equal(db.events.at(-1)?.event_type, "operator_joined");
  assert.equal(db.events.at(-1)?.payload?.mutationOutcome, "applied");
  assert.equal(
    db.events.at(-1)?.payload?.replayTrace?.runtimeRef?.approvedRuntime,
    true
  );
  assert.equal(
    db.events.at(-1)?.payload?.replayTrace?.runtimeRef?.truthVersionId,
    "truth-v1"
  );
  assert.equal(
    db.events.at(-1)?.payload?.replayTrace?.decisionPath?.status,
    "escalated_to_operator"
  );
  assert.equal(sent.length, 2);
  assert.equal(sent[0]?.type, "voice.call.updated");
  assert.equal(sent[0]?.audience, "operator");
  assert.equal(sent[0]?.mutationOutcome, "applied");
  assert.equal(sent[1]?.type, "voice.event.created");
  assert.equal(sent[1]?.event?.eventType, "operator_joined");
});

test("voice handoff request rejects terminal regression and records rejected truth", async () => {
  const db = new FakeVoiceDb();
  seedTerminalVoiceRows(db);
  const sent = [];
  const router = voiceRoutes({
    db,
    audit: null,
    getRuntime: getApprovedRuntime,
    wsHub: {
      broadcast(payload) {
        sent.push(payload);
        return true;
      },
    },
  });

  const result = await invokeRouter(router, "post", "/voice/live/session-1/request-handoff", {
    ...buildAuth("operator"),
    body: {
      joinMode: "live",
      operatorName: "Alice",
    },
  });

  assert.equal(result.res.statusCode, 409);
  assert.equal(result.res.body?.error, "voice_session_state_conflict");
  assert.equal(result.res.body?.mutationOutcome, "rejected");
  assert.equal(db.sessions.get("session-1")?.status, "completed");
  assert.equal(db.calls.get("call-1")?.status, "completed");
  assert.equal(db.events.at(-1)?.event_type, "operator_handoff_request_rejected");
  assert.equal(db.events.at(-1)?.payload?.mutationOutcome, "rejected");
  assert.equal(db.events.at(-1)?.payload?.requestedStatus, "agent_ringing");
  assert.equal(
    db.events.at(-1)?.payload?.replayTrace?.decisionPath?.status,
    "refused"
  );
  assert.equal(
    db.events.at(-1)?.payload?.replayTrace?.decisionPath?.reasonCode,
    "terminal_state_regression"
  );
  assert.equal(sent.length, 2);
  assert.equal(sent[0]?.mutationOutcome, "rejected");
  assert.equal(sent[1]?.event?.eventType, "operator_handoff_request_rejected");
});

test("voice end ignores already terminal truth without rewriting the session", async () => {
  const db = new FakeVoiceDb();
  seedTerminalVoiceRows(db);
  const sent = [];
  const router = voiceRoutes({
    db,
    audit: null,
    getRuntime: getApprovedRuntime,
    wsHub: {
      broadcast(payload) {
        sent.push(payload);
        return true;
      },
    },
  });
  const originalEndedAt = db.sessions.get("session-1")?.ended_at;

  const result = await invokeRouter(router, "post", "/voice/live/session-1/end", {
    ...buildAuth("operator"),
  });

  assert.equal(result.res.statusCode, 200);
  assert.equal(result.res.body?.mutationOutcome, "ignored");
  assert.equal(result.res.body?.session?.status, "completed");
  assert.equal(db.sessions.get("session-1")?.ended_at, originalEndedAt);
  assert.equal(db.calls.get("call-1")?.ended_at, "2026-03-30T01:10:00.000Z");
  assert.equal(db.events.at(-1)?.event_type, "session_end_ignored");
  assert.equal(db.events.at(-1)?.payload?.mutationOutcome, "ignored");
  assert.equal(db.events.at(-1)?.payload?.reasonCode, "already_terminal");
  assert.equal(
    db.events.at(-1)?.payload?.replayTrace?.decisionPath?.status,
    "no_reply"
  );
  assert.equal(sent.length, 2);
  assert.equal(sent[0]?.mutationOutcome, "ignored");
  assert.equal(sent[1]?.event?.eventType, "session_end_ignored");
});

test("voice events read endpoint exposes unified operator inspect shape", async () => {
  const db = new FakeVoiceDb();
  seedActiveVoiceRows(db);
  const router = voiceRoutes({
    db,
    audit: null,
    getRuntime: getApprovedRuntime,
  });

  const joinResult = await invokeRouter(router, "post", "/voice/calls/call-2/join", {
    ...buildAuth("operator"),
    body: {
      sessionId: "session-2",
      joinMode: "live",
      operatorName: "Alice",
      operatorUserId: "user-42",
    },
  });
  assert.equal(joinResult.res.statusCode, 200);

  const readResult = await invokeRouter(router, "get", "/voice/calls/call-2/events", {
    ...buildAuth("operator"),
  });

  assert.equal(readResult.res.statusCode, 200);
  assert.equal(readResult.res.body?.events?.length, 1);
  assert.equal(readResult.res.body?.inspect?.schema, "operator_replay_inspect.v1");
  assert.equal(readResult.res.body?.inspect?.channel, "voice");
  assert.equal(readResult.res.body?.inspect?.authority?.approvedRuntime, true);
  assert.equal(
    readResult.res.body?.events?.[0]?.inspect?.decision?.status,
    "escalated_to_operator"
  );
  assert.equal(
    readResult.res.body?.events?.[0]?.inspect?.summary?.operatorJoinMode,
    "live"
  );
});

test("voice public mutation rolls back when durable event recording fails", async () => {
  const db = new FakeVoiceDb();
  seedActiveVoiceRows(db);
  db.failOnInsertEvent = true;
  const sent = [];
  const router = voiceRoutes({
    db,
    audit: null,
    wsHub: {
      broadcast(payload) {
        sent.push(payload);
        return true;
      },
    },
  });

  const result = await invokeRouter(router, "post", "/voice/live/session-2/takeover", {
    ...buildAuth("admin"),
  });

  assert.equal(result.res.statusCode, 500);
  assert.equal(result.res.body?.error, "voice_takeover_failed");
  assert.equal(db.sessions.get("session-2")?.status, "bot_active");
  assert.equal(db.calls.get("call-2")?.agent_mode, "assistant");
  assert.equal(db.events.length, 0);
  assert.equal(sent.length, 0);
});
