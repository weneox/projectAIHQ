import WebSocket from "ws";

import {
  OPENAI_REALTIME_PROVIDER,
  getRealtimeProviderAdapter,
  normalizeRealtimeProviderName,
} from "./realtimeProviderAdapters.js";
import {
  buildRealtimeSidebandConnectionState,
  buildRealtimeSidebandLifecycleTrace,
  transitionRealtimeSidebandConnectionState,
} from "./realtimeSidebandConnectionLifecycle.js";
import {
  processRealtimeSidebandEvent,
} from "./realtimeSidebandProcessor.js";
import {
  normalizeProviderRealtimeCallId,
} from "./realtimeControlPlane.js";

export const VOICE_REALTIME_SIDEBAND_SOCKET_RUNNER_VERSION =
  "voice-realtime-sideband-socket-runner-v1";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function truthy(value = "") {
  return ["1", "true", "yes", "y", "on"].includes(s(value).toLowerCase());
}

function isSidebandEnabled(env = process.env) {
  return truthy(
    env.VOICE_REALTIME_SIDEBAND_ENABLED ||
      env.AIHQ_VOICE_REALTIME_SIDEBAND_ENABLED
  );
}

function errorMessage(err) {
  return s(err?.message || err || "sideband socket runner failed");
}

function readMessageData(message) {
  if (message && typeof message === "object" && "data" in message) {
    return readMessageData(message.data);
  }

  if (Buffer.isBuffer(message)) {
    return message.toString("utf8");
  }

  if (message instanceof ArrayBuffer) {
    return Buffer.from(message).toString("utf8");
  }

  return String(message ?? "");
}

function safeJsonParse(raw = "") {
  try {
    return {
      ok: true,
      value: JSON.parse(String(raw)),
      error: "",
    };
  } catch (err) {
    return {
      ok: false,
      value: null,
      error: errorMessage(err),
    };
  }
}

function attachSocketHandler(socket, eventName, handler) {
  if (typeof socket?.on === "function") {
    socket.on(eventName, handler);
    return;
  }

  if (typeof socket?.addEventListener === "function") {
    socket.addEventListener(eventName, (event) => handler(event));
  }
}

function buildSocketHeaders({ sidebandPlan = {}, env = process.env } = {}) {
  const headers = {
    ...obj(sidebandPlan.headers),
  };

  if (s(env.OPENAI_API_KEY)) {
    headers.Authorization = `Bearer ${s(env.OPENAI_API_KEY)}`;
  }

  return headers;
}

function buildSkippedResult({
  provider = "",
  reasonCode = "",
  lifecycleState = null,
  sidebandPlan = null,
} = {}) {
  return {
    ok: false,
    skipped: true,
    runnerVersion: VOICE_REALTIME_SIDEBAND_SOCKET_RUNNER_VERSION,
    provider: normalizeRealtimeProviderName(provider),
    reasonCode: s(reasonCode || lifecycleState?.reasonCode || "sideband_socket_not_started"),
    socketCreated: false,
    socket: null,
    lifecycleState,
    lifecycleTrace: lifecycleState
      ? buildRealtimeSidebandLifecycleTrace({
          state: lifecycleState,
          target: lifecycleState.target,
        })
      : null,
    sidebandPlan,
    processedEvents: [],
    sentOutboundEvents: [],
    errors: [],
    networkIo: false,
  };
}

function closeLifecycleState(current = {}, close = {}) {
  const state = s(current.state || current.status);

  if (state === "open") {
    const closing = transitionRealtimeSidebandConnectionState({
      current,
      eventType: "close_requested",
    });
    const closed = transitionRealtimeSidebandConnectionState({
      current: closing,
      eventType: "closed",
      reasonCode: s(close.reasonCode),
    });
    return {
      ...closed,
      closeCode: close.code ?? null,
      closeReason: s(close.reason),
    };
  }

  if (state === "closing") {
    const closed = transitionRealtimeSidebandConnectionState({
      current,
      eventType: "closed",
      reasonCode: s(close.reasonCode),
    });
    return {
      ...closed,
      closeCode: close.code ?? null,
      closeReason: s(close.reason),
    };
  }

  return {
    ...current,
    state: "closed",
    status: "closed",
    reasonCode: s(close.reasonCode || current.reasonCode),
    closeCode: close.code ?? null,
    closeReason: s(close.reason),
    networkIo: false,
  };
}

export async function startRealtimeSidebandSocketRunner({
  db = null,
  call = {},
  scope = {},
  target = {},
  runtimeConfig = {},
  env = process.env,
  logger = null,
  providerAdapter = null,
  sinkRegistry = null,
  dispatchSinks = undefined,
  buildSinkDeliverySnapshot = undefined,
  recordBusinessAction = undefined,
  applyInboxSinkDeliveryToCallPatch = undefined,
  processor = processRealtimeSidebandEvent,
  WebSocketImpl = WebSocket,
} = {}) {
  const provider = normalizeRealtimeProviderName(target.provider || providerAdapter?.provider);
  const adapter = providerAdapter || getRealtimeProviderAdapter(provider);
  const sidebandPlanResult =
    typeof adapter?.buildSidebandPlan === "function"
      ? adapter.buildSidebandPlan({
          target,
          env,
        })
      : {
          ok: false,
          provider,
          status: "unsupported",
          reasonCode: "unsupported_realtime_provider",
          sidebandPlan: null,
        };

  const lifecycleState = buildRealtimeSidebandConnectionState({
    provider,
    target,
    env,
    adapterRegistry: () => sidebandPlanResult,
  });
  const sidebandPlan = sidebandPlanResult?.sidebandPlan || null;
  const providerRealtimeCallId = normalizeProviderRealtimeCallId(
    sidebandPlan?.providerRealtimeCallId || target.providerRealtimeCallId
  );

  if (!isSidebandEnabled(env)) {
    return buildSkippedResult({
      provider,
      reasonCode: lifecycleState.reasonCode || "sideband_disabled",
      lifecycleState,
      sidebandPlan,
    });
  }

  if (provider !== OPENAI_REALTIME_PROVIDER) {
    return buildSkippedResult({
      provider,
      reasonCode: "unsupported_realtime_provider",
      lifecycleState,
      sidebandPlan,
    });
  }

  if (!providerRealtimeCallId) {
    return buildSkippedResult({
      provider,
      reasonCode: "provider_realtime_call_id_missing",
      lifecycleState,
      sidebandPlan,
    });
  }

  if (!s(env.OPENAI_API_KEY)) {
    return buildSkippedResult({
      provider,
      reasonCode: "openai_api_key_missing",
      lifecycleState,
      sidebandPlan,
    });
  }

  if (lifecycleState.state !== "ready" || !sidebandPlan?.url) {
    return buildSkippedResult({
      provider,
      reasonCode: lifecycleState.reasonCode || "sideband_lifecycle_not_ready",
      lifecycleState,
      sidebandPlan,
    });
  }

  const runner = {
    ok: true,
    skipped: false,
    runnerVersion: VOICE_REALTIME_SIDEBAND_SOCKET_RUNNER_VERSION,
    provider,
    reasonCode: "",
    socketCreated: true,
    socket: null,
    sidebandPlan,
    lifecycleState: transitionRealtimeSidebandConnectionState({
      current: lifecycleState,
      eventType: "connect_requested",
    }),
    lifecycleTrace: null,
    processedEvents: [],
    sentOutboundEvents: [],
    errors: [],
    networkIo: true,
    getSnapshot() {
      return {
        ok: this.ok,
        skipped: this.skipped,
        runnerVersion: this.runnerVersion,
        provider: this.provider,
        reasonCode: this.reasonCode,
        socketCreated: this.socketCreated,
        sidebandPlan: this.sidebandPlan,
        lifecycleState: this.lifecycleState,
        lifecycleTrace: this.lifecycleTrace,
        processedEvents: [...this.processedEvents],
        sentOutboundEvents: [...this.sentOutboundEvents],
        errors: [...this.errors],
        networkIo: this.networkIo,
      };
    },
  };

  const updateTrace = () => {
    runner.lifecycleTrace = buildRealtimeSidebandLifecycleTrace({
      state: runner.lifecycleState,
      target,
    });
  };
  updateTrace();

  let socket = null;
  try {
    socket = new WebSocketImpl(sidebandPlan.url, {
      headers: buildSocketHeaders({
        sidebandPlan,
        env,
      }),
    });
  } catch (err) {
    const failedState = transitionRealtimeSidebandConnectionState({
      current: runner.lifecycleState,
      eventType: "failed",
      reasonCode: "sideband_socket_construct_failed",
      error: errorMessage(err),
    });

    return {
      ...runner.getSnapshot(),
      ok: false,
      socketCreated: false,
      socket: null,
      reasonCode: "sideband_socket_construct_failed",
      lifecycleState: failedState,
      lifecycleTrace: buildRealtimeSidebandLifecycleTrace({
        state: failedState,
        target,
      }),
      errors: [
        {
          reasonCode: "sideband_socket_construct_failed",
          message: errorMessage(err),
        },
      ],
    };
  }

  runner.socket = socket;

  attachSocketHandler(socket, "open", () => {
    runner.lifecycleState = transitionRealtimeSidebandConnectionState({
      current: runner.lifecycleState,
      eventType: "connected",
    });
    updateTrace();
  });

  attachSocketHandler(socket, "message", async (message) => {
    const parsed = safeJsonParse(readMessageData(message));
    if (!parsed.ok) {
      const error = {
        reasonCode: "sideband_message_invalid_json",
        message: parsed.error,
      };
      runner.errors.push(error);
      logger?.warn?.("voice.realtime.sideband.invalid_json", error);
      return;
    }

    let processed = null;
    try {
      processed = await processor({
        db,
        event: parsed.value,
        target,
        call,
        scope,
        runtimeConfig,
        sinkRegistry,
        dispatchSinks,
        buildSinkDeliverySnapshot,
        recordBusinessAction,
        applyInboxSinkDeliveryToCallPatch,
      });
    } catch (err) {
      const error = {
        reasonCode: "sideband_processor_failed",
        message: errorMessage(err),
      };
      runner.errors.push(error);
      logger?.error?.("voice.realtime.sideband.processor_failed", err);
      return;
    }

    runner.processedEvents.push({
      event: parsed.value,
      result: processed,
    });

    for (const outboundEvent of arr(processed?.outboundEvents)) {
      try {
        const encoded = JSON.stringify(outboundEvent);
        socket.send(encoded);
        runner.sentOutboundEvents.push(outboundEvent);
      } catch (err) {
        const error = {
          reasonCode: "sideband_socket_send_failed",
          message: errorMessage(err),
          outboundEvent,
        };
        runner.errors.push(error);
        logger?.error?.("voice.realtime.sideband.send_failed", err);
      }
    }
  });

  attachSocketHandler(socket, "close", (code = null, reason = "") => {
    runner.lifecycleState = closeLifecycleState(runner.lifecycleState, {
      code,
      reason,
      reasonCode: "sideband_socket_closed",
    });
    updateTrace();
  });

  attachSocketHandler(socket, "error", (err) => {
    const message = errorMessage(err);
    runner.errors.push({
      reasonCode: "sideband_socket_error",
      message,
    });
    runner.lifecycleState = transitionRealtimeSidebandConnectionState({
      current: runner.lifecycleState,
      eventType: "failed",
      reasonCode: "sideband_socket_error",
      error: message,
    });
    updateTrace();
    logger?.error?.("voice.realtime.sideband.socket_error", err);
  });

  return runner;
}

export const runRealtimeSidebandSocketRunner = startRealtimeSidebandSocketRunner;
