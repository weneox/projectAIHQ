import { apiGet, apiPost } from "./client.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function buildDomainVerificationPath(basePath, options = {}) {
  const domain = s(options?.domain);
  if (!domain) return basePath;

  const search = new URLSearchParams({
    domain,
  });

  return `${basePath}?${search.toString()}`;
}

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

export async function getWebsiteWidgetStatus() {
  return apiGet("/api/channels/webchat/status");
}

export async function saveWebsiteWidgetConfig(payload = {}) {
  return apiPost("/api/channels/webchat/config", payload);
}

export async function getWebsiteDomainVerificationStatus(options = {}) {
  return apiGet(
    buildDomainVerificationPath(
      "/api/channels/webchat/domain-verification",
      options
    )
  );
}

export async function createWebsiteDomainVerificationChallenge(payload = {}) {
  return apiPost("/api/channels/webchat/domain-verification/challenge", payload);
}

export async function checkWebsiteDomainVerification(payload = {}) {
  return apiPost("/api/channels/webchat/domain-verification/check", payload);
}
