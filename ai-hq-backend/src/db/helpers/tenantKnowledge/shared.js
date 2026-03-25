export function s(v, d = "") {
  return String(v ?? d).trim();
}

export function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

export function b(v, d = false) {
  if (typeof v === "boolean") return v;
  const x = String(v ?? "").trim().toLowerCase();
  if (!x) return d;
  if (["1", "true", "yes", "y", "on"].includes(x)) return true;
  if (["0", "false", "no", "n", "off"].includes(x)) return false;
  return d;
}

export function obj(v, fallback = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : fallback;
}

export function arr(v, fallback = []) {
  return Array.isArray(v) ? v : fallback;
}

export function iso(v) {
  if (!v) return null;
  try {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

export function lower(v) {
  return s(v).toLowerCase();
}

export function uniq(list = []) {
  return [...new Set(arr(list).filter((x) => x !== undefined && x !== null))];
}

export function hasQueryApi(db) {
  return !!db && typeof db.query === "function";
}

export function hasConnectApi(db) {
  return !!db && typeof db.connect === "function";
}

export function normalizeJson(value, fallback) {
  if (value == null) return fallback;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      return fallback;
    }
  }

  if (typeof value === "object") return value;
  return fallback;
}

export function compactText(text = "", max = 1200) {
  const x = s(text).replace(/\s+/g, " ").trim();
  if (!x) return "";
  if (x.length <= max) return x;
  return `${x.slice(0, max - 1).trim()}…`;
}

export function normalizeCompareText(text = "") {
  return lower(text)
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSameMeaning(a = "", bValue = "") {
  const aa = normalizeCompareText(a);
  const bb = normalizeCompareText(bValue);
  return !!aa && !!bb && aa === bb;
}

export function uniqueJsonList(list = []) {
  const out = [];
  const seen = new Set();

  for (const item of arr(list)) {
    const key = JSON.stringify(item ?? null);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

export function mergeStringList(current = [], incoming = [], maxItems = 50) {
  const out = [];
  const seen = new Set();

  for (const raw of [...arr(current), ...arr(incoming)]) {
    const text = compactText(raw, 500);
    if (!text) continue;

    const key = normalizeCompareText(text);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push(text);

    if (out.length >= maxItems) break;
  }

  return out;
}

export function mergeUrlList(current = [], incoming = [], maxItems = 50) {
  const out = [];
  const seen = new Set();

  for (const raw of [...arr(current), ...arr(incoming)]) {
    const text = s(raw);
    if (!text) continue;

    const key = lower(text);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push(text);

    if (out.length >= maxItems) break;
  }

  return out;
}

export function mergeSocialLinks(current = [], incoming = [], maxItems = 40) {
  const normalized = [...arr(current), ...arr(incoming)]
    .map((item) => ({
      platform: s(item?.platform),
      url: s(item?.url),
    }))
    .filter((item) => item.platform && item.url);

  const out = [];
  const seen = new Set();

  for (const item of normalized) {
    const key = `${lower(item.platform)}|${lower(item.url)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);

    if (out.length >= maxItems) break;
  }

  return out;
}

export function mergeFaqItems(current = [], incoming = [], maxItems = 30) {
  const out = [];
  const seen = new Set();

  for (const item of [...arr(current), ...arr(incoming)]) {
    const question = compactText(item?.question, 300);
    const answer = compactText(item?.answer, 1200);
    if (!question) continue;

    const key = normalizeCompareText(question);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push({ question, answer });

    if (out.length >= maxItems) break;
  }

  return out;
}

export function mergeJsonObjects(current = {}, incoming = {}) {
  const a = obj(current);
  const bValue = obj(incoming);
  const out = { ...a };

  for (const [key, value] of Object.entries(bValue)) {
    if (Array.isArray(value) && Array.isArray(out[key])) {
      out[key] = uniqueJsonList([...out[key], ...value]);
      continue;
    }

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      out[key] &&
      typeof out[key] === "object" &&
      !Array.isArray(out[key])
    ) {
      out[key] = mergeJsonObjects(out[key], value);
      continue;
    }

    out[key] = value;
  }

  return out;
}

export function normalizeCategory(v) {
  const x = lower(v);

  const aliases = {
    website_title: "summary",
    website_summary: "summary",
    company_summary: "summary",
    business_summary: "summary",
  };

  const normalized = aliases[x] || x;

  if (
    [
      "company",
      "summary",
      "service",
      "product",
      "pricing",
      "pricing_policy",
      "offer",
      "faq",
      "objection",
      "contact",
      "location",
      "hours",
      "language",
      "tone",
      "brand",
      "policy",
      "capability",
      "cta",
      "social_link",
      "channel",
      "claim",
      "audience",
      "support",
      "booking",
      "handoff",
      "campaign",
      "legal",
      "other",
    ].includes(normalized)
  ) {
    return normalized;
  }

  return "other";
}

export function normalizeCandidateStatus(v) {
  const x = lower(v);
  if (
    ["pending", "approved", "rejected", "needs_review", "conflict", "superseded", "promoted"].includes(
      x
    )
  ) {
    return x;
  }
  return "pending";
}

export function normalizeConfidenceLabel(v) {
  const x = lower(v);
  if (["low", "medium", "high", "very_high"].includes(x)) return x;
  return "low";
}

export function normalizeKnowledgeStatus(v) {
  const x = lower(v);
  if (["approved", "active", "inactive", "deprecated", "archived"].includes(x)) return x;
  return "approved";
}

export function normalizeApprovalMode(v) {
  const x = lower(v);
  if (["manual", "auto", "promoted", "system"].includes(x)) return x;
  return "manual";
}

export function normalizeApprovalAction(v) {
  const x = lower(v);
  if (
    ["approve", "reject", "merge", "promote", "archive", "restore", "override", "auto_accept", "auto_reject"].includes(
      x
    )
  ) {
    return x;
  }
  return "approve";
}

export function normalizeApprovalDecision(v) {
  const x = lower(v);
  if (
    ["approved", "rejected", "merged", "promoted", "archived", "restored", "overridden"].includes(x)
  ) {
    return x;
  }
  return "approved";
}

export function normalizeReviewerType(v) {
  const x = lower(v);
  if (["human", "ai", "system"].includes(x)) return x;
  return "human";
}

export function normalizeProfileStatus(v) {
  const x = lower(v);
  if (["draft", "review", "approved", "stale", "archived"].includes(x)) return x;
  return "draft";
}

export function normalizeReplyStyle(v) {
  const x = lower(v);
  if (["friendly", "professional", "premium", "luxury", "corporate", "playful", "consultative"].includes(x)) {
    return x;
  }
  return "professional";
}

export function normalizeReplyLength(v) {
  const x = lower(v);
  if (["short", "medium", "detailed"].includes(x)) return x;
  return "medium";
}

export function normalizeEmojiLevel(v) {
  const x = lower(v);
  if (["none", "low", "medium", "high"].includes(x)) return x;
  return "low";
}

export function normalizeCtaStyle(v) {
  const x = lower(v);
  if (["none", "soft", "direct", "strong"].includes(x)) return x;
  return "soft";
}

export function normalizePricingMode(v) {
  const x = lower(v);
  if (["hidden", "starting_price", "fixed_price", "custom_quote", "hybrid"].includes(x)) {
    return x;
  }
  return "custom_quote";
}

export function normalizeBookingMode(v) {
  const x = lower(v);
  if (["disabled", "manual", "form", "calendar", "whatsapp", "instagram", "phone"].includes(x)) {
    return x;
  }
  return "manual";
}

export function normalizeSalesMode(v) {
  const x = lower(v);
  if (["soft", "consultative", "direct", "high_touch"].includes(x)) return x;
  return "consultative";
}

export function normalizeExtractionMethod(v) {
  const x = lower(v);
  if (["ai", "rule", "parser", "ocr", "human", "import", "system"].includes(x)) return x;
  return "ai";
}

export function normalizeConfidence(v, d = 0) {
  const x = Number(v);
  if (!Number.isFinite(x)) return d;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export function buildCanonicalKey(category, itemKey, fallbackValue = "") {
  const c = normalizeCategory(category);
  const k = lower(itemKey).replace(/\s+/g, "_");
  const base = `${c}:${k || "item"}`;

  if (base !== `${c}:item`) return base;

  const extra = lower(fallbackValue)
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);

  return extra ? `${base}:${extra}` : base;
}

export const WRITE_INTENTS = new Set([
  "manual",
  "manual_override",
  "approved_projection",
  "system_safe",
]);

export function normalizeWriteIntent(v, fallback = "manual") {
  const x = lower(v);
  if (WRITE_INTENTS.has(x)) return x;
  return fallback;
}

export function isLikelySystemActor(value = "") {
  const x = lower(value);
  return !!x && /(source_fusion|source_sync|google_maps|website_sync|import|system|crawler|extractor)/i.test(x);
}

export function resolveWriteIntent(input = {}, fallback = "manual") {
  const explicit = normalizeWriteIntent(input.writeIntent, "");
  if (explicit) return explicit;

  const actor = [
    s(input.generatedBy),
    s(input.createdBy),
    s(input.updatedBy),
    s(input.approvedBy),
    s(input.extractionModel),
  ]
    .filter(Boolean)
    .join(" | ");

  if (s(input.approvedBy)) return "approved_projection";
  if (isLikelySystemActor(actor)) return "system_safe";
  return fallback;
}

export function isLikelyBusinessWebsiteUrl(value = "") {
  const x = lower(value);
  if (!x) return false;

  if (
    x.includes("schema.org") ||
    x.includes("google.com") ||
    x.includes("maps.app.goo.gl") ||
    x.includes("googleusercontent.com")
  ) {
    return false;
  }

  try {
    const url = new URL(value);
    return !!url.hostname;
  } catch {
    return false;
  }
}