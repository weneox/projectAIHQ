import {
  buildPioneroLiveKitAgentRunnerState,
  createPioneroLiveKitAgentRunner,
} from "./pioneroLiveKitAgentRunner.js";

export const PIONERO_LIVEKIT_AGENT_RUNTIME_VERSION = "pionero_livekit_agent_runtime.v1";

function readRuntimeRoomName(input = {}, env = process.env) {
  return buildPioneroLiveKitAgentRunnerState({
    env,
    roomName: input.roomName || input.room_name,
  }).roomName;
}

function readRunnerStatus(runner = null) {
  try {
    return String(runner?.getState?.()?.status || "").trim();
  } catch {
    return "";
  }
}

function shouldReuseRunner(runner = null) {
  const status = readRunnerStatus(runner);

  return Boolean(runner) && !["", "error", "stopped"].includes(status);
}

export function createPioneroLiveKitAgentRuntime(input = {}) {
  const {
    createRunner = createPioneroLiveKitAgentRunner,
    env = process.env,
  } = input;
  const runners = new Map();

  async function start(startInput = {}) {
    const roomName = readRuntimeRoomName(startInput, startInput.env || env);
    const existing = runners.get(roomName);

    if (shouldReuseRunner(existing?.runner)) {
      return existing.runner.getState();
    }

    const runner = createRunner({
      ...startInput,
      env: startInput.env || env,
      logger: startInput.logger || null,
      roomName,
    });

    runners.set(roomName, {
      runner,
    });

    return runner.start();
  }

  function getState(stateInput = {}) {
    const roomName = readRuntimeRoomName(stateInput, stateInput.env || env);
    const entry = runners.get(roomName);

    return entry?.runner?.getState?.() || null;
  }

  async function stop(stopInput = {}) {
    const roomName = readRuntimeRoomName(stopInput, stopInput.env || env);
    const entry = runners.get(roomName);

    if (!entry?.runner) return null;

    return entry.runner.stop();
  }

  function clear() {
    runners.clear();
  }

  return {
    clear,
    getState,
    start,
    stop,
  };
}

export const defaultPioneroLiveKitAgentRuntime = createPioneroLiveKitAgentRuntime();

export function startPioneroLiveKitAgentRuntime(input = {}) {
  return defaultPioneroLiveKitAgentRuntime.start(input);
}

export function getPioneroLiveKitAgentRuntimeState(input = {}) {
  return defaultPioneroLiveKitAgentRuntime.getState(input);
}

export function stopPioneroLiveKitAgentRuntime(input = {}) {
  return defaultPioneroLiveKitAgentRuntime.stop(input);
}
