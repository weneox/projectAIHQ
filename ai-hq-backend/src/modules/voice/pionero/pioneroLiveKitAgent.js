import { AccessToken } from "livekit-server-sdk";

import { s } from "../shared.js";

export const PIONERO_LIVEKIT_AGENT_PLAN_VERSION = "pionero_livekit_agent_plan.v1";

const DEFAULT_AGENT_IDENTITY = "aihq-pionero-agent";
const DEFAULT_AGENT_NAME = "AIHQ Pionero Agent";
const DEFAULT_ROOM_NAME = "pionero-browser-test";
const TOKEN_TTL_SECONDS = 600;

function cleanLiveKitName(value = "", fallback = "pionero") {
  const clean = s(value, fallback)
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);

  return clean || fallback;
}

function cleanString(value = "", fallback = "") {
  return s(value) || fallback;
}

function buildPipeline() {
  return {
    transport: "livekit",
    stt: "soniox",
    llm: "fast_text_llm",
    tts: "cartesia",
  };
}

function buildReadiness() {
  return {
    agentParticipantReady: false,
    reasonCode: "pionero_agent_runner_not_started",
  };
}

export function readPioneroLiveKitAgentConfig(env = process.env) {
  return {
    url: s(env.LIVEKIT_URL || env.LIVEKIT_WS_URL),
    apiKey: s(env.LIVEKIT_API_KEY),
    apiSecret: s(env.LIVEKIT_API_SECRET),
    agentIdentity: cleanLiveKitName(
      env.PIONERO_AGENT_IDENTITY,
      DEFAULT_AGENT_IDENTITY
    ),
    agentName: cleanString(env.PIONERO_AGENT_NAME, DEFAULT_AGENT_NAME),
  };
}

export function buildPioneroLiveKitAgentPlan(input = {}) {
  const config = input.config || readPioneroLiveKitAgentConfig(input.env);
  const configured = Boolean(config.url && config.apiKey && config.apiSecret);
  const roomName = cleanLiveKitName(input.roomName, DEFAULT_ROOM_NAME);

  return {
    version: PIONERO_LIVEKIT_AGENT_PLAN_VERSION,
    configured,
    reasonCode: configured ? "" : "livekit_config_missing",
    provider: "livekit",
    url: s(config.url),
    roomName,
    agentIdentity: cleanLiveKitName(config.agentIdentity, DEFAULT_AGENT_IDENTITY),
    agentName: cleanString(config.agentName, DEFAULT_AGENT_NAME),
    pipeline: buildPipeline(),
    readiness: buildReadiness(),
  };
}

export async function createPioneroLiveKitAgentToken(input = {}) {
  const config = input.config || readPioneroLiveKitAgentConfig(input.env);
  const plan = buildPioneroLiveKitAgentPlan({
    ...input,
    config,
  });

  if (!plan.configured) {
    const err = new Error("livekit_config_missing");
    err.code = "livekit_config_missing";
    err.plan = plan;
    throw err;
  }

  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: plan.agentIdentity,
    name: plan.agentName,
    ttl: `${TOKEN_TTL_SECONDS}s`,
  });

  token.addGrant({
    room: plan.roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return {
    version: PIONERO_LIVEKIT_AGENT_PLAN_VERSION,
    provider: "livekit",
    url: plan.url,
    roomName: plan.roomName,
    agentIdentity: plan.agentIdentity,
    agentName: plan.agentName,
    token: await token.toJwt(),
    expiresInSeconds: TOKEN_TTL_SECONDS,
  };
}
