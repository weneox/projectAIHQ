import { cfg } from "../../../config.js";
import { deepFix, fixText } from "../../../utils/textFix.js";

export function s(v) {
  return String(v ?? "").trim();
}

export function safeJson(v, fallback = {}) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return fallback;
  return v;
}

export function normalizeTimestampMs(value) {
  if (value == null || value === "") return Date.now();

  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }

  const raw = String(value).trim();
  if (!raw) return Date.now();

  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (Number.isFinite(n)) {
      return n > 1e12 ? n : n * 1000;
    }
  }

  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return parsed;

  return Date.now();
}

export function nowIso() {
  return new Date().toISOString();
}

export function trimSlash(x) {
  return String(x || "").trim().replace(/\/+$/, "");
}

export async function safeReadJson(res) {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export function getMetaGatewayBaseUrl() {
  return trimSlash(
    cfg?.gateway?.metaBaseUrl ||
      cfg?.gateway?.metaGatewayBaseUrl ||
      cfg?.gateway?.baseUrl ||
      cfg?.meta?.gatewayBaseUrl ||
      cfg?.META_GATEWAY_BASE_URL ||
      cfg?.META_BOT_BACKEND_URL ||
      cfg?.META_GATEWAY_URL ||
      ""
  );
}

export function getMetaGatewayInternalToken() {
  return s(
    cfg?.gateway?.internalToken ||
      cfg?.gateway?.metaInternalToken ||
      cfg?.security?.internalWebhookToken ||
      cfg?.META_GATEWAY_INTERNAL_TOKEN ||
      cfg?.META_BOT_INTERNAL_TOKEN ||
      cfg?.INTERNAL_WEBHOOK_TOKEN ||
      ""
  );
}

export function normalizeComment(row) {
  if (!row) return null;

  return {
    ...row,
    tenant_key: fixText(row.tenant_key || ""),
    channel: fixText(row.channel || ""),
    source: fixText(row.source || ""),
    external_comment_id: fixText(row.external_comment_id || ""),
    external_parent_comment_id: fixText(row.external_parent_comment_id || ""),
    external_post_id: fixText(row.external_post_id || ""),
    external_user_id: fixText(row.external_user_id || ""),
    external_username: fixText(row.external_username || ""),
    customer_name: fixText(row.customer_name || ""),
    text: fixText(row.text || ""),
    classification: deepFix(row.classification || {}),
    raw: deepFix(row.raw || {}),
  };
}

export function normalizeLead(row) {
  if (!row) return null;

  return {
    ...row,
    tenant_key: fixText(row.tenant_key || ""),
    source: fixText(row.source || ""),
    source_ref: fixText(row.source_ref || ""),
    inbox_thread_id: fixText(row.inbox_thread_id || ""),
    proposal_id: fixText(row.proposal_id || ""),
    full_name: fixText(row.full_name || ""),
    username: fixText(row.username || ""),
    company: fixText(row.company || ""),
    phone: fixText(row.phone || ""),
    email: fixText(row.email || ""),
    interest: fixText(row.interest || ""),
    notes: fixText(row.notes || ""),
    stage: fixText(row.stage || ""),
    status: fixText(row.status || ""),
    extra: deepFix(row.extra || {}),
  };
}