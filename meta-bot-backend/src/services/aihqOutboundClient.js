import { AIHQ_BASE_URL, AIHQ_INTERNAL_TOKEN, AIHQ_TIMEOUT_MS } from "../config.js";
import {
  validateAihqOutboundAckRequest,
  validateAihqOutboundAckResponse,
} from "@aihq/shared-contracts/critical";
import { createStructuredLogger } from "@aihq/shared-contracts/logger";

const logger = createStructuredLogger({
  service: "meta-bot-backend",
  component: "aihq-outbound-client",
});

function s(v) {
  return String(v ?? "").trim();
}

function trimSlash(x) {
  return s(x).replace(/\/+$/, "");
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

export async function notifyAiHqOutbound(payload) {
  const base = trimSlash(AIHQ_BASE_URL);
  const checked = validateAihqOutboundAckRequest(payload);

  if (!checked.ok) {
    logger.warn("meta.outbound.notify.rejected", {
      error: checked.error,
    });
    return {
      ok: false,
      status: 0,
      error: checked.error,
    };
  }

  if (!base) {
    return {
      ok: false,
      status: 0,
      error: "AIHQ_BASE_URL missing",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AIHQ_TIMEOUT_MS);

  try {
    const res = await fetch(`${base}/api/inbox/outbound`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
        ...(AIHQ_INTERNAL_TOKEN ? { "x-internal-token": AIHQ_INTERNAL_TOKEN } : {}),
      },
      body: JSON.stringify(checked.value),
      signal: controller.signal,
    });

    const json = await safeReadJson(res);
    const responseChecked = validateAihqOutboundAckResponse(json || { ok: false });
    if (res.ok && !responseChecked.ok) {
      logger.warn("meta.outbound.notify.invalid_response", {
        status: res.status,
        error: responseChecked.error,
        threadId: checked.value.threadId,
        tenantKey: checked.value.tenantKey,
      });
    }

    return {
      ok: res.ok && responseChecked.ok && json?.ok !== false,
      status: res.status,
      json,
      error: res.ok
        ? responseChecked.ok
          ? null
          : responseChecked.error
        : json?.error || json?.message || "AI HQ outbound notify failed",
    };
  } catch (err) {
    logger.warn("meta.outbound.notify.failed", {
      threadId: checked.value.threadId,
      tenantKey: checked.value.tenantKey,
      error:
        err?.name === "AbortError"
          ? "AI HQ outbound timeout"
          : String(err?.message || err),
    });
    return {
      ok: false,
      status: 0,
      error:
        err?.name === "AbortError"
          ? "AI HQ outbound timeout"
          : String(err?.message || err),
    };
  } finally {
    clearTimeout(timer);
  }
}
