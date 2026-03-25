// src/routes/api/settings/sources.js
// FINAL v2.3 â€” db-safe lazy helpers + stable cleanup + stronger summary dedup + promotion quality gate

import express from "express";
import { getAuthTenantId, getAuthTenantKey } from "../../../utils/auth.js";
import { createTenantSourcesHelpers } from "../../../db/helpers/tenantSources.js";
import { createTenantKnowledgeHelpers } from "../../../db/helpers/tenantKnowledge.js";
import { dbUpsertTenantBusinessFact } from "../../../db/helpers/tenantBusinessBrain.js";
import { requireOwnerOrAdmin, auditSafe } from "./utils.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function b(v, d = false) {
  if (typeof v === "boolean") return v;
  const x = String(v ?? "").trim().toLowerCase();
  if (!x) return d;
  if (["1", "true", "yes", "y", "on"].includes(x)) return true;
  if (["0", "false", "no", "n", "off"].includes(x)) return false;
  return d;
}

function obj(v, fallback = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : fallback;
}

function lower(v) {
  return s(v).toLowerCase();
}

function buildSourceSyncReviewState(started = {}) {
  const run = obj(started.run);
  const source = obj(started.source);
  const runMeta = obj(run.metadata_json);
  const sourceMeta = obj(source.metadata_json);

  const sessionId = s(
    run.review_session_id ||
      run.reviewSessionId ||
      source.review_session_id ||
      source.reviewSessionId ||
      runMeta.review_session_id ||
      runMeta.reviewSessionId ||
      sourceMeta.review_session_id ||
      sourceMeta.reviewSessionId
  );

  const projectionStatus = s(
    run.projection_status ||
      run.projectionStatus ||
      source.projection_status ||
      source.projectionStatus ||
      runMeta.projection_status ||
      runMeta.projectionStatus ||
      sourceMeta.projection_status ||
      sourceMeta.projectionStatus ||
      (sessionId ? "review_required" : "")
  );

  const candidateDraftCount = Math.max(
    n(run.candidate_draft_count, 0),
    n(run.candidateDraftCount, 0),
    n(source.candidate_draft_count, 0),
    n(source.candidateDraftCount, 0),
    n(runMeta.candidate_draft_count, 0),
    n(runMeta.candidateDraftCount, 0),
    n(sourceMeta.candidate_draft_count, 0),
    n(sourceMeta.candidateDraftCount, 0)
  );

  const candidateCreatedCount = Math.max(
    n(run.candidate_created_count, 0),
    n(run.candidateCreatedCount, 0),
    n(source.candidate_created_count, 0),
    n(source.candidateCreatedCount, 0),
    n(runMeta.candidate_created_count, 0),
    n(runMeta.candidateCreatedCount, 0),
    n(sourceMeta.candidate_created_count, 0),
    n(sourceMeta.candidateCreatedCount, 0)
  );

  const required =
    !!sessionId ||
    projectionStatus === "review_required" ||
    candidateDraftCount > 0 ||
    candidateCreatedCount > 0;

  return {
    required,
    sessionId,
    projectionStatus,
    candidateDraftCount,
    candidateCreatedCount,
    canonicalProjection: s(
      run.canonical_projection ||
        run.canonicalProjection ||
        source.canonical_projection ||
        source.canonicalProjection ||
        runMeta.canonical_projection ||
        runMeta.canonicalProjection ||
        sourceMeta.canonical_projection ||
        sourceMeta.canonicalProjection ||
        (required ? "deferred_to_review" : "")
    ),
  };
}
function hasDb(db) {
  return Boolean(db && typeof db.query === "function");
}

function bad(res, code, message, extra = {}) {
  return res.status(code).json({
    ok: false,
    error: message,
    ...extra,
  });
}

function ok(res, data = {}) {
  return res.json({
    ok: true,
    ...data,
  });
}

function normalizeSourceType(v) {
  const x = lower(v);
  if (
    [
      "website",
      "instagram",
      "facebook_page",
      "facebook_comments",
      "messenger",
      "whatsapp_business",
      "google_maps",
      "google_business",
      "linkedin",
      "tiktok",
      "youtube",
      "telegram",
      "email",
      "pdf",
      "document",
      "spreadsheet",
      "notion",
      "drive_folder",
      "crm",
      "manual_note",
      "api",
      "other",
    ].includes(x)
  ) {
    return x;
  }
  return "other";
}

function pickUserId(req) {
  return (
    s(req.user?.id) ||
    s(req.session?.user?.id) ||
    s(req.auth?.user?.id) ||
    s(req.body?.by) ||
    s(req.body?.userId) ||
    s(req.headers["x-user-id"])
  );
}

function pickUserName(req) {
  return (
    s(req.user?.name) ||
    s(req.session?.user?.name) ||
    s(req.auth?.user?.name) ||
    s(req.body?.byName) ||
    s(req.headers["x-user-name"])
  );
}

function pickTenantKey(req) {
  return s(getAuthTenantKey(req));
}

function pickTenantId(req) {
  return s(getAuthTenantId(req));
}

function normalizeSourcePayload(body = {}) {
  const permissions = obj(body.permissionsJson || body.permissions || {}, {});
  const settings = obj(body.settingsJson || body.settings || {}, {});
  const metadata = obj(body.metadataJson || body.metadata || {}, {});

  return {
    sourceType: normalizeSourceType(body.sourceType || body.source_type),
    sourceKey: s(body.sourceKey || body.source_key),
    displayName: s(body.displayName || body.display_name),
    status: s(body.status || "pending"),
    authStatus: s(body.authStatus || body.auth_status || "not_required"),
    syncStatus: s(body.syncStatus || body.sync_status || "idle"),
    connectionMode: s(body.connectionMode || body.connection_mode || "manual"),
    accessScope: s(body.accessScope || body.access_scope || "public"),
    sourceUrl: s(body.sourceUrl || body.source_url),
    externalAccountId: s(body.externalAccountId || body.external_account_id),
    externalPageId: s(body.externalPageId || body.external_page_id),
    externalUsername: s(body.externalUsername || body.external_username),
    isEnabled: b(body.isEnabled ?? body.is_enabled, true),
    isPrimary: b(body.isPrimary ?? body.is_primary, false),
    permissionsJson: permissions,
    settingsJson: settings,
    metadataJson: metadata,
  };
}

function normalizeApprovePayload(body = {}) {
  return {
    canonicalKey: s(body.canonicalKey || body.canonical_key),
    category: s(body.category),
    itemKey: s(body.itemKey || body.item_key),
    title: s(body.title),
    valueText: s(body.valueText || body.value_text),
    valueJson: body.valueJson ?? body.value_json,
    normalizedText: s(body.normalizedText || body.normalized_text),
    normalizedJson: body.normalizedJson ?? body.normalized_json,
    priority: body.priority,
    confidence: body.confidence,
    sourceCount: body.sourceCount,
    primarySourceId: s(body.primarySourceId || body.primary_source_id),
    sourceEvidenceJson: body.sourceEvidenceJson ?? body.source_evidence_json,
    approvalMode: s(body.approvalMode || body.approval_mode || "promoted"),
    tagsJson: body.tagsJson ?? body.tags_json,
    metadataJson: body.metadataJson ?? body.metadata_json,
    knowledgeStatus: s(body.knowledgeStatus || body.knowledge_status || "approved"),
    candidateStatus: s(body.candidateStatus || body.candidate_status || "approved"),
    reason: s(body.reason),
  };
}

function pickApprovedCategory(result = {}) {
  const knowledge = result?.knowledge || {};
  const candidate = result?.candidate || {};
  return lower(knowledge.category || candidate.category);
}

function pickApprovedItemKey(result = {}) {
  const knowledge = result?.knowledge || {};
  const candidate = result?.candidate || {};
  return lower(knowledge.item_key || candidate.item_key);
}

function pickApprovedTitle(result = {}) {
  const knowledge = result?.knowledge || {};
  const candidate = result?.candidate || {};
  return (
    s(knowledge.title) ||
    s(candidate.title) ||
    s(knowledge.item_key) ||
    s(candidate.item_key) ||
    "Knowledge Fact"
  );
}

function pickApprovedValueText(result = {}) {
  const knowledge = result?.knowledge || {};
  const candidate = result?.candidate || {};

  return (
    s(knowledge.value_text) ||
    s(candidate.value_text) ||
    s(knowledge.normalized_text) ||
    s(candidate.normalized_text) ||
    s(knowledge.title) ||
    s(candidate.title)
  );
}

function pickApprovedValueJson(result = {}) {
  const knowledge = result?.knowledge || {};
  const candidate = result?.candidate || {};

  if (knowledge.value_json && typeof knowledge.value_json === "object") {
    return knowledge.value_json;
  }
  if (candidate.value_json && typeof candidate.value_json === "object") {
    return candidate.value_json;
  }
  if (knowledge.normalized_json && typeof knowledge.normalized_json === "object") {
    return knowledge.normalized_json;
  }
  if (candidate.normalized_json && typeof candidate.normalized_json === "object") {
    return candidate.normalized_json;
  }
  return {};
}

function normalizeFactGroupFromCategory(category = "") {
  const c = lower(category);

  if (["summary", "company", "brand", "audience", "support", "cta", "claim", "tone"].includes(c)) {
    return "general";
  }
  if (["pricing", "pricing_policy", "offer"].includes(c)) {
    return "pricing";
  }
  if (["policy", "legal"].includes(c)) {
    return "policy";
  }
  if (["contact", "social_link", "channel", "booking", "handoff"].includes(c)) {
    return "contact";
  }
  if (["location", "hours"].includes(c)) {
    return "location";
  }
  if (["service", "product", "faq", "objection", "capability"].includes(c)) {
    return "services";
  }

  return "general";
}

function compactText(x = "", max = 300) {
  const v = s(x).replace(/\s+/g, " ").trim();
  if (!v) return "";
  if (v.length <= max) return v;
  return `${v.slice(0, max - 1).trim()}â€¦`;
}

function safeKeyPart(x = "", fallback = "item", max = 80) {
  const v = lower(x)
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, max);

  return v || fallback;
}

function normalizeFactKeyFromKnowledge(result = {}) {
  const category = pickApprovedCategory(result) || "general";
  const itemKey = safeKeyPart(pickApprovedItemKey(result) || "item", "item", 80);
  return `${category}_${itemKey}`.slice(0, 120);
}

function shouldPromoteKnowledgeToBusinessFact(result = {}) {
  const category = pickApprovedCategory(result);

  return [
    "company",
    "summary",
    "service",
    "product",
    "pricing",
    "pricing_policy",
    "faq",
    "contact",
    "location",
    "hours",
    "tone",
    "brand",
    "policy",
    "cta",
    "social_link",
    "support",
    "booking",
    "handoff",
    "website_title",
    "website_summary",
  ].includes(category);
}

function normalizePromotionCategory(result = {}) {
  const raw = pickApprovedCategory(result);
  if (raw === "website_title") return "company";
  if (raw === "website_summary") return "summary";
  return raw || "summary";
}

function escapeRegex(text = "") {
  return s(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeCompareText(text = "") {
  return lower(text)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeSet(text = "") {
  return new Set(
    normalizeCompareText(text)
      .split(" ")
      .map((x) => x.trim())
      .filter((x) => x.length >= 3)
  );
}

function jaccardSimilarity(a = "", b = "") {
  const sa = tokenizeSet(a);
  const sb = tokenizeSet(b);

  if (!sa.size || !sb.size) return 0;

  let intersection = 0;
  for (const w of sa) {
    if (sb.has(w)) intersection += 1;
  }

  const union = new Set([...sa, ...sb]).size;
  return union ? intersection / union : 0;
}

function isNearDuplicateText(a = "", b = "") {
  const aa = compactText(a, 1800);
  const bb = compactText(b, 1800);
  if (!aa || !bb) return false;

  const na = normalizeCompareText(aa);
  const nb = normalizeCompareText(bb);
  if (!na || !nb) return false;

  if (na === nb) return true;

  if (na.includes(nb) || nb.includes(na)) {
    const shorter = Math.min(na.length, nb.length);
    const longer = Math.max(na.length, nb.length);
    if (shorter >= 24 && shorter / longer >= 0.72) return true;
  }

  const sim = jaccardSimilarity(aa, bb);
  return sim >= 0.86;
}

function sentenceSplit(text = "") {
  return s(text)
    .split(/(?<=[.!?])\s+/)
    .map((x) => compactText(x, 800))
    .filter(Boolean);
}

function dedupeSentences(text = "", max = 1600) {
  const out = [];
  const seen = new Set();

  for (const part of sentenceSplit(text)) {
    const key = normalizeCompareText(part);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }

  return compactText(out.join(" "), max);
}

function pickPossibleBrandFromText(text = "") {
  const x = compactText(text, 300);

  const m1 = x.match(/^([A-Z][A-Z0-9 .&_-]{1,40})\s+is\b/);
  if (m1?.[1]) return s(m1[1]);

  const m2 = x.match(/\s+â€”\s+([A-Z][A-Z0-9 .&_-]{1,40})$/);
  if (m2?.[1]) return s(m2[1]);

  return "";
}

function getBrandHint(result = {}) {
  const valueJson = pickApprovedValueJson(result);
  return (
    s(valueJson.brand) ||
    s(valueJson.company) ||
    s(valueJson.company_name) ||
    s(valueJson.name) ||
    s(valueJson.title) ||
    s(pickApprovedTitle(result))
  );
}

function cleanRepeatedBranding(text = "", brandHint = "") {
  let x = compactText(text, 2400);
  if (!x) return "";

  x = x
    .replace(/\s*[-â€”:]\s*/g, " â€” ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const brand = s(brandHint);
  if (brand) {
    const escaped = escapeRegex(brand);
    const reStart = new RegExp(`^${escaped}\\s*[-â€”:]\\s*`, "i");
    const reEnd = new RegExp(`\\s*[-â€”:]\\s*${escaped}$`, "i");
    x = x.replace(reStart, "").replace(reEnd, "").trim();
  }

  x = x
    .replace(/^([A-Za-z0-9& ._]{2,40})\s+â€”\s+\1\s+â€”\s+/i, "$1 â€” ")
    .replace(/\b([A-Za-z0-9&._]{2,40})\s+â€”\s+\1\b/gi, "$1")
    .trim();

  return x;
}

function stripTrailingBrandTail(text = "", brandHint = "") {
  let x = compactText(text, 2000);
  if (!x) return "";

  if (brandHint) {
    const escaped = escapeRegex(brandHint);
    x = x
      .replace(new RegExp(`\\s+â€”\\s+${escaped}$`, "i"), "")
      .replace(new RegExp(`\\s+-\\s+${escaped}$`, "i"), "")
      .trim();
  }

  x = x
    .replace(/\s+â€”\s+[A-Z][A-Z0-9 .&_-]{1,40}$/, "")
    .replace(/\s+-\s+[A-Z][A-Z0-9 .&_-]{1,40}$/, "")
    .trim();

  return x;
}

function cleanSummaryText(text = "", result = {}) {
  const fallbackBrand = pickPossibleBrandFromText(text);
  const brandHint = getBrandHint(result) || fallbackBrand;

  let x = cleanRepeatedBranding(text, brandHint);

  x = x
    .replace(/\b(home|about|services|contact)\b\s*â€”?\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  x = x
    .replace(/\bAI\s+â€”\s+powered\b/gi, "AI-powered")
    .replace(/\bAI\s*-\s*powered\b/gi, "AI-powered")
    .replace(/\b([A-Za-z]+)\s+â€”\s+powered\b/g, "$1-powered")
    .trim();

  x = stripTrailingBrandTail(x, brandHint);
  x = dedupeSentences(x, 1400);

  return compactText(x, 1400);
}

function normalizeSummaryPromotionText(text = "", result = {}) {
  let x = cleanSummaryText(text, result);

  x = x
    .replace(/^[-â€”â€“:,;\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();

  x = dedupeSentences(x, 1400);

  const parts = x
    .split(/\s+â€”\s+/)
    .map((p) => compactText(p, 800))
    .filter(Boolean);

  const dedupedParts = [];
  for (const part of parts) {
    const exists = dedupedParts.some((p) => isNearDuplicateText(p, part));
    if (!exists) dedupedParts.push(part);
  }

  x = dedupedParts.join(" â€” ");
  x = dedupeSentences(x, 1400);

  return compactText(x, 1400);
}

function isVeryWeakText(text = "") {
  const x = compactText(text, 240);
  if (!x) return true;
  if (x.length < 3) return true;

  const weak = lower(x);
  if (
    [
      "home",
      "about",
      "services",
      "service",
      "contact",
      "read more",
      "learn more",
      "more",
      "details",
      "website title",
      "knowledge fact",
    ].includes(weak)
  ) {
    return true;
  }

  return false;
}

function isLikelyOnlyBrandName(text = "", result = {}) {
  const x = compactText(text, 120);
  if (!x) return false;

  const brandHint = compactText(getBrandHint(result), 120);
  if (!brandHint) return false;

  const normA = normalizeCompareText(x);
  const normB = normalizeCompareText(brandHint);

  if (!normA || !normB) return false;
  return normA === normB;
}

function isWeakCompanyFact(result = {}) {
  const category = normalizePromotionCategory(result);
  const text = compactText(pickApprovedValueText(result), 200);
  const title = compactText(pickApprovedTitle(result), 120);

  if (category !== "company") return false;
  if (isVeryWeakText(text) && isVeryWeakText(title)) return true;

  if (isLikelyOnlyBrandName(text || title, result)) {
    const itemKey = pickApprovedItemKey(result);
    if (["website_title", "about_page"].includes(itemKey)) return true;
  }

  return false;
}

function deriveBetterFactTitle(result = {}) {
  const category = normalizePromotionCategory(result);
  const rawTitle = compactText(pickApprovedTitle(result), 180);
  const cleanedTitle = cleanRepeatedBranding(rawTitle, getBrandHint(result));
  const itemKey = safeKeyPart(pickApprovedItemKey(result) || "item", "item", 60);

  if (category === "summary") {
    const key = pickApprovedItemKey(result);
    if (key.includes("short")) return "Company Summary";
    if (key.includes("long")) return "Company Overview";
    return "Company Summary";
  }

  if (category === "company" && isLikelyOnlyBrandName(cleanedTitle, result)) {
    return "Company Name";
  }

  if (cleanedTitle && !isVeryWeakText(cleanedTitle)) return cleanedTitle;

  const labelMap = {
    company: "Company",
    summary: "Summary",
    service: "Service",
    product: "Product",
    pricing: "Pricing",
    pricing_policy: "Pricing Policy",
    faq: "FAQ",
    contact: "Contact",
    location: "Location",
    hours: "Working Hours",
    tone: "Tone",
    brand: "Brand",
    policy: "Policy",
    cta: "CTA",
    social_link: "Social Link",
    support: "Support",
    booking: "Booking",
    handoff: "Handoff",
  };

  return `${labelMap[category] || "Knowledge"} ${itemKey}`;
}

function deriveBetterValueText(result = {}) {
  const category = normalizePromotionCategory(result);
  const valueJson = pickApprovedValueJson(result);
  const rawText = compactText(pickApprovedValueText(result), 1600);

  if (category === "summary") {
    return normalizeSummaryPromotionText(
      rawText || valueJson.summary || valueJson.text || valueJson.promoted_text || "",
      result
    );
  }

  if (category === "company") {
    const companyName =
      compactText(valueJson.company_name || valueJson.name || valueJson.title || "", 180) ||
      compactText(rawText, 180);

    if (isLikelyOnlyBrandName(companyName, result)) {
      return companyName;
    }

    return cleanSummaryText(
      rawText ||
        valueJson.text ||
        valueJson.summary ||
        valueJson.company_name ||
        valueJson.name ||
        "",
      result
    );
  }

  if (category === "faq") {
    const q = compactText(valueJson.question || "", 240);
    const a = compactText(valueJson.answer || "", 700);
    if (q && a) return `${q} â€” ${a}`;
    if (q) return q;
    return cleanSummaryText(rawText, result);
  }

  if (category === "pricing_policy") {
    return cleanSummaryText(valueJson.policy || valueJson.text || rawText || "", result);
  }

  if (category === "pricing") {
    return cleanSummaryText(
      valueJson.text || valueJson.price || valueJson.label || valueJson.summary || rawText || "",
      result
    );
  }

  if (category === "service") {
    return compactText(valueJson.service || valueJson.name || valueJson.text || rawText || "", 320);
  }

  if (category === "product") {
    return compactText(valueJson.product || valueJson.name || valueJson.text || rawText || "", 320);
  }

  if (category === "contact") {
    return compactText(
      valueJson.email || valueJson.phone || valueJson.url || valueJson.contact || rawText || "",
      500
    );
  }

  if (category === "location") {
    return compactText(valueJson.address || valueJson.location || valueJson.text || rawText || "", 700);
  }

  if (category === "hours") {
    return compactText(valueJson.hours || valueJson.text || rawText || "", 400);
  }

  if (category === "cta") {
    return compactText(valueJson.label || valueJson.text || valueJson.url || rawText || "", 500);
  }

  if (category === "booking") {
    return compactText(valueJson.url || valueJson.text || rawText || "", 500);
  }

  if (category === "social_link") {
    return compactText(valueJson.url || rawText || "", 500);
  }

  if (category === "support") {
    return compactText(valueJson.support_mode || valueJson.text || rawText || "", 600);
  }

  if (category === "brand" || category === "tone") {
    return cleanSummaryText(
      valueJson.summary || valueJson.text || valueJson.title || valueJson.name || rawText || "",
      result
    );
  }

  return cleanSummaryText(rawText, result);
}

function deriveBetterValueJson(result = {}) {
  const category = normalizePromotionCategory(result);
  const source = pickApprovedValueJson(result);
  const text = deriveBetterValueText(result);
  const title = deriveBetterFactTitle(result);

  if (source && Object.keys(source).length) {
    return {
      ...source,
      promoted_category: category,
      promoted_title: title,
      promoted_text: text,
    };
  }

  return {
    promoted_category: category,
    promoted_title: title,
    promoted_text: text,
  };
}

function isMeaningfulPromotionPayload({ title = "", valueText = "", valueJson = {} } = {}) {
  const t = compactText(title, 180);
  const v = compactText(valueText, 1400);
  const keys = Object.keys(obj(valueJson, {}));

  if (v.length >= 5) return true;
  if (t.length >= 5) return true;
  if (keys.length > 0) return true;
  return false;
}

function shouldBlockPromotion(result = {}) {
  const category = normalizePromotionCategory(result);
  const text = deriveBetterValueText(result);
  const title = deriveBetterFactTitle(result);
  const itemKey = pickApprovedItemKey(result);

  if (isVeryWeakText(text) && isVeryWeakText(title)) return true;
  if (category === "company" && isWeakCompanyFact(result)) return true;
  if (category === "summary" && compactText(text, 1400).length < 24) return true;
  if (pickApprovedCategory(result) === "website_title") return true;

  if (category === "summary" && itemKey.includes("long")) {
    const valueJson = pickApprovedValueJson(result);
    const rawSummary = compactText(
      valueJson.summary || valueJson.text || valueJson.promoted_text || pickApprovedValueText(result),
      1600
    );
    const cleaned = normalizeSummaryPromotionText(rawSummary, result);

    if (!cleaned || cleaned.length < 40) return true;
  }

  return false;
}

async function maybePromoteApprovedKnowledgeToBusinessFact(db, tenant, result = {}) {
  if (!hasDb(db)) return null;
  if (!tenant?.tenant_id) return null;
  if (!shouldPromoteKnowledgeToBusinessFact(result)) return null;
  if (shouldBlockPromotion(result)) return null;

  const knowledge = result?.knowledge || {};
  const candidate = result?.candidate || {};
  const normalizedCategory = normalizePromotionCategory(result);

  const title = deriveBetterFactTitle(result);
  const valueText = deriveBetterValueText(result);
  const valueJson = deriveBetterValueJson(result);
  const itemKey = pickApprovedItemKey(result);

  if (!isMeaningfulPromotionPayload({ title, valueText, valueJson })) {
    return null;
  }

  if (normalizedCategory === "summary" && itemKey.includes("long")) {
    const shortFactKey = `${normalizedCategory}_company_summary_short`;
    let existingShort = null;

    try {
      const q = await db.query(
        `
        select value_text
        from tenant_business_facts
        where tenant_id = $1
          and fact_key = $2
        limit 1
        `,
        [tenant.tenant_id, shortFactKey]
      );
      existingShort = s(q?.rows?.[0]?.value_text);
    } catch {
      existingShort = "";
    }

    if (existingShort && isNearDuplicateText(existingShort, valueText)) {
      return null;
    }
  }

  const fact = await dbUpsertTenantBusinessFact(db, tenant.tenant_id, {
    fact_key: normalizeFactKeyFromKnowledge({
      ...result,
      knowledge: {
        ...knowledge,
        category: normalizedCategory,
      },
      candidate: {
        ...candidate,
        category: normalizedCategory,
      },
    }),
    fact_group: normalizeFactGroupFromCategory(normalizedCategory),
    category: normalizedCategory,
    title,
    value_text: valueText,
    value_json: valueJson,
    language: s(knowledge.language || candidate.language || "az") || "az",
    priority: Number.isFinite(Number(knowledge.priority))
      ? Number(knowledge.priority)
      : Number.isFinite(Number(candidate.priority))
        ? Number(candidate.priority)
        : 100,
    enabled: true,
    source_type: "manual",
    source_ref:
      s(knowledge.id) ||
      s(candidate.id) ||
      s(knowledge.canonical_key) ||
      s(candidate.canonical_key),
    meta: {
      knowledgeItemId: s(knowledge.id),
      candidateId: s(candidate.id),
      knowledgeCategory: normalizedCategory,
      knowledgeItemKey: s(knowledge.item_key || candidate.item_key),
      canonicalKey: s(knowledge.canonical_key || candidate.canonical_key),
      promotedFrom: "settings.sources.approve",
      originalCategory: pickApprovedCategory(result),
    },
  });

  return fact;
}

export function settingsSourcesRoutes({ db }) {
  const router = express.Router();

  function requireSettingsWriteRole(req, res) {
    return requireOwnerOrAdmin(req, res);
  }

  function requireDbOr503(res) {
    if (hasDb(db)) return true;
    bad(res, 503, "db disabled", { dbDisabled: true });
    return false;
  }

  function getSources() {
    if (!hasDb(db)) return null;
    return createTenantSourcesHelpers({ db });
  }

  function getKnowledge() {
    if (!hasDb(db)) return null;
    return createTenantKnowledgeHelpers({ db });
  }

  async function resolveTenantOr400(req, res) {
    if (!requireDbOr503(res)) return null;

    const sources = getSources();
    if (!sources) {
      bad(res, 503, "db disabled", { dbDisabled: true });
      return null;
    }

    const tenantId = pickTenantId(req);
    const tenantKey = pickTenantKey(req);

    const tenant = await sources.resolveTenantIdentity({ tenantId, tenantKey });
    if (!tenant) {
      bad(res, 400, "tenant not found");
      return null;
    }
    return tenant;
  }

  router.get("/sources", async (req, res) => {
    try {
      const tenant = await resolveTenantOr400(req, res);
      if (!tenant) return;

      const sources = getSources();
      if (!sources) return bad(res, 503, "db disabled", { dbDisabled: true });

      const items = await sources.listSources({
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        sourceType: s(req.query?.sourceType || req.query?.source_type),
        status: s(req.query?.status),
        isEnabled:
          req.query?.isEnabled != null || req.query?.is_enabled != null
            ? b(req.query?.isEnabled ?? req.query?.is_enabled, true)
            : undefined,
        limit: n(req.query?.limit, 100),
        offset: n(req.query?.offset, 0),
      });

      return ok(res, {
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        items,
        count: items.length,
      });
    } catch (err) {
      return bad(res, 500, err.message || "failed to list sources");
    }
  });

  router.post("/sources", async (req, res) => {
    try {
      const role = requireSettingsWriteRole(req, res);
      if (!role) return;

      const tenant = await resolveTenantOr400(req, res);
      if (!tenant) return;

      const sources = getSources();
      const knowledge = getKnowledge();
      if (!sources || !knowledge) {
        return bad(res, 503, "db disabled", { dbDisabled: true });
      }

      const by = pickUserId(req);
      const payload = normalizeSourcePayload(req.body);

      if (!payload.sourceType) {
        return bad(res, 400, "sourceType is required");
      }

      const item = await sources.upsertSource({
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        ...payload,
        createdBy: by,
        updatedBy: by,
      });

      await knowledge.refreshChannelCapabilitiesFromSources({
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        approvedBy: by,
      });

      await auditSafe(db, req, tenant, "settings.source.created", "tenant_source", item?.id, {
        sourceType: s(item?.source_type),
        sourceKey: s(item?.source_key),
        displayName: s(item?.display_name),
        isPrimary: !!item?.is_primary,
        isEnabled: !!item?.is_enabled,
        syncStatus: s(item?.sync_status),
      });

      return ok(res, { item });
    } catch (err) {
      return bad(res, 500, err.message || "failed to create source");
    }
  });

  router.patch("/sources/:id", async (req, res) => {
    try {
      const role = requireSettingsWriteRole(req, res);
      if (!role) return;

      const tenant = await resolveTenantOr400(req, res);
      if (!tenant) return;

      const sources = getSources();
      const knowledge = getKnowledge();
      if (!sources || !knowledge) return bad(res, 503, "db disabled", { dbDisabled: true });

      const sourceId = s(req.params.id);
      if (!sourceId) return bad(res, 400, "source id is required");

      const current = await sources.getSourceById(sourceId);
      if (!current || current.tenant_id !== tenant.tenant_id) {
        return bad(res, 404, "source not found");
      }

      const by = pickUserId(req);
      const payload = normalizeSourcePayload(req.body);

      const item = await sources.updateSource(sourceId, {
        ...payload,
        displayName:
          req.body?.displayName != null || req.body?.display_name != null
            ? payload.displayName
            : current.display_name,
        status: req.body?.status != null ? payload.status : current.status,
        authStatus:
          req.body?.authStatus != null || req.body?.auth_status != null
            ? payload.authStatus
            : current.auth_status,
        syncStatus:
          req.body?.syncStatus != null || req.body?.sync_status != null
            ? payload.syncStatus
            : current.sync_status,
        connectionMode:
          req.body?.connectionMode != null || req.body?.connection_mode != null
            ? payload.connectionMode
            : current.connection_mode,
        accessScope:
          req.body?.accessScope != null || req.body?.access_scope != null
            ? payload.accessScope
            : current.access_scope,
        sourceUrl:
          req.body?.sourceUrl != null || req.body?.source_url != null
            ? payload.sourceUrl
            : current.source_url,
        externalAccountId:
          req.body?.externalAccountId != null || req.body?.external_account_id != null
            ? payload.externalAccountId
            : current.external_account_id,
        externalPageId:
          req.body?.externalPageId != null || req.body?.external_page_id != null
            ? payload.externalPageId
            : current.external_page_id,
        externalUsername:
          req.body?.externalUsername != null || req.body?.external_username != null
            ? payload.externalUsername
            : current.external_username,
        isEnabled:
          req.body?.isEnabled != null || req.body?.is_enabled != null
            ? payload.isEnabled
            : current.is_enabled,
        isPrimary:
          req.body?.isPrimary != null || req.body?.is_primary != null
            ? payload.isPrimary
            : current.is_primary,
        permissionsJson:
          req.body?.permissionsJson != null || req.body?.permissions != null
            ? payload.permissionsJson
            : current.permissions_json,
        settingsJson:
          req.body?.settingsJson != null || req.body?.settings != null
            ? payload.settingsJson
            : current.settings_json,
        metadataJson:
          req.body?.metadataJson != null || req.body?.metadata != null
            ? payload.metadataJson
            : current.metadata_json,
        updatedBy: by,
      });

      await knowledge.refreshChannelCapabilitiesFromSources({
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        approvedBy: by,
      });

      await auditSafe(db, req, tenant, "settings.source.updated", "tenant_source", item?.id, {
        sourceType: s(item?.source_type),
        sourceKey: s(item?.source_key),
        displayName: s(item?.display_name),
        isPrimary: !!item?.is_primary,
        isEnabled: !!item?.is_enabled,
        syncStatus: s(item?.sync_status),
        status: s(item?.status),
      });

      return ok(res, { item });
    } catch (err) {
      return bad(res, 500, err.message || "failed to update source");
    }
  });

  router.get("/sources/:id/sync-runs", async (req, res) => {
    try {
      const tenant = await resolveTenantOr400(req, res);
      if (!tenant) return;

      const sources = getSources();
      if (!sources) return bad(res, 503, "db disabled", { dbDisabled: true });

      const sourceId = s(req.params.id);
      if (!sourceId) return bad(res, 400, "source id is required");

      const source = await sources.getSourceById(sourceId);
      if (!source || source.tenant_id !== tenant.tenant_id) {
        return bad(res, 404, "source not found");
      }

      const items = await sources.listSyncRuns({
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        sourceId,
        status: s(req.query?.status),
        limit: n(req.query?.limit, 100),
        offset: n(req.query?.offset, 0),
      });

      return ok(res, {
        source,
        items,
        count: items.length,
      });
    } catch (err) {
      return bad(res, 500, err.message || "failed to list sync runs");
    }
  });

  router.post("/sources/:id/sync", async (req, res) => {
    try {
      const role = requireSettingsWriteRole(req, res);
      if (!role) return;

      const tenant = await resolveTenantOr400(req, res);
      if (!tenant) return;

      const sources = getSources();
      if (!sources) return bad(res, 503, "db disabled", { dbDisabled: true });

      const sourceId = s(req.params.id);
      if (!sourceId) return bad(res, 400, "source id is required");

      const source = await sources.getSourceById(sourceId);
      if (!source || source.tenant_id !== tenant.tenant_id) {
        return bad(res, 404, "source not found");
      }

      const by = pickUserId(req);
      const runnerKey = s(req.body?.runnerKey || req.body?.runner_key || "settings.manual");
      const runType = s(req.body?.runType || req.body?.run_type || "sync");
      const triggerType = s(req.body?.triggerType || req.body?.trigger_type || "manual");
      req.log?.info("source_sync.enqueue.requested", {
        sourceId,
        runnerKey,
        runType,
        triggerType,
      });

      const started = await sources.beginSourceSync({
        sourceId,
        requestedBy: by,
        runnerKey,
        runType,
        triggerType,
        metadataJson: {
          workerTaskType: "tenant_source_sync",
          requestId: s(req.requestId),
        },
      });

      req.log?.info("source_sync.enqueued", {
        sourceId,
        runId: s(started.run?.id),
        tenantId: s(tenant.tenant_id),
        tenantKey: s(tenant.tenant_key),
      });

      const review = buildSourceSyncReviewState(started);

      await auditSafe(db, req, tenant, "settings.source.sync.requested", "tenant_source_sync_run", started.run?.id || sourceId, {
        sourceId,
        sourceType: s(started.source?.source_type || source.source_type),
        runId: s(started.run?.id),
        runType,
        triggerType,
        runnerKey,
        review,
      });

      return res.status(202).json({
        ok: true,
        accepted: true,
        message: "sync accepted",
        status: "queued",
        source: started.source,
        run: started.run,
        review,
        poll: {
          sourceId,
          runsPath: `/api/sources/${sourceId}/sync-runs`,
        },
      });
    } catch (err) {
      req.log?.error("source_sync.enqueue.failed", err, {
        sourceId: s(req.params?.id),
      });
      return bad(res, 500, err.message || "failed to start sync");
    }
  });

  router.get("/knowledge/review-queue", async (req, res) => {
    try {
      const tenant = await resolveTenantOr400(req, res);
      if (!tenant) return;

      const knowledge = getKnowledge();
      if (!knowledge) return bad(res, 503, "db disabled", { dbDisabled: true });

      const items = await knowledge.listReviewQueue({
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        category: s(req.query?.category),
        limit: n(req.query?.limit, 100),
        offset: n(req.query?.offset, 0),
      });

      return ok(res, {
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        items,
        count: items.length,
      });
    } catch (err) {
      return bad(res, 500, err.message || "failed to load review queue");
    }
  });

  router.post("/knowledge/:candidateId/approve", async (req, res) => {
    try {
      const role = requireSettingsWriteRole(req, res);
      if (!role) return;

      const tenant = await resolveTenantOr400(req, res);
      if (!tenant) return;

      const knowledge = getKnowledge();
      if (!knowledge) return bad(res, 503, "db disabled", { dbDisabled: true });

      const candidateId = s(req.params.candidateId);
      if (!candidateId) return bad(res, 400, "candidate id is required");

      const candidate = await knowledge.getCandidateById(candidateId);
      if (!candidate || candidate.tenant_id !== tenant.tenant_id) {
        return bad(res, 404, "candidate not found");
      }

      const by = pickUserId(req);
      const reviewerName = pickUserName(req);
      const payload = normalizeApprovePayload(req.body);

      const result = await knowledge.approveCandidate(candidateId, {
        ...payload,
        reviewerType: "human",
        reviewerId: by,
        reviewerName,
        createdBy: by,
        approvedBy: by,
        updatedBy: by,
      });

      const promotedBusinessFact = await maybePromoteApprovedKnowledgeToBusinessFact(
        db,
        tenant,
        result
      );

      await knowledge.refreshChannelCapabilitiesFromSources({
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        approvedBy: by,
      });

      await auditSafe(db, req, tenant, "settings.knowledge.approved", "tenant_knowledge_candidate", candidateId, {
        category: s(result?.knowledge?.category || result?.candidate?.category),
        itemKey: s(result?.knowledge?.item_key || result?.candidate?.item_key),
        knowledgeItemId: s(result?.knowledge?.id),
        approvalId: s(result?.approval?.id),
        promotedBusinessFactId: s(promotedBusinessFact?.id),
        reviewerName,
      });

      return ok(res, {
        ...result,
        promoted: Boolean(promotedBusinessFact),
        promotedBusinessFact: promotedBusinessFact || null,
      });
    } catch (err) {
      return bad(res, 500, err.message || "failed to approve candidate");
    }
  });

  router.post("/knowledge/:candidateId/reject", async (req, res) => {
    try {
      const role = requireSettingsWriteRole(req, res);
      if (!role) return;

      const tenant = await resolveTenantOr400(req, res);
      if (!tenant) return;

      const knowledge = getKnowledge();
      if (!knowledge) return bad(res, 503, "db disabled", { dbDisabled: true });

      const candidateId = s(req.params.candidateId);
      if (!candidateId) return bad(res, 400, "candidate id is required");

      const candidate = await knowledge.getCandidateById(candidateId);
      if (!candidate || candidate.tenant_id !== tenant.tenant_id) {
        return bad(res, 404, "candidate not found");
      }

      const by = pickUserId(req);
      const reviewerName = pickUserName(req);

      const result = await knowledge.rejectCandidate(candidateId, {
        reviewerType: "human",
        reviewerId: by,
        reviewerName,
        reason: s(req.body?.reason),
        metadataJson: obj(req.body?.metadataJson || req.body?.metadata || {}, {}),
      });

      await auditSafe(db, req, tenant, "settings.knowledge.rejected", "tenant_knowledge_candidate", candidateId, {
        category: s(candidate?.category),
        itemKey: s(candidate?.item_key),
        approvalId: s(result?.approval?.id),
        reviewerName,
        reason: s(req.body?.reason),
      });

      return ok(res, result);
    } catch (err) {
      return bad(res, 500, err.message || "failed to reject candidate");
    }
  });
  return router;
}


export const __test__ = {
  buildSourceSyncReviewState,
};




