import {
  getBusinessCapabilitiesInternal,
  getBusinessProfileInternal,
  q,
  refreshRuntimeProjectionRequired,
  resolveTenantIdentity,
  withTx,
} from "./tenantKnowledge/core.js";
import {
  upsertBusinessCapabilitiesInternal,
  upsertBusinessProfileInternal,
} from "./tenantKnowledge/writers.js";
import { safeAppendDecisionEvent } from "./decisionEvents.js";
import { dbAudit } from "./audit.js";
import { normalizeRole } from "../../utils/roles.js";

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

function uniqStrings(items = []) {
  return [...new Set(arr(items).map((item) => s(item)).filter(Boolean))];
}

function lower(value = "", fallback = "") {
  return s(value, fallback).toLowerCase();
}

function mergeObjects(...values) {
  return values.reduce((acc, value) => {
    for (const [key, next] of Object.entries(obj(value))) {
      acc[key] = next;
    }
    return acc;
  }, {});
}

function normalizeComparisonList(items = []) {
  return uniqStrings(items).sort((a, b) => a.localeCompare(b));
}

function comparePreviewToActualDimension(previewItems = [], actualItems = []) {
  const preview = normalizeComparisonList(previewItems);
  const actual = normalizeComparisonList(actualItems);

  if (!preview.length && !actual.length) {
    return {
      status: "unknown",
      matched: null,
      previewUnknown: true,
      missingFromActual: [],
      addedInActual: [],
    };
  }

  const missingFromActual = preview.filter((item) => !actual.includes(item));
  const addedInActual = actual.filter((item) => !preview.includes(item));
  const matched = missingFromActual.length === 0 && addedInActual.length === 0;

  return {
    status: matched ? "matched" : "differs",
    matched,
    previewUnknown: !preview.length,
    missingFromActual,
    addedInActual,
  };
}

function summarizeComparison(dimensions = []) {
  const usable = arr(dimensions).filter(Boolean);
  if (!usable.length) return "unknown";
  if (usable.some((item) => item.status === "differs")) return "partial_match";
  if (usable.every((item) => item.status === "unknown")) return "unknown";
  if (usable.some((item) => item.previewUnknown)) return "partial_match";
  return "matched";
}

function buildActorDisplay(actor = {}) {
  return (
    s(actor?.user?.email) ||
    s(actor?.user?.name) ||
    s(actor?.user?.full_name) ||
    s(actor?.user?.fullName) ||
    s(actor?.user?.id) ||
    s(actor?.actorName) ||
    "system"
  );
}

function titleize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (item) => item.toUpperCase());
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

function inferRuntimeImpactFromPaths(paths = []) {
  const runtimeAreas = new Set();
  const surfaces = new Set();

  for (const path of arr(paths).map((item) => s(item))) {
    const lowerPath = path.toLowerCase();

    if (
      lowerPath.includes("profile.primaryphone") ||
      lowerPath.includes("profile.primaryemail") ||
      lowerPath.includes("profile.primaryaddress") ||
      lowerPath.includes("profile.sociallinks")
    ) {
      runtimeAreas.add("contact_channels");
      surfaces.add("voice");
      surfaces.add("inbox");
    }

    if (
      lowerPath.includes("profile.companyname") ||
      lowerPath.includes("profile.displayname") ||
      lowerPath.includes("profile.description") ||
      lowerPath.includes("profile.summary") ||
      lowerPath.includes("profile.websiteurl") ||
      lowerPath.includes("profile.targetaudience") ||
      lowerPath.includes("profile.tone") ||
      lowerPath.includes("profile.mainlanguage")
    ) {
      runtimeAreas.add("tenant_profile");
      surfaces.add("inbox");
    }

    if (
      lowerPath.includes("capabilities.autohandoff") ||
      lowerPath.includes("capabilities.shouldavoid") ||
      lowerPath.includes("capabilities.handoffenabled") ||
      lowerPath.includes("capabilities.salesmode") ||
      lowerPath.includes("capabilities.pricingmode") ||
      lowerPath.includes("capabilities.bookingmode")
    ) {
      runtimeAreas.add("behavioral_policy");
      surfaces.add("voice");
      surfaces.add("automation_executions");
    }

    if (
      lowerPath.includes("capabilities.supports") ||
      lowerPath.includes("capabilities.canoffer") ||
      lowerPath.includes("capabilities.cancapture")
    ) {
      runtimeAreas.add("channel_capabilities");
      surfaces.add("inbox");
      surfaces.add("automation_executions");
    }
  }

  return {
    runtimeAreasLikelyAffected: [...runtimeAreas],
    affectedSurfaces: [...surfaces],
  };
}

function inferAutonomyDeltaFromPaths(paths = []) {
  const lowerPaths = arr(paths).map((item) => s(item).toLowerCase());
  if (
    lowerPaths.some((path) =>
      path.includes("capabilities.autohandoff") ||
      path.includes("capabilities.supports") ||
      path.includes("capabilities.canoffer")
    )
  ) {
    return "review_required";
  }
  if (
    lowerPaths.some((path) =>
      path.includes("profile.primaryphone") ||
      path.includes("profile.primaryemail") ||
      path.includes("profile.websiteurl") ||
      path.includes("profile.summary")
    )
  ) {
    return "follow_up_required";
  }
  return "safe";
}

function summarizeValueCounts(fieldChanges = []) {
  const summary = {
    added: 0,
    removed: 0,
    changed: 0,
  };

  for (const change of arr(fieldChanges)) {
    const hasBefore = change?.beforeSummary?.kind && change.beforeSummary.kind !== "empty";
    const hasAfter = change?.afterSummary?.kind && change.afterSummary.kind !== "empty";

    if (!hasBefore && hasAfter) {
      summary.added += 1;
    } else if (hasBefore && !hasAfter) {
      summary.removed += 1;
    } else {
      summary.changed += 1;
    }
  }

  return summary;
}

export function buildTruthVersionDiffModel(currentVersion = {}, previousVersion = null) {
  const current = normalizeVersionRow(currentVersion);
  const previous = previousVersion ? normalizeVersionRow(previousVersion) : null;
  const compare = buildTruthVersionCompare(current, previous);
  const canonicalPathsChanged = uniqStrings(compare.changedFields);
  const canonicalAreasChanged = uniqStrings(
    canonicalPathsChanged.map((path) => {
      if (path.startsWith("profile.")) return "business_profile";
      if (path.startsWith("capabilities.")) return "business_capabilities";
      if (path.startsWith("fieldProvenance.")) return "truth_provenance";
      if (path.startsWith("sourceSummary.")) return "truth_source_summary";
      return "";
    })
  );
  const inferred = inferRuntimeImpactFromPaths(canonicalPathsChanged);
  const valueSummary = summarizeValueCounts(compare.fieldChanges);

  return compactObject({
    fromVersion: compactObject({
      id: s(previous?.id),
      version: s(previous?.id),
      approvedAt: s(previous?.approved_at),
      approvedBy: s(previous?.approved_by),
    }),
    toVersion: compactObject({
      id: s(current?.id),
      version: s(current?.id),
      approvedAt: s(current?.approved_at),
      approvedBy: s(current?.approved_by),
    }),
    canonicalAreasChanged,
    canonicalPathsChanged,
    runtimeAreasLikelyAffected: inferred.runtimeAreasLikelyAffected,
    affectedSurfaces: inferred.affectedSurfaces,
    autonomyImpact: inferAutonomyDeltaFromPaths(canonicalPathsChanged),
    valueSummary: {
      ...valueSummary,
      changedFields: canonicalPathsChanged,
    },
    summaryExplanation: canonicalPathsChanged.length
      ? `${canonicalPathsChanged.length} canonical field change${
          canonicalPathsChanged.length === 1 ? "" : "s"
        } span ${canonicalAreasChanged.length || 1} governed area${
          canonicalAreasChanged.length === 1 ? "" : "s"
        }.`
      : "No canonical differences were exposed for these truth versions.",
  });
}

export function buildRollbackActionContract({
  currentVersion = {},
  targetVersion = {},
  rollbackPreview = {},
  viewerRole = "",
} = {}) {
  const role = normalizeRole(viewerRole);
  const currentId = s(currentVersion?.id);
  const targetId = s(targetVersion?.id);
  const disposition = lower(rollbackPreview?.rollbackDisposition);
  const label = "Execute governed rollback";

  if (!targetId) {
    return {
      actionType: "execute_safe_rollback",
      label,
      allowed: false,
      requiredRole: "operator",
      reason: "The selected rollback target could not be resolved.",
    };
  }

  if (!currentId) {
    return {
      actionType: "execute_safe_rollback",
      label,
      allowed: false,
      requiredRole: "operator",
      reason: "Current approved truth is unavailable, so governed rollback cannot start safely.",
    };
  }

  if (currentId === targetId) {
    return {
      actionType: "execute_safe_rollback",
      label,
      allowed: false,
      requiredRole: "operator",
      reason: "This version already matches current approved truth, so no governed rollback is required.",
    };
  }

  if (!["operator", "admin", "owner"].includes(role)) {
    return {
      actionType: "execute_safe_rollback",
      label,
      allowed: false,
      requiredRole: "operator",
      reason: "Only operator, admin, or owner roles can request governed rollback.",
    };
  }

  if (disposition === "review_required" && role !== "owner") {
    return {
      actionType: "execute_safe_rollback",
      label,
      allowed: false,
      requiredRole: "owner",
      reason:
        "This rollback affects higher-impact policy/runtime surfaces and requires owner review before execution.",
    };
  }

  if (disposition === "follow_up_required" && !["admin", "owner"].includes(role)) {
    return {
      actionType: "execute_safe_rollback",
      label,
      allowed: false,
      requiredRole: "admin",
      reason:
        "This rollback will require runtime follow-up, so operator execution is not permitted.",
    };
  }

  return {
    actionType: "execute_safe_rollback",
    label,
    allowed: true,
    requiredRole:
      disposition === "review_required"
        ? "owner"
        : disposition === "follow_up_required"
          ? "admin"
          : "operator",
    reason:
      disposition === "review_required"
        ? "Owner approval is required because rollback touches higher-impact runtime or policy posture."
        : disposition === "follow_up_required"
          ? "Rollback is allowed, but runtime verification and follow-up will still be required."
          : "Rollback is allowed inside the governed truth workflow.",
  };
}

export function buildRollbackPreviewModel({
  currentVersion = {},
  targetVersion = {},
  viewerRole = "",
} = {}) {
  const current = normalizeVersionRow(currentVersion);
  const target = normalizeVersionRow(targetVersion);
  const revertDiff = buildTruthVersionDiffModel(target, current);
  const readinessImplications = [];
  let rollbackDisposition = "safe";

  if (arr(revertDiff.runtimeAreasLikelyAffected).length) {
    readinessImplications.push(
      "Runtime projection refresh will be required before governed runtime reflects the rollback."
    );
    rollbackDisposition = "follow_up_required";
  }

  if (arr(revertDiff.runtimeAreasLikelyAffected).includes("behavioral_policy")) {
    readinessImplications.push(
      "Behavioral policy surfaces may require additional operator review after rollback."
    );
    rollbackDisposition = "review_required";
  }

  if (!arr(revertDiff.canonicalPathsChanged).length) {
    readinessImplications.push(
      "The selected version already matches current approved truth."
    );
  }

  return compactObject({
    currentApprovedVersion: compactObject({
      id: s(current.id),
      version: s(current.id),
      approvedAt: s(current.approved_at),
      approvedBy: s(current.approved_by),
    }),
    targetRollbackVersion: compactObject({
      id: s(target.id),
      version: s(target.id),
      approvedAt: s(target.approved_at),
      approvedBy: s(target.approved_by),
    }),
    canonicalAreasChangedBack: arr(revertDiff.canonicalAreasChanged),
    canonicalPathsChangedBack: arr(revertDiff.canonicalPathsChanged),
    runtimeAreasLikelyAffected: arr(revertDiff.runtimeAreasLikelyAffected),
    affectedSurfaces: arr(revertDiff.affectedSurfaces),
    postureImpact: {
      autonomyDelta:
        rollbackDisposition === "review_required"
          ? "tightens"
          : rollbackDisposition === "follow_up_required"
            ? "reviewable"
            : "unchanged",
    },
    readinessImplications,
    rollbackDisposition,
    summaryExplanation: arr(revertDiff.canonicalPathsChanged).length
      ? `Rolling back to ${target.id || "the selected version"} would revert ${
          revertDiff.canonicalPathsChanged.length
        } canonical field${revertDiff.canonicalPathsChanged.length === 1 ? "" : "s"} and ${
          arr(revertDiff.runtimeAreasLikelyAffected).length
            ? "trigger runtime follow-up."
            : "leave runtime impact limited."
        }`
      : "This rollback target matches the current approved version, so no governed revert would be necessary.",
    action: buildRollbackActionContract({
      currentVersion: current,
      targetVersion: target,
      rollbackPreview: {
        rollbackDisposition,
      },
      viewerRole,
    }),
  });
}

function buildRollbackSourceSummary(targetVersion = {}, currentVersion = {}, preview = {}, receipt = {}) {
  return mergeObjects(obj(targetVersion?.source_summary_json), {
    rollback: {
      requestedAt: s(receipt?.timestamp || new Date().toISOString()),
      sourceCurrentVersionId: s(currentVersion?.id),
      targetRollbackVersionId: s(targetVersion?.id),
      resultingTruthVersionId: s(receipt?.resultingTruthVersionId),
      rollbackStatus: s(receipt?.rollbackStatus),
      previewDisposition: s(preview?.rollbackDisposition),
      summaryExplanation: s(receipt?.summaryExplanation),
    },
  });
}

function buildRollbackProfileInput(targetVersion = {}, actorName = "", metadataJson = {}, sourceSummaryJson = {}) {
  const snapshot = obj(targetVersion?.profile_snapshot_json);
  return {
    companyName: snapshot.companyName,
    displayName: snapshot.displayName,
    legalName: snapshot.legalName,
    summaryShort: snapshot.summaryShort,
    summaryLong: snapshot.summaryLong,
    valueProposition: snapshot.valueProposition,
    targetAudience: snapshot.targetAudience,
    toneProfile: snapshot.tone,
    mainLanguage: snapshot.mainLanguage,
    supportedLanguages: arr(snapshot.supportedLanguages),
    websiteUrl: snapshot.websiteUrl,
    primaryPhone: snapshot.primaryPhone,
    primaryEmail: snapshot.primaryEmail,
    primaryAddress: snapshot.primaryAddress,
    profileJson: mergeObjects(snapshot, {
      fieldSources: obj(targetVersion?.field_provenance_json),
      rollbackSourceVersionId: s(targetVersion?.id),
    }),
    sourceSummaryJson,
    metadataJson,
    profileStatus: "approved",
    approvedBy: actorName,
    approvedAt: new Date().toISOString(),
    generatedBy: actorName,
  };
}

function buildRollbackCapabilitiesInput(targetVersion = {}, actorName = "", metadataJson = {}) {
  const snapshot = obj(targetVersion?.capabilities_snapshot_json);
  return {
    canSharePrices: snapshot.canSharePrices,
    canShareStartingPrices: snapshot.canShareStartingPrices,
    requiresHumanForCustomQuote: snapshot.requiresHumanForCustomQuote,
    canCaptureLeads: snapshot.canCaptureLeads,
    canCapturePhone: snapshot.canCapturePhone,
    canCaptureEmail: snapshot.canCaptureEmail,
    canOfferBooking: snapshot.canOfferBooking,
    canOfferConsultation: snapshot.canOfferConsultation,
    canOfferCallback: snapshot.canOfferCallback,
    supportsInstagramDm: snapshot.supportsInstagramDm,
    supportsFacebookMessenger: snapshot.supportsFacebookMessenger,
    supportsWhatsapp: snapshot.supportsWhatsapp,
    supportsComments: snapshot.supportsComments,
    supportsVoice: snapshot.supportsVoice,
    supportsEmail: snapshot.supportsEmail,
    supportsMultilanguage: snapshot.supportsMultilanguage,
    primaryLanguage: snapshot.primaryLanguage,
    supportedLanguages: arr(snapshot.supportedLanguages),
    handoffEnabled: snapshot.handoffEnabled,
    autoHandoffOnHumanRequest: snapshot.autoHandoffOnHumanRequest,
    autoHandoffOnLowConfidence: snapshot.autoHandoffOnLowConfidence,
    shouldAvoidCompetitorComparisons: snapshot.shouldAvoidCompetitorComparisons,
    shouldAvoidLegalClaims: snapshot.shouldAvoidLegalClaims,
    shouldAvoidUnverifiedPromises: snapshot.shouldAvoidUnverifiedPromises,
    replyStyle: snapshot.replyStyle,
    replyLength: snapshot.replyLength,
    emojiLevel: snapshot.emojiLevel,
    ctaStyle: snapshot.ctaStyle,
    pricingMode: snapshot.pricingMode,
    bookingMode: snapshot.bookingMode,
    salesMode: snapshot.salesMode,
    capabilitiesJson: obj(snapshot.capabilities),
    metadataJson,
    approvedBy: actorName,
  };
}

export function buildRollbackBlockedReceipt({
  currentVersion = {},
  targetVersion = {},
  rollbackPreview = {},
  rollbackAction = {},
  actor = "",
  timestamp = "",
  reasonCode = "rollback_blocked",
} = {}) {
  const canonical = comparePreviewToActualDimension(
    rollbackPreview?.canonicalAreasChangedBack,
    []
  );
  const runtime = comparePreviewToActualDimension(
    rollbackPreview?.runtimeAreasLikelyAffected,
    []
  );
  const channels = comparePreviewToActualDimension(
    rollbackPreview?.affectedSurfaces,
    []
  );

  return {
    rollbackActionResult: "blocked",
    rollbackStatus: "blocked",
    sourceCurrentVersion: compactObject({
      id: s(currentVersion?.id),
      version: s(currentVersion?.id),
      approvedAt: s(currentVersion?.approved_at),
      approvedBy: s(currentVersion?.approved_by),
    }),
    targetRollbackVersion: compactObject({
      id: s(targetVersion?.id),
      version: s(targetVersion?.id),
      approvedAt: s(targetVersion?.approved_at),
      approvedBy: s(targetVersion?.approved_by),
    }),
    resultingTruthVersionId: "",
    runtimeProjectionId: "",
    runtimeRefreshResult: "blocked",
    actual: {
      canonical: { areas: [], paths: [] },
      runtime: { areas: [], paths: [] },
      channels: { affectedSurfaces: [] },
      policy: {
        autonomyDelta: "unknown",
        executionPostureDelta: "unknown",
        riskDelta: "unknown",
      },
    },
    previewComparison: {
      status: "unknown",
      previewHadUnknowns: true,
      canonical,
      runtime,
      channels,
    },
    verification: {
      truthVersionCreated: false,
      runtimeProjectionRefreshed: false,
      projectionHealthStatus: "",
      runtimeControlWarnings: [s(rollbackAction?.reason)],
      repairRecommendation: "",
    },
    actor: s(actor),
    timestamp: s(timestamp || new Date().toISOString()),
    summaryExplanation:
      s(rollbackAction?.reason) ||
      "Governed rollback was blocked before canonical truth could be changed.",
    reasonCode: s(reasonCode),
  };
}

export function buildRollbackReceipt({
  currentVersion = {},
  targetVersion = {},
  resultingTruthVersion = {},
  runtimeProjection = null,
  runtimeError = null,
  rollbackPreview = {},
  actor = "",
  timestamp = "",
} = {}) {
  const actualDiff = buildTruthVersionDiffModel(resultingTruthVersion, currentVersion);
  const runtimeProjectionSafe = obj(runtimeProjection);
  const runtimeHealth = obj(runtimeProjectionSafe.health);
  const actualCanonicalAreas = normalizeComparisonList(actualDiff.canonicalAreasChanged);
  const actualCanonicalPaths = normalizeComparisonList(actualDiff.canonicalPathsChanged);
  const actualRuntimeAreas = runtimeProjectionSafe.id
    ? normalizeComparisonList(actualDiff.runtimeAreasLikelyAffected)
    : [];
  const actualRuntimePaths = runtimeProjectionSafe.id
    ? normalizeComparisonList(actualDiff.canonicalPathsChanged)
    : [];
  const actualAffectedSurfaces = runtimeProjectionSafe.id
    ? normalizeComparisonList(
        runtimeProjectionSafe.affectedSurfaces ||
          runtimeProjectionSafe.affected_surfaces ||
          actualDiff.affectedSurfaces
      )
    : [];

  const canonicalComparison = comparePreviewToActualDimension(
    rollbackPreview?.canonicalAreasChangedBack,
    actualCanonicalAreas
  );
  const runtimeComparison = comparePreviewToActualDimension(
    rollbackPreview?.runtimeAreasLikelyAffected,
    actualRuntimeAreas
  );
  const channelsComparison = comparePreviewToActualDimension(
    rollbackPreview?.affectedSurfaces,
    actualAffectedSurfaces
  );
  const comparisonStatus = summarizeComparison([
    canonicalComparison,
    runtimeComparison,
    channelsComparison,
  ]);
  const projectionHealthStatus = lower(
    runtimeHealth.status ||
      runtimeProjectionSafe.healthStatus ||
      runtimeProjectionSafe.health_status ||
      runtimeProjectionSafe.status
  );
  const runtimeRefreshResult = lower(
    runtimeProjectionSafe.refreshResult ||
      runtimeProjectionSafe.refresh_result ||
      runtimeProjectionSafe.status ||
      (runtimeError ? "failed" : runtimeProjectionSafe.id ? "refreshed" : "")
  );
  const runtimeControlWarnings = uniqStrings([
    ...arr(runtimeHealth.warnings),
    ...arr(runtimeProjectionSafe.warnings),
    s(runtimeError?.message),
  ]);
  const repairRecommendation = s(
    runtimeProjectionSafe.repairRecommendation ||
      runtimeProjectionSafe.repair_recommendation ||
      runtimeHealth.repairRecommendation ||
      runtimeHealth.repair_recommendation ||
      (runtimeError
        ? "Repair runtime projection before trusting rollback in governed runtime."
        : "")
  );

  let rollbackStatus = "success";
  if (runtimeError) {
    rollbackStatus = "repair_required";
  } else if (
    runtimeControlWarnings.length ||
    repairRecommendation ||
    ["pending", "queued", "refresh_required"].includes(runtimeRefreshResult)
  ) {
    rollbackStatus = "follow_up_required";
  } else if (!resultingTruthVersion?.id || comparisonStatus === "partial_match") {
    rollbackStatus = "partial_success";
  }

  const summaryBits = [
    rollbackStatus === "success"
      ? "Rollback completed and verification matched the governed revert path."
      : rollbackStatus === "repair_required"
        ? "Rollback committed, but runtime verification requires repair before governed runtime is considered clean."
        : rollbackStatus === "follow_up_required"
          ? "Rollback committed, but follow-up is required before the governed revert path is fully clean."
          : "Rollback committed with partial verification detail.",
    actualCanonicalAreas.length
      ? `Canonical impact: ${actualCanonicalAreas.join(", ")}.`
      : "Canonical impact could not be verified precisely.",
    runtimeProjectionSafe.id
      ? `Runtime projection ${runtimeProjectionSafe.id} recorded ${runtimeRefreshResult || "an update"}.`
      : "Runtime projection verification was unavailable.",
    comparisonStatus === "matched"
      ? "Rollback preview matched the verified outcome."
      : comparisonStatus === "partial_match"
        ? "Rollback preview comparison stayed partial because some impact dimensions were unknown."
        : "Rollback preview comparison was unavailable.",
  ];

  return {
    rollbackActionResult: "executed",
    rollbackStatus,
    sourceCurrentVersion: compactObject({
      id: s(currentVersion?.id),
      version: s(currentVersion?.id),
      approvedAt: s(currentVersion?.approved_at),
      approvedBy: s(currentVersion?.approved_by),
    }),
    targetRollbackVersion: compactObject({
      id: s(targetVersion?.id),
      version: s(targetVersion?.id),
      approvedAt: s(targetVersion?.approved_at),
      approvedBy: s(targetVersion?.approved_by),
    }),
    resultingTruthVersion: compactObject({
      id: s(resultingTruthVersion?.id),
      version: s(resultingTruthVersion?.id),
      approvedAt: s(resultingTruthVersion?.approved_at),
      approvedBy: s(resultingTruthVersion?.approved_by),
    }),
    sourceCurrentVersionId: s(currentVersion?.id),
    targetRollbackVersionId: s(targetVersion?.id),
    resultingTruthVersionId: s(resultingTruthVersion?.id),
    runtimeProjectionId: s(runtimeProjectionSafe.id),
    runtimeRefreshResult,
    actual: {
      canonical: {
        areas: actualCanonicalAreas,
        paths: actualCanonicalPaths,
      },
      runtime: {
        areas: actualRuntimeAreas,
        paths: actualRuntimePaths,
      },
      channels: {
        affectedSurfaces: actualAffectedSurfaces,
      },
      policy: {
        autonomyDelta:
          lower(runtimeHealth.autonomousAllowed) === "false"
            ? "tightens"
            : lower(runtimeProjectionSafe.autonomyDelta || runtimeProjectionSafe.autonomy_delta || "unknown"),
        executionPostureDelta: lower(
          runtimeProjectionSafe.executionPostureDelta ||
            runtimeProjectionSafe.execution_posture_delta ||
            "unknown"
        ),
        riskDelta: lower(runtimeProjectionSafe.riskDelta || runtimeProjectionSafe.risk_delta || "unknown"),
      },
    },
    previewComparison: {
      status: comparisonStatus,
      previewHadUnknowns:
        canonicalComparison.previewUnknown ||
        runtimeComparison.previewUnknown ||
        channelsComparison.previewUnknown,
      canonical: canonicalComparison,
      runtime: runtimeComparison,
      channels: channelsComparison,
    },
    verification: {
      truthVersionCreated: Boolean(resultingTruthVersion?.id),
      runtimeProjectionRefreshed: Boolean(runtimeProjectionSafe.id),
      projectionHealthStatus,
      runtimeControlWarnings,
      repairRecommendation,
    },
    actor: s(actor),
    timestamp: s(timestamp || new Date().toISOString()),
    summaryExplanation: summaryBits.join(" "),
  };
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

export async function executeTruthVersionRollbackInternal(db, input = {}, deps = {}) {
  const resolveTenant = deps.resolveTenantIdentity || resolveTenantIdentity;
  const getVersion = deps.getTruthVersionByIdInternal || getTruthVersionByIdInternal;
  const getLatestVersion = deps.getLatestTruthVersionInternal || getLatestTruthVersionInternal;
  const runWithTx = deps.withTx || withTx;
  const getProfile = deps.getBusinessProfileInternal || getBusinessProfileInternal;
  const getCapabilities =
    deps.getBusinessCapabilitiesInternal || getBusinessCapabilitiesInternal;
  const upsertProfile = deps.upsertBusinessProfileInternal || upsertBusinessProfileInternal;
  const upsertCapabilities =
    deps.upsertBusinessCapabilitiesInternal || upsertBusinessCapabilitiesInternal;
  const createVersion = deps.createTruthVersionInternal || createTruthVersionInternal;
  const refreshProjection =
    deps.refreshRuntimeProjectionRequired || refreshRuntimeProjectionRequired;
  const appendDecisionEvent = deps.safeAppendDecisionEvent || safeAppendDecisionEvent;
  const audit = deps.dbAudit || dbAudit;

  const tenant = await resolveTenant(db, {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
  });
  if (!tenant) {
    throw new Error("tenantTruthVersions.rollback: tenant not found");
  }

  const actor = obj(input.actor);
  const actorRole = normalizeRole(input.actorRole || actor.role);
  const actorName = buildActorDisplay(actor);
  const timestamp = new Date().toISOString();
  const targetVersion = await getVersion(db, {
    tenantId: tenant.tenant_id,
    tenantKey: tenant.tenant_key,
    versionId: input.targetVersionId || input.versionId,
  });
  const currentVersion = await getLatestVersion(db, {
    tenantId: tenant.tenant_id,
    tenantKey: tenant.tenant_key,
  });
  const rollbackPreview = buildRollbackPreviewModel({
    currentVersion: currentVersion || {},
    targetVersion: targetVersion || {},
    viewerRole: actorRole,
  });
  const rollbackAction = buildRollbackActionContract({
    currentVersion,
    targetVersion,
    rollbackPreview,
    viewerRole: actorRole,
  });

  if (!rollbackAction.allowed) {
    const rollbackReceipt = buildRollbackBlockedReceipt({
      currentVersion,
      targetVersion,
      rollbackPreview,
      rollbackAction,
      actor: actorName,
      timestamp,
      reasonCode:
        lower(rollbackPreview.rollbackDisposition) === "review_required"
          ? "rollback_review_required"
          : "rollback_blocked",
    });

    await appendDecisionEvent(db, {
      tenantId: tenant.tenant_id,
      tenantKey: tenant.tenant_key,
      eventType:
        lower(rollbackPreview.rollbackDisposition) === "review_required"
          ? "review_required_action_outcome"
          : "blocked_action_outcome",
      actor: actorName,
      source: "workspace.setup.truth.rollback",
      surface: "tenant",
      policyOutcome: lower(rollbackPreview.rollbackDisposition || "blocked"),
      reasonCodes: [
        lower(rollbackReceipt.reasonCode || "rollback_blocked"),
        lower(actorRole ? `${actorRole}_rollback_attempt` : "rollback_attempt"),
      ],
      truthVersionId: s(currentVersion?.id),
      affectedSurfaces: arr(rollbackPreview.affectedSurfaces),
      recommendedNextAction: {
        label: s(rollbackAction.requiredRole)
          ? `Escalate to ${rollbackAction.requiredRole}`
          : "Review rollback posture",
        kind: "review",
      },
      decisionContext: {
        operationType: "rollback",
        sourceCurrentVersionId: s(currentVersion?.id),
        targetRollbackVersionId: s(targetVersion?.id),
        rollbackDisposition: s(rollbackPreview.rollbackDisposition),
        blockedReason: s(rollbackAction.reason),
      },
    });

    await audit(
      db,
      actorName,
      "truth.rollback.blocked",
      "tenant_business_profile_version",
      s(targetVersion?.id || currentVersion?.id) || null,
      {
        actorRole,
        sourceCurrentVersionId: s(currentVersion?.id),
        targetRollbackVersionId: s(targetVersion?.id),
        rollbackDisposition: s(rollbackPreview.rollbackDisposition),
        rollbackAction,
        rollbackReceipt,
      }
    );

    return {
      ok: false,
      blocked: true,
      rollbackPreview,
      rollbackAction,
      rollbackReceipt,
    };
  }

  await appendDecisionEvent(db, {
    tenantId: tenant.tenant_id,
    tenantKey: tenant.tenant_key,
    eventType: "truth_publication_decision",
    actor: actorName,
    source: "workspace.setup.truth.rollback",
    surface: "tenant",
    policyOutcome: "requested",
    reasonCodes: ["rollback_requested"],
    truthVersionId: s(currentVersion?.id),
    affectedSurfaces: arr(rollbackPreview.affectedSurfaces),
    decisionContext: {
      operationType: "rollback",
      sourceCurrentVersionId: s(currentVersion?.id),
      targetRollbackVersionId: s(targetVersion?.id),
      rollbackDisposition: s(rollbackPreview.rollbackDisposition),
    },
  });

  const rollbackMetadata = mergeObjects(obj(targetVersion?.metadata_json), obj(input.metadataJson), {
    rollbackExecution: {
      sourceCurrentVersionId: s(currentVersion?.id),
      targetRollbackVersionId: s(targetVersion?.id),
      requestedBy: actorName,
      requestedRole: actorRole,
      requestedAt: timestamp,
      rollbackDisposition: s(rollbackPreview.rollbackDisposition),
    },
  });
  const sourceSummaryJson = buildRollbackSourceSummary(
    targetVersion,
    currentVersion,
    rollbackPreview,
    {
      timestamp,
      rollbackStatus: "requested",
      resultingTruthVersionId: "",
    }
  );

  const txResult = await runWithTx(db, async (tx) => {
    const currentProfile = await getProfile(tx, {
      tenantId: tenant.tenant_id,
      tenantKey: tenant.tenant_key,
    });
    const currentCapabilities = await getCapabilities(tx, {
      tenantId: tenant.tenant_id,
      tenantKey: tenant.tenant_key,
    });
    const savedProfile = await upsertProfile(tx, {
      tenantId: tenant.tenant_id,
      tenantKey: tenant.tenant_key,
      ...buildRollbackProfileInput(targetVersion, actorName, rollbackMetadata, sourceSummaryJson),
    });
    const savedCapabilities = await upsertCapabilities(tx, {
      tenantId: tenant.tenant_id,
      tenantKey: tenant.tenant_key,
      ...buildRollbackCapabilitiesInput(targetVersion, actorName, rollbackMetadata),
    });
    const resultingTruthVersion = await createVersion(tx, {
      tenantId: tenant.tenant_id,
      tenantKey: tenant.tenant_key,
      businessProfileId: s(savedProfile?.id || currentProfile?.id),
      businessCapabilitiesId: s(savedCapabilities?.id || currentCapabilities?.id),
      approvedAt: timestamp,
      approvedBy: actorName,
      profile: savedProfile,
      capabilities: savedCapabilities,
      sourceSummaryJson,
      metadataJson: rollbackMetadata,
    });

    return {
      savedProfile,
      savedCapabilities,
      resultingTruthVersion,
    };
  });

  let runtimeProjection = null;
  let runtimeError = null;
  try {
    runtimeProjection = await refreshProjection(db, {
      tenantId: tenant.tenant_id,
      tenantKey: tenant.tenant_key,
      triggerType: "truth_rollback",
      requestedBy: actorName,
      runnerKey: "workspace.setup.truth.rollback",
      generatedBy: actorName,
      metadata: {
        sourceCurrentVersionId: s(currentVersion?.id),
        targetRollbackVersionId: s(targetVersion?.id),
        resultingTruthVersionId: s(txResult?.resultingTruthVersion?.id),
        rollbackDisposition: s(rollbackPreview.rollbackDisposition),
      },
    });
  } catch (error) {
    runtimeError = error;
  }

  const rollbackReceipt = buildRollbackReceipt({
    currentVersion,
    targetVersion,
    resultingTruthVersion: txResult?.resultingTruthVersion || {},
    runtimeProjection,
    runtimeError,
    rollbackPreview,
    actor: actorName,
    timestamp,
  });

  await audit(
    db,
    actorName,
    "truth.rollback.executed",
    "tenant_business_profile_version",
    s(txResult?.resultingTruthVersion?.id || targetVersion?.id) || null,
    {
      actorRole,
      sourceCurrentVersionId: s(currentVersion?.id),
      targetRollbackVersionId: s(targetVersion?.id),
      resultingTruthVersionId: s(txResult?.resultingTruthVersion?.id),
      runtimeProjectionId: s(runtimeProjection?.id),
      rollbackReceipt,
    }
  );

  await appendDecisionEvent(db, {
    tenantId: tenant.tenant_id,
    tenantKey: tenant.tenant_key,
    eventType: "truth_publication_decision",
    actor: actorName,
    source: "workspace.setup.truth.rollback",
    surface: "tenant",
    policyOutcome: "approved",
    reasonCodes: ["rollback_executed", "truth_version_created"],
    truthVersionId: s(txResult?.resultingTruthVersion?.id),
    runtimeProjectionId: s(runtimeProjection?.id),
    affectedSurfaces: arr(rollbackReceipt?.actual?.channels?.affectedSurfaces),
    recommendedNextAction:
      rollbackReceipt.rollbackStatus === "success"
        ? { label: "Monitor governance history", kind: "observe" }
        : {
            label:
              rollbackReceipt.rollbackStatus === "repair_required"
                ? "Open repair controls"
                : "Inspect runtime verification",
            kind: "review",
          },
    decisionContext: {
      operationType: "rollback",
      sourceCurrentVersionId: s(currentVersion?.id),
      targetRollbackVersionId: s(targetVersion?.id),
      resultingTruthVersionId: s(txResult?.resultingTruthVersion?.id),
      rollbackStatus: s(rollbackReceipt.rollbackStatus),
      previewComparisonStatus: s(rollbackReceipt?.previewComparison?.status),
    },
  });

  await appendDecisionEvent(db, {
    tenantId: tenant.tenant_id,
    tenantKey: tenant.tenant_key,
    eventType: "runtime_health_transition",
    actor: actorName,
    source: "workspace.setup.truth.rollback",
    surface: "tenant",
    policyOutcome: lower(rollbackReceipt.rollbackStatus),
    reasonCodes: [
      lower(rollbackReceipt.rollbackStatus || "rollback_verified"),
      runtimeError ? "runtime_projection_refresh_failed" : "runtime_projection_verified",
    ],
    healthState: {
      status: s(rollbackReceipt?.verification?.projectionHealthStatus),
      warnings: arr(rollbackReceipt?.verification?.runtimeControlWarnings),
    },
    truthVersionId: s(txResult?.resultingTruthVersion?.id),
    runtimeProjectionId: s(runtimeProjection?.id),
    affectedSurfaces: arr(rollbackReceipt?.actual?.channels?.affectedSurfaces),
    recommendedNextAction:
      s(rollbackReceipt?.verification?.repairRecommendation)
        ? {
            label: s(rollbackReceipt.verification.repairRecommendation),
            kind: "review",
          }
        : { label: "Verification completed", kind: "observe" },
    decisionContext: {
      operationType: "rollback",
      sourceCurrentVersionId: s(currentVersion?.id),
      targetRollbackVersionId: s(targetVersion?.id),
      resultingTruthVersionId: s(txResult?.resultingTruthVersion?.id),
      rollbackStatus: s(rollbackReceipt.rollbackStatus),
    },
  });

  return {
    ok: true,
    blocked: false,
    rollbackPreview,
    rollbackAction,
    rollbackReceipt,
    resultingTruthVersion: txResult?.resultingTruthVersion || null,
    runtimeProjection: runtimeProjection || null,
  };
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
      viewerRole = "",
    } = {}) {
      const current = await getTruthVersionByIdInternal(db, {
        tenantId,
        tenantKey,
        versionId,
      });
      if (!current?.id) return null;

      const latest = await getLatestTruthVersionInternal(db, {
        tenantId,
        tenantKey,
      });

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

      const versionDiff = buildTruthVersionDiffModel(current, previous);
      const rollbackPreview = buildRollbackPreviewModel({
        currentVersion: latest || current,
        targetVersion: current,
        viewerRole,
      });

      return {
        version: current,
        previousVersion: previous,
        currentVersion: latest || current,
        diff: buildTruthVersionCompare(current, previous),
        versionDiff,
        rollbackPreview,
        rollbackAction: rollbackPreview.action,
      };
    },

    buildHistoryEntries(versions = []) {
      const compareMap = buildTimelineCompareMap(versions);
      return arr(versions).map((item) =>
        buildTruthVersionHistoryEntry(item, compareMap.get(s(item.id)))
      );
    },

    async executeRollback(input = {}) {
      return executeTruthVersionRollbackInternal(db, input);
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
  buildTruthVersionDiffModel,
  buildRollbackPreviewModel,
  buildRollbackActionContract,
  buildRollbackBlockedReceipt,
  buildRollbackReceipt,
  buildTruthVersionHistoryEntry,
  hasTruthVersionChanged,
};
