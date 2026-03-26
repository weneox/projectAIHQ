// src/services/n8nClient.js
import { N8N_TIMEOUT_MS, N8N_WEBHOOK_URL } from "../config.js";
import { createStructuredLogger } from "@aihq/shared-contracts/logger";
import { recordRuntimeSignal } from "./runtimeReliability.js";

const logger = createStructuredLogger({
  service: "meta-bot-backend",
  component: "n8n-client",
});

// Node 18+ fetch var. Node 16 olarsa fallback (undici).
let fetchFn = globalThis.fetch;
if (!fetchFn) {
  try {
    const undici = await import("undici");
    fetchFn = undici.fetch;
  } catch {
    // fetch yoxdursa, forwardToN8n error qaytaracaq
  }
}

export async function forwardToN8n(payload) {
  if (!N8N_WEBHOOK_URL) {
    logger.warn("meta.n8n.unavailable", {
      reason: "missing_webhook_url",
    });
    recordRuntimeSignal({
      level: "warn",
      category: "n8n",
      code: "meta_n8n_unavailable",
      reasonCode: "missing_webhook_url",
    });
    return { ok: false, error: "N8N_WEBHOOK_URL missing" };
  }
  if (!fetchFn) {
    logger.warn("meta.n8n.unavailable", {
      reason: "fetch_unavailable",
    });
    recordRuntimeSignal({
      level: "error",
      category: "n8n",
      code: "meta_n8n_unavailable",
      reasonCode: "fetch_unavailable",
    });
    return { ok: false, error: "fetch not available" };
  }

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), N8N_TIMEOUT_MS);

  try {
    const r = await fetchFn(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });

    const text = await r.text().catch(() => "");
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // n8n plain text qaytara bilər
    }

    return { ok: r.ok, status: r.status, text, json };
  } catch (err) {
    recordRuntimeSignal({
      level: "error",
      category: "n8n",
      code: "meta_n8n_request_failed",
      reasonCode: err?.name === "AbortError" ? "timeout" : "request_failed",
      error: String(err?.message || err),
    });
    return { ok: false, error: String(err?.message || err) };
  } finally {
    clearTimeout(t);
  }
}
