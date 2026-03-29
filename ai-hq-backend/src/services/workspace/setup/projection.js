import { createTenantKnowledgeHelpers } from "../../../db/helpers/tenantKnowledge.js";
import { createTenantTruthVersionHelpers } from "../../../db/helpers/tenantTruthVersions.js";
import {
  refreshRuntimeProjectionBestEffort,
  q,
} from "../../../db/helpers/tenantKnowledge/core.js";
import {
  dbDeleteTenantContact,
  dbDeleteTenantLocation,
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

async function resolvePersistedReviewSessionId(db, actor = {}, session = {}) {
  const rawSessionId = s(session?.id);
  const tenantId = s(actor?.tenantId);

  if (!rawSessionId || !tenantId) return "";

  // Unit/non-DB fallback only
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

  // DB-backed flow must remain FK-safe
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
      (item) => lower(item.contact_key || item.contactKey) === lower(contact.contactKey)
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
      (item) => lower(item.location_key || item.locationKey) === lower(location.locationKey)
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

  let projectedProfile = false;
  let projectedCapabilities = false;
  let savedProfile = currentProfile;
  let savedCapabilities = currentCapabilities;
  let truthVersion = null;
  let publishedServices = [];
  let publishedContacts = [];
  let publishedLocations = [];

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
    Object.keys(capabilities).length &&
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

  if (
    typeof truthVersionHelper?.createVersion === "function" &&
    businessProfileId &&
    businessCapabilitiesId
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

    truthVersion = await truthVersionHelper.createVersion({
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      businessProfileId,
      businessCapabilitiesId,
      reviewSessionId: persistedReviewSessionId || null,
      approvedAt,
      approvedBy,
      profile: savedProfile,
      capabilities: savedCapabilities,
      services: publishedServices,
      contacts: publishedContacts,
      locations: publishedLocations,
      sourceSummaryJson: obj(savedProfile?.source_summary_json),
      metadataJson: compactObject({
        reviewSessionProjection: true,
        reviewSessionId: s(session?.id),
        persistedReviewSessionId: persistedReviewSessionId || undefined,
        draftVersion: toFiniteNumber(draft?.version, 0) || undefined,
        sourceId: sourceInfo.primarySourceId || undefined,
        sourceRunId: sourceInfo.latestRunId || undefined,
        finalizeImpact: impactSummary,
        approvalPolicy,
      }),
    });
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
    truthVersion,
    runtimeProjection: Object.keys(runtimeProjection).length ? runtimeProjection : null,
    serviceProjection,
    contactProjection,
    locationProjection,
    knowledgeProjection,
    sourceInfo,
    impactSummary,
    approvalPolicy,
  };
}
