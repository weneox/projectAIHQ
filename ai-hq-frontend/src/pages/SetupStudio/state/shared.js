// src/pages/SetupStudio/state/shared.js

export function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

export function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

export function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

export const KNOWN_LANGS = new Set(["az", "en", "tr", "ru"]);

export const STUDIO_SOURCE_TYPES = new Set([
  "manual",
  "website",
  "instagram",
  "facebook",
  "linkedin",
  "google_maps",
]);

export const IMPORTABLE_STUDIO_SOURCE_TYPES = new Set([
  "website",
  "google_maps",
]);

function lower(value = "") {
  return s(value).toLowerCase();
}

function firstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function firstObject(...values) {
  for (const value of values) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value;
    }
  }
  return {};
}

function boolFrom(...values) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return false;
}

export function createEmptyReviewState() {
  return {
    session: null,
    concurrency: {},
    finalizeProtection: {},
    viewerRole: "member",
    permissions: {},
    sessionMeta: {
      sessionId: "",
      sessionStatus: "",
      revision: "",
      freshness: "unknown",
      stale: false,
      conflicted: false,
      hasRevision: false,
      hasSessionId: false,
      sourceFingerprint: "",
      conflictMessage: "",
    },
    draft: {},
    sources: [],
    events: [],
    bundleSources: [],
    contributionSummary: {},
    fieldProvenance: {},
    reviewDraftSummary: {},
  };
}

export function createEmptyLegacyDraft() {
  return {
    sourceId: "",
    sourceRunId: "",
    snapshotId: "",
    quickSummary: "",
    overview: {},
    capabilities: {},
    sections: {},
    reviewQueue: [],
    existing: {},
    stats: {},
    warnings: [],
    completeness: {},
    confidenceSummary: {},
    rawDraft: {},
    session: null,
    draft: {},
    sources: [],
    events: [],
    reviewRequired: false,
    reviewFlags: [],
    fieldConfidence: {},
    mainLanguage: "",
    primaryLanguage: "",
    reviewSessionId: "",
    reviewSessionStatus: "",
    reviewSessionRevision: "",
    reviewFreshness: "unknown",
    reviewStale: false,
    reviewConflicted: false,
    reviewConflictMessage: "",
    bundleSources: [],
    contributionSummary: {},
    fieldProvenance: {},
    reviewDraftSummary: {},
  };
}

export function createIdleDiscoveryState() {
  return {
    mode: "idle",
    lastUrl: "",
    lastSourceType: "",
    sourceLabel: "",
    message: "",
    candidateCount: 0,
    profileApplied: false,
    shouldReview: false,
    warnings: [],
    requestId: "",
    intakeContext: {},
    profile: {},
    signals: {},
    snapshot: {},
    sourceId: "",
    sourceRunId: "",
    snapshotId: "",
    reviewSessionId: "",
    reviewSessionStatus: "",
    reviewSessionRevision: "",
    reviewFreshness: "unknown",
    reviewStale: false,
    reviewConflicted: false,
    reviewConflictMessage: "",
    hasResults: false,
    resultCount: 0,
    importedKnowledgeItems: [],
    importedServices: [],
    mainLanguage: "",
    primaryLanguage: "",
    reviewRequired: false,
    reviewFlags: [],
    fieldConfidence: {},
  };
}

export function createEmptySourceScope() {
  return {
    sourceType: "",
    sourceUrl: "",
    fingerprint: "",
  };
}

export function pickSetupProfile(setup = {}, workspace = {}) {
  return obj(
    setup?.tenantProfile ||
      setup?.businessProfile ||
      workspace?.tenantProfile ||
      workspace?.businessProfile
  );
}

export function normalizeBootMeta(
  boot = {},
  pendingKnowledge = [],
  serviceItems = []
) {
  const workspace = obj(boot?.workspace);
  const setup = obj(boot?.setup);
  const knowledge = obj(setup?.knowledge || workspace?.knowledge);
  const catalog = obj(setup?.catalog || workspace?.catalog);
  const progress = obj(setup?.progress || workspace?.progress || workspace);
  const runtime = obj(setup?.runtime || workspace?.runtime);

  return {
    readinessScore: Number(
      progress?.readinessScore || workspace?.readinessScore || 0
    ),
    readinessLabel: s(
      progress?.readinessLabel || workspace?.readinessLabel || ""
    ),
    missingSteps: arr(progress?.missingSteps || workspace?.missingSteps),
    primaryMissingStep: s(
      progress?.primaryMissingStep || workspace?.primaryMissingStep || ""
    ),
    nextRoute: s(progress?.nextRoute || workspace?.nextRoute || "/"),
    nextSetupRoute: s(
      progress?.nextSetupRoute || workspace?.nextSetupRoute || "/setup"
    ),
    nextStudioStage: s(
      progress?.nextStudioStage || workspace?.nextStudioStage || ""
    ),
    setupCompleted: !!(
      progress?.setupCompleted ?? workspace?.setupCompleted ?? false
    ),
    pendingCandidateCount: Number(
      knowledge?.pendingCandidateCount || pendingKnowledge.length || 0
    ),
    approvedKnowledgeCount: Number(knowledge?.approvedKnowledgeCount || 0),
    serviceCount: Number(catalog?.serviceCount || serviceItems.length || 0),
    playbookCount: Number(catalog?.playbookCount || 0),
    runtimeKnowledgeCount: Number(runtime?.knowledgeCount || 0),
    runtimeServiceCount: Number(runtime?.serviceCount || 0),
    runtimePlaybookCount: Number(runtime?.playbookCount || 0),
  };
}

export function resolveMainLanguageValue(...candidates) {
  for (const candidate of candidates) {
    const value = s(candidate).toLowerCase();
    if (KNOWN_LANGS.has(value)) return value;
  }
  return "";
}

export function normalizeFieldConfidenceMap(value = {}) {
  const out = {};
  const map = obj(value);

  for (const [key, raw] of Object.entries(map)) {
    if (!s(key)) continue;

    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const score = Number(raw.score ?? raw.value ?? raw.confidence);
      out[key] = {
        score: Number.isFinite(score) ? score : 0,
        label: s(raw.label || raw.confidenceLabel),
      };
      continue;
    }

    const score = Number(raw);
    out[key] = {
      score: Number.isFinite(score) ? score : 0,
      label: "",
    };
  }

  return out;
}

export function extractReviewMetadata(value = {}) {
  const x = obj(value);

  const reviewFlags = arr(
    x.reviewFlags || x.review_flags || x.flags || x.review_flags_list
  )
    .map((item) => s(item))
    .filter(Boolean);

  const fieldConfidence = normalizeFieldConfidenceMap(
    x.fieldConfidence || x.field_confidence
  );

  const mainLanguage = resolveMainLanguageValue(
    x.mainLanguage,
    x.main_language,
    x.primaryLanguage,
    x.primary_language,
    x.language,
    x.sourceLanguage,
    x.source_language
  );

  return {
    reviewRequired: !!(x.reviewRequired ?? x.review_required ?? false),
    reviewFlags,
    fieldConfidence,
    mainLanguage,
    primaryLanguage: mainLanguage,
  };
}

export function normalizeIncomingSourceType(value = "") {
  const x = s(value).toLowerCase().replace(/[\s-]+/g, "_");

  if (x === "manual" || x === "note" || x === "text" || x === "voice") {
    return "manual";
  }

  if (x === "website" || x === "site" || x === "web") return "website";

  if (
    x === "google_maps" ||
    x === "googlemaps" ||
    x === "google_map" ||
    x === "maps" ||
    x === "gmaps"
  ) {
    return "google_maps";
  }

  if (x === "instagram" || x === "ig" || x === "insta") {
    return "instagram";
  }

  if (x === "facebook" || x === "fb" || x === "meta") {
    return "facebook";
  }

  if (x === "linkedin" || x === "li") {
    return "linkedin";
  }

  return "";
}

export function isImportableStudioSourceType(value = "") {
  return IMPORTABLE_STUDIO_SOURCE_TYPES.has(normalizeIncomingSourceType(value));
}

export function detectSourceTypeFromUrl(url = "") {
  const value = lower(url);
  if (!value) return "";

  if (
    value.includes("google.com/maps") ||
    value.includes("maps.app.goo.gl") ||
    value.includes("g.co/kgs") ||
    value.includes("goo.gl/maps")
  ) {
    return "google_maps";
  }

  if (value.includes("instagram.com") || /^@[a-z0-9._]{2,}$/i.test(s(url))) {
    return "instagram";
  }

  if (
    value.includes("facebook.com") ||
    value.includes("fb.com") ||
    value.includes("m.facebook.com")
  ) {
    return "facebook";
  }

  if (value.includes("linkedin.com")) {
    return "linkedin";
  }

  if (
    /^(https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?$/i.test(
      s(url)
    )
  ) {
    return "website";
  }

  return "";
}

function buildStudioSourceLabel(sourceType = "", sourceUrl = "") {
  const normalizedType =
    normalizeIncomingSourceType(sourceType) || detectSourceTypeFromUrl(sourceUrl);

  if (normalizedType === "google_maps") return "Google Maps";
  if (normalizedType === "instagram") return "Instagram";
  if (normalizedType === "facebook") return "Facebook";
  if (normalizedType === "linkedin") return "LinkedIn";
  if (normalizedType === "website") return "Website";
  if (normalizedType === "manual") return "Manual";
  return "Source";
}

function maybeNormalizeImportableUrl(sourceType = "", value = "") {
  const raw = s(value);
  if (!raw) return "";

  const normalizedType = normalizeIncomingSourceType(sourceType);

  if (normalizedType === "website" || normalizedType === "google_maps") {
    return safeNormalizeUrl(raw);
  }

  return raw;
}

function normalizeStudioSourceRecord(item = {}) {
  const x = obj(item);

  const rawType =
    normalizeIncomingSourceType(
      x.sourceType || x.source_type || x.type || x.key
    ) || detectSourceTypeFromUrl(x.url || x.sourceUrl || x.source_url || x.value);

  const rawValue = s(
    x.url ||
      x.sourceUrl ||
      x.source_url ||
      x.sourceValue ||
      x.source_value ||
      x.value ||
      x.websiteUrl ||
      x.website_url ||
      x.handle
  );

  const normalizedValue = maybeNormalizeImportableUrl(rawType, rawValue);

  const label =
    s(x.label) ||
    s(x.title) ||
    s(x.name) ||
    s(x.displayName) ||
    s(x.display_name) ||
    buildStudioSourceLabel(rawType, normalizedValue);

  const isPrimary =
    typeof x.isPrimary === "boolean"
      ? x.isPrimary
      : typeof x.primary === "boolean"
        ? x.primary
        : false;

  if (!rawType && !normalizedValue) return null;

  return {
    sourceType: rawType,
    url: normalizedValue,
    label,
    isPrimary,
  };
}

function normalizeSourceDraftMap(sourceDrafts = {}) {
  const drafts = obj(sourceDrafts);
  const out = [];

  for (const [key, raw] of Object.entries(drafts)) {
    const item = obj(raw);
    const value = s(item.value || item.url || item.sourceUrl || item.sourceValue);
    if (!value) continue;

    const normalizedType = normalizeIncomingSourceType(key);
    if (!normalizedType) continue;

    out.push({
      sourceType: normalizedType,
      url: maybeNormalizeImportableUrl(normalizedType, value),
      label: buildStudioSourceLabel(normalizedType, value),
      isPrimary: false,
    });
  }

  return out;
}

export function safeNormalizeUrl(input = "") {
  const raw = s(input);
  if (!raw) return "";

  if (/^@[a-z0-9._]{2,}$/i.test(raw)) return raw;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;

  return `https://${raw.replace(/^\/+/, "")}`;
}

export function comparableHost(input = "") {
  const raw = s(input);
  if (!raw) return "";

  if (/^@[a-z0-9._]{2,}$/i.test(raw)) {
    return raw.toLowerCase().replace(/^@/, "");
  }

  try {
    const u = new URL(safeNormalizeUrl(raw));
    return s(u.hostname).toLowerCase().replace(/^www\./, "");
  } catch {
    return s(raw)
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split(/[/?#]/)[0];
  }
}

export function comparableUrl(input = "") {
  const raw = s(input);
  if (!raw) return "";

  if (/^@[a-z0-9._]{2,}$/i.test(raw)) {
    return raw.toLowerCase().replace(/^@/, "");
  }

  try {
    const u = new URL(safeNormalizeUrl(raw));
    const host = s(u.hostname).toLowerCase().replace(/^www\./, "");
    const path = s(u.pathname || "/").replace(/\/+$/, "") || "/";
    const search = s(u.search || "");
    return `${host}${path}${search}`;
  } catch {
    return s(raw)
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/+$/, "");
  }
}

export function sourceIdentityKey(sourceType = "", sourceUrl = "") {
  const normalizedType =
    normalizeIncomingSourceType(sourceType) || detectSourceTypeFromUrl(sourceUrl);

  if (!normalizedType && !s(sourceUrl)) return "";

  if (normalizedType === "website") {
    return `website|${comparableHost(sourceUrl)}`;
  }

  if (normalizedType === "instagram") {
    return `instagram|${comparableUrl(sourceUrl)}`;
  }

  if (normalizedType === "facebook") {
    return `facebook|${comparableUrl(sourceUrl)}`;
  }

  if (normalizedType === "linkedin") {
    return `linkedin|${comparableUrl(sourceUrl)}`;
  }

  return `${normalizedType || "unknown"}|${comparableUrl(sourceUrl)}`;
}

function dedupeStudioSources(items = []) {
  const out = [];
  const seen = new Set();

  for (const raw of arr(items)) {
    const item = normalizeStudioSourceRecord(raw);
    if (!item?.sourceType && !item?.url) continue;

    const key = sourceIdentityKey(item.sourceType, item.url);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push(item);
  }

  return out;
}

function firstImportableSource(items = []) {
  return (
    arr(items).find(
      (item) =>
        isImportableStudioSourceType(item?.sourceType) && s(item?.url)
    ) || null
  );
}

function preferredPrimarySource({
  explicitPrimary = null,
  normalizedSources = [],
  fallbackSourceType = "",
  fallbackUrl = "",
} = {}) {
  const explicit = normalizeStudioSourceRecord(explicitPrimary);
  if (explicit?.sourceType || explicit?.url) {
    return {
      ...explicit,
      isPrimary: true,
    };
  }

  const fromList = arr(normalizedSources).find((item) => item.isPrimary);
  if (fromList) {
    return {
      ...fromList,
      isPrimary: true,
    };
  }

  const fallback = normalizeStudioSourceRecord({
    sourceType: fallbackSourceType,
    url: fallbackUrl,
    isPrimary: true,
  });

  if (fallback?.sourceType || fallback?.url) return fallback;
  return null;
}

export function normalizeScanRequest(input, discoveryForm = {}) {
  if (input && typeof input.preventDefault === "function") {
    input.preventDefault();
    return normalizeScanRequest(obj(discoveryForm), {});
  }

  const payload = obj(input);
  const discovery = obj(discoveryForm);

  const singularPayloadSource = normalizeStudioSourceRecord({
    sourceType: payload.sourceType || payload.type || discovery.sourceType,
    url:
      payload.url ||
      payload.sourceUrl ||
      payload.source_value ||
      payload.sourceValue ||
      payload.websiteUrl ||
      discovery.sourceValue ||
      discovery.websiteUrl,
    isPrimary: true,
  });

  const explicitSources = dedupeStudioSources([
    ...arr(payload.sources),
    ...arr(discovery.sources),
    ...normalizeSourceDraftMap(payload.sourceDrafts),
    ...normalizeSourceDraftMap(discovery.sourceDrafts),
    singularPayloadSource,
  ]);

  const fallbackUrl = s(
    payload.url ||
      payload.sourceUrl ||
      payload.source_value ||
      payload.sourceValue ||
      payload.websiteUrl ||
      discovery.sourceValue ||
      discovery.websiteUrl
  );

  const fallbackType =
    normalizeIncomingSourceType(
      payload.sourceType || payload.type || discovery.sourceType
    ) || detectSourceTypeFromUrl(fallbackUrl);

  const primarySource = preferredPrimarySource({
    explicitPrimary: payload.primarySource || discovery.primarySource,
    normalizedSources: explicitSources,
    fallbackSourceType: fallbackType,
    fallbackUrl,
  });

  const normalizedSources = dedupeStudioSources(
    primarySource
      ? [
          ...explicitSources.map((item) => ({
            ...item,
            isPrimary:
              sourceIdentityKey(item.sourceType, item.url) ===
              sourceIdentityKey(primarySource.sourceType, primarySource.url),
          })),
          primarySource,
        ]
      : explicitSources
  );

  const importablePrimary =
    (primarySource &&
    isImportableStudioSourceType(primarySource.sourceType) &&
    s(primarySource.url)
      ? {
          sourceType: primarySource.sourceType,
          url: primarySource.url,
        }
      : null) || firstImportableSource(normalizedSources);

  return {
    sourceType: s(importablePrimary?.sourceType),
    url: s(importablePrimary?.url),
    note: s(payload.note || discovery.note),
    sources: normalizedSources,
    primarySource: primarySource
      ? {
          sourceType: s(primarySource.sourceType),
          url: s(primarySource.url),
          label:
            s(primarySource.label) ||
            buildStudioSourceLabel(primarySource.sourceType, primarySource.url),
          isPrimary: true,
        }
      : null,
    requestedPrimarySourceType: s(primarySource?.sourceType),
    requestedPrimarySourceUrl: s(primarySource?.url),
    sourceCount: normalizedSources.length,
    hasImportableSource: !!(
      s(importablePrimary?.sourceType) && s(importablePrimary?.url)
    ),
    hasUnsupportedSources: normalizedSources.some(
      (item) =>
        !isImportableStudioSourceType(item?.sourceType) && s(item?.url)
    ),
  };
}

export function scanStartLabel(sourceType = "") {
  const x = normalizeIncomingSourceType(sourceType);

  if (x === "google_maps") return "Google Maps scan started...";
  if (x === "instagram") return "Instagram context is being prepared...";
  if (x === "facebook") return "Facebook context is being prepared...";
  if (x === "linkedin") return "LinkedIn context is being prepared...";
  if (x === "manual") return "Building the temporary business draft...";
  return "Website scan started...";
}

export function scanCompleteLabel(sourceType = "", candidateCount = 0) {
  const x = normalizeIncomingSourceType(sourceType);
  const count = Number(candidateCount || 0);

  if (count > 0) {
    return `${count} review candidates are ready.`;
  }

  if (x === "google_maps") return "Google Maps import completed.";
  if (x === "instagram") return "Instagram context is ready.";
  if (x === "facebook") return "Facebook context is ready.";
  if (x === "linkedin") return "LinkedIn context is ready.";
  if (x === "manual") return "Business draft generated.";

  return "Website import completed.";
}

export function applyUiHintsFromMeta({
  nextMeta = {},
  pendingKnowledge = [],
  setShowKnowledge,
}) {
  const stage = s(nextMeta?.nextStudioStage).toLowerCase();

  if (
    ["knowledge", "review", "confirm"].includes(stage) &&
    arr(pendingKnowledge).length > 0
  ) {
    setShowKnowledge(true);
  }
}

function normalizeFreshnessValue(
  value = "",
  { stale = false, conflicted = false, hasRevision = false } = {}
) {
  const raw = lower(value);

  if (conflicted || raw.includes("conflict")) return "conflict";

  if (
    stale ||
    raw.includes("stale") ||
    raw.includes("expired") ||
    raw.includes("out_of_date") ||
    raw.includes("out-of-date") ||
    raw.includes("outdated")
  ) {
    return "stale";
  }

  if (
    raw === "fresh" ||
    raw === "current" ||
    raw === "synced" ||
    raw === "aligned"
  ) {
    return "fresh";
  }

  if (hasRevision) return "unverified";
  return "unknown";
}

function normalizeSessionId(session = {}, meta = {}, payload = {}, review = {}) {
  return firstNonEmpty(
    session.id,
    session.sessionId,
    session.session_id,
    meta.reviewSessionId,
    meta.review_session_id,
    payload.reviewSessionId,
    payload.review_session_id,
    payload.sessionId,
    payload.session_id,
    review.reviewSessionId,
    review.review_session_id
  );
}

function normalizeSessionRevision(
  draft = {},
  session = {},
  meta = {},
  payload = {},
  review = {}
) {
  const concurrency = obj(payload?.concurrency || review?.concurrency);
  return firstNonEmpty(
    draft.version,
    concurrency.draftVersion,
    concurrency.draft_version,
    meta.draftVersion,
    meta.draft_version,
    payload.draftVersion,
    payload.draft_version,
    review?.draft?.version
  );
}

export function extractReviewSessionMeta(payload = {}) {
  const root = obj(payload);
  const review = obj(root?.review || root);
  const session = firstObject(review?.session, root?.session);
  const draft = firstObject(review?.draft, root?.draft);
  const concurrency = firstObject(review?.concurrency, root?.concurrency);
  const meta = firstObject(
    concurrency,
    review?.reviewMeta,
    review?.review_meta,
    review?.meta,
    review?.metadata,
    root?.reviewMeta,
    root?.review_meta,
    root?.meta,
    root?.metadata,
    session?.reviewMeta,
    session?.review_meta,
    session?.meta,
    session?.metadata
  );

  const sessionId = normalizeSessionId(session, meta, root, review);
  const revision = normalizeSessionRevision(draft, session, meta, root, review);
  const sessionStatus = firstNonEmpty(
    session.status,
    concurrency.sessionStatus,
    concurrency.session_status,
    meta.reviewSessionStatus,
    meta.review_session_status,
    meta.status,
    root.reviewSessionStatus
  );

  const conflictMessage = firstNonEmpty(
    session.conflictMessage,
    session.conflict_message,
    meta.conflictMessage,
    meta.conflict_message,
    root.conflictMessage,
    root.conflict_message,
    review.conflictMessage,
    review.conflict_message
  );

  const sourceFingerprint = firstNonEmpty(
    session.sourceFingerprint,
    session.source_fingerprint,
    meta.sourceFingerprint,
    meta.source_fingerprint,
    root.sourceFingerprint,
    root.source_fingerprint,
    review.sourceFingerprint,
    review.source_fingerprint
  );

  const freshnessHint = firstNonEmpty(
    session.freshness,
    session.syncState,
    session.sync_state,
    meta.freshness,
    meta.syncState,
    meta.sync_state,
    root.freshness,
    review.freshness,
    sessionStatus
  );

  const conflicted =
    boolFrom(
      session.conflicted,
      session.conflict,
      session.hasConflict,
      session.has_conflict,
      meta.conflicted,
      meta.conflict,
      meta.hasConflict,
      meta.has_conflict,
      root.conflicted,
      root.conflict,
      review.conflicted,
      review.conflict
    ) ||
    lower(freshnessHint).includes("conflict") ||
    lower(sessionStatus).includes("conflict");

  const stale =
    boolFrom(
      session.stale,
      session.isStale,
      session.is_stale,
      meta.stale,
      meta.isStale,
      meta.is_stale,
      root.stale,
      root.isStale,
      root.is_stale,
      review.stale,
      review.isStale,
      review.is_stale
    ) ||
    /stale|expired|out[_-]?of[_-]?date|outdated/.test(lower(freshnessHint)) ||
    /stale|expired|out[_-]?of[_-]?date|outdated/.test(lower(sessionStatus));

  const freshness = normalizeFreshnessValue(freshnessHint, {
    stale,
    conflicted,
    hasRevision: !!revision,
  });

  return {
    sessionId,
    sessionStatus,
    revision,
    freshness,
    stale: freshness === "stale",
    conflicted: freshness === "conflict",
    hasRevision: !!revision,
    hasSessionId: !!sessionId,
    sourceFingerprint,
    conflictMessage,
  };
}

export function normalizeReviewState(payload = {}) {
  const review = obj(payload?.review || payload);
  const concurrency = firstObject(payload?.concurrency, review?.concurrency);
  const finalizeProtection = firstObject(
    payload?.finalizeProtection,
    review?.finalizeProtection
  );
  const sessionMeta = extractReviewSessionMeta(payload);
  const rawSession = firstObject(review?.session, payload?.session);
  const session =
    sessionMeta.hasSessionId || Object.keys(rawSession).length
      ? {
          ...rawSession,
          id: firstNonEmpty(
            rawSession.id,
            rawSession.sessionId,
            rawSession.session_id,
            sessionMeta.sessionId
          ),
          status: firstNonEmpty(
            rawSession.status,
            rawSession.reviewStatus,
            rawSession.review_status,
            concurrency.sessionStatus,
            concurrency.session_status,
            sessionMeta.sessionStatus
          ),
          revision: firstNonEmpty(
            rawSession.version,
            concurrency.draftVersion,
            concurrency.draft_version,
            sessionMeta.revision
          ),
          freshness: sessionMeta.freshness,
          stale: sessionMeta.stale,
          conflicted: sessionMeta.conflicted,
          sourceFingerprint: firstNonEmpty(
            rawSession.sourceFingerprint,
            rawSession.source_fingerprint,
            sessionMeta.sourceFingerprint
          ),
          conflictMessage: firstNonEmpty(
            rawSession.conflictMessage,
            rawSession.conflict_message,
            sessionMeta.conflictMessage
          ),
        }
      : null;

  return {
    session,
    concurrency,
    finalizeProtection,
    viewerRole: firstNonEmpty(payload?.viewerRole, review?.viewerRole, payload?.role, review?.role),
    permissions: firstObject(payload?.permissions, review?.permissions),
    sessionMeta,
    draft: obj(review?.draft),
    sources: arr(review?.sources),
    events: arr(review?.events),
    bundleSources: firstArray(payload?.bundleSources, review?.bundleSources),
    contributionSummary: firstObject(
      payload?.contributionSummary,
      review?.contributionSummary
    ),
    fieldProvenance: firstObject(
      payload?.fieldProvenance,
      review?.fieldProvenance
    ),
    reviewDraftSummary: firstObject(
      payload?.reviewDraftSummary,
      review?.reviewDraftSummary
    ),
  };
}

export function firstNonEmpty(...values) {
  for (const value of values) {
    const x = s(value);
    if (x) return x;
  }
  return "";
}
