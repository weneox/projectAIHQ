import { createTenantKnowledgeHelpers } from "../../../db/helpers/tenantKnowledge.js";
import {
  buildCanonicalTruthVersionSnapshot,
  createTenantTruthVersionHelpers,
  hasTruthVersionChanged,
} from "../../../db/helpers/tenantTruthVersions.js";
import {
  refreshRuntimeProjectionBestEffort,
  q,
} from "../../../db/helpers/tenantKnowledge/core.js";
import {
  dbDeleteTenantContact,
  dbDeleteTenantLocation,
  dbListTenantBusinessFacts,
  dbListTenantContacts,
  dbListTenantLocations,
  dbUpsertTenantContact,
  dbUpsertTenantLocation,
} from "../../../db/helpers/tenantBusinessBrain.js";
import {
  createSetupService,
  listSetupServices,
  updateSetupService,
} from "../services.js";
import {
  arr,
  compactObject,
  lower,
  mergeDeep,
  obj,
  s,
  toFiniteNumber,
} from "./utils.js";
import { buildFinalizeImpactSummary } from "../../sourceFusion/governance.js";
import { buildFinalizeApprovalPolicySummary } from "../../sourceFusion/approvalPolicy.js";

function hasDbQuery(db) {
  return Boolean(db && typeof db.query === "function");
}

function resolveKnowledgeHelper(db, explicitHelper = null) {
  if (explicitHelper) return explicitHelper;
  if (!hasDbQuery(db)) return null;
  return createTenantKnowledgeHelpers({ db });
}

function resolveTruthVersionHelper(db, explicitHelper = null) {
  if (explicitHelper) return explicitHelper;
  if (!hasDbQuery(db)) return null;
  return createTenantTruthVersionHelpers({ db });
}

function buildDeferredRuntimeProjection({
  actor = {},
  requestedBy = "",
  session = {},
  draft = {},
  sourceInfo = {},
  truthVersion = null,
} = {}) {
  return compactObject({
    status: "deferred",
    triggerType: "review_approval",
    requestedBy: s(requestedBy),
    tenantId: s(actor?.tenantId),
    tenantKey: s(actor?.tenantKey),
    reviewSessionId: s(session?.id),
    truthVersionId: s(truthVersion?.id),
    metadata: compactObject({
      source: "projectSetupReviewDraftToCanonical",
      reviewSessionId: s(session?.id),
      draftVersion: toFiniteNumber(draft?.version, 0) || undefined,
      primarySourceId: s(sourceInfo.primarySourceId),
      latestRunId: s(sourceInfo.latestRunId),
      reasonCode: "db_projection_deferred",
    }),
  });
}

function extractPrimarySourceInfo(session = {}, draft = {}, sources = []) {
  const summary = obj(draft?.sourceSummary);
  const latestImport = obj(summary.latestImport);

  return {
    primarySourceId:
      session?.primarySourceId ||
      summary.primarySourceId ||
      latestImport.sourceId ||
      null,
    primarySourceType:
      s(session?.primarySourceType) ||
      s(summary.primarySourceType) ||
      s(latestImport.sourceType),
    latestRunId:
      summary.latestRunId ||
      latestImport.runId ||
      draft?.draftPayload?.latestImport?.runId ||
      null,
    sourceUrl:
      s(summary.primarySourceUrl) ||
      s(latestImport.sourceUrl) ||
      s(draft?.draftPayload?.sourceUrl),
    sources: arr(sources),
  };
}

function extractServiceRows(data = {}) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.services)) return data.services;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function extractTruthVersionRows(data = {}) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.versions)) return data.versions;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (data && typeof data === "object") return [data];
  return [];
}

function extractTruthVersionId(version = {}) {
  return s(
    version?.id ||
      version?.versionId ||
      version?.version_id ||
      version?.truthVersionId ||
      version?.truth_version_id
  );
}

function extractTruthVersionBusinessProfileId(version = {}) {
  return s(
    version?.businessProfileId ||
      version?.business_profile_id ||
      version?.profileId ||
      version?.profile_id ||
      version?.profile?.id
  );
}

function extractTruthVersionBusinessCapabilitiesId(version = {}) {
  return s(
    version?.businessCapabilitiesId ||
      version?.business_capabilities_id ||
      version?.capabilitiesId ||
      version?.capabilities_id ||
      version?.capabilities?.id
  );
}

function buildComparablePendingTruthVersion(input = {}) {
  const snapshot = buildCanonicalTruthVersionSnapshot({
    profile: input.profile,
    capabilities: input.capabilities,
    services: input.services,
    contacts: input.contacts,
    locations: input.locations,
    truthFacts: input.truthFacts,
    sourceSummary: input.sourceSummaryJson ?? input.source_summary_json,
    metadata: input.metadataJson ?? input.metadata_json,
  });

  return {
    business_profile_id: s(input.businessProfileId || input.business_profile_id),
    business_capabilities_id: s(
      input.businessCapabilitiesId || input.business_capabilities_id
    ),
    review_session_id: s(input.reviewSessionId || input.review_session_id),
    source_summary_json: obj(snapshot.sourceSummary),
    profile_snapshot_json: obj(snapshot.profileSnapshot),
    capabilities_snapshot_json: obj(snapshot.capabilitiesSnapshot),
    services_snapshot_json: arr(snapshot.servicesSnapshot),
    contacts_snapshot_json: arr(snapshot.contactsSnapshot),
    locations_snapshot_json: arr(snapshot.locationsSnapshot),
    truth_facts_snapshot_json: arr(snapshot.truthFactsSnapshot),
    field_provenance_json: obj(snapshot.fieldProvenance),
  };
}

function normalizeTruthSnapshotComparableValue(value) {
  if (value == null) return null;
  if (Array.isArray(value)) {
    return value.map((item) => normalizeTruthSnapshotComparableValue(item));
  }
  if (value && typeof value === "object") {
    return Object.keys(obj(value))
      .sort()
      .reduce((acc, key) => {
        acc[key] = normalizeTruthSnapshotComparableValue(value[key]);
        return acc;
      }, {});
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "boolean") return value;
  return s(value);
}

function buildComparableTruthVersionSnapshotState(
  version = {},
  { ignoreIdentity = false } = {}
) {
  const metadataJson = obj(version?.metadataJson || version?.metadata_json);

  return {
    businessProfileId: ignoreIdentity
      ? ""
      : extractTruthVersionBusinessProfileId(version),
    businessCapabilitiesId: ignoreIdentity
      ? ""
      : extractTruthVersionBusinessCapabilitiesId(version),
    reviewSessionId: ignoreIdentity
      ? ""
      : s(version?.review_session_id || version?.reviewSessionId),
    sourceSummary: obj(version?.source_summary_json || version?.sourceSummaryJson),
    profile: obj(version?.profile_snapshot_json || version?.profileSnapshotJson),
    capabilities: obj(
      version?.capabilities_snapshot_json || version?.capabilitiesSnapshotJson
    ),
    services: arr(
      version?.services_snapshot_json ||
        version?.servicesSnapshotJson ||
        metadataJson.servicesSnapshot ||
        metadataJson.services_snapshot_json
    ),
    contacts: arr(
      version?.contacts_snapshot_json ||
        version?.contactsSnapshotJson ||
        metadataJson.contactsSnapshot ||
        metadataJson.contacts_snapshot_json
    ),
    locations: arr(
      version?.locations_snapshot_json ||
        version?.locationsSnapshotJson ||
        metadataJson.locationsSnapshot ||
        metadataJson.locations_snapshot_json
    ),
    truthFacts: arr(
      version?.truth_facts_snapshot_json ||
        version?.truthFactsSnapshotJson ||
        metadataJson.truthFactsSnapshot ||
        metadataJson.truth_facts_snapshot_json
    ),
    fieldProvenance: obj(
      version?.field_provenance_json || version?.fieldProvenanceJson
    ),
  };
}

function truthSnapshotsEquivalent(
  currentVersion = {},
  pendingVersion = null,
  { ignoreIdentity = false } = {}
) {
  if (!pendingVersion) return false;

  const currentComparable = buildComparableTruthVersionSnapshotState(
    currentVersion,
    { ignoreIdentity }
  );
  const pendingComparable = buildComparableTruthVersionSnapshotState(
    pendingVersion,
    { ignoreIdentity }
  );

  return (
    JSON.stringify(
      normalizeTruthSnapshotComparableValue(currentComparable)
    ) ===
    JSON.stringify(
      normalizeTruthSnapshotComparableValue(pendingComparable)
    )
  );
}

function truthVersionEquivalentToPending(version = {}, pendingVersion = null) {
  if (!extractTruthVersionId(version) || !pendingVersion) return false;

  if (hasTruthVersionChanged(version, pendingVersion) === false) {
    return true;
  }

  return truthSnapshotsEquivalent(version, pendingVersion, {
    ignoreIdentity: true,
  });
}

function markTruthVersionSnapshotEquivalent(version = {}) {
  return mergeDeep(obj(version), {
    reuseReason: "snapshot_equivalent",
    metadataJson: mergeDeep(
      obj(version?.metadataJson || version?.metadata_json),
      {
        reuseReason: "snapshot_equivalent",
      }
    ),
  });
}

function truthVersionMatchesProjection(
  version = {},
  {
    businessProfileId = "",
    businessCapabilitiesId = "",
    pendingVersion = null,
  } = {}
) {
  if (truthVersionEquivalentToPending(version, pendingVersion)) {
    return true;
  }

  const versionBusinessProfileId =
    extractTruthVersionBusinessProfileId(version);
  const versionBusinessCapabilitiesId =
    extractTruthVersionBusinessCapabilitiesId(version);

  if (
    businessProfileId &&
    versionBusinessProfileId &&
    businessProfileId !== versionBusinessProfileId
  ) {
    return false;
  }

  if (
    businessCapabilitiesId &&
    versionBusinessCapabilitiesId &&
    businessCapabilitiesId !== versionBusinessCapabilitiesId
  ) {
    return false;
  }

  return true;
}

function isReusableTruthVersion(version = {}, { method = "" } = {}) {
  if (!extractTruthVersionId(version)) return false;

  if (version?.isPublished === true) return true;
  if (version?.published === true) return true;
  if (version?.approved === true) return true;
  if (version?.isApproved === true) return true;

  const status = lower(
    version?.status ||
      version?.versionStatus ||
      version?.version_status ||
      version?.publicationStatus ||
      version?.publication_status
  );

  if (
    status &&
    ["draft", "pending", "queued", "failed", "error", "archived", "deleted"].includes(
      status
    )
  ) {
    return false;
  }

  if (
    status &&
    ["published", "approved", "live", "active", "current"].includes(status)
  ) {
    return true;
  }

  if (
    s(
      version?.publishedAt ||
        version?.published_at ||
        version?.approvedAt ||
        version?.approved_at
    )
  ) {
    return true;
  }

  const sourceMethod = s(method);

  if (
    [
      "findReusablePublishedVersion",
      "findReusableApprovedVersion",
      "findReusableVersion",
      "getLatestPublishedVersion",
      "getLatestApprovedVersion",
      "listPublishedVersions",
      "listApprovedVersions",
    ].includes(sourceMethod)
  ) {
    return true;
  }

  return false;
}

function normalizeReusableTruthVersion(version = {}, reuseMode = "") {
  const id = extractTruthVersionId(version);
  if (!id) return null;

  return mergeDeep(obj(version), {
    id,
    reuseMode: s(reuseMode || version?.reuseMode || version?.reuse_mode),
    reusedExistingTruthVersion: true,
    metadataJson: mergeDeep(obj(version?.metadataJson || version?.metadata_json), {
      reusedExistingTruthVersion: true,
      reuseMode: s(reuseMode || version?.reuseMode || version?.reuse_mode),
    }),
  });
}

function shouldAttemptTruthVersionReuseFromError(error = null) {
  const code = lower(error?.code);
  const reasonCode = lower(error?.reasonCode);
  const message = lower(error?.message || error);

  if (
    [
      "truth_version_not_required",
      "tenant_truth_version_not_required",
      "setup_review_truth_version_not_required",
      "published_truth_version_reusable",
      "truth_version_already_current",
      "truth_version_noop",
      "truth_version_reuse_latest",
    ].includes(code)
  ) {
    return true;
  }

  if (
    [
      "truth_version_not_required",
      "published_truth_version_reusable",
      "truth_version_already_current",
      "no_new_truth_version_required",
    ].includes(reasonCode)
  ) {
    return true;
  }

  if (
    message.includes("not required") ||
    message.includes("already current") ||
    message.includes("reuse latest") ||
    message.includes("re-use latest") ||
    message.includes("existing published truth version") ||
    message.includes("latest approved truth version")
  ) {
    return true;
  }

  return false;
}

function buildTruthVersionNoopError({
  message = "No new truth version required because published truth is already current.",
  code = "TRUTH_VERSION_NOT_REQUIRED",
  reasonCode = "published_truth_version_reusable",
} = {}) {
  const err = new Error(
    s(message) ||
      "No new truth version required because published truth is already current."
  );
  err.code = s(code) || "TRUTH_VERSION_NOT_REQUIRED";
  err.reasonCode = s(reasonCode) || "published_truth_version_reusable";
  return err;
}

async function resolveReusableTruthVersion({
  truthVersionHelper,
  actor,
  businessProfileId = "",
  businessCapabilitiesId = "",
  pendingVersion = null,
} = {}) {
  if (!truthVersionHelper || !actor?.tenantId) return null;

  const exactArgs = {
    tenantId: actor.tenantId,
    tenantKey: actor.tenantKey,
    businessProfileId: businessProfileId || undefined,
    businessCapabilitiesId: businessCapabilitiesId || undefined,
  };

  const tenantArgs = {
    tenantId: actor.tenantId,
    tenantKey: actor.tenantKey,
  };

  const attempts = [
    ["findReusablePublishedVersion", exactArgs],
    ["findReusableApprovedVersion", exactArgs],
    ["findReusableVersion", exactArgs],
    ["getLatestPublishedVersion", tenantArgs],
    ["getLatestApprovedVersion", tenantArgs],
    ["getLatestVersion", tenantArgs],
    ["listPublishedVersions", { ...tenantArgs, limit: 10 }],
    ["listApprovedVersions", { ...tenantArgs, limit: 10 }],
    ["listVersions", { ...tenantArgs, limit: 10 }],
  ];

  for (const [method, args] of attempts) {
    if (typeof truthVersionHelper?.[method] !== "function") continue;

    const result = await truthVersionHelper[method](args);

    const reusable = extractTruthVersionRows(result)
      .map((item) => normalizeReusableTruthVersion(item, method))
      .filter(Boolean)
      .filter((item) => isReusableTruthVersion(item, { method }));

    const strictMatch = reusable.find((item) =>
      truthVersionMatchesProjection(item, {
        businessProfileId,
        businessCapabilitiesId,
      })
    );

    if (strictMatch) {
      return strictMatch;
    }

    if (pendingVersion) {
      const snapshotEquivalent = reusable.find((item) =>
        truthVersionEquivalentToPending(item, pendingVersion)
      );

      if (snapshotEquivalent) {
        return markTruthVersionSnapshotEquivalent(snapshotEquivalent);
      }
    }
  }

  return null;
}

function normalizeServiceForProjection(item = {}) {
  const value = obj(item);
  const key = s(value.key || value.serviceKey || value.service_key || value.slug);
  const title = s(value.title || value.name || value.label);
  const description = s(
    value.description || value.summary || value.valueText || value.value_text
  );
  const category = s(value.category || value.type || value.group || "service");

  if (!title && !key) return null;

  return {
    key,
    title: title || key,
    description,
    category,
    metadataJson: mergeDeep(obj(value.metadataJson || value.metadata_json), {
      origin: s(value.origin || "setup_review_session"),
      confidence:
        typeof value.confidence === "number"
          ? value.confidence
          : Number(value.confidence || 0) || 0,
      confidenceLabel: s(value.confidenceLabel || value.confidence_label),
      reviewReason: s(value.reviewReason || value.review_reason),
      sourceId: s(value.sourceId || value.source_id),
      sourceRunId: s(value.sourceRunId || value.source_run_id),
      sourceType: s(value.sourceType || value.source_type),
      governance: obj(value.governance),
      impact: obj(value.impact),
    }),
  };
}

function normalizeKnowledgeForProjection(item = {}) {
  const value = obj(item);
  const title = s(
    value.title || value.label || value.itemKey || value.item_key || value.key
  );

  if (!title) return null;

  return {
    key: s(value.key || value.itemKey || value.item_key),
    category: s(value.category || value.group || "general"),
    title,
    valueText: s(value.valueText || value.value_text),
    valueJson: obj(value.valueJson || value.value_json),
    normalizedText: s(value.normalizedText || value.normalized_text),
    normalizedJson: obj(value.normalizedJson || value.normalized_json),
    confidence:
      typeof value.confidence === "number"
        ? value.confidence
        : Number(value.confidence || 0) || 0,
    confidenceLabel: s(value.confidenceLabel || value.confidence_label),
    status: s(value.status || "approved"),
    reviewReason: s(value.reviewReason || value.review_reason),
    sourceId: s(value.sourceId || value.source_id),
    sourceRunId: s(value.sourceRunId || value.source_run_id),
    sourceType: s(value.sourceType || value.source_type),
    metadataJson: mergeDeep(obj(value.metadataJson || value.metadata_json), {
      origin: s(value.origin || "setup_review_session"),
      governance: obj(value.governance),
      impact: obj(value.impact),
    }),
  };
}

function normalizeContactForProjection(item = {}) {
  const value = obj(item);
  const contactKey = s(value.contactKey || value.contact_key || value.key);
  const label = s(value.label);
  const contactValue = s(value.value);

  if (!contactKey) return null;

  return {
    id: s(value.id || value.contactId || value.contact_id),
    contactKey,
    channel: s(value.channel || "other").toLowerCase() || "other",
    label,
    value: contactValue,
    isPrimary:
      typeof value.isPrimary === "boolean"
        ? value.isPrimary
        : typeof value.is_primary === "boolean"
          ? value.is_primary
          : false,
    enabled:
      typeof value.enabled === "boolean"
        ? value.enabled
        : true,
    visiblePublic:
      typeof value.visiblePublic === "boolean"
        ? value.visiblePublic
        : typeof value.visible_public === "boolean"
          ? value.visible_public
          : true,
    visibleInAi:
      typeof value.visibleInAi === "boolean"
        ? value.visibleInAi
        : typeof value.visible_in_ai === "boolean"
          ? value.visible_in_ai
          : true,
    sortOrder: Number(value.sortOrder ?? value.sort_order ?? 0) || 0,
    meta: obj(value.meta),
  };
}

function normalizeLocationForProjection(item = {}) {
  const value = obj(item);
  const locationKey = s(value.locationKey || value.location_key || value.key);
  const title = s(value.title);

  if (!locationKey) return null;

  return {
    id: s(value.id || value.locationId || value.location_id),
    locationKey,
    title,
    countryCode: s(value.countryCode || value.country_code),
    city: s(value.city),
    addressLine: s(value.addressLine || value.address_line),
    mapUrl: s(value.mapUrl || value.map_url),
    phone: s(value.phone),
    email: s(value.email),
    workingHours: obj(value.workingHours || value.working_hours),
    deliveryAreas: arr(value.deliveryAreas || value.delivery_areas),
    isPrimary:
      typeof value.isPrimary === "boolean"
        ? value.isPrimary
        : typeof value.is_primary === "boolean"
          ? value.is_primary
          : false,
    enabled:
      typeof value.enabled === "boolean"
        ? value.enabled
        : true,
    sortOrder: Number(value.sortOrder ?? value.sort_order ?? 0) || 0,
    meta: obj(value.meta),
  };
}

function buildBusinessProfileProjection(draft = {}, sourceInfo = {}) {
  const profile = compactObject(draft?.businessProfile);

  if (s(sourceInfo.sourceUrl)) {
    if (lower(sourceInfo.primarySourceType) === "website") {
      profile.websiteUrl = s(profile.websiteUrl || sourceInfo.sourceUrl);
    }
    if (lower(sourceInfo.primarySourceType) === "google_maps") {
      profile.googleMapsSeedUrl = s(
        profile.googleMapsSeedUrl || sourceInfo.sourceUrl
      );
    }
  }

  return profile;
}

function buildCapabilitiesProjection(draft = {}) {
  return compactObject(draft?.capabilities);
}

function shouldEnsureCapabilitiesProjection({
  draft = {},
  capabilities = {},
  currentCapabilities = null,
} = {}) {
  if (s(currentCapabilities?.id)) return true;
  if (Object.keys(obj(capabilities)).length) return true;
  if (Object.keys(obj(draft?.businessProfile)).length) return true;
  if (arr(draft?.services).length) return true;
  if (arr(draft?.contacts).length) return true;
  if (arr(draft?.locations).length) return true;
  if (arr(draft?.knowledgeItems).length) return true;
  if (arr(draft?.channels).length) return true;
  if (Object.keys(obj(draft?.sourceSummary)).length) return true;
  return false;
}

function shouldAttemptTruthVersionCreation({
  businessProfile = {},
  capabilities = {},
  savedProfile = null,
  savedCapabilities = null,
  publishedServices = [],
  publishedContacts = [],
  publishedLocations = [],
  publishedTruthFacts = [],
  sourceInfo = {},
} = {}) {
  const savedProfileJson = obj(savedProfile?.profile_json || savedProfile?.profileJson);
  const savedCapabilitiesJson = obj(
    savedCapabilities?.capabilities_json || savedCapabilities?.capabilitiesJson
  );

  return Boolean(
    Object.keys(obj(businessProfile)).length ||
      Object.keys(obj(capabilities)).length ||
      Object.keys(savedProfileJson).length ||
      Object.keys(savedCapabilitiesJson).length ||
      arr(publishedServices).length ||
      arr(publishedContacts).length ||
      arr(publishedLocations).length ||
      arr(publishedTruthFacts).length ||
      s(sourceInfo?.primarySourceType) ||
      s(sourceInfo?.sourceUrl)
  );
}

function buildTruthVersionRequiredError({
  businessProfileId = "",
  businessCapabilitiesId = "",
  draft = {},
  sourceInfo = {},
} = {}) {
  const err = new Error(
    "Setup review cannot finalize yet because a fresh published truth version could not be created."
  );
  err.code = "SETUP_REVIEW_TRUTH_VERSION_REQUIRED";
  err.reasonCode = "published_truth_version_required";
  err.details = {
    missingBusinessProfile: !s(businessProfileId),
    missingBusinessCapabilities: !s(businessCapabilitiesId),
    businessProfileKeys: Object.keys(obj(draft?.businessProfile)).length,
    capabilitiesKeys: Object.keys(obj(draft?.capabilities)).length,
    servicesCount: arr(draft?.services).length,
    contactsCount: arr(draft?.contacts).length,
    knowledgeCount: arr(draft?.knowledgeItems).length,
    primarySourceType: s(sourceInfo?.primarySourceType),
    primarySourceId: s(sourceInfo?.primarySourceId),
  };
  return err;
}

function extractBehaviorProjection(draft = {}) {
  return compactObject(
    obj(draft?.businessProfile?.nicheBehavior || draft?.businessProfile?.niche_behavior)
  );
}

async function resolvePersistedReviewSessionId(db, actor = {}, session = {}) {
  const rawSessionId = s(session?.id);
  const tenantId = s(actor?.tenantId);

  if (!rawSessionId || !tenantId) return "";

  if (!hasDbQuery(db)) return rawSessionId;

  const result = await q(
    db,
    `
      select id
      from tenant_setup_review_sessions
      where id = $1
        and tenant_id = $2
      limit 1
    `,
    [rawSessionId, tenantId]
  );

  return s(result.rows?.[0]?.id);
}

export function buildCanonicalProfileSourceSummary({
  session = {},
  draft = {},
  sources = [],
  sourceInfo = {},
  approvedAt = "",
} = {}) {
  const impactSummary = buildFinalizeImpactSummary({ draft });
  const approvalPolicy = buildFinalizeApprovalPolicySummary({ draft });
  return compactObject({
    reviewSessionId: s(session?.id),
    primarySourceType: s(sourceInfo.primarySourceType),
    primarySourceId: s(sourceInfo.primarySourceId),
    primarySourceUrl: s(sourceInfo.sourceUrl),
    latestRunId: s(sourceInfo.latestRunId),
    lastSnapshotId: s(draft?.lastSnapshotId),
    approvedAt: s(approvedAt),
    governance: obj(draft?.sourceSummary?.governance),
    finalizeImpact: impactSummary,
    approvalPolicy,
    sources: arr(sources)
      .map((item) =>
        compactObject({
          sourceId: s(item?.sourceId || item?.id),
          sourceType: s(item?.sourceType),
          role: s(item?.role),
          label: s(item?.label),
          sourceUrl: s(item?.sourceUrl || item?.url),
        })
      )
      .filter((item) => Object.keys(item).length),
  });
}

function buildTruthVersionCreateInput({
  actor,
  session,
  draft,
  sources,
  sourceInfo,
  businessProfileId = "",
  businessCapabilitiesId = "",
  savedProfile = null,
  savedCapabilities = null,
  publishedServices = [],
  publishedContacts = [],
  publishedLocations = [],
  publishedTruthFacts = [],
  impactSummary = {},
  approvalPolicy = {},
  persistedReviewSessionId = "",
  requestedBy = "",
  approvedAt = "",
  approvedBy = "",
} = {}) {
  return {
    tenantId: actor?.tenantId,
    tenantKey: actor?.tenantKey,
    businessProfileId: businessProfileId || null,
    businessCapabilitiesId: businessCapabilitiesId || null,
    reviewSessionId: persistedReviewSessionId || null,
    approvedAt: approvedAt || new Date().toISOString(),
    approvedBy: approvedBy || requestedBy || "system",
    profile: savedProfile,
    capabilities: savedCapabilities,
    services: publishedServices,
    contacts: publishedContacts,
    locations: publishedLocations,
    truthFacts: publishedTruthFacts,
    sourceSummaryJson: buildCanonicalProfileSourceSummary({
      session,
      draft,
      sources,
      sourceInfo,
      approvedAt: approvedAt || new Date().toISOString(),
    }),
    metadataJson: compactObject({
      reviewSessionProjection: true,
      reviewSessionId: s(session?.id),
      persistedReviewSessionId: persistedReviewSessionId || undefined,
      draftVersion: toFiniteNumber(draft?.version, 0) || undefined,
      sourceId: sourceInfo?.primarySourceId || undefined,
      sourceRunId: sourceInfo?.latestRunId || undefined,
      finalizeImpact: impactSummary,
      approvalPolicy,
    }),
  };
}

async function projectDraftServicesToCanonical({
  db,
  actor,
  draft,
  sourceInfo,
}) {
  const services = arr(draft?.services)
    .map((item) => normalizeServiceForProjection(item))
    .filter(Boolean);

  if (!services.length) {
    return {
      created: 0,
      updated: 0,
      skipped: 0,
      total: 0,
    };
  }

  const existingServices = extractServiceRows(
    await listSetupServices({
      db,
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      role: actor.role,
      tenant: actor.tenant,
      includeSetup: false,
    })
  );

  const findMatch = (service) => {
    const serviceKey = lower(service.key);
    const serviceTitle = lower(service.title);

    return existingServices.find((row) => {
      const rowKey = lower(
        row?.key || row?.serviceKey || row?.service_key || row?.slug
      );

      const rowTitle = lower(row?.title || row?.name || row?.label);

      return (
        (serviceKey && rowKey && serviceKey === rowKey) ||
        (serviceTitle && rowTitle && serviceTitle === rowTitle)
      );
    });
  };

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const service of services) {
    const body = {
      key: service.key,
      serviceKey: service.key,
      service_key: service.key,
      title: service.title,
      name: service.title,
      description: service.description,
      category: service.category,
      metadataJson: mergeDeep(service.metadataJson, {
        reviewSessionProjection: true,
        sourceId: sourceInfo.primarySourceId || null,
        sourceRunId: sourceInfo.latestRunId || null,
        sourceType: sourceInfo.primarySourceType || "",
      }),
    };

    const match = findMatch(service);

    if (match?.id) {
      await updateSetupService({
        db,
        tenantId: actor.tenantId,
        tenantKey: actor.tenantKey,
        role: actor.role,
        tenant: actor.tenant,
        serviceId: match.id,
        body,
        includeSetup: false,
      });
      updated += 1;
      continue;
    }

    try {
      await createSetupService({
        db,
        tenantId: actor.tenantId,
        tenantKey: actor.tenantKey,
        role: actor.role,
        tenant: actor.tenant,
        body,
        includeSetup: false,
      });
      created += 1;
    } catch (error) {
      const message = s(error?.message || error);
      throw new Error(
        `projectDraftServicesToCanonical:createSetupService failed for "${service.title || service.key}" (${message})`
      );
    }
  }

  return {
    created,
    updated,
    skipped,
    total: services.length,
  };
}

async function projectDraftContactsToCanonical({ db, actor, draft }) {
  if (!Array.isArray(draft?.contacts)) {
    return {
      created: 0,
      updated: 0,
      deleted: 0,
      total: 0,
    };
  }

  const contacts = arr(draft?.contacts)
    .map((item) => normalizeContactForProjection(item))
    .filter(Boolean);
  const existingContacts = arr(await dbListTenantContacts(db, actor.tenantId));
  const desiredKeys = new Set(
    contacts.map((item) => lower(item.contactKey)).filter(Boolean)
  );

  let created = 0;
  let updated = 0;
  let deleted = 0;

  for (const existing of existingContacts) {
    const existingKey = lower(existing.contact_key || existing.contactKey);
    if (existingKey && !desiredKeys.has(existingKey)) {
      await dbDeleteTenantContact(db, actor.tenantId, existing.id);
      deleted += 1;
    }
  }

  for (const contact of contacts) {
    const existing = existingContacts.find(
      (item) =>
        lower(item.contact_key || item.contactKey) === lower(contact.contactKey)
    );

    await dbUpsertTenantContact(db, actor.tenantId, {
      contact_key: contact.contactKey,
      channel: contact.channel,
      label: contact.label,
      value: contact.value,
      is_primary: contact.isPrimary,
      enabled: contact.enabled,
      visible_public: contact.visiblePublic,
      visible_in_ai: contact.visibleInAi,
      sort_order: contact.sortOrder,
      meta: contact.meta,
    });

    if (existing?.id) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  return {
    created,
    updated,
    deleted,
    total: contacts.length,
  };
}

async function projectDraftLocationsToCanonical({ db, actor, draft }) {
  if (!Array.isArray(draft?.locations)) {
    return {
      created: 0,
      updated: 0,
      deleted: 0,
      total: 0,
    };
  }

  const locations = arr(draft?.locations)
    .map((item) => normalizeLocationForProjection(item))
    .filter(Boolean);
  const existingLocations = arr(await dbListTenantLocations(db, actor.tenantId));
  const desiredKeys = new Set(
    locations.map((item) => lower(item.locationKey)).filter(Boolean)
  );

  let created = 0;
  let updated = 0;
  let deleted = 0;

  for (const existing of existingLocations) {
    const existingKey = lower(existing.location_key || existing.locationKey);
    if (existingKey && !desiredKeys.has(existingKey)) {
      await dbDeleteTenantLocation(db, actor.tenantId, existing.id);
      deleted += 1;
    }
  }

  for (const location of locations) {
    const existing = existingLocations.find(
      (item) =>
        lower(item.location_key || item.locationKey) ===
        lower(location.locationKey)
    );

    await dbUpsertTenantLocation(db, actor.tenantId, {
      location_key: location.locationKey,
      title: location.title,
      country_code: location.countryCode,
      city: location.city,
      address_line: location.addressLine,
      map_url: location.mapUrl,
      phone: location.phone,
      email: location.email,
      working_hours: location.workingHours,
      delivery_areas: location.deliveryAreas,
      is_primary: location.isPrimary,
      enabled: location.enabled,
      sort_order: location.sortOrder,
      meta: location.meta,
    });

    if (existing?.id) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  return {
    created,
    updated,
    deleted,
    total: locations.length,
  };
}

async function projectDraftKnowledgeToCanonical({
  db,
  actor,
  draft,
  session,
  sourceInfo,
  knowledgeHelper,
}) {
  const items = arr(draft?.knowledgeItems)
    .map((item) => normalizeKnowledgeForProjection(item))
    .filter(Boolean);

  if (!items.length) {
    return {
      projected: 0,
      skipped: 0,
      total: 0,
      method: "",
    };
  }

  const helper = knowledgeHelper || resolveKnowledgeHelper(db);

  if (!helper) {
    return {
      projected: 0,
      skipped: items.length,
      total: items.length,
      method: "",
    };
  }

  const payload = items.map((item) => ({
    tenantId: actor.tenantId,
    tenantKey: actor.tenantKey,
    reviewSessionId: s(session?.id),
    sourceId: s(item.sourceId || sourceInfo.primarySourceId),
    sourceRunId: s(item.sourceRunId || sourceInfo.latestRunId),
    sourceType: s(item.sourceType || sourceInfo.primarySourceType),
    itemKey: s(item.key),
    key: s(item.key),
    category: s(item.category),
    title: s(item.title),
    valueText: s(item.valueText),
    valueJson: obj(item.valueJson),
    normalizedText: s(item.normalizedText),
    normalizedJson: obj(item.normalizedJson),
    confidence: item.confidence,
    confidenceLabel: s(item.confidenceLabel),
    status: s(item.status || "approved"),
    reviewReason: s(item.reviewReason),
    metadataJson: mergeDeep(obj(item.metadataJson), {
      reviewSessionProjection: true,
    }),
  }));

  for (const method of [
    "upsertKnowledgeItemsBulk",
    "upsertKnowledgeItems",
    "createKnowledgeItemsBulk",
    "mergeKnowledgeItems",
  ]) {
    if (typeof helper[method] === "function") {
      await helper[method](payload);
      return {
        projected: payload.length,
        skipped: 0,
        total: payload.length,
        method,
      };
    }
  }

  for (const method of [
    "upsertKnowledgeItem",
    "createKnowledgeItem",
    "saveKnowledgeItem",
  ]) {
    if (typeof helper[method] === "function") {
      let projected = 0;

      for (const item of payload) {
        try {
          await helper[method](item);
          projected += 1;
        } catch (error) {
          const label = s(item?.title || item?.key);
          const message = s(error?.message || error);
          throw new Error(
            `projectDraftKnowledgeToCanonical:${method} failed for "${label}" (${message})`
          );
        }
      }

      return {
        projected,
        skipped: 0,
        total: payload.length,
        method,
      };
    }
  }

  return {
    projected: 0,
    skipped: payload.length,
    total: payload.length,
    method: "",
  };
}

export async function projectSetupReviewDraftToCanonical(
  {
    db,
    actor,
    session,
    draft,
    sources,
  },
  deps = {}
) {
  const knowledgeHelper = resolveKnowledgeHelper(db, deps.knowledgeHelper);
  const truthVersionHelper = resolveTruthVersionHelper(
    db,
    deps.truthVersionHelper
  );
  const refreshProjection =
    deps.refreshRuntimeProjectionBestEffort || refreshRuntimeProjectionBestEffort;

  const sourceInfo = extractPrimarySourceInfo(session, draft, sources);
  const impactSummary = buildFinalizeImpactSummary({ draft });
  const approvalPolicy = buildFinalizeApprovalPolicySummary({ draft });
  const persistedReviewSessionId = await resolvePersistedReviewSessionId(
    db,
    actor,
    session
  );

  const requestedBy =
    s(actor?.user?.name) ||
    s(actor?.user?.full_name) ||
    s(actor?.user?.fullName) ||
    s(actor?.user?.email) ||
    s(actor?.user?.id) ||
    "system";

  const currentProfile =
    typeof knowledgeHelper?.getBusinessProfile === "function"
      ? await knowledgeHelper.getBusinessProfile({
          tenantId: actor.tenantId,
          tenantKey: actor.tenantKey,
        })
      : null;

  const currentCapabilities =
    typeof knowledgeHelper?.getBusinessCapabilities === "function"
      ? await knowledgeHelper.getBusinessCapabilities({
          tenantId: actor.tenantId,
          tenantKey: actor.tenantKey,
        })
      : null;

  const businessProfile = buildBusinessProfileProjection(draft, sourceInfo);
  const capabilities = buildCapabilitiesProjection(draft);
  const behavior = extractBehaviorProjection(draft);

  let projectedProfile = false;
  let projectedCapabilities = false;
  let savedProfile = currentProfile;
  let savedCapabilities = currentCapabilities;
  let createdTruthVersion = null;
  let reusedTruthVersion = null;
  let truthVersion = null;
  let truthVersionCreateError = null;
  let truthVersionCreateInput = null;
  let pendingTruthVersion = null;
  let publishedServices = [];
  let publishedContacts = [];
  let publishedLocations = [];
  let publishedTruthFacts = [];

  if (
    Object.keys(businessProfile).length &&
    typeof knowledgeHelper?.upsertBusinessProfile === "function"
  ) {
    const approvedAt = new Date().toISOString();

    savedProfile = await knowledgeHelper.upsertBusinessProfile({
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      reviewSessionId: persistedReviewSessionId || null,
      sourceId: sourceInfo.primarySourceId || null,
      sourceRunId: sourceInfo.latestRunId || null,
      profileStatus: "approved",
      profileJson: businessProfile,
      businessProfile,
      profile: businessProfile,
      sourceSummaryJson: buildCanonicalProfileSourceSummary({
        session,
        draft,
        sources,
        sourceInfo,
        approvedAt,
      }),
      metadataJson: {
        reviewSessionProjection: true,
        reviewSessionId: s(session?.id),
        persistedReviewSessionId: persistedReviewSessionId || undefined,
        draftVersion: toFiniteNumber(draft?.version, 0) || undefined,
        nicheBehavior: Object.keys(behavior).length ? behavior : undefined,
        finalizeImpact: impactSummary,
        approvalPolicy,
      },
      generatedBy: requestedBy,
      approvedBy: requestedBy,
      approvedAt,
      runtimeRefreshMode: "defer",
    });
    projectedProfile = true;
  }

  if (
    shouldEnsureCapabilitiesProjection({
      draft,
      capabilities,
      currentCapabilities,
    }) &&
    typeof knowledgeHelper?.upsertBusinessCapabilities === "function"
  ) {
    savedCapabilities = await knowledgeHelper.upsertBusinessCapabilities({
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      reviewSessionId: persistedReviewSessionId || null,
      sourceId: sourceInfo.primarySourceId || null,
      sourceRunId: sourceInfo.latestRunId || null,
      capabilitiesJson: capabilities,
      capabilities,
      signals: capabilities,
      metadataJson: {
        reviewSessionProjection: true,
        reviewSessionId: s(session?.id),
        persistedReviewSessionId: persistedReviewSessionId || undefined,
        nicheBehavior: Object.keys(behavior).length ? behavior : undefined,
        finalizeImpact: impactSummary,
        approvalPolicy,
      },
      approvedBy: requestedBy,
      runtimeRefreshMode: "defer",
    });
    projectedCapabilities = true;
  }

  const businessProfileId = s(savedProfile?.id || currentProfile?.id);
  const businessCapabilitiesId = s(
    savedCapabilities?.id || currentCapabilities?.id
  );

  const serviceProjection = await projectDraftServicesToCanonical({
    db,
    actor,
    draft,
    sourceInfo,
  });

  const contactProjection = await projectDraftContactsToCanonical({
    db,
    actor,
    draft,
  });

  const locationProjection = await projectDraftLocationsToCanonical({
    db,
    actor,
    draft,
  });

  publishedServices = extractServiceRows(
    await listSetupServices({
      db,
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      role: actor.role,
      tenant: actor.tenant,
      includeSetup: false,
    })
  );
  publishedContacts = arr(await dbListTenantContacts(db, actor.tenantId));
  publishedLocations = arr(await dbListTenantLocations(db, actor.tenantId));

  if (Array.isArray(draft?.businessFacts)) {
    publishedTruthFacts = arr(draft.businessFacts);
  } else if (typeof truthVersionHelper?.getLatestVersion === "function") {
    const latestTruthVersion = await truthVersionHelper.getLatestVersion({
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
    });
    publishedTruthFacts = arr(
      latestTruthVersion?.truth_facts_snapshot_json ||
        latestTruthVersion?.metadata_json?.truthFactsSnapshot ||
        latestTruthVersion?.metadata_json?.truth_facts_snapshot_json
    );
  } else {
    publishedTruthFacts = arr(
      await dbListTenantBusinessFacts(db, actor.tenantId, {
        enabledOnly: false,
        factSurface: "legacy_truth",
      })
    );
  }

  if (
    typeof truthVersionHelper?.createVersion === "function" &&
    shouldAttemptTruthVersionCreation({
      businessProfile,
      capabilities,
      savedProfile,
      savedCapabilities,
      publishedServices,
      publishedContacts,
      publishedLocations,
      publishedTruthFacts,
      sourceInfo,
    })
  ) {
    const approvedAt =
      s(savedProfile?.approved_at) ||
      s(currentProfile?.approved_at) ||
      new Date().toISOString();

    const approvedBy =
      s(savedProfile?.approved_by) ||
      s(savedCapabilities?.approved_by) ||
      s(currentProfile?.approved_by) ||
      requestedBy;

    truthVersionCreateInput = buildTruthVersionCreateInput({
      actor,
      session,
      draft,
      sources,
      sourceInfo,
      businessProfileId,
      businessCapabilitiesId,
      savedProfile,
      savedCapabilities,
      publishedServices,
      publishedContacts,
      publishedLocations,
      publishedTruthFacts,
      impactSummary,
      approvalPolicy,
      persistedReviewSessionId,
      requestedBy,
      approvedAt,
      approvedBy,
    });

    pendingTruthVersion = buildComparablePendingTruthVersion(
      truthVersionCreateInput
    );

    try {
      createdTruthVersion = await truthVersionHelper.createVersion(
        truthVersionCreateInput
      );

      if (s(createdTruthVersion?.id)) {
        truthVersion = createdTruthVersion;
      } else {
        truthVersionCreateError = buildTruthVersionNoopError();
      }
    } catch (error) {
      if (shouldAttemptTruthVersionReuseFromError(error)) {
        truthVersionCreateError = error;
      } else {
        throw error;
      }
    }
  }

  if (!s(truthVersion?.id)) {
    reusedTruthVersion = await resolveReusableTruthVersion({
      truthVersionHelper,
      actor,
      businessProfileId,
      businessCapabilitiesId,
      pendingVersion: pendingTruthVersion,
    });

    if (s(reusedTruthVersion?.id)) {
      truthVersion = reusedTruthVersion;
    }
  }

  if (!s(truthVersion?.id)) {
    const error = buildTruthVersionRequiredError({
      businessProfileId,
      businessCapabilitiesId,
      draft,
      sourceInfo,
    });

    if (truthVersionCreateError) {
      error.cause = truthVersionCreateError;
      error.truthVersionCreateErrorCode = s(truthVersionCreateError?.code);
      error.truthVersionCreateReasonCode = s(
        truthVersionCreateError?.reasonCode
      );
    }

    throw error;
  }

  const knowledgeProjection = await projectDraftKnowledgeToCanonical({
    db,
    actor,
    draft,
    session,
    sourceInfo,
    knowledgeHelper,
  });

  const shouldRefreshRuntime =
    projectedProfile ||
    projectedCapabilities ||
    Boolean(truthVersion?.id) ||
    serviceProjection.total > 0 ||
    contactProjection.total > 0 ||
    locationProjection.total > 0 ||
    knowledgeProjection.total > 0;

  let runtimeRefresh = null;

  if (shouldRefreshRuntime) {
    if (hasDbQuery(db) && typeof refreshProjection === "function") {
      runtimeRefresh = await refreshProjection(db, {
        tenantId: actor.tenantId,
        tenantKey: actor.tenantKey,
        triggerType: "review_approval",
        requestedBy,
        runnerKey: "workspace.setup.projectSetupReviewDraftToCanonical",
        generatedBy: requestedBy,
        metadata: compactObject({
          source: "projectSetupReviewDraftToCanonical",
          reviewSessionId: s(session?.id),
          persistedReviewSessionId: persistedReviewSessionId || undefined,
          truthVersionId: s(truthVersion?.id),
          truthVersionReused: Boolean(s(reusedTruthVersion?.id)) || undefined,
          truthVersionReuseMode: s(reusedTruthVersion?.reuseMode) || undefined,
          truthVersionReuseReason: s(reusedTruthVersion?.reuseReason) || undefined,
          draftVersion: toFiniteNumber(draft?.version, 0) || undefined,
          primarySourceId: s(sourceInfo.primarySourceId),
          latestRunId: s(sourceInfo.latestRunId),
        }),
      });
    } else {
      runtimeRefresh = {
        projection: buildDeferredRuntimeProjection({
          actor,
          requestedBy,
          session,
          draft,
          sourceInfo,
          truthVersion,
        }),
      };
    }
  }

  const runtimeProjection = obj(runtimeRefresh?.projection || runtimeRefresh);

  return {
    projectedProfile,
    projectedCapabilities,
    truthVersionCreated: Boolean(s(createdTruthVersion?.id)),
    truthVersionReused: Boolean(s(reusedTruthVersion?.id)),
    truthVersion,
    runtimeProjection: Object.keys(runtimeProjection).length
      ? runtimeProjection
      : null,
    serviceProjection,
    contactProjection,
    locationProjection,
    knowledgeProjection,
    sourceInfo,
    impactSummary,
    approvalPolicy,
  };
}
