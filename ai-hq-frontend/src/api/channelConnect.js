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

export async function createWebsiteWidgetInstallHandoff(payload = {}) {
  return apiPost("/api/channels/webchat/install-handoff", payload);
}

export async function createWebsiteWidgetGtmInstallHandoff(payload = {}) {
  return apiPost("/api/channels/webchat/install-handoff/gtm", payload);
}

export async function createWebsiteWidgetWordpressInstallHandoff(payload = {}) {
  return apiPost("/api/channels/webchat/install-handoff/wordpress", payload);
}
export async function createWebsiteWidgetTestMessage(payload = {}) {
  return apiPost("/api/channels/webchat/test-message", payload);
}


export async function startWebsiteGuidedSetup(payload = {}) {
  return apiPost("/api/channels/webchat/guided-setup/start", payload);
}


export async function getWebsiteGuidedSetupReview(params = {}) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params || {})) {
    const next = String(value ?? "").trim();
    if (next) query.set(key, next);
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiGet(`/api/channels/webchat/guided-setup/review${suffix}`);
}


export async function approveWebsiteGuidedSetupReviewItem(candidateId, payload = {}) {
  return apiPost(
    `/api/channels/webchat/guided-setup/review/${encodeURIComponent(candidateId)}/approve`,
    payload
  );
}

export async function rejectWebsiteGuidedSetupReviewItem(candidateId, payload = {}) {
  return apiPost(
    `/api/channels/webchat/guided-setup/review/${encodeURIComponent(candidateId)}/reject`,
    payload
  );
}
