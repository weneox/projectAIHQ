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

export async function getTelegramChannelStatus() {
  return apiGet("/api/channels/telegram/status");
}

export async function connectTelegramChannel(payload = {}) {
  return apiPost("/api/channels/telegram/connect", payload);
}

export async function disconnectTelegramChannel() {
  return apiPost("/api/channels/telegram/disconnect", {});
}
