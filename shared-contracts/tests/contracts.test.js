import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRealtimeEnvelope,
  validateAihqOutboundAckRequest,
  validateDurableExecutionResponse,
  validateDurableVoiceSyncRequest,
  validateMetaCommentActionResponse,
  validateMetaGatewayOutboundResponse,
  validateVoiceInternalResponse,
  validateVoiceSessionUpsertRequest,
} from "../index.js";

test("realtime envelope validation rejects missing tenant scope", () => {
  const checked = buildRealtimeEnvelope({
    type: "inbox.thread.updated",
    thread: { id: "thread-1" },
  });

  assert.equal(checked.ok, false);
  assert.equal(checked.error, "realtime_tenant_scope_required");
});

test("outbound ack contract requires thread and recipient ids", () => {
  const missingThread = validateAihqOutboundAckRequest({
    recipientId: "user-1",
  });
  assert.equal(missingThread.ok, false);
  assert.equal(missingThread.error, "thread_id_required");

  const valid = validateAihqOutboundAckRequest({
    threadId: "thread-1",
    recipientId: "user-1",
    tenantKey: "acme",
  });
  assert.equal(valid.ok, true);
});

test("voice session upsert contract still enforces tenant and provider call ids", () => {
  const checked = validateVoiceSessionUpsertRequest({
    tenantKey: "acme",
    providerCallSid: "CA123",
  });

  assert.equal(checked.ok, true);
});

test("meta gateway response contract requires explicit ok state", () => {
  const bad = validateMetaGatewayOutboundResponse({});
  assert.equal(bad.ok, false);

  const good = validateMetaGatewayOutboundResponse({ ok: true, result: {} });
  assert.equal(good.ok, true);
});

test("meta comment action response contract requires results array", () => {
  const bad = validateMetaCommentActionResponse({ ok: true });
  assert.equal(bad.ok, false);

  const good = validateMetaCommentActionResponse({ ok: true, results: [] });
  assert.equal(good.ok, true);
});

test("voice internal response contract requires explicit ok state", () => {
  const bad = validateVoiceInternalResponse({});
  assert.equal(bad.ok, false);

  const good = validateVoiceInternalResponse({ ok: true, session: { id: "voice-1" } });
  assert.equal(good.ok, true);
});

test("durable voice sync contract requires a supported action and provider call sid", () => {
  const bad = validateDurableVoiceSyncRequest({
    actionType: "voice.sync.state",
    payload: {},
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, "provider_call_sid_required");

  const good = validateDurableVoiceSyncRequest({
    actionType: "voice.sync.state",
    payload: {
      providerCallSid: "CA123",
      status: "completed",
    },
  });
  assert.equal(good.ok, true);
});

test("durable execution response contract requires an execution id and status", () => {
  const bad = validateDurableExecutionResponse({ ok: true, execution: {} });
  assert.equal(bad.ok, false);

  const good = validateDurableExecutionResponse({
    ok: true,
    execution: {
      id: "exec-1",
      status: "pending",
    },
  });
  assert.equal(good.ok, true);
});
