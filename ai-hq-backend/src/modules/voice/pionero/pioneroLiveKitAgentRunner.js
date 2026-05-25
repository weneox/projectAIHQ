import {
  buildPioneroLiveKitAgentPlan,
  createPioneroLiveKitAgentToken,
} from "./pioneroLiveKitAgent.js";
import { s } from "../shared.js";

export const PIONERO_LIVEKIT_AGENT_RUNNER_VERSION = "pionero_livekit_agent_runner.v1";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function buildSafePlan(input = {}) {
  const plan = obj(input.plan);

  return plan.version
    ? plan
    : buildPioneroLiveKitAgentPlan({
        roomName: input.roomName,
        env: input.env,
      });
}

export function buildPioneroLiveKitAgentRunnerState(input = {}) {
  const plan = buildSafePlan(input);
  const tokenResult = obj(input.tokenResult);
  const status = s(input.status, "idle") || "idle";
  const reasonCode = s(input.reasonCode);

  return {
    version: PIONERO_LIVEKIT_AGENT_RUNNER_VERSION,
    provider: "livekit",
    configured: input.configured === false
      ? false
      : tokenResult.token
        ? true
        : plan.configured === true,
    status,
    networkIo: input.networkIo === true,
    reasonCode,
    url: s(tokenResult.url || plan.url),
    roomName: s(tokenResult.roomName || plan.roomName),
    agentIdentity: s(tokenResult.agentIdentity || plan.agentIdentity),
    agentName: s(tokenResult.agentName || plan.agentName),
    pipeline: obj(plan.pipeline),
    readiness: {
      ...obj(plan.readiness),
      agentParticipantReady: status === "connected",
      reasonCode: status === "connected"
        ? ""
        : s(
            input.readinessReasonCode ||
              plan.readiness?.reasonCode ||
              reasonCode
          ),
    },
  };
}

export function createPioneroLiveKitAgentRunner(input = {}) {
  const {
    RoomClass = null,
    createAgentToken = createPioneroLiveKitAgentToken,
    env = process.env,
    logger = null,
    roomName = "",
  } = input;

  let room = null;
  let connected = false;
  let currentState = buildPioneroLiveKitAgentRunnerState({
    env,
    roomName,
  });

  async function start() {
    let tokenResult = null;

    try {
      tokenResult = await createAgentToken({
        roomName,
        env,
      });
    } catch (err) {
      const plan = obj(err?.plan).version
        ? err.plan
        : buildPioneroLiveKitAgentPlan({ roomName, env });

      logger?.warn?.("pionero.livekit.agent_runner.token_unavailable", {
        reasonCode: s(err?.code || err?.message, "livekit_config_missing"),
      });

      currentState = buildPioneroLiveKitAgentRunnerState({
        plan,
        status: "blocked",
        configured: false,
        networkIo: false,
        reasonCode: s(err?.code || err?.message, "livekit_config_missing"),
      });

      return currentState;
    }

    if (!RoomClass) {
      currentState = buildPioneroLiveKitAgentRunnerState({
        env,
        roomName,
        tokenResult,
        status: "planned",
        networkIo: false,
        reasonCode: "livekit_room_client_not_configured",
      });

      return currentState;
    }

    try {
      room = new RoomClass();
      await room.connect(tokenResult.url, tokenResult.token);
      connected = true;

      currentState = buildPioneroLiveKitAgentRunnerState({
        env,
        roomName,
        tokenResult,
        status: "connected",
        networkIo: true,
        reasonCode: "",
      });

      return currentState;
    } catch (err) {
      logger?.error?.("pionero.livekit.agent_runner.connect_failed", {
        reasonCode: "livekit_room_connect_failed",
        error: s(err?.message || err),
      });

      currentState = buildPioneroLiveKitAgentRunnerState({
        env,
        roomName,
        tokenResult,
        status: "error",
        networkIo: true,
        reasonCode: "livekit_room_connect_failed",
      });

      return currentState;
    }
  }

  async function stop() {
    if (room && connected) {
      try {
        await room.disconnect?.();
      } catch (err) {
        logger?.warn?.("pionero.livekit.agent_runner.disconnect_failed", {
          reasonCode: "livekit_room_disconnect_failed",
          error: s(err?.message || err),
        });
      }
    }

    room = null;
    connected = false;
    currentState = buildPioneroLiveKitAgentRunnerState({
      plan: currentState,
      status: "stopped",
      networkIo: false,
      reasonCode: "",
    });

    return currentState;
  }

  return {
    start,
    stop,
  };
}
