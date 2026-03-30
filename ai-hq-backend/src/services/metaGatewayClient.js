// src/services/metaGatewayClient.js
import {
  validateMetaInternalOutboundRequest,
  validateMetaCommentActionRequest,
  validateMetaCommentActionResponse,
  validateMetaGatewayOutboundResponse,
} from "@aihq/shared-contracts/critical";

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

function normalizePayload(input = {}) {
  const x = input && typeof input === "object" && !Array.isArray(input) ? input : {};

  return {
    ...x,
    tenantKey: lower(x.tenantKey || x.tenant_key || ""),
    tenantId: s(x.tenantId || x.tenant_id || ""),
    channel: lower(x.channel || "instagram"),
    provider: lower(x.provider || "meta"),
  };
}

function getMetaGatewayConfig() {
  return {
    base: trimSlash(process.env.META_GATEWAY_BASE_URL || ""),
    token: s(process.env.META_GATEWAY_INTERNAL_TOKEN || ""),
    timeoutMs: Number(process.env.META_GATEWAY_TIMEOUT_MS || 20000),
  };
}

export async function sendOutboundViaMetaGateway(payload) {
  const { base, token, timeoutMs } = getMetaGatewayConfig();

  if (!base) {
    return {
      ok: false,
      status: 0,
      error: "META_GATEWAY_BASE_URL missing",
      json: null,
    };
  }

  const bodyPayload = normalizePayload(payload || {});
  const checked = validateMetaInternalOutboundRequestCompat(bodyPayload);
  if (!checked.ok) {
    return {
      ok: false,
      status: 0,
      error: checked.error,
      json: null,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${base}/internal/outbound/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
        ...(token ? { "x-internal-token": token } : {}),
      },
      body: JSON.stringify(checked.value),
      signal: controller.signal,
    });

    const json = await safeReadJson(res);
    const checkedResponse = validateMetaGatewayOutboundResponse(json || { ok: false });

    return {
      ok: res.ok && checkedResponse.ok && json?.ok !== false,
      status: res.status,
      error: res.ok
        ? checkedResponse.ok
          ? null
          : checkedResponse.error
        : json?.error || json?.message || "meta gateway send failed",
      json,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error:
        err?.name === "AbortError"
          ? "meta gateway timeout"
          : String(err?.message || err),
      json: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function sendCommentActionsViaMetaGateway(payload) {
  const { base, token, timeoutMs } = getMetaGatewayConfig();

  if (!base) {
    return {
      ok: false,
      status: 0,
      error: "META_GATEWAY_BASE_URL missing",
      json: null,
      skipped: true,
    };
  }

  const checked = validateMetaCommentActionRequest(payload || {});
  if (!checked.ok) {
    return {
      ok: false,
      status: 0,
      error: checked.error,
      json: null,
      skipped: true,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${base}/internal/comment-actions/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
        ...(token ? { "x-internal-token": token } : {}),
      },
      body: JSON.stringify(checked.value.body),
      signal: controller.signal,
    });

    const json = await safeReadJson(res);
    const checkedResponse = validateMetaCommentActionResponse(json || { ok: false });

    return {
      ok: Boolean(res.ok && checkedResponse.ok && json?.ok !== false),
      status: res.status,
      json,
      error: res.ok
        ? checkedResponse.ok
          ? null
          : checkedResponse.error
        : json?.error || json?.message || "meta gateway failed",
      skipped: false,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error:
        err?.name === "AbortError"
          ? "meta gateway timeout"
          : String(err?.message || err),
      json: null,
      skipped: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

function validateMetaInternalOutboundRequestCompat(payload = {}) {
  if (Array.isArray(payload?.actions) && payload.actions.length > 0) {
    return validateMetaCommentActionRequest(payload);
  }

  return validateMetaInternalOutboundRequest(payload);
}
