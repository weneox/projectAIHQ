import { AIHQ_BASE_URL, AIHQ_INTERNAL_TOKEN, AIHQ_TIMEOUT_MS } from "../config.js";
import {
  validateResolveChannelQuery,
} from "@aihq/shared-contracts/critical";
import { validateResolveChannelProjectedResponse } from "@aihq/shared-contracts/runtime";
import {
  buildCorrelationHeaders,
  createStructuredLogger,
} from "@aihq/shared-contracts/logger";

function s(v) {
  return String(v ?? "").trim();
}

function lower(v) {
  return s(v).toLowerCase();
}

function trimSlash(x) {
  return s(x).replace(/\/+$/, "");
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function getRuntimeAuthorityFailure(projectedRuntime) {
  const authority = obj(obj(projectedRuntime).authority);
  const source = s(authority.source);
  const available = authority.available === true;
  const reasonCode = s(authority.reasonCode || authority.reason || "");

  if (available && source === "approved_runtime_projection") {
    return null;
  }

  return {
    error: "runtime_authority_unavailable",
    reasonCode: reasonCode || (!available ? "runtime_authority_unavailable" : "runtime_authority_source_invalid"),
    authority,
  };
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

function buildUrl({ channel = "", recipientId = "", pageId = "", igUserId = "" }) {
  const base = trimSlash(AIHQ_BASE_URL);
  if (!base) return "";

  const safeChannel = lower(channel);
  const safeRecipientId = s(recipientId);
  const safePageId = s(pageId);
  const safeIgUserId = s(igUserId);

  const qs = new URLSearchParams();
  if (safeChannel) qs.set("channel", safeChannel);
  if (safeRecipientId) qs.set("recipientId", safeRecipientId);
  if (safePageId) qs.set("pageId", safePageId);
  if (safeIgUserId) qs.set("igUserId", safeIgUserId);

  const checked = validateResolveChannelQuery({
    channel: safeChannel,
    recipientId: safeRecipientId,
    pageId: safePageId,
    igUserId: safeIgUserId,
  });
  if (!checked.ok) return "";

  return `${base}/api/tenants/resolve-channel?${qs.toString()}`;
}

const baseLogger = createStructuredLogger({
  service: "meta-bot-backend",
  component: "tenant-resolver",
});

function buildHeaders(requestContext = {}) {
  return buildCorrelationHeaders({
    requestId: s(requestContext?.requestId),
    correlationId: s(requestContext?.correlationId),
    headers: {
    Accept: "application/json",
    ...(s(AIHQ_INTERNAL_TOKEN) ? { "x-internal-token": s(AIHQ_INTERNAL_TOKEN) } : {}),
    },
  });
}

export async function resolveTenantContextFromMetaEvent({
  channel = "",
  recipientId = "",
  pageId = "",
  igUserId = "",
  requestContext = {},
  logger: providedLogger = null,
}) {
  const safeInput = {
    channel: lower(channel),
    recipientId: s(recipientId),
    pageId: s(pageId),
    igUserId: s(igUserId),
  };

  const base = trimSlash(AIHQ_BASE_URL);
  const url = buildUrl(safeInput);
  const timeoutMs = Number(AIHQ_TIMEOUT_MS || 20000);
  const logger = (providedLogger || baseLogger).child?.({
    flow: "meta_tenant_resolution",
    requestId: s(requestContext?.requestId),
    correlationId: s(requestContext?.correlationId),
    channel: safeInput.channel,
    recipientId: safeInput.recipientId,
    pageId: safeInput.pageId,
    igUserId: safeInput.igUserId,
  }) || (providedLogger || baseLogger);

  if (!base) {
    return {
      ok: false,
      status: 0,
      error: "AIHQ_BASE_URL missing",
      tenantKey: "",
      tenantId: "",
      tenant: null,
      channelConfig: null,
      resolvedChannel: safeInput.channel || "",
      input: safeInput,
    };
  }

  if (!url) {
    return {
      ok: false,
      status: 0,
      error: "tenant resolve input missing",
      tenantKey: "",
      tenantId: "",
      tenant: null,
      channelConfig: null,
      resolvedChannel: safeInput.channel || "",
      input: safeInput,
    };
  }

  logger.info("meta.tenant_resolve.requested", {
    base,
    timeoutMs,
    hasInternalToken: Boolean(s(AIHQ_INTERNAL_TOKEN)),
    input: safeInput,
    requestId: s(requestContext?.requestId),
    correlationId: s(requestContext?.correlationId),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const startedAt = Date.now();

    const res = await fetch(url, {
      method: "GET",
      headers: buildHeaders(requestContext),
      signal: controller.signal,
    });

    const tookMs = Date.now() - startedAt;
    const json = await safeReadJson(res);

    logger.info("meta.tenant_resolve.responded", {
      status: res.status,
      tookMs,
      ok: res.ok,
      reasonCode: s(json?.reasonCode || json?.error || ""),
    });

    if (!res.ok || json?.ok === false) {
      return {
        ok: false,
        status: res.status,
        error: json?.error || json?.message || "tenant resolve failed",
        tenantKey: "",
        tenantId: "",
        tenant: null,
        channelConfig: null,
        resolvedChannel: safeInput.channel || "",
        input: safeInput,
        json,
      };
    }

    const checked = validateResolveChannelProjectedResponse(json || {});
    if (!checked.ok) {
      return {
        ok: false,
        status: res.status,
        error: checked.error,
        tenantKey: "",
        tenantId: "",
        tenant: null,
        channelConfig: null,
        resolvedChannel: safeInput.channel || "",
        input: safeInput,
        json,
      };
    }

    const authorityFailure = getRuntimeAuthorityFailure(
      checked.value.projectedRuntime
    );
    if (authorityFailure) {
      logger.warn("meta.tenant_resolve.authority_blocked", {
        status: res.status,
        tenantKey: s(
          checked.value?.tenantKey ||
            checked.value?.projectedRuntime?.tenant?.tenantKey
        ),
        tenantId: s(
          checked.value?.tenantId ||
            checked.value?.projectedRuntime?.tenant?.tenantId
        ),
        reasonCode: authorityFailure.reasonCode,
        authoritySource: s(authorityFailure?.authority?.source),
        runtimeProjectionId: s(authorityFailure?.authority?.runtimeProjectionId),
      });
      return {
        ok: false,
        status: res.status,
        error: authorityFailure.error,
        reasonCode: authorityFailure.reasonCode,
        authority: authorityFailure.authority,
        tenantKey: "",
        tenantId: "",
        tenant: null,
        channelConfig: null,
        resolvedChannel: safeInput.channel || "",
        input: safeInput,
        json,
      };
    }

    return {
      ok: true,
      status: res.status,
      tenantKey: checked.value.tenantKey,
      tenantId: checked.value.tenantId,
      tenant: checked.value.tenant,
      channelConfig: checked.value.channelConfig,
      projectedRuntime: checked.value.projectedRuntime,
      resolvedChannel: s(checked.value.resolvedChannel || safeInput.channel || ""),
      input: safeInput,
      json,
    };
  } catch (err) {
    const error =
      err?.name === "AbortError"
        ? "tenant resolve timeout"
        : String(err?.message || err);

    logger.warn("meta.tenant_resolve.failed", {
      error,
      base,
      timeoutMs,
      hasInternalToken: Boolean(s(AIHQ_INTERNAL_TOKEN)),
      input: safeInput,
    });

    return {
      ok: false,
      status: 0,
      error,
      tenantKey: "",
      tenantId: "",
      tenant: null,
      channelConfig: null,
      resolvedChannel: safeInput.channel || "",
      input: safeInput,
    };
  } finally {
    clearTimeout(timer);
  }
}
