import { apiGet, apiPost } from "./client.js";

export async function getWorkspaceSettings() {
  return apiGet("/api/settings/workspace");
}

export async function saveWorkspaceAiPolicy(aiPolicy = {}) {
  return apiPost("/api/settings/workspace", { aiPolicy });
}

export async function getOperationalSettings() {
  return apiGet("/api/settings/operational");
}

export async function getChannelSettings() {
  return apiGet("/api/settings/channels");
}

export async function getAgentSettings() {
  return apiGet("/api/settings/agents");
}
