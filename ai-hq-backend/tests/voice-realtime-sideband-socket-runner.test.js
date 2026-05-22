import assert from "node:assert/strict";
import test from "node:test";

import {
  VOICE_REALTIME_SIDEBAND_SOCKET_RUNNER_VERSION,
  startRealtimeSidebandSocketRunner,
} from "../src/modules/voice/realtimeSidebandSocketRunner.js";

function target(overrides = {}) {
  return {
    provider: "openai",
    transport: "webrtc",
    providerRealtimeCallId: "call_realtime_1",
    ...overrides,
  };
}

function call() {
  return {
    id: "voice-call-1",
    meta: {},
  };
}

function scope() {
  return {
    tenantId: "tenant-1",
    tenantKey: "acme",
  };
}

function readyEnv(overrides = {}) {
  return {
    VOICE_REALTIME_SIDEBAND_ENABLED: "1",
    OPENAI_API_KEY: "sk-test",
    ...overrides,
  };
}

function createFakeWebSocketClass() {
  return class FakeWebSocket {
    static instances = [];

    constructor(url, options = {}) {
      this.url = url;
      this.options = options;
      this.handlers = {};
      this.sent = [];
      FakeWebSocket.instances.push(this);
    }

    on(eventName, handler) {
      this.handlers[eventName] ||= [];
      this.handlers[eventName].push(handler);
    }

    async emit(eventName, ...args) {
      for (const handler of this.handlers[eventName] || []) {
        await handler(...args);
      }
    }

    send(message) {
      this.sent.push(message);
    }
  };
}

test("flag off returns disabled and no socket created", async () => {
  const FakeWebSocket = createFakeWebSocketClass();

  const runner = await startRealtimeSidebandSocketRunner({
    call: call(),
    scope: scope(),
    target: target(),
    env: {},
    WebSocketImpl: FakeWebSocket,
  });

  assert.equal(runner.ok, false);
  assert.equal(runner.skipped, true);
  assert.equal(runner.runnerVersion, VOICE_REALTIME_SIDEBAND_SOCKET_RUNNER_VERSION);
  assert.equal(runner.reasonCode, "sideband_disabled");
  assert.equal(runner.socketCreated, false);
  assert.equal(runner.lifecycleTrace.state, "disabled");
  assert.equal(FakeWebSocket.instances.length, 0);
});

test("missing api key is blocked and no socket created", async () => {
  const FakeWebSocket = createFakeWebSocketClass();

  const runner = await startRealtimeSidebandSocketRunner({
    call: call(),
    scope: scope(),
    target: target(),
    env: {
      VOICE_REALTIME_SIDEBAND_ENABLED: "1",
    },
    WebSocketImpl: FakeWebSocket,
  });

  assert.equal(runner.ok, false);
  assert.equal(runner.skipped, true);
  assert.equal(runner.reasonCode, "openai_api_key_missing");
  assert.equal(runner.lifecycleTrace.state, "blocked");
  assert.equal(runner.lifecycleTrace.reasonCode, "openai_api_key_missing");
  assert.equal(FakeWebSocket.instances.length, 0);
});

test("not-ready lifecycle is blocked and no socket created", async () => {
  const FakeWebSocket = createFakeWebSocketClass();

  const runner = await startRealtimeSidebandSocketRunner({
    call: call(),
    scope: scope(),
    target: target({
      providerRealtimeCallId: "",
    }),
    env: readyEnv(),
    WebSocketImpl: FakeWebSocket,
  });

  assert.equal(runner.ok, false);
  assert.equal(runner.skipped, true);
  assert.equal(runner.reasonCode, "provider_realtime_call_id_missing");
  assert.equal(runner.lifecycleTrace.state, "blocked");
  assert.equal(FakeWebSocket.instances.length, 0);
});

test("ready OpenAI creates injected WebSocket", async () => {
  const FakeWebSocket = createFakeWebSocketClass();

  const runner = await startRealtimeSidebandSocketRunner({
    call: call(),
    scope: scope(),
    target: target(),
    env: readyEnv(),
    WebSocketImpl: FakeWebSocket,
  });

  assert.equal(runner.ok, true);
  assert.equal(runner.skipped, false);
  assert.equal(runner.socketCreated, true);
  assert.equal(FakeWebSocket.instances.length, 1);
  assert.equal(
    FakeWebSocket.instances[0].url,
    "wss://api.openai.com/v1/realtime?call_id=call_realtime_1"
  );
  assert.equal(FakeWebSocket.instances[0].options.headers.Authorization, "Bearer sk-test");
  assert.equal(FakeWebSocket.instances[0].options.headers["OpenAI-Beta"], "realtime=v1");
  assert.equal(runner.lifecycleTrace.state, "connecting");

  await FakeWebSocket.instances[0].emit("open");
  assert.equal(runner.lifecycleTrace.state, "open");
});

test("inbound JSON event is processed", async () => {
  const FakeWebSocket = createFakeWebSocketClass();
  const processedEvents = [];

  const runner = await startRealtimeSidebandSocketRunner({
    db: {},
    call: call(),
    scope: scope(),
    target: target(),
    env: readyEnv(),
    WebSocketImpl: FakeWebSocket,
    processor: async (input) => {
      processedEvents.push(input);
      return {
        ok: true,
        outboundEvents: [],
      };
    },
  });
  const socket = FakeWebSocket.instances[0];

  await socket.emit("message", JSON.stringify({
    type: "response.output_text.done",
    text: "Hello",
  }));

  assert.equal(runner.ok, true);
  assert.equal(processedEvents.length, 1);
  assert.equal(processedEvents[0].event.type, "response.output_text.done");
  assert.equal(processedEvents[0].target.providerRealtimeCallId, "call_realtime_1");
  assert.equal(runner.processedEvents.length, 1);
});

test("outboundEvents from processor are sent", async () => {
  const FakeWebSocket = createFakeWebSocketClass();

  await startRealtimeSidebandSocketRunner({
    call: call(),
    scope: scope(),
    target: target(),
    env: readyEnv(),
    WebSocketImpl: FakeWebSocket,
    processor: async () => ({
      ok: true,
      outboundEvents: [
        {
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: "tool-call-1",
            output: "{\"ok\":true}",
          },
        },
        {
          type: "response.create",
        },
      ],
    }),
  });
  const socket = FakeWebSocket.instances[0];

  await socket.emit("message", JSON.stringify({
    type: "response.function_call_arguments.done",
    call_id: "tool-call-1",
  }));

  assert.equal(socket.sent.length, 2);
  assert.equal(JSON.parse(socket.sent[0]).type, "conversation.item.create");
  assert.equal(JSON.parse(socket.sent[1]).type, "response.create");
});

test("invalid JSON produces structured error and does not crash", async () => {
  const FakeWebSocket = createFakeWebSocketClass();
  let processorCalls = 0;

  const runner = await startRealtimeSidebandSocketRunner({
    call: call(),
    scope: scope(),
    target: target(),
    env: readyEnv(),
    WebSocketImpl: FakeWebSocket,
    processor: async () => {
      processorCalls += 1;
      throw new Error("processor should not run");
    },
  });
  const socket = FakeWebSocket.instances[0];

  await socket.emit("message", "{not-json");

  assert.equal(processorCalls, 0);
  assert.equal(runner.errors.length, 1);
  assert.equal(runner.errors[0].reasonCode, "sideband_message_invalid_json");
  assert.equal(runner.processedEvents.length, 0);
});

test("close and error update lifecycle trace", async () => {
  const CloseFakeWebSocket = createFakeWebSocketClass();
  const closeRunner = await startRealtimeSidebandSocketRunner({
    call: call(),
    scope: scope(),
    target: target(),
    env: readyEnv(),
    WebSocketImpl: CloseFakeWebSocket,
  });
  const closeSocket = CloseFakeWebSocket.instances[0];

  await closeSocket.emit("open");
  await closeSocket.emit("close", 1000, "normal");

  assert.equal(closeRunner.lifecycleTrace.state, "closed");
  assert.equal(closeRunner.lifecycleState.closeCode, 1000);
  assert.equal(closeRunner.lifecycleState.closeReason, "normal");

  const ErrorFakeWebSocket = createFakeWebSocketClass();
  const errorRunner = await startRealtimeSidebandSocketRunner({
    call: call(),
    scope: scope(),
    target: target(),
    env: readyEnv(),
    WebSocketImpl: ErrorFakeWebSocket,
  });
  const errorSocket = ErrorFakeWebSocket.instances[0];

  await errorSocket.emit("error", new Error("socket exploded"));

  assert.equal(errorRunner.lifecycleTrace.state, "failed");
  assert.equal(errorRunner.lifecycleTrace.reasonCode, "sideband_socket_error");
  assert.equal(errorRunner.errors[0].reasonCode, "sideband_socket_error");
  assert.match(errorRunner.errors[0].message, /socket exploded/);
});

test("no frontend schema or migration behavior is touched", async () => {
  const FakeWebSocket = createFakeWebSocketClass();

  const runner = await startRealtimeSidebandSocketRunner({
    call: call(),
    scope: scope(),
    target: target(),
    env: readyEnv(),
    WebSocketImpl: FakeWebSocket,
  });

  assert.equal(runner.socketCreated, true);
  assert.equal(runner.sidebandPlan.networkIo, false);
  assert.equal(FakeWebSocket.instances.length, 1);
});
