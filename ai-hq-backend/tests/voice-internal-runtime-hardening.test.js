import test from "node:test";
import assert from "node:assert/strict";

import {
  processVoiceSessionState,
  processVoiceSessionUpsert,
  processVoiceTranscript,
} from "../src/services/voiceInternalRuntime.js";

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

  findCallByProviderSid(providerCallSid = "") {
    return [...this.calls.values()].find(
      (row) => String(row.provider_call_sid || "") === String(providerCallSid || "")
    );
  }

  findSessionByProviderSid(providerCallSid = "") {
    return [...this.sessions.values()].find(
      (row) => String(row.provider_call_sid || "") === String(providerCallSid || "")
    );
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

    if (text.includes("from voice_calls where provider_call_sid = $1")) {
      return { rows: [this.clone(this.findCallByProviderSid(params[0]))].filter(Boolean) };
    }

    if (text.includes("from voice_calls where id = $1")) {
      return { rows: [this.clone(this.calls.get(String(params[0])))].filter(Boolean) };
    }

    if (text.startsWith("insert into voice_calls")) {
      const row = {
        id: params[0],
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
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      this.calls.set(String(row.id), row);
      return { rows: [this.clone(row)] };
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

    if (text.includes("from voice_call_sessions where provider_call_sid = $1")) {
      return {
        rows: [this.clone(this.findSessionByProviderSid(params[0]))].filter(Boolean),
      };
    }

    if (text.includes("from voice_call_sessions where id = $1")) {
      return { rows: [this.clone(this.sessions.get(String(params[0])))].filter(Boolean) };
    }

    if (text.startsWith("insert into voice_call_sessions")) {
      const row = {
        id: params[0],
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
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      this.sessions.set(String(row.id), row);
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
    handoff_requested: false,
    handoff_completed: false,
    handoff_target: null,
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
    requested_department: null,
    resolved_department: null,
    operator_user_id: null,
    operator_name: null,
    operator_join_mode: "live",
    bot_active: false,
    operator_join_requested: false,
    operator_joined: false,
    whisper_active: false,
    takeover_active: false,
    lead_payload: {},
    transcript_live: [
      {
        ts: "2026-03-30T01:01:00.000Z",
        role: "customer",
        text: "hello",
      },
    ],
    summary: "Completed cleanly",
    meta: {},
    started_at: "2026-03-30T01:00:00.000Z",
    operator_requested_at: null,
    operator_joined_at: null,
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
    requested_department: null,
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

test("voice session state rejects terminal regression and records a rejection event", async () => {
  const db = new FakeVoiceDb();
  seedTerminalVoiceRows(db);

  const result = await processVoiceSessionState({
    db,
    providerCallSid: "CA123",
    body: {
      status: "bot_active",
      eventType: "session_resumed",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 409);
  assert.equal(result.error, "voice_session_state_conflict");
  assert.equal(result.details?.reasonCode, "terminal_state_regression");
  assert.equal(db.sessions.get("session-1")?.status, "completed");
  assert.equal(db.calls.get("call-1")?.status, "completed");
  assert.equal(db.events.at(-1)?.event_type, "session_state_rejected");
  assert.equal(db.events.at(-1)?.payload?.requestedStatus, "bot_active");
});

test("voice transcript replay is idempotent and does not duplicate persisted truth", async () => {
  const db = new FakeVoiceDb();
  seedTerminalVoiceRows(db);

  const result = await processVoiceTranscript({
    db,
    providerCallSid: "CA123",
    role: "customer",
    text: "hello",
    ts: "2026-03-30T01:01:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.payload?.appliedGuards, ["duplicate_transcript_ignored"]);
  assert.equal(result.payload?.session?.transcriptLive?.length, 1);
  assert.equal(result.payload?.call?.transcript, "[customer] hello");
  assert.equal(db.events.at(-1)?.event_type, "transcript_ignored");
  assert.equal(db.events.at(-1)?.payload?.reasonCode, "duplicate_transcript_frame");
});

test("voice upsert preserves terminal statuses while still accepting late summary enrichment", async () => {
  const db = new FakeVoiceDb();
  seedTerminalVoiceRows(db);

  const result = await processVoiceSessionUpsert({
    db,
    body: {
      tenantId: "tenant-1",
      tenantKey: "acme",
      providerCallSid: "CA123",
      callStatus: "in_progress",
      sessionStatus: "bot_active",
      summary: "Final operator summary",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.payload?.call?.status, "completed");
  assert.equal(result.payload?.session?.status, "completed");
  assert.equal(result.payload?.session?.botActive, false);
  assert.equal(result.payload?.call?.summary, "Final operator summary");
  assert.equal(result.payload?.session?.summary, "Final operator summary");
  assert.deepEqual(result.payload?.appliedGuards, [
    "call_terminal_status_preserved",
    "session_terminal_status_preserved",
  ]);
  assert.deepEqual(db.events.at(-1)?.payload?.appliedGuards, [
    "call_terminal_status_preserved",
    "session_terminal_status_preserved",
  ]);
});

test("applied internal voice mutations persist durable events and emit operator realtime", async () => {
  const db = new FakeVoiceDb();
  seedActiveVoiceRows(db);
  const sent = [];

  const result = await processVoiceSessionState({
    db,
    wsHub: {
      broadcast(payload) {
        sent.push(payload);
        return true;
      },
    },
    providerCallSid: "CA456",
    body: {
      status: "completed",
      eventType: "session_completed",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(db.sessions.get("session-2")?.status, "completed");
  assert.equal(db.events.at(-1)?.event_type, "session_completed");
  assert.equal(db.events.at(-1)?.payload?.mutationOutcome, "applied");
  assert.equal(sent.length, 2);
  assert.equal(sent[0]?.type, "voice.call.updated");
  assert.equal(sent[0]?.audience, "operator");
  assert.equal(sent[0]?.tenantKey, "acme");
  assert.equal(sent[0]?.mutationOutcome, "applied");
  assert.equal(sent[1]?.type, "voice.event.created");
  assert.equal(sent[1]?.event?.eventType, "session_completed");
});

test("ignored internal voice mutations emit durable ignored truth and realtime", async () => {
  const db = new FakeVoiceDb();
  seedTerminalVoiceRows(db);
  const sent = [];

  const result = await processVoiceTranscript({
    db,
    wsHub: {
      broadcast(payload) {
        sent.push(payload);
        return true;
      },
    },
    providerCallSid: "CA123",
    role: "customer",
    text: "hello",
    ts: "2026-03-30T01:01:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.equal(db.events.at(-1)?.event_type, "transcript_ignored");
  assert.equal(db.events.at(-1)?.payload?.mutationOutcome, "ignored");
  assert.equal(sent.length, 2);
  assert.equal(sent[0]?.mutationOutcome, "ignored");
  assert.equal(sent[1]?.event?.eventType, "transcript_ignored");
});

test("rejected internal voice mutations emit durable rejected truth and realtime", async () => {
  const db = new FakeVoiceDb();
  seedTerminalVoiceRows(db);
  const sent = [];

  const result = await processVoiceSessionState({
    db,
    wsHub: {
      broadcast(payload) {
        sent.push(payload);
        return true;
      },
    },
    providerCallSid: "CA123",
    body: {
      status: "bot_active",
      eventType: "session_resumed",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 409);
  assert.equal(db.events.at(-1)?.event_type, "session_state_rejected");
  assert.equal(db.events.at(-1)?.payload?.mutationOutcome, "rejected");
  assert.equal(sent.length, 2);
  assert.equal(sent[0]?.mutationOutcome, "rejected");
  assert.equal(sent[1]?.event?.eventType, "session_state_rejected");
});

test("voice mutation rolls back persisted truth when event recording fails", async () => {
  const db = new FakeVoiceDb();
  seedActiveVoiceRows(db);
  db.failOnInsertEvent = true;
  const sent = [];

  await assert.rejects(
    () =>
      processVoiceSessionState({
        db,
        wsHub: {
          broadcast(payload) {
            sent.push(payload);
            return true;
          },
        },
        providerCallSid: "CA456",
        body: {
          status: "completed",
          eventType: "session_completed",
        },
      }),
    /voice_call_events_insert_failed|voice_event_record_failed/
  );

  assert.equal(db.sessions.get("session-2")?.status, "bot_active");
  assert.equal(db.calls.get("call-2")?.status, "in_progress");
  assert.equal(db.events.length, 0);
  assert.equal(sent.length, 0);
});
