import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { attachRealtimeBridge, __test__ } from "../src/services/realtimeBridge.js";
import { listRuntimeSignals, resetRuntimeMetrics } from "../src/services/runtimeObservability.js";

function waitForTick() {
  return new Promise((resolve) => setImmediate(resolve));
}

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function shutdownBridgeSockets(twilioWs = null) {
  if (twilioWs && twilioWs.readyState === FakeSocket.OPEN) {
    twilioWs.close();
    await waitForTick();
  }

  for (const socket of FakeSocket.instances) {
    if (socket.readyState === FakeSocket.OPEN) {
      socket.close();
      await waitForTick();
    }
  }

  for (const socket of FakeOpenAIWebSocket.instances) {
    if (socket.readyState === FakeSocket.OPEN) {
      socket.close();
      await waitForTick();
    }
  }
}

function buildTenantConfig() {
  return {
    tenantKey: "acme",
    authority: {
      available: true,
      runtimeProjectionId: "projection-1",
    },
    realtime: {
      model: "gpt-4o-realtime-preview",
      voice: "alloy",
      instructions: "Stay on script.",
    },
    voiceProfile: {
      defaultLanguage: "en",
      companyName: "Acme",
      assistantName: "Acme Assistant",
      roleLabel: "assistant",
      purpose: "support",
      tone: "professional",
      answerStyle: "short_clear",
      askStyle: "single_question",
      businessSummary: "Acme support line",
      allowedTopics: [],
      forbiddenTopics: [],
      leadCaptureMode: "none",
      transferMode: "manual",
      contactPolicy: {
        sharePhone: false,
        shareEmail: false,
        shareWebsite: false,
      },
      texts: {
        greeting: {},
      },
    },
    operatorRouting: {
      mode: "manual",
      departments: {},
    },
    contact: {},
  };
}

function buildTransferTenantConfig() {
  return {
    ...buildTenantConfig(),
    voiceProfile: {
      ...buildTenantConfig().voiceProfile,
      transferMode: "department",
    },
    operatorRouting: {
      mode: "department",
      defaultDepartment: "sales",
      departments: {
        sales: {
          enabled: true,
          label: "Sales",
          phone: "+15551234567",
          keywords: ["sales", "agent", "human"],
        },
      },
    },
  };
}

class FakeWss extends EventEmitter {}

class FakeSocket extends EventEmitter {
  static OPEN = 1;
  static CLOSED = 3;
  static instances = [];

  constructor() {
    super();
    this.readyState = FakeSocket.OPEN;
    this.sent = [];
    this.closeCalls = 0;
    FakeSocket.instances.push(this);
  }

  send(payload) {
    this.sent.push(payload);
  }

  close(code = 1000, reason = "") {
    if (this.readyState === FakeSocket.CLOSED) return;
    this.readyState = FakeSocket.CLOSED;
    this.closeCalls += 1;
    queueMicrotask(() => {
      this.emit("close", code, Buffer.from(String(reason || ""), "utf8"));
    });
  }
}

class FakeOpenAIWebSocket extends FakeSocket {
  static instances = [];

  constructor(url, options = {}) {
    super();
    this.url = url;
    this.options = options;
    FakeOpenAIWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.emit("open");
    });
  }

  static reset() {
    FakeOpenAIWebSocket.instances.length = 0;
  }
}

test.afterEach(async () => {
  await shutdownBridgeSockets();
  FakeOpenAIWebSocket.reset();
  FakeSocket.instances.length = 0;
  resetRuntimeMetrics();
});

function createVoiceClientRecorder() {
  const calls = {
    upsertSession: [],
    updateSessionState: [],
    appendTranscript: [],
    markOperatorJoin: [],
  };

  return {
    calls,
    canUse() {
      return true;
    },
    async upsertSession(payload) {
      calls.upsertSession.push(payload);
      return { ok: true };
    },
    async updateSessionState(payload) {
      calls.updateSessionState.push(payload);
      return { ok: true };
    },
    async appendTranscript(payload) {
      calls.appendTranscript.push(payload);
      return { ok: true };
    },
    async markOperatorJoin(payload) {
      calls.markOperatorJoin.push(payload);
      return { ok: true };
    },
  };
}

function createAttachedBridge({
  resolveTenantConfig,
  reporters,
  voiceClient,
  twilioClient = null,
  OPENAI_API_KEY = "openai-key",
  RECONNECT_MAX = 0,
} = {}) {
  const wss = new FakeWss();

  attachRealtimeBridge({
    wss,
    OPENAI_API_KEY,
    DEBUG_REALTIME: false,
    PUBLIC_BASE_URL: "https://voice.example.test",
    reporters,
    twilioClient,
    REALTIME_MODEL: "gpt-4o-realtime-preview",
    REALTIME_VOICE: "alloy",
    RECONNECT_MAX,
    WebSocketImpl: FakeOpenAIWebSocket,
    resolveTenantConfig,
    voiceClient,
  });

  return wss;
}

function createTwilioClientRecorder() {
  const updates = [];

  return {
    updates,
    calls(callSid) {
      return {
        async update(payload) {
          updates.push({
            callSid,
            ...payload,
          });
          return { sid: callSid, ...payload };
        },
      };
    },
  };
}

async function startInboundStream(wss, twilioWs, {
  streamSid = "MZ100",
  callSid = "CA100",
  from = "+15550000001",
  to = "+15550000002",
  tenantKey = "acme",
} = {}) {
  wss.emit("connection", twilioWs, { headers: {}, url: "/twilio/stream" });
  twilioWs.emit(
    "message",
    Buffer.from(
      JSON.stringify({
        event: "start",
        start: {
          streamSid,
          callSid,
          customParameters: {
            From: from,
            To: to,
            TenantKey: tenantKey,
          },
        },
      }),
      "utf8"
    )
  );

  await waitForTick();
  return FakeOpenAIWebSocket.instances.at(-1);
}

async function markRealtimeSessionReady(openaiWs) {
  openaiWs.emit(
    "message",
    Buffer.from(JSON.stringify({ type: "session.created" }), "utf8")
  );
  await waitForTick();
  await waitMs(260);
  openaiWs.emit(
    "message",
    Buffer.from(JSON.stringify({ type: "response.done" }), "utf8")
  );
  await waitForTick();
}

async function sendTranscriptTurn(openaiWs, text) {
  openaiWs.emit(
    "message",
    Buffer.from(
      JSON.stringify({ type: "input_audio_buffer.speech_started" }),
      "utf8"
    )
  );
  openaiWs.emit(
    "message",
    Buffer.from(
      JSON.stringify({
        type: "input_audio_transcription.completed",
        transcript: text,
      }),
      "utf8"
    )
  );
  openaiWs.emit(
    "message",
    Buffer.from(
      JSON.stringify({ type: "input_audio_buffer.speech_stopped" }),
      "utf8"
    )
  );

  await waitMs(320);
  await waitForTick();
}

test("bridge tenant bootstrap normalization fails closed without authoritative config", () => {
  const blocked = __test__.normalizeBridgeTenantConfigResult({
    ok: false,
    error: "runtime_authority_unavailable",
    status: 503,
    authority: {
      reasonCode: "runtime_projection_missing",
    },
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, "runtime_authority_unavailable");

  const resolved = __test__.normalizeBridgeTenantConfigResult({
    ok: true,
    config: buildTenantConfig(),
  });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.config.tenantKey, "acme");
});

test("bridge fails closed before realtime connect when tenant config is unavailable", async () => {
  resetRuntimeMetrics();
  FakeOpenAIWebSocket.reset();
  const reporters = {
    statuses: [],
    async sendReports(_ctx, meta = {}) {
      this.statuses.push(meta.status);
    },
  };
  const voiceClient = createVoiceClientRecorder();
  const wss = createAttachedBridge({
    resolveTenantConfig: async () => ({
      ok: false,
      error: "runtime_authority_unavailable",
      status: 503,
      authority: {
        reasonCode: "runtime_projection_missing",
      },
    }),
    reporters,
    voiceClient,
  });
  const twilioWs = new FakeSocket();

  wss.emit("connection", twilioWs, { headers: {}, url: "/twilio/stream" });
  twilioWs.emit(
    "message",
    Buffer.from(
      JSON.stringify({
        event: "start",
        start: {
          streamSid: "MZ123",
          callSid: "CA123",
          customParameters: {
            From: "+15550000001",
            To: "+15550000002",
            TenantKey: "acme",
          },
        },
      }),
      "utf8"
    )
  );

  await waitForTick();
  await waitForTick();

  assert.equal(FakeOpenAIWebSocket.instances.length, 0);
  assert.equal(reporters.statuses.length, 1);
  assert.equal(reporters.statuses[0], "failed");
  assert.equal(voiceClient.calls.upsertSession.length, 1);
  assert.equal(voiceClient.calls.updateSessionState.length, 1);
  assert.equal(
    voiceClient.calls.updateSessionState[0]?.eventType,
    "call_failed_tenant_config_unavailable"
  );
  assert.equal(voiceClient.calls.updateSessionState[0]?.status, "failed");
  assert.equal(voiceClient.calls.upsertSession[0]?.outcome, "failed");
  await shutdownBridgeSockets(twilioWs);
});

test("bridge reports twilio websocket errors as failed, not completed", async () => {
  resetRuntimeMetrics();
  FakeOpenAIWebSocket.reset();
  const reporters = {
    statuses: [],
    async sendReports(_ctx, meta = {}) {
      this.statuses.push(meta.status);
    },
  };
  const voiceClient = createVoiceClientRecorder();
  const wss = createAttachedBridge({
    resolveTenantConfig: async () => ({
      ok: true,
      config: buildTenantConfig(),
    }),
    reporters,
    voiceClient,
  });
  const twilioWs = new FakeSocket();

  wss.emit("connection", twilioWs, { headers: {}, url: "/twilio/stream" });
  twilioWs.emit(
    "message",
    Buffer.from(
      JSON.stringify({
        event: "start",
        start: {
          streamSid: "MZ456",
          callSid: "CA456",
          customParameters: {
            From: "+15550000003",
            To: "+15550000004",
            TenantKey: "acme",
          },
        },
      }),
      "utf8"
    )
  );

  await waitForTick();
  twilioWs.emit("error", new Error("socket exploded"));
  await waitForTick();
  await waitForTick();

  assert.equal(reporters.statuses.length, 1);
  assert.equal(reporters.statuses[0], "failed");
  assert.equal(
    voiceClient.calls.updateSessionState.at(-1)?.eventType,
    "twilio_ws_error"
  );
  assert.equal(voiceClient.calls.updateSessionState.at(-1)?.status, "failed");
  await shutdownBridgeSockets(twilioWs);
});

test("bridge finalizes only once when twilio stop is followed by websocket close", async () => {
  resetRuntimeMetrics();
  FakeOpenAIWebSocket.reset();
  const reporters = {
    statuses: [],
    async sendReports(_ctx, meta = {}) {
      this.statuses.push(meta.status);
    },
  };
  const voiceClient = createVoiceClientRecorder();
  const wss = createAttachedBridge({
    resolveTenantConfig: async () => ({
      ok: true,
      config: buildTenantConfig(),
    }),
    reporters,
    voiceClient,
  });
  const twilioWs = new FakeSocket();

  wss.emit("connection", twilioWs, { headers: {}, url: "/twilio/stream" });
  twilioWs.emit(
    "message",
    Buffer.from(
      JSON.stringify({
        event: "start",
        start: {
          streamSid: "MZ789",
          callSid: "CA789",
          customParameters: {
            From: "+15550000005",
            To: "+15550000006",
            TenantKey: "acme",
          },
        },
      }),
      "utf8"
    )
  );

  await waitForTick();
  twilioWs.emit("message", Buffer.from(JSON.stringify({ event: "stop" }), "utf8"));
  await waitForTick();
  await waitForTick();

  assert.deepEqual(reporters.statuses, ["completed"]);
  assert.equal(
    voiceClient.calls.updateSessionState.at(-1)?.eventType,
    "caller_hangup_completed"
  );
  assert.equal(voiceClient.calls.updateSessionState.at(-1)?.status, "completed");
  assert.equal(
    voiceClient.calls.upsertSession.at(-1)?.meta?.terminalOutcomeClass,
    "caller_hangup"
  );
  await shutdownBridgeSockets(twilioWs);
});

test("bridge persists local forced completion distinctly from caller hangup", async () => {
  resetRuntimeMetrics();
  FakeOpenAIWebSocket.reset();
  const reporters = {
    statuses: [],
    async sendReports(_ctx, meta = {}) {
      this.statuses.push(meta.status);
    },
  };
  const voiceClient = createVoiceClientRecorder();
  const wss = createAttachedBridge({
    resolveTenantConfig: async () => ({
      ok: true,
      config: buildTenantConfig(),
    }),
    reporters,
    voiceClient,
  });
  const twilioWs = new FakeSocket();
  const openaiWs = await startInboundStream(wss, twilioWs, {
    streamSid: "MZ910",
    callSid: "CA910",
  });

  await markRealtimeSessionReady(openaiWs);
  await sendTranscriptTurn(openaiWs, "goodbye");
  openaiWs.emit(
    "message",
    Buffer.from(JSON.stringify({ type: "response.done" }), "utf8")
  );
  await waitForTick();
  await waitForTick();

  assert.deepEqual(reporters.statuses, ["completed"]);
  assert.equal(
    voiceClient.calls.updateSessionState.at(-1)?.eventType,
    "call_completed_local_hangup"
  );
  assert.equal(
    voiceClient.calls.upsertSession.at(-1)?.meta?.terminalOutcomeClass,
    "local_forced_completion"
  );
  assert.equal(voiceClient.calls.upsertSession.at(-1)?.outcome, "unknown");
  await shutdownBridgeSockets(twilioWs);
});

test("terminal disposition marks transfer handoff completion distinctly", () => {
  const closeOutcome = __test__.deriveTwilioCloseOutcome({
    transferHandoffCompleted: true,
  });
  assert.equal(closeOutcome.eventType, "call_handoff_completed");
  assert.equal(closeOutcome.reasonCode, "transfer_handoff_completed");

  const disposition = __test__.buildTerminalDisposition({
    eventType: closeOutcome.eventType,
    status: closeOutcome.status,
    reasonCode: closeOutcome.reasonCode,
    transferHandoffCompleted: true,
    resolvedDepartment: "sales",
  });

  assert.equal(disposition.terminalOutcomeClass, "transfer_handoff_completed");
  assert.equal(disposition.callOutcome, "handoff_completed");
  assert.equal(disposition.handoffCompleted, true);
  assert.equal(disposition.handoffTarget, "sales");

  const transcriptDisposition =
    __test__.buildTerminalTranscriptDisposition(disposition);
  assert.equal(transcriptDisposition.shouldPersist, true);
  assert.equal(transcriptDisposition.truthClass, "pre_handoff_partial");
  assert.match(transcriptDisposition.text, /pre-handoff portion/i);
});

test("bridge writes inbound call/session direction metadata truthfully", async () => {
  resetRuntimeMetrics();
  FakeOpenAIWebSocket.reset();
  const reporters = {
    async sendReports() {},
  };
  const voiceClient = createVoiceClientRecorder();
  const wss = createAttachedBridge({
    resolveTenantConfig: async () => ({
      ok: true,
      config: buildTenantConfig(),
    }),
    reporters,
    voiceClient,
  });
  const twilioWs = new FakeSocket();

  wss.emit("connection", twilioWs, { headers: {}, url: "/twilio/stream" });
  twilioWs.emit(
    "message",
    Buffer.from(
      JSON.stringify({
        event: "start",
        start: {
          streamSid: "MZ901",
          callSid: "CA901",
          customParameters: {
            From: "+15550000007",
            To: "+15550000008",
            TenantKey: "acme",
          },
        },
      }),
      "utf8"
    )
  );

  await waitForTick();

  assert.equal(voiceClient.calls.upsertSession.length, 1);
  assert.equal(voiceClient.calls.upsertSession[0]?.direction, "inbound");
  assert.equal(voiceClient.calls.upsertSession[0]?.sessionDirection, "inbound");
  assert.equal(voiceClient.calls.upsertSession[0]?.callStatus, "in_progress");
  assert.equal(voiceClient.calls.upsertSession[0]?.sessionStatus, "bot_silent");
  assert.equal(
    voiceClient.calls.updateSessionState.find(
      (item) => item.eventType === "twilio_media_stream_started"
    )?.status,
    "bot_silent"
  );
  await shutdownBridgeSockets(twilioWs);
});

test("bridge promotes session to bot_active only after realtime session is ready", async () => {
  resetRuntimeMetrics();
  FakeOpenAIWebSocket.reset();
  const reporters = {
    async sendReports() {},
  };
  const voiceClient = createVoiceClientRecorder();
  const wss = createAttachedBridge({
    resolveTenantConfig: async () => ({
      ok: true,
      config: buildTenantConfig(),
    }),
    reporters,
    voiceClient,
  });
  const twilioWs = new FakeSocket();

  wss.emit("connection", twilioWs, { headers: {}, url: "/twilio/stream" });
  twilioWs.emit(
    "message",
    Buffer.from(
      JSON.stringify({
        event: "start",
        start: {
          streamSid: "MZ903",
          callSid: "CA903",
          customParameters: {
            From: "+15550000011",
            To: "+15550000012",
            TenantKey: "acme",
          },
        },
      }),
      "utf8"
    )
  );

  await waitForTick();
  assert.equal(
    voiceClient.calls.upsertSession.at(-1)?.sessionStatus,
    "bot_silent"
  );

  FakeOpenAIWebSocket.instances[0].emit(
    "message",
    Buffer.from(JSON.stringify({ type: "session.created" }), "utf8")
  );
  await waitForTick();

  assert.equal(
    voiceClient.calls.upsertSession.at(-1)?.sessionStatus,
    "bot_active"
  );
  assert.equal(
    voiceClient.calls.updateSessionState.find(
      (item) => item.eventType === "openai_session_ready"
    )?.status,
    "bot_active"
  );
  await shutdownBridgeSockets(twilioWs);
});

test("bridge emits reconnect lifecycle signals and distinguishes retry churn from exhaustion", async () => {
  resetRuntimeMetrics();
  FakeOpenAIWebSocket.reset();
  const reporters = {
    statuses: [],
    async sendReports(_ctx, meta = {}) {
      this.statuses.push(meta.status);
    },
  };
  const voiceClient = createVoiceClientRecorder();
  const wss = createAttachedBridge({
    resolveTenantConfig: async () => ({
      ok: true,
      config: buildTenantConfig(),
    }),
    reporters,
    voiceClient,
    RECONNECT_MAX: 1,
  });
  const twilioWs = new FakeSocket();

  wss.emit("connection", twilioWs, { headers: {}, url: "/twilio/stream" });
  twilioWs.emit(
    "message",
    Buffer.from(
      JSON.stringify({
        event: "start",
        start: {
          streamSid: "MZ902",
          callSid: "CA902",
          customParameters: {
            From: "+15550000009",
            To: "+15550000010",
            TenantKey: "acme",
          },
        },
      }),
      "utf8"
    )
  );

  await waitForTick();
  assert.equal(FakeOpenAIWebSocket.instances.length, 1);

  FakeOpenAIWebSocket.instances[0].close(1011, "upstream reset");
  await waitForTick();

  const scheduledState = voiceClient.calls.updateSessionState.find(
    (item) => item.eventType === "openai_reconnect_scheduled"
  );
  assert.ok(scheduledState);
  assert.equal(scheduledState.status, "bot_silent");

  const scheduledSignal = listRuntimeSignals().find(
    (item) => item.code === "openai_reconnect_scheduled"
  );
  assert.ok(scheduledSignal);
  assert.equal(scheduledSignal.reasonCode, "openai_ws_closed_retrying");

  await waitMs(760);
  assert.equal(FakeOpenAIWebSocket.instances.length, 2);
  FakeOpenAIWebSocket.instances[1].emit(
    "message",
    Buffer.from(JSON.stringify({ type: "session.created" }), "utf8")
  );
  await waitForTick();

  const recoveredState = voiceClient.calls.updateSessionState.find(
    (item) => item.eventType === "openai_reconnected"
  );
  assert.ok(recoveredState);
  assert.equal(recoveredState.status, "bot_active");

  FakeOpenAIWebSocket.instances[1].close(1011, "upstream reset again");
  await waitForTick();
  await waitForTick();

  const exhaustedState = voiceClient.calls.updateSessionState.find(
    (item) => item.eventType === "openai_reconnect_exhausted"
  );
  assert.ok(exhaustedState);
  assert.equal(exhaustedState.status, "failed");
  assert.equal(
    voiceClient.calls.upsertSession.at(-1)?.outcome,
    "failed"
  );
  assert.equal(
    voiceClient.calls.upsertSession.at(-1)?.meta?.terminalOutcomeClass,
    "upstream_realtime_failure"
  );

  const exhaustedSignal = listRuntimeSignals().find(
    (item) => item.code === "openai_reconnect_exhausted"
  );
  assert.ok(exhaustedSignal);
  assert.equal(exhaustedSignal.reasonCode, "openai_reconnect_exhausted");
  assert.deepEqual(reporters.statuses, ["failed"]);
  assert.equal(voiceClient.calls.appendTranscript.at(-1)?.role, "system");
  assert.match(
    voiceClient.calls.appendTranscript.at(-1)?.text || "",
    /partial and should not be treated as a completed bot conversation/i
  );
  assert.equal(
    voiceClient.calls.upsertSession.at(-1)?.meta?.transcriptTruthClass,
    "partial_failure"
  );
  await shutdownBridgeSockets(twilioWs);
});

test("terminal transcript disposition marks transfer handoff sessions as pre-handoff partial", () => {
  const disposition = __test__.buildTerminalDisposition({
    eventType: "call_handoff_completed",
    status: "completed",
    reasonCode: "transfer_handoff_completed",
    transferHandoffCompleted: true,
    resolvedDepartment: "sales",
  });

  const transcriptDisposition =
    __test__.buildTerminalTranscriptDisposition(disposition);

  assert.equal(transcriptDisposition.shouldPersist, true);
  assert.equal(transcriptDisposition.role, "system");
  assert.equal(transcriptDisposition.truthClass, "pre_handoff_partial");
  assert.match(transcriptDisposition.text, /operator handoff to sales/i);
});
