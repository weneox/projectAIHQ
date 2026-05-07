import { apiGet, apiPost } from "./client.js";

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

export async function getWorkspaceSettings() {
  return apiGet("/api/settings/workspace");
}

export async function saveWorkspaceAiPolicy(aiPolicy = {}) {
  return apiPost("/api/settings/workspace", {
    aiPolicy: obj(aiPolicy),
  });
}