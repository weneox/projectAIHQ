// src/features/setup-studio/lib/setupStudioHelpers.js
// FINAL v2.2 — canonical setup studio helpers with barrier/warning-safe projection

export function arr(value) {
  return Array.isArray(value) ? value : [];
}

export function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lowerText(value = "") {
  return s(value).toLowerCase();
}

export function isBarrierLikeDiscoveryText(value = "") {
  const text = s(value);
  if (!text) return false;

  const normalized = lowerText(text);

  if (
    /^(website|google_maps|googlemaps|source)_(extract|fetch|entry|page|crawl|robots|sitemap|sync)_(timeout|failed|error)(?:_\d+ms)?$/i.test(
      text
    )
  ) {
    return true;
  }

  if (
    /^(http_\d{3}|fetch_failed|non_html_response|robots_disallow_all_detected|sitemap_not_found_or_unreadable|partial_website_extraction)$/i.test(
      text
    )
  ) {
    return true;
  }

  if (
    /\b(timeout|timed out|fetch failed|non html|non-html|robots|sitemap|http_403|http_404|http_429|http_500)\b/i.test(
      text
    )
  ) {
    return true;
  }

  if (normalized === "warning" || normalized === "review required") {
    return true;
  }

  return false;
}

export function sanitizeDiscoveryText(value = "", fallback = "") {
  const text = s(value, fallback);
  if (!text) return "";
  if (isBarrierLikeDiscoveryText(text)) return "";
  return text;
}

function firstMeaningfulDiscoveryValue(...values) {
  for (const value of values) {
    const next = sanitizeDiscoveryText(value);
    if (next) return next;
  }
  return "";
}

function sanitizePreviewCollection(list = [], mapper = null, maxItems = 4, separator = ", ") {
  const out = [];

  for (const item of arr(list)) {
    const raw =
      typeof mapper === "function"
        ? mapper(item)
        : typeof item === "string"
          ? item
          : s(item?.title || item?.name || item?.label || item?.value || item?.description);

    const next = sanitizeDiscoveryText(raw);
    if (!next) continue;
    out.push(next);
    if (out.length >= maxItems) break;
  }

  return out.join(separator);
}

export function truncateMiddle(value = "", start = 28, end = 18) {
  const text = s(value);
  if (!text || text.length <= start + end + 3) return text;
  return `${text.slice(0, start)}...${text.slice(-end)}`;
}

export function firstLanguage(profile) {
  const p = obj(profile);

  if (p.language) return String(p.language);
  if (p.mainLanguage) return String(p.mainLanguage);
  if (p.main_language) return String(p.main_language);

  if (Array.isArray(p.languages) && p.languages[0]) {
    return String(p.languages[0]);
  }

  if (Array.isArray(p.supportedLanguages) && p.supportedLanguages[0]) {
    return String(p.supportedLanguages[0]);
  }

  if (Array.isArray(p.supported_languages) && p.supported_languages[0]) {
    return String(p.supported_languages[0]);
  }

  return "";
}

export function extractItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const candidates = [
    payload.items,
    payload.rows,
    payload.results,
    payload.data,
    payload.entries,
    payload.candidates,
    payload.queue,
    payload.services,
    payload.knowledgeItems,
    payload.knowledge_items,
    payload.playbooks,
  ];

  for (const item of candidates) {
    if (Array.isArray(item)) return item;
  }

  return [];
}

export function parseJsonArray(value) {
  if (Array.isArray(value)) return value;

  if (value && typeof value === "object") {
    return [value];
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") return [parsed];
      return [];
    } catch {
      return [];
    }
  }

  return [];
}

export function compactValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeDiscoveryText(item))
      .filter(Boolean)
      .slice(0, 3)
      .join(" · ");
  }

  if (value && typeof value === "object") {
    return Object.values(value)
      .map((item) => sanitizeDiscoveryText(item))
      .filter(Boolean)
      .slice(0, 3)
      .join(" · ");
  }

  return sanitizeDiscoveryText(value);
}

export function isPendingKnowledge(item = {}) {
  const status = s(
    item.status ||
      item.reviewStatus ||
      item.review_status ||
      item.state
  ).toLowerCase();

  if (!status) return true;

  return ["pending", "needs_review", "conflict", "review", "awaiting_review"].includes(
    status
  );
}

export function candidateTitle(item = {}) {
  return (
    sanitizeDiscoveryText(item.title) ||
    sanitizeDiscoveryText(item.name) ||
    sanitizeDiscoveryText(item.label) ||
    sanitizeDiscoveryText(item.itemKey) ||
    sanitizeDiscoveryText(item.item_key) ||
    sanitizeDiscoveryText(item.key) ||
    sanitizeDiscoveryText(item.canonical_key) ||
    "Untitled discovery"
  );
}

export function candidateCategory(item = {}) {
  return s(item.category || item.candidateGroup || item.candidate_group || "general");
}

export function candidateValue(item = {}) {
  const text = sanitizeDiscoveryText(
    item.valueText ||
      item.value_text ||
      item.normalizedText ||
      item.normalized_text ||
      item.summary ||
      item.description
  );

  if (text) return text;

  const valueJson = obj(item.valueJson || item.value_json);
  const normalizedJson = obj(item.normalizedJson || item.normalized_json);

  const combined =
    sanitizeDiscoveryText(valueJson.question || normalizedJson.question) &&
    sanitizeDiscoveryText(valueJson.answer || normalizedJson.answer)
      ? `${sanitizeDiscoveryText(valueJson.question || normalizedJson.question)} — ${sanitizeDiscoveryText(
          valueJson.answer || normalizedJson.answer
        )}`
      : firstMeaningfulDiscoveryValue(
          valueJson.summary,
          normalizedJson.summary,
          valueJson.text,
          normalizedJson.text,
          valueJson.description,
          normalizedJson.description,
          valueJson.service,
          normalizedJson.service,
          valueJson.product,
          normalizedJson.product,
          valueJson.policy,
          normalizedJson.policy,
          valueJson.address,
          normalizedJson.address,
          valueJson.hours,
          normalizedJson.hours,
          valueJson.email,
          normalizedJson.email,
          valueJson.phone,
          normalizedJson.phone,
          valueJson.url,
          normalizedJson.url,
          valueJson.title,
          normalizedJson.title,
          valueJson.company_name,
          normalizedJson.company_name
        );

  if (combined) return combined;

  const compactJson = compactValue(valueJson);
  if (compactJson) return compactJson;

  const compactNormalized = compactValue(normalizedJson);
  if (compactNormalized) return compactNormalized;

  try {
    const raw = JSON.stringify(valueJson, null, 2);
    return sanitizeDiscoveryText(raw);
  } catch {
    return "";
  }
}

export function evidenceList(item = {}) {
  return [
    ...parseJsonArray(item.sourceEvidenceJson),
    ...parseJsonArray(item.source_evidence_json),
    ...parseJsonArray(item.evidence),
  ].slice(0, 3);
}

export function candidateSource(item = {}) {
  const evidence = evidenceList(item)[0] || {};

  return (
    s(item.sourceDisplayName) ||
    s(item.source_display_name) ||
    s(item.displayName) ||
    s(item.display_name) ||
    s(item.sourceLabel) ||
    s(item.source_label) ||
    s(item.sourceType) ||
    s(item.source_type) ||
    s(item.source_key) ||
    s(evidence.source_label) ||
    s(evidence.sourceLabel) ||
    s(evidence.type) ||
    s(evidence.source_type) ||
    s(evidence.sourceType) ||
    "Unknown source"
  );
}

export function candidateConfidence(item = {}) {
  const n = Number(item.confidence);
  if (!Number.isFinite(n)) return "";

  const percent = n <= 1 ? n * 100 : n;
  return `${Math.round(percent)}%`;
}

export function profilePatchFromDiscovery(profile = {}) {
  const p = obj(profile);
  const languages = arr(p.languages);
  const supportedLanguages = arr(p.supportedLanguages);
  const supportedLanguagesLegacy = arr(p.supported_languages);

  return {
    companyName: firstMeaningfulDiscoveryValue(
      p.companyName,
      p.displayName,
      p.businessName,
      p.name,
      p.title,
      p.brandName,
      p.companyTitle
    ),
    description: firstMeaningfulDiscoveryValue(
      p.description,
      p.summaryShort,
      p.summary,
      p.businessDescription,
      p.about,
      p.companySummaryShort,
      p.companySummaryLong,
      p.summaryLong,
      p.aboutSection
    ),
    timezone: s(p.timezone || p.timeZone),
    language: s(
      p.language ||
        p.mainLanguage ||
        p.main_language ||
        languages[0] ||
        supportedLanguages[0] ||
        supportedLanguagesLegacy[0]
    ),
  };
}

export function mergeBusinessForm(prev, patch = {}) {
  const next = { ...prev };

  if (s(patch.companyName) && !s(prev.companyName)) {
    next.companyName = s(patch.companyName);
  }

  if (s(patch.description) && !s(prev.description)) {
    next.description = s(patch.description);
  }

  if (s(patch.timezone) && !s(prev.timezone)) {
    next.timezone = s(patch.timezone);
  }

  if (s(patch.language) && !s(prev.language)) {
    next.language = s(patch.language);
  }

  return next;
}

export function profilePreviewRows(profile = {}) {
  const p = obj(profile);

  const services = sanitizePreviewCollection(
    arr(p.services),
    (item) => (typeof item === "string" ? item : s(item?.title || item?.name || item?.label)),
    4,
    ", "
  );

  const products = sanitizePreviewCollection(
    arr(p.products),
    (item) => (typeof item === "string" ? item : s(item?.title || item?.name || item?.label)),
    4,
    ", "
  );

  const pricingHints = sanitizePreviewCollection(
    arr(p.pricingHints || p.pricing_hints),
    (item) => (typeof item === "string" ? item : compactValue(item)),
    3,
    " · "
  );

  const socialLinks = sanitizePreviewCollection(
    arr(p.socialLinks || p.social_links),
    (item) => s(item?.platform || item?.url || item),
    4,
    ", "
  );

  const rowDefs = [
    {
      fieldKey: "companyName",
      label: "Name",
      value: firstMeaningfulDiscoveryValue(
        p.companyName,
        p.displayName,
        p.businessName,
        p.name,
        p.title,
        p.brandName,
        p.companyTitle
      ),
    },
    {
      fieldKey: "description",
      label: "Description",
      value: firstMeaningfulDiscoveryValue(
        p.description,
        p.summaryShort,
        p.summary,
        p.businessDescription,
        p.about,
        p.companySummaryShort,
        p.companySummaryLong,
        p.summaryLong,
        p.aboutSection
      ),
    },
    {
      fieldKey: "timezone",
      label: "Timezone",
      value: sanitizeDiscoveryText(p.timezone || p.timeZone),
    },
    {
      fieldKey: "language",
      label: "Language",
      value: sanitizeDiscoveryText(
        p.language ||
          p.mainLanguage ||
          p.main_language ||
          arr(p.languages)[0] ||
          arr(p.supportedLanguages)[0] ||
          arr(p.supported_languages)[0]
      ),
    },
    {
      fieldKey: "websiteUrl",
      label: "Website",
      value: sanitizeDiscoveryText(
        p.websiteUrl || p.website || p.url || p.siteUrl || p.site_url
      ),
    },
    {
      fieldKey: "primaryPhone",
      label: "Phone",
      value: sanitizeDiscoveryText(
        p.primaryPhone || p.primary_phone || arr(p.phones)[0]
      ),
    },
    {
      fieldKey: "primaryEmail",
      label: "Email",
      value: sanitizeDiscoveryText(
        p.primaryEmail || p.primary_email || arr(p.emails)[0]
      ),
    },
    {
      fieldKey: "primaryAddress",
      label: "Address",
      value: sanitizeDiscoveryText(
        p.primaryAddress || p.primary_address || arr(p.addresses)[0]
      ),
    },
    { fieldKey: "services", label: "Services", value: services },
    { fieldKey: "products", label: "Products", value: products },
    { fieldKey: "pricingHints", label: "Pricing", value: pricingHints },
    { fieldKey: "socialLinks", label: "Social", value: socialLinks },
  ];

  return rowDefs
    .filter((row) => s(row.value))
    .map((row) => [row.label, row.value]);
}

function provenanceSourceLabel(source = {}) {
  const item = obj(source);

  return (
    sanitizeDiscoveryText(
      item.label ||
        item.sourceLabel ||
        item.source_label ||
        item.displayName ||
        item.display_name ||
        item.title ||
        item.name ||
        item.sourceType ||
        item.source_type
    ) || ""
  );
}

export function summarizeFieldProvenance(value = {}) {
  const provenance = obj(value);
  const sourceList = arr(
    provenance.sources || provenance.sourceList || provenance.contributors
  );

  const directSource = provenanceSourceLabel(provenance);
  const primarySource = provenanceSourceLabel(
    obj(provenance.primarySource || provenance.primary_source)
  );

  const sourceLabels = [
    primarySource,
    directSource,
    ...sourceList.map((item) => provenanceSourceLabel(item)),
  ].filter(Boolean);

  const dedupedLabels = [...new Set(sourceLabels)];
  const role = sanitizeDiscoveryText(
    provenance.role || provenance.sourceRole || provenance.source_role
  );

  if (dedupedLabels.length && role) {
    return `${dedupedLabels.join(", ")} (${role})`;
  }

  if (dedupedLabels.length) {
    return dedupedLabels.join(", ");
  }

  return sanitizeDiscoveryText(
    provenance.summary ||
      provenance.note ||
      provenance.reason ||
      provenance.display
  );
}

export function profilePreviewRowsWithProvenance(
  profile = {},
  fieldProvenance = {}
) {
  const provenanceMap = obj(fieldProvenance);
  const baseRows = new Map(
    profilePreviewRows(profile).map((row) => [s(row[0]), s(row[1])])
  );
  const rowDefs = [
    { fieldKey: "companyName", label: "Name" },
    { fieldKey: "description", label: "Description" },
    { fieldKey: "timezone", label: "Timezone" },
    { fieldKey: "language", label: "Language" },
    { fieldKey: "websiteUrl", label: "Website" },
    { fieldKey: "primaryPhone", label: "Phone" },
    { fieldKey: "primaryEmail", label: "Email" },
    { fieldKey: "primaryAddress", label: "Address" },
    { fieldKey: "services", label: "Services" },
    { fieldKey: "products", label: "Products" },
    { fieldKey: "pricingHints", label: "Pricing" },
    { fieldKey: "socialLinks", label: "Social" },
  ];

  return rowDefs
    .map((def) => {
      const label = def.label;
      const fieldKey = def.fieldKey;
      const provenance = obj(provenanceMap[fieldKey]);
      const observedValue = compactValue(
        provenance.observedValue ||
          provenance.observed_value ||
          provenance.value
      );
      const value = s(baseRows.get(label) || observedValue);

      if (!value) return null;

      return {
        label,
        value,
        fieldKey,
        provenance: summarizeFieldProvenance(provenance),
      };
    })
    .filter(Boolean);
}

export function discoveryModeLabel(mode = "") {
  const value = s(mode).toLowerCase();

  if (!value || value === "idle") return "Ready to scan";
  if (["running", "queued", "processing", "syncing"].includes(value)) return "AI is scanning";
  if (["partial", "warning", "warnings", "needs_review"].includes(value)) return "Review needed";
  if (["success", "completed", "complete", "done"].includes(value)) return "Scan completed";
  if (["error", "failed"].includes(value)) return "Scan failed";

  return value;
}

export function stepDone(meta, key) {
  const missing = arr(meta?.missingSteps).map((x) => s(x).toLowerCase());
  return !missing.includes(String(key).toLowerCase());
}

function normalizeProgressStage(value = "") {
  const x = s(value).toLowerCase();

  if (["entry", "source"].includes(x)) return "entry";
  if (["identity", "business_profile", "business"].includes(x)) return "identity";
  if (["knowledge", "review"].includes(x)) return "knowledge";
  if (["service", "services"].includes(x)) return "service";
  if (["ready", "launch", "complete"].includes(x)) return "ready";

  return "entry";
}

export function deriveStudioProgress({ importingWebsite, discoveryState, meta }) {
  const readinessScore = Number(meta?.readinessScore || 0);
  const setupCompleted = !!meta?.setupCompleted;
  const missingSteps = arr(meta?.missingSteps);
  const primaryMissingStep = s(meta?.primaryMissingStep);
  const nextRoute = s(meta?.nextRoute || "/");
  const nextSetupRoute = s(meta?.nextSetupRoute || "/setup/studio");
  const nextStudioStage = normalizeProgressStage(meta?.nextStudioStage);
  const readinessLabel = s(meta?.readinessLabel);
  const pendingCandidateCount = Number(meta?.pendingCandidateCount || 0);

  let progressPercent = readinessScore;

  if (setupCompleted) {
    progressPercent = 100;
  } else if (importingWebsite) {
    progressPercent = Math.max(
      24,
      Math.min(76, 36 + pendingCandidateCount * 4)
    );
  } else {
    const mode = s(discoveryState?.mode).toLowerCase();

    if (["success", "completed", "complete", "done"].includes(mode)) {
      progressPercent = Math.max(readinessScore, 72);
    } else if (["partial", "warning", "warnings", "needs_review"].includes(mode)) {
      progressPercent = Math.max(readinessScore, 64);
    } else if (["error", "failed"].includes(mode)) {
      progressPercent = Math.max(12, readinessScore);
    } else {
      progressPercent = Math.max(8, readinessScore);
    }
  }

  return {
    progressPercent,
    readinessScore,
    readinessLabel,
    missingSteps,
    primaryMissingStep,
    nextRoute,
    nextSetupRoute,
    nextStudioStage,
    setupCompleted,
    pendingCandidateCount,
  };
}

export function isSuccessMode(mode = "") {
  return ["success", "completed", "complete", "done", "partial"].includes(
    s(mode).toLowerCase()
  );
}

export function pageTone(mode = "", importingWebsite = false) {
  const value = importingWebsite ? "running" : s(mode).toLowerCase();

  if (["error", "failed"].includes(value)) {
    return {
      dot: "bg-rose-500",
      text: "text-rose-700",
      chip: "border-rose-500/15 bg-rose-500/10 text-rose-700",
    };
  }

  if (["running", "queued", "processing", "syncing"].includes(value)) {
    return {
      dot: "bg-cyan-500",
      text: "text-cyan-700",
      chip: "border-cyan-500/15 bg-cyan-500/10 text-cyan-700",
    };
  }

  if (["partial", "warning", "warnings", "needs_review"].includes(value)) {
    return {
      dot: "bg-amber-500",
      text: "text-amber-700",
      chip: "border-amber-500/15 bg-amber-500/10 text-amber-700",
    };
  }

  if (["success", "completed", "complete", "done"].includes(value)) {
    return {
      dot: "bg-emerald-500",
      text: "text-emerald-700",
      chip: "border-emerald-500/15 bg-emerald-500/10 text-emerald-700",
    };
  }

  return {
    dot: "bg-slate-400",
    text: "text-slate-600",
    chip: "border-slate-900/8 bg-slate-900/5 text-slate-600",
  };
}
