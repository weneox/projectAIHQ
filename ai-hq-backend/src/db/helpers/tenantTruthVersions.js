import { q, resolveTenantIdentity } from "./tenantKnowledge/core.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function iso(v) {
  if (!v) return "";
  try {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  } catch {
    return "";
  }
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function compactObject(input = {}) {
  const out = {};

  for (const [key, raw] of Object.entries(obj(input))) {
    if (raw == null) continue;

    if (Array.isArray(raw)) {
      if (raw.length) out[key] = raw;
      continue;
    }

    if (typeof raw === "object") {
      const nested = compactObject(raw);
      if (Object.keys(nested).length) out[key] = nested;
      continue;
    }

    if (typeof raw === "number") {
      if (Number.isFinite(raw)) out[key] = raw;
      continue;
    }

    if (typeof raw === "boolean") {
      out[key] = raw;
      continue;
    }

    const text = s(raw);
    if (text) out[key] = text;
  }

  return out;
}

export function buildCanonicalTruthProfile(profile = {}) {
  const current = obj(profile);
  const profileJson = obj(current.profile_json);

  return compactObject({
    companyName: s(current.company_name || current.display_name || profileJson.companyName || profileJson.displayName),
    displayName: s(current.display_name || profileJson.displayName || current.company_name),
    legalName: s(current.legal_name || profileJson.legalName),
    description: s(
      profileJson.description ||
        current.summary_short ||
        current.value_proposition ||
        current.summary_long
    ),
    summaryShort: s(current.summary_short || profileJson.summaryShort),
    summaryLong: s(current.summary_long || profileJson.summaryLong),
    valueProposition: s(current.value_proposition || profileJson.valueProposition),
    targetAudience: s(current.target_audience || profileJson.targetAudience),
    tone: s(current.tone_profile || profileJson.tone),
    mainLanguage: s(current.main_language || profileJson.mainLanguage),
    supportedLanguages: arr(current.supported_languages).length
      ? arr(current.supported_languages)
      : arr(profileJson.supportedLanguages),
    websiteUrl: s(current.website_url || profileJson.websiteUrl),
    primaryPhone: s(current.primary_phone || profileJson.primaryPhone),
    primaryEmail: s(current.primary_email || profileJson.primaryEmail),
    primaryAddress: s(current.primary_address || profileJson.primaryAddress),
    services: arr(profileJson.services),
    products: arr(profileJson.products),
    pricingHints: arr(profileJson.pricingHints),
    socialLinks: arr(profileJson.socialLinks),
    confidence: toFiniteNumber(current.confidence, 0),
    confidenceLabel: s(current.confidence_label),
    profileStatus: s(current.profile_status),
  });
}

export function buildCanonicalTruthFieldProvenance(profile = {}) {
  const fieldSources = obj(obj(obj(profile).profile_json).fieldSources);
  const out = {};

  for (const [field, raw] of Object.entries(fieldSources)) {
    const item = compactObject({
      sourceType: s(raw?.sourceType || raw?.source_type),
      sourceUrl: s(raw?.sourceUrl || raw?.source_url),
      authorityRank: toFiniteNumber(raw?.authorityRank ?? raw?.authority_rank, 0) || undefined,
      sourceLabel: s(raw?.sourceLabel || raw?.source_label),
      trustTier: s(raw?.trustTier || raw?.trust_tier),
      trustScore:
        toFiniteNumber(raw?.trustScore ?? raw?.trust_score, 0) || undefined,
      freshnessBucket: s(raw?.freshnessBucket || raw?.freshness_bucket),
      conflictClassification: s(
        raw?.conflictClassification || raw?.conflict_classification
      ),
    });

    if (Object.keys(item).length) out[field] = item;
  }

  return out;
}

export function buildCanonicalTruthCapabilities(capabilities = {}) {
  const current = obj(capabilities);
  const capabilitiesJson = obj(current.capabilities_json);

  return compactObject({
    canSharePrices: current.can_share_prices,
    canShareStartingPrices: current.can_share_starting_prices,
    requiresHumanForCustomQuote: current.requires_human_for_custom_quote,
    canCaptureLeads: current.can_capture_leads,
    canCapturePhone: current.can_capture_phone,
    canCaptureEmail: current.can_capture_email,
    canOfferBooking: current.can_offer_booking,
    canOfferConsultation: current.can_offer_consultation,
    canOfferCallback: current.can_offer_callback,
    supportsInstagramDm: current.supports_instagram_dm,
    supportsFacebookMessenger: current.supports_facebook_messenger,
    supportsWhatsapp: current.supports_whatsapp,
    supportsComments: current.supports_comments,
    supportsVoice: current.supports_voice,
    supportsEmail: current.supports_email,
    supportsMultilanguage: current.supports_multilanguage,
    primaryLanguage: s(current.primary_language),
    supportedLanguages: arr(current.supported_languages),
    handoffEnabled: current.handoff_enabled,
    autoHandoffOnHumanRequest: current.auto_handoff_on_human_request,
    autoHandoffOnLowConfidence: current.auto_handoff_on_low_confidence,
    shouldAvoidCompetitorComparisons: current.should_avoid_competitor_comparisons,
    shouldAvoidLegalClaims: current.should_avoid_legal_claims,
    shouldAvoidUnverifiedPromises: current.should_avoid_unverified_promises,
    replyStyle: s(current.reply_style),
    replyLength: s(current.reply_length),
    emojiLevel: s(current.emoji_level),
    ctaStyle: s(current.cta_style),
    pricingMode: s(current.pricing_mode),
    bookingMode: s(current.booking_mode),
    salesMode: s(current.sales_mode),
    capabilities: capabilitiesJson,
  });
}

export function buildCanonicalTruthVersionSnapshot({
  profile = null,
  capabilities = null,
  sourceSummary = null,
  metadata = null,
} = {}) {
  const profileSnapshot = buildCanonicalTruthProfile(profile);
  const capabilitiesSnapshot = buildCanonicalTruthCapabilities(capabilities);
  const fieldProvenance = buildCanonicalTruthFieldProvenance(profile);

  return {
    profileSnapshot,
    capabilitiesSnapshot,
    fieldProvenance,
    sourceSummary: compactObject(sourceSummary || obj(profile?.source_summary_json)),
    metadata: compactObject(metadata),
  };
}

function normalizeVersionRow(row = {}) {
  return {
    id: s(row.id),
    tenant_id: s(row.tenant_id),
    tenant_key: s(row.tenant_key),
    business_profile_id: s(row.business_profile_id),
    business_capabilities_id: s(row.business_capabilities_id),
    review_session_id: s(row.review_session_id),
    previous_version_id: s(row.previous_version_id),
    approved_at: iso(row.approved_at),
    approved_by: s(row.approved_by),
    source_summary_json: obj(row.source_summary_json),
    profile_snapshot_json: obj(row.profile_snapshot_json),
    capabilities_snapshot_json: obj(row.capabilities_snapshot_json),
    field_provenance_json: obj(row.field_provenance_json),
    metadata_json: obj(row.metadata_json),
    created_at: iso(row.created_at),
  };
}

function normalizeComparableValue(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map((item) => normalizeComparableValue(item));
  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = normalizeComparableValue(value[key]);
        return acc;
      }, {});
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  return s(value);
}

function valuesEqual(a, b) {
  return JSON.stringify(normalizeComparableValue(a)) === JSON.stringify(normalizeComparableValue(b));
}

function isPrimitiveArray(value) {
  return Array.isArray(value) && value.every((item) => item == null || ["string", "number", "boolean"].includes(typeof item));
}

export function buildSafeTruthDiffValueSummary(value) {
  if (value == null) return { kind: "empty" };
  if (typeof value === "boolean") return { kind: "boolean", value };
  if (typeof value === "number" && Number.isFinite(value)) return { kind: "number", value };
  if (typeof value === "string") return { kind: "string", value: s(value), length: s(value).length };
  if (isPrimitiveArray(value)) {
    return {
      kind: "array",
      count: value.length,
      items: value.slice(0, 10),
    };
  }
  if (Array.isArray(value)) {
    return {
      kind: "array",
      count: value.length,
    };
  }
  if (isPlainObject(value)) {
    return {
      kind: "object",
      keyCount: Object.keys(value).length,
      keys: Object.keys(value).sort().slice(0, 12),
    };
  }
  return { kind: typeof value };
}

function buildDiffSectionChanges(section, beforeValue, afterValue, path = []) {
  if (valuesEqual(beforeValue, afterValue)) return [];

  if (isPlainObject(beforeValue) || isPlainObject(afterValue)) {
    const beforeObj = isPlainObject(beforeValue) ? beforeValue : {};
    const afterObj = isPlainObject(afterValue) ? afterValue : {};
    const keys = [...new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)])].sort();

    return keys.flatMap((key) =>
      buildDiffSectionChanges(section, beforeObj[key], afterObj[key], [...path, key])
    );
  }

  const fieldPath = [section, ...path].join(".");

  return [
    compactObject({
      path: fieldPath,
      section,
      field: path[0] || section,
      before: beforeValue == null ? undefined : beforeValue,
      after: afterValue == null ? undefined : afterValue,
      beforeSummary: buildSafeTruthDiffValueSummary(beforeValue),
      afterSummary: buildSafeTruthDiffValueSummary(afterValue),
    }),
  ];
}

export function buildTruthVersionCompare(currentVersion = {}, previousVersion = null) {
  const current = normalizeVersionRow(currentVersion);
  const previous = previousVersion ? normalizeVersionRow(previousVersion) : null;
  const changes = [
    ...buildDiffSectionChanges(
      "profile",
      previous?.profile_snapshot_json,
      current.profile_snapshot_json
    ),
    ...buildDiffSectionChanges(
      "capabilities",
      previous?.capabilities_snapshot_json,
      current.capabilities_snapshot_json
    ),
    ...buildDiffSectionChanges(
      "fieldProvenance",
      previous?.field_provenance_json,
      current.field_provenance_json
    ),
    ...buildDiffSectionChanges(
      "sourceSummary",
      previous?.source_summary_json,
      current.source_summary_json
    ),
  ];

  const changedFields = changes.map((item) => item.path);
  const summary = compactObject({
    totalChangedFields: changedFields.length,
    profileChangedFields: changes.filter((item) => item.section === "profile").map((item) => item.path),
    capabilitiesChangedFields: changes
      .filter((item) => item.section === "capabilities")
      .map((item) => item.path),
    fieldProvenanceChangedFields: changes
      .filter((item) => item.section === "fieldProvenance")
      .map((item) => item.path),
    sourceSummaryChangedFields: changes
      .filter((item) => item.section === "sourceSummary")
      .map((item) => item.path),
  });

  return compactObject({
    versionId: current.id,
    previousVersionId: s(current.previous_version_id || previous?.id),
    changedFields,
    fieldChanges: changes,
    summary,
  });
}

function buildTimelineCompareMap(versions = []) {
  const ordered = [...arr(versions)]
    .map((item) => normalizeVersionRow(item))
    .sort((a, b) => {
      const aTime = new Date(a.approved_at || a.created_at || 0).getTime();
      const bTime = new Date(b.approved_at || b.created_at || 0).getTime();
      return aTime - bTime;
    });

  const compareMap = new Map();
  let previous = null;

  for (const version of ordered) {
    const enriched = {
      ...version,
      previous_version_id: s(version.previous_version_id || previous?.id),
    };
    compareMap.set(
      version.id,
      buildTruthVersionCompare(enriched, previous)
    );
    previous = enriched;
  }

  return compareMap;
}

export function buildTruthVersionHistoryEntry(version = {}, compare = null) {
  return compactObject({
    id: s(version.id),
    versionId: s(version.id),
    previousVersionId: s(version.previous_version_id || compare?.previousVersionId),
    approvedAt: s(version.approved_at),
    approvedBy: s(version.approved_by),
    sourceSummary: obj(version.source_summary_json),
    profile: obj(version.profile_snapshot_json),
    capabilities: obj(version.capabilities_snapshot_json),
    fieldProvenance: obj(version.field_provenance_json),
    metadata: obj(version.metadata_json),
    diff: compare || undefined,
  });
}

export function hasTruthVersionChanged(previous = null, next = null) {
  if (!previous) return true;
  if (!next) return false;

  return JSON.stringify({
    sourceSummary: obj(previous.source_summary_json),
    profile: obj(previous.profile_snapshot_json),
    capabilities: obj(previous.capabilities_snapshot_json),
    fieldProvenance: obj(previous.field_provenance_json),
  }) !==
    JSON.stringify({
      sourceSummary: obj(next.source_summary_json),
      profile: obj(next.profile_snapshot_json),
      capabilities: obj(next.capabilities_snapshot_json),
      fieldProvenance: obj(next.field_provenance_json),
    });
}

export async function getLatestTruthVersionInternal(db, { tenantId, tenantKey } = {}) {
  const tenant = await resolveTenantIdentity(db, { tenantId, tenantKey });
  if (!tenant) return null;

  const r = await q(
    db,
    `
    select *
    from tenant_business_profile_versions
    where tenant_id = $1
    order by approved_at desc, created_at desc
    limit 1
    `,
    [tenant.tenant_id]
  );

  return normalizeVersionRow(r.rows?.[0]);
}

export async function listTruthVersionsInternal(
  db,
  { tenantId, tenantKey, limit = 20, offset = 0 } = {},
) {
  const tenant = await resolveTenantIdentity(db, { tenantId, tenantKey });
  if (!tenant) return [];

  const r = await q(
    db,
    `
    select *
    from (
      select
        v.*,
        lag(v.id) over (
          partition by v.tenant_id
          order by v.approved_at asc, v.created_at asc
        ) as previous_version_id
      from tenant_business_profile_versions v
      where v.tenant_id = $1
    ) versions
    order by approved_at desc, created_at desc
    limit $2
    offset $3
    `,
    [tenant.tenant_id, Math.max(1, Math.min(200, Number(limit) || 20)), Math.max(0, Number(offset) || 0)]
  );

  return arr(r.rows).map(normalizeVersionRow);
}

export async function getTruthVersionByIdInternal(
  db,
  { tenantId, tenantKey, versionId } = {},
) {
  const tenant = await resolveTenantIdentity(db, { tenantId, tenantKey });
  if (!tenant || !s(versionId)) return null;

  const r = await q(
    db,
    `
    select *
    from (
      select
        v.*,
        lag(v.id) over (
          partition by v.tenant_id
          order by v.approved_at asc, v.created_at asc
        ) as previous_version_id
      from tenant_business_profile_versions v
      where v.tenant_id = $1
    ) versions
    where id = $2
    limit 1
    `,
    [tenant.tenant_id, s(versionId)]
  );

  return normalizeVersionRow(r.rows?.[0]);
}

export async function createTruthVersionInternal(db, input = {}) {
  const tenant = await resolveTenantIdentity(db, {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
  });
  if (!tenant) {
    throw new Error("tenantTruthVersions.createVersion: tenant not found");
  }

  const approvedAt = input.approvedAt || input.approved_at || new Date().toISOString();
  const approvedBy = s(input.approvedBy || input.approved_by);
  const snapshot = buildCanonicalTruthVersionSnapshot({
    profile: input.profile,
    capabilities: input.capabilities,
    sourceSummary: input.sourceSummaryJson ?? input.source_summary_json,
    metadata: input.metadataJson ?? input.metadata_json,
  });

  if (
    !Object.keys(snapshot.profileSnapshot).length &&
    !Object.keys(snapshot.capabilitiesSnapshot).length
  ) {
    return null;
  }

  const latest = await getLatestTruthVersionInternal(db, {
    tenantId: tenant.tenant_id,
    tenantKey: tenant.tenant_key,
  });

  const pending = {
    source_summary_json: snapshot.sourceSummary,
    profile_snapshot_json: snapshot.profileSnapshot,
    capabilities_snapshot_json: snapshot.capabilitiesSnapshot,
    field_provenance_json: snapshot.fieldProvenance,
  };

  if (!hasTruthVersionChanged(latest, pending)) {
    return null;
  }

  const r = await q(
    db,
    `
    insert into tenant_business_profile_versions (
      tenant_id,
      tenant_key,
      business_profile_id,
      business_capabilities_id,
      review_session_id,
      approved_at,
      approved_by,
      source_summary_json,
      profile_snapshot_json,
      capabilities_snapshot_json,
      field_provenance_json,
      metadata_json
    )
    values (
      $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb
    )
    returning *
    `,
    [
      tenant.tenant_id,
      tenant.tenant_key,
      s(input.businessProfileId || input.business_profile_id) || null,
      s(input.businessCapabilitiesId || input.business_capabilities_id) || null,
      s(input.reviewSessionId || input.review_session_id) || null,
      approvedAt,
      approvedBy,
      JSON.stringify(snapshot.sourceSummary),
      JSON.stringify(snapshot.profileSnapshot),
      JSON.stringify(snapshot.capabilitiesSnapshot),
      JSON.stringify(snapshot.fieldProvenance),
      JSON.stringify(snapshot.metadata),
    ]
  );

  return normalizeVersionRow(r.rows?.[0]);
}

export function createTenantTruthVersionHelpers({ db }) {
  return {
    async listVersions({ tenantId, tenantKey, limit = 20, offset = 0 } = {}) {
      return listTruthVersionsInternal(db, { tenantId, tenantKey, limit, offset });
    },

    async getVersion({ tenantId, tenantKey, versionId } = {}) {
      return getTruthVersionByIdInternal(db, { tenantId, tenantKey, versionId });
    },

    async getLatestVersion({ tenantId, tenantKey } = {}) {
      return getLatestTruthVersionInternal(db, { tenantId, tenantKey });
    },

    async createVersion(input = {}) {
      return createTruthVersionInternal(db, input);
    },

    async compareVersions({
      tenantId,
      tenantKey,
      versionId,
      compareToVersionId = "",
    } = {}) {
      const current = await getTruthVersionByIdInternal(db, {
        tenantId,
        tenantKey,
        versionId,
      });
      if (!current?.id) return null;

      const previous = s(compareToVersionId)
        ? await getTruthVersionByIdInternal(db, {
            tenantId,
            tenantKey,
            versionId: compareToVersionId,
          })
        : current.previous_version_id
          ? await getTruthVersionByIdInternal(db, {
              tenantId,
              tenantKey,
              versionId: current.previous_version_id,
            })
          : null;

      return {
        version: current,
        previousVersion: previous,
        diff: buildTruthVersionCompare(current, previous),
      };
    },

    buildHistoryEntries(versions = []) {
      const compareMap = buildTimelineCompareMap(versions);
      return arr(versions).map((item) =>
        buildTruthVersionHistoryEntry(item, compareMap.get(s(item.id)))
      );
    },
  };
}

export const __test__ = {
  buildCanonicalTruthProfile,
  buildCanonicalTruthFieldProvenance,
  buildCanonicalTruthCapabilities,
  buildCanonicalTruthVersionSnapshot,
  buildSafeTruthDiffValueSummary,
  buildTruthVersionCompare,
  buildTruthVersionHistoryEntry,
  hasTruthVersionChanged,
};
