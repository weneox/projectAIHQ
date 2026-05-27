import { s } from "../shared.js";
import {
  PIONERO_OPENAI_REALTIME_LIVEKIT_BRIDGE_MODE,
  PIONERO_OPENAI_REALTIME_LIVEKIT_BRIDGE_VERSION,
  createOpenAIRealtimeLiveKitBridge,
  readPioneroRealtimeBridgeConfig,
} from "./realtime/openaiRealtimeLiveKitBridge.js";

export const PIONERO_REALTIME_AGENT_REGISTRY_VERSION =
  "pionero_realtime_agent_registry.v1";

function buildSkippedStatus({
  env = process.env,
  roomName = "",
  reasonCode = "",
} = {}) {
  const config = readPioneroRealtimeBridgeConfig(env);

  return {
    version: PIONERO_OPENAI_REALTIME_LIVEKIT_BRIDGE_VERSION,
    registryVersion: PIONERO_REALTIME_AGENT_REGISTRY_VERSION,
    mode: PIONERO_OPENAI_REALTIME_LIVEKIT_BRIDGE_MODE,
    enabled: false,
    status: config.enabled ? "blocked" : "disabled",
    roomName: s(roomName),
    provider: config.provider,
    realtimeConnected: false,
    livekitAudioTrackPublished: false,
    firstAudioAt: "",
    firstAudioLatencyMs: 0,
    interruptionsObserved: 0,
    lastReasonCode: s(
      reasonCode ||
        (config.enabled
          ? "unsupported_realtime_provider"
          : "pionero_realtime_lane_disabled")
    ),
    errorMessage: "",
  };
}

export function createPioneroRealtimeAgentRegistry({
  env = process.env,
  logger = null,
  createBridge = createOpenAIRealtimeLiveKitBridge,
} = {}) {
  const bridges = new Map();

  async function start(input = {}) {
    const roomName = s(input.roomName || input.room_name, "pionero-browser-test");
    const config = readPioneroRealtimeBridgeConfig(input.env || env);

    if (!config.enabled || config.provider !== "openai_realtime") {
      return buildSkippedStatus({
        env: input.env || env,
        roomName,
      });
    }

    const existing = bridges.get(roomName);
    const existingStatus = existing?.bridge?.getStatus?.();

    if (existingStatus && !["error", "stopped"].includes(existingStatus.status)) {
      return existingStatus;
    }

    const bridge = createBridge({
      ...input,
      env: input.env || env,
      logger: input.logger || logger,
      roomName,
    });

    bridges.set(roomName, {
      bridge,
    });

    return bridge.start();
  }

  function getState(input = {}) {
    const roomName = s(input.roomName || input.room_name, "pionero-browser-test");
    return bridges.get(roomName)?.bridge?.getStatus?.() || null;
  }

  async function stop(input = {}) {
    const roomName = s(input.roomName || input.room_name, "pionero-browser-test");
    const entry = bridges.get(roomName);

    if (!entry?.bridge) return null;

    return entry.bridge.stop();
  }

  function clear() {
    bridges.clear();
  }

  return {
    clear,
    getState,
    start,
    stop,
  };
}

export const defaultPioneroRealtimeAgentRegistry =
  createPioneroRealtimeAgentRegistry();

export function startPioneroRealtimeAgent(input = {}) {
  return defaultPioneroRealtimeAgentRegistry.start(input);
}

export function getPioneroRealtimeAgentState(input = {}) {
  return defaultPioneroRealtimeAgentRegistry.getState(input);
}

export function stopPioneroRealtimeAgent(input = {}) {
  return defaultPioneroRealtimeAgentRegistry.stop(input);
}
