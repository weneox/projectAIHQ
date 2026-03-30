import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { attachRealtimeBridge, __test__ } from "../src/services/realtimeBridge.js";

function waitForTick() {
  return new Promise((resolve) => setImmediate(resolve));
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

class FakeWss extends EventEmitter {}

class FakeSocket extends EventEmitter {
  static OPEN = 1;
  static CLOSED = 3;

  constructor() {
    super();
    this.readyState = FakeSocket.OPEN;
    this.sent = [];
    this.closeCalls = 0;
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
  OPENAI_API_KEY = "openai-key",
} = {}) {
  const wss = new FakeWss();

  attachRealtimeBridge({
    wss,
    OPENAI_API_KEY,
    DEBUG_REALTIME: false,
    PUBLIC_BASE_URL: "https://voice.example.test",
    reporters,
    twilioClient: null,
    REALTIME_MODEL: "gpt-4o-realtime-preview",
    REALTIME_VOICE: "alloy",
    RECONNECT_MAX: 0,
    WebSocketImpl: FakeOpenAIWebSocket,
    resolveTenantConfig,
    voiceClient,
  });

  return wss;
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
  assert.equal(voiceClient.calls.upsertSession.length, 0);
  assert.equal(voiceClient.calls.updateSessionState.length, 1);
  assert.equal(
    voiceClient.calls.updateSessionState[0]?.eventType,
    "call_failed_tenant_config_unavailable"
  );
  assert.equal(voiceClient.calls.updateSessionState[0]?.status, "failed");
});

test("bridge reports twilio websocket errors as failed, not completed", async () => {
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
  assert.equal(voiceClient.calls.updateSessionState.length, 1);
  assert.equal(voiceClient.calls.updateSessionState[0]?.eventType, "twilio_ws_error");
  assert.equal(voiceClient.calls.updateSessionState[0]?.status, "failed");
});

test("bridge finalizes only once when twilio stop is followed by websocket close", async () => {
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
  assert.equal(voiceClient.calls.updateSessionState.length, 1);
  assert.equal(voiceClient.calls.updateSessionState[0]?.eventType, "call_stopped");
  assert.equal(voiceClient.calls.updateSessionState[0]?.status, "completed");
});
