import { apiGet, apiPost } from "./client.js";

export async function getMetaChannelStatus() {
  return apiGet("/api/channels/meta/status");
}

export async function getMetaConnectUrl() {
  return apiGet("/api/channels/meta/connect-url");
}

export async function disconnectMetaChannel() {
  return apiPost("/api/channels/meta/disconnect", {});
}

export async function selectMetaChannelCandidate(payload = {}) {
  return apiPost("/api/channels/meta/select", payload);
}
