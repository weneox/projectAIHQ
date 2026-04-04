import { buildCorrelationHeaders } from "@aihq/shared-contracts/logger";

import {
  AIHQ_BASE_URL,
  AIHQ_INTERNAL_SERVICE,
  AIHQ_INTERNAL_TOKEN,
  AIHQ_TIMEOUT_MS,
} from "../config.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function trimSlash(v = "") {
  return s(v).replace(/\/+$/, "");
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
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

function normalizeLifecyclePayload(payload = {}) {
  const source = obj(payload);
  return {
    metaUserId: s(source.metaUserId || source.meta_user_id || source.user_id),
    pageId: s(source.pageId || source.page_id),
    igUserId: s(
      source.igUserId ||
        source.ig_user_id ||
        source.instagram_business_account_id
    ),
    reasonCode: s(source.reasonCode || source.reason_code || "meta_app_deauthorized"),
    occurredAt: s(source.occurredAt || source.occurred_at || new Date().toISOString()),
    signedRequestMeta: obj(source.signedRequestMeta || source.signed_request_meta),
  };
}

export function createAihqMetaChannelLifecycleClient({
  fetchFn = globalThis.fetch?.bind(globalThis),
  baseUrl = AIHQ_BASE_URL,
  internalToken = AIHQ_INTERNAL_TOKEN,
  timeoutMs = AIHQ_TIMEOUT_MS,
} = {}) {
  const root = trimSlash(baseUrl);
  const token = s(internalToken);

  function canUse() {
    return Boolean(root && token && fetchFn);
  }

  async function signalDeauthorize(payload = {}, requestContext = {}) {
    if (!canUse()) {
      return {
        ok: false,
        status: 0,
        error: "aihq_meta_channel_lifecycle_client_not_configured",
        json: null,
      };
    }

    const normalized = normalizeLifecyclePayload(payload);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(timeoutMs || 8000));

    try {
      const res = await fetchFn(`${root}/api/internal/channels/meta/deauthorize`, {
        method: "POST",
        headers: buildCorrelationHeaders({
          requestId: s(requestContext?.requestId),
          correlationId: s(requestContext?.correlationId),
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Accept: "application/json",
            "x-internal-token": token,
            ...(s(AIHQ_INTERNAL_SERVICE)
              ? { "x-internal-service": s(AIHQ_INTERNAL_SERVICE) }
              : {}),
            "x-internal-audience": "aihq-backend.channels.meta-deauthorize",
          },
        }),
        body: JSON.stringify(normalized),
        signal: controller.signal,
      });

      const json = await safeReadJson(res);
      return {
        ok: res.ok && json?.ok !== false,
        status: Number(res.status || 0),
        json,
        error: res.ok ? "" : s(json?.error || json?.message || "aihq_request_failed"),
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        json: null,
        error:
          error?.name === "AbortError"
            ? "aihq_meta_channel_lifecycle_timeout"
            : s(error?.message || error),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    canUse,
    signalDeauthorize,
  };
}
