import { AIHQ_BASE_URL, AIHQ_INTERNAL_TOKEN, AIHQ_TIMEOUT_MS } from "../config.js";
import {
  validateProviderAccessResponse,
} from "@aihq/shared-contracts/operations";
import { createStructuredLogger } from "@aihq/shared-contracts/logger";
import { recordRuntimeSignal } from "./runtimeReliability.js";

function s(v) {
  return String(v ?? "").trim();
}

function lower(v) {
  return s(v).toLowerCase();
}

function trimSlash(v) {
  return s(v).replace(/\/+$/, "");
}

async function safeReadJson(res) {
  const text = await res.text().catch(() => "");
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function buildHeaders() {
  return {
    Accept: "application/json",
    ...(s(AIHQ_INTERNAL_TOKEN)
      ? { "x-internal-token": s(AIHQ_INTERNAL_TOKEN) }
      : {}),
  };
}

const logger = createStructuredLogger({
  service: "meta-bot-backend",
  component: "tenant-provider-secrets",
});

async function fetchMetaProviderAccess({
  channel = "instagram",
  recipientId = "",
  pageId = "",
  igUserId = "",
}) {
  const base = trimSlash(AIHQ_BASE_URL);

  if (!base) {
    return {
      ok: false,
      status: 0,
      error: "AIHQ_BASE_URL missing",
      json: null,
    };
  }

  const safeChannel = lower(channel || "instagram");
  const safeRecipientId = s(recipientId);
  const safePageId = s(pageId);
  const safeIgUserId = s(igUserId);

  if (!safeRecipientId && !safePageId && !safeIgUserId) {
    return {
      ok: false,
      status: 0,
      error: "recipientId or pageId or igUserId is required",
      json: null,
    };
  }

  const qs = new URLSearchParams();
  qs.set("channel", safeChannel);
  if (safeRecipientId) qs.set("recipientId", safeRecipientId);
  if (safePageId) qs.set("pageId", safePageId);
  if (safeIgUserId) qs.set("igUserId", safeIgUserId);

  const url = `${base}/api/internal/providers/meta-channel-access?${qs.toString()}`;
  const timeoutMs = Number(AIHQ_TIMEOUT_MS || 20000);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: buildHeaders(),
      signal: controller.signal,
    });

    const json = await safeReadJson(res);

    if (!res.ok || json?.ok === false) {
      return {
        ok: false,
        status: res.status,
        error:
          json?.error ||
          json?.message ||
          `meta provider access failed (${res.status})`,
        json,
      };
    }

    const checked = validateProviderAccessResponse(json || {});
    if (!checked.ok) {
      return {
        ok: false,
        status: res.status,
        error: checked.error,
        json,
      };
    }

    return {
      ok: true,
      status: res.status,
      json: checked.value,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error:
        err?.name === "AbortError"
          ? "meta provider access timeout"
          : String(err?.message || err),
      json: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function getTenantMetaConfigByChannel({
  channel = "instagram",
  recipientId = "",
  pageId = "",
  igUserId = "",
}) {
  const result = await fetchMetaProviderAccess({
    channel,
    recipientId,
    pageId,
    igUserId,
  });

  if (!result.ok) {
    logger.warn("meta.provider_access.unavailable", {
      channel,
      recipientId,
      pageId,
      igUserId,
      error: result.error,
      status: result.status,
    });
    recordRuntimeSignal({
      level: "warn",
      category: "provider_access",
      code: "meta_provider_access_unavailable",
      reasonCode: s(result.error || "meta_provider_access_failed"),
      status: Number(result.status || 0),
    });

    return {
      tenantKey: "",
      pageAccessToken: "",
      pageId: "",
      igUserId: "",
      appSecret: "",
      source: "none",
      error: s(result.error || "meta_provider_access_failed"),
      status: Number(result.status || 0),
      projectedRuntime: null,
      operationalChannels: null,
      providerAccess: null,
    };
  }

  const access = result.json?.providerAccess || {};
  const operationalChannels = result.json?.operationalChannels || {};
  const operationalMeta =
    operationalChannels && typeof operationalChannels === "object"
      ? operationalChannels.meta || null
      : null;

  logger.info("meta.provider_access.resolved", {
    tenantKey: access.tenantKey,
    pageId: access.pageId,
    igUserId: access.igUserId,
    available: Boolean(access.available),
    channelReady: Boolean(operationalMeta?.ready),
  });

  if (access.available !== true || operationalMeta?.ready !== true) {
    recordRuntimeSignal({
      level: "warn",
      category: "provider_access",
      code: "meta_provider_access_blocked",
      reasonCode: s(
        access.reasonCode || operationalMeta?.reasonCode || "provider_access_unavailable"
      ),
      status: Number(result.status || 409),
      tenantKey: s(access.tenantKey),
    });
    return {
      tenantKey: s(access.tenantKey),
      pageAccessToken: "",
      pageId: s(access.pageId),
      igUserId: s(access.igUserId),
      appSecret: "",
      source: "none",
      error: s(
        access.reasonCode || operationalMeta?.reasonCode || "provider_access_unavailable"
      ),
      status: Number(result.status || 409),
      projectedRuntime: result.json?.projectedRuntime || null,
      operationalChannels,
      providerAccess: access,
    };
  }

  return {
    tenantKey: s(access.tenantKey),
    pageAccessToken: s(access.pageAccessToken),
    pageId: s(access.pageId),
    igUserId: s(access.igUserId),
    appSecret: s(access.appSecret),
    source: "provider_access",
    error: access.available ? null : s(access.reasonCode || "provider_access_unavailable"),
    status: Number(result.status || 0),
    projectedRuntime: result.json?.projectedRuntime || null,
    operationalChannels,
    providerAccess: access,
  };
}

export async function getTenantMetaConfig(tenantKeyOrInput) {
  if (
    tenantKeyOrInput &&
    typeof tenantKeyOrInput === "object" &&
    !Array.isArray(tenantKeyOrInput)
  ) {
    return getTenantMetaConfigByChannel(tenantKeyOrInput);
  }

  const tenantKey = lower(tenantKeyOrInput);

  return {
    tenantKey,
    pageAccessToken: "",
    pageId: "",
    igUserId: "",
    appSecret: "",
    source: "none",
    error: tenantKey
      ? "tenantKey-only resolve is no longer supported here; use channel ids"
      : "tenantKey missing",
    status: 0,
    projectedRuntime: null,
    operationalChannels: null,
    providerAccess: null,
  };
}
