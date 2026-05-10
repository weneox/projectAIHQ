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




function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function bool(...values) {
  return values.some(
    (value) => value === true || value === "true" || value === 1
  );
}

function normalizeBackendChannelStatus(payload = {}) {
  const source = obj(payload);
  const readiness = obj(source.readiness || source.launchReadiness);
  const runtime = obj(source.runtime);

  const connected = bool(
    source.connected,
    source.isConnected,
    source.enabled,
    source.configured,
    source.widget?.enabled,
    source.account?.connected,
    source.channel?.connected,
    source.launchReadiness?.channelConfigured
  );

  const deliveryReady = bool(
    source.deliveryReady,
    source.productionReady,
    source.launchReady,
    source.launchReadiness?.productionReady,
    source.launchReadiness?.productionLaunchAllowed,
    source.launchReadiness?.widgetEnabled,
    runtime.deliveryReady
  );

  const blocked = [
    lower(source.state),
    lower(source.status),
    lower(readiness.status),
    lower(source.launchReadiness?.status),
  ].some((value) => ["blocked", "error", "failed", "disabled"].includes(value));

  const pending = [
    lower(source.state),
    lower(source.status),
    lower(readiness.status),
  ].some((value) =>
    ["pending", "needs_setup", "needs setup", "action_required"].includes(value)
  );

  if (connected || deliveryReady) {
    return {
      status: "connected",
      health: deliveryReady ? "ready" : "action required",
      connected: true,
      payload: source,
    };
  }

  if (blocked) {
    return {
      status: "not connected",
      health: "disabled",
      connected: false,
      payload: source,
    };
  }

  if (pending) {
    return {
      status: "pending",
      health: "action required",
      connected: false,
      payload: source,
    };
  }

  return {
    status: "not connected",
    health: "disabled",
    connected: false,
    payload: source,
  };
}

async function safeChannelCatalogStatus(loader) {
  try {
    const payload = await loader();

    return {
      ok: true,
      ...normalizeBackendChannelStatus(payload),
    };
  } catch (error) {
    return {
      ok: false,
      status: "not connected",
      health: "unavailable",
      connected: false,
      error:
        s(error?.payload?.error || error?.payload?.message || error?.message) ||
        "Channel status unavailable.",
      payload: null,
    };
  }
}

export async function getChannelCatalogStatus() {
  const [website, meta, telegram] = await Promise.all([
    safeChannelCatalogStatus(getWebsiteWidgetStatus),
    safeChannelCatalogStatus(getMetaChannelStatus),
    safeChannelCatalogStatus(getTelegramChannelStatus),
  ]);

  return {
    ok: true,
    channels: {
      "website-chat": website,
      instagram: meta,
      facebook: meta,
      telegram,
      whatsapp: {
        ok: true,
        status: "not connected",
        health: "disabled",
        connected: false,
        payload: null,
      },
      email: {
        ok: true,
        status: "not connected",
        health: "disabled",
        connected: false,
        payload: null,
      },
    },
  };
}
