import { createTenantKnowledgeHelpers } from "../../../db/helpers/tenantKnowledge.js";
import { createTenantTruthVersionHelpers } from "../../../db/helpers/tenantTruthVersions.js";
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
    }),
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

export function buildCanonicalProfileSourceSummary({
  session = {},
  draft = {},
  sources = [],
  sourceInfo = {},
  approvedAt = "",
} = {}) {
  return compactObject({
    reviewSessionId: s(session?.id),
    primarySourceType: s(sourceInfo.primarySourceType),
    primarySourceId: s(sourceInfo.primarySourceId),
    primarySourceUrl: s(sourceInfo.sourceUrl),
    latestRunId: s(sourceInfo.latestRunId),
    lastSnapshotId: s(draft?.lastSnapshotId),
    approvedAt: s(approvedAt),
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
    })
  );

  const findMatch = (service) => {
    const serviceKey = lower(service.key);
    const serviceTitle = lower(service.title);

    return existingServices.find((row) => {
      const rowKey = lower(
        row?.key ||
          row?.serviceKey ||
          row?.service_key ||
          row?.slug
      );

      const rowTitle = lower(
        row?.title ||
          row?.name ||
          row?.label
      );

      return (serviceKey && rowKey && serviceKey === rowKey) ||
        (serviceTitle && rowTitle && serviceTitle === rowTitle);
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
      });
      created += 1;
    } catch {
      skipped += 1;
    }
  }

  return {
    created,
    updated,
    skipped,
    total: services.length,
  };
}

async function projectDraftKnowledgeToCanonical({
  db,
  actor,
  draft,
  session,
  sourceInfo,
  knowledgeHelper = createTenantKnowledgeHelpers({ db }),
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
    if (typeof knowledgeHelper[method] === "function") {
      await knowledgeHelper[method](payload);
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
    if (typeof knowledgeHelper[method] === "function") {
      let projected = 0;
      let skipped = 0;

      for (const item of payload) {
        try {
          await knowledgeHelper[method](item);
          projected += 1;
        } catch {
          skipped += 1;
        }
      }

      return {
        projected,
        skipped,
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
  deps = {},
) {
  const knowledgeHelper = deps.knowledgeHelper || createTenantKnowledgeHelpers({ db });
  const truthVersionHelper =
    deps.truthVersionHelper || createTenantTruthVersionHelpers({ db });
  const sourceInfo = extractPrimarySourceInfo(session, draft, sources);
  const currentProfile =
    typeof knowledgeHelper.getBusinessProfile === "function"
      ? await knowledgeHelper.getBusinessProfile({
          tenantId: actor.tenantId,
          tenantKey: actor.tenantKey,
        })
      : null;
  const currentCapabilities =
    typeof knowledgeHelper.getBusinessCapabilities === "function"
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

  if (
    Object.keys(businessProfile).length &&
    typeof knowledgeHelper.upsertBusinessProfile === "function"
  ) {
    const approvedAt = new Date().toISOString();
    const approvedBy =
      s(actor?.user?.name) ||
      s(actor?.user?.full_name) ||
      s(actor?.user?.fullName) ||
      s(actor?.user?.email) ||
      s(actor?.user?.id) ||
      "system";

    savedProfile = await knowledgeHelper.upsertBusinessProfile({
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      reviewSessionId: s(session?.id),
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
        draftVersion: toFiniteNumber(draft?.version, 0) || undefined,
      },
      generatedBy: approvedBy,
      approvedBy,
      approvedAt,
    });
    projectedProfile = true;
  }

  if (
    Object.keys(capabilities).length &&
    typeof knowledgeHelper.upsertBusinessCapabilities === "function"
  ) {
    const approvedBy =
      s(actor?.user?.name) ||
      s(actor?.user?.full_name) ||
      s(actor?.user?.fullName) ||
      s(actor?.user?.email) ||
      s(actor?.user?.id) ||
      "system";

    savedCapabilities = await knowledgeHelper.upsertBusinessCapabilities({
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      reviewSessionId: s(session?.id),
      sourceId: sourceInfo.primarySourceId || null,
      sourceRunId: sourceInfo.latestRunId || null,
      capabilitiesJson: capabilities,
      capabilities,
      signals: capabilities,
      metadataJson: {
        reviewSessionProjection: true,
        reviewSessionId: s(session?.id),
      },
      approvedBy,
    });
    projectedCapabilities = true;
  }

  if (typeof truthVersionHelper.createVersion === "function") {
    const approvedAt =
      s(savedProfile?.approved_at) ||
      s(currentProfile?.approved_at) ||
      new Date().toISOString();
    const approvedBy =
      s(savedProfile?.approved_by) ||
      s(savedCapabilities?.approved_by) ||
      s(currentProfile?.approved_by) ||
      s(actor?.user?.name) ||
      s(actor?.user?.full_name) ||
      s(actor?.user?.fullName) ||
      s(actor?.user?.email) ||
      s(actor?.user?.id) ||
      "system";

    truthVersion = await truthVersionHelper.createVersion({
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      businessProfileId: s(savedProfile?.id),
      businessCapabilitiesId: s(savedCapabilities?.id),
      reviewSessionId: s(session?.id),
      approvedAt,
      approvedBy,
      profile: savedProfile,
      capabilities: savedCapabilities,
      sourceSummaryJson: obj(savedProfile?.source_summary_json),
      metadataJson: compactObject({
        reviewSessionProjection: true,
        reviewSessionId: s(session?.id),
        draftVersion: toFiniteNumber(draft?.version, 0) || undefined,
        sourceId: sourceInfo.primarySourceId || undefined,
        sourceRunId: sourceInfo.latestRunId || undefined,
      }),
    });
  }

  const serviceProjection = await projectDraftServicesToCanonical({
    db,
    actor,
    draft,
    sourceInfo,
  });

  const knowledgeProjection = await projectDraftKnowledgeToCanonical({
    db,
    actor,
    draft,
    session,
    sourceInfo,
    knowledgeHelper,
  });

  return {
    projectedProfile,
    projectedCapabilities,
    truthVersion,
    serviceProjection,
    knowledgeProjection,
    sourceInfo,
  };
}
