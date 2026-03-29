import { listSetupServices } from "../services.js";
import { createTenantTruthVersionHelpers } from "../../../db/helpers/tenantTruthVersions.js";
import {
  arr,
  compactDraftObject,
  getOrCreateSetupDraftSession,
  mergeDraftState,
  obj,
  s,
} from "./draftShared.js";

async function defaultGetCurrentSetupReview(tenantId) {
  const reviewHelper = await import("../../../db/helpers/tenantSetupReview.js");
  return reviewHelper.getCurrentSetupReview(tenantId);
}

async function defaultPatchSetupReviewDraft(input) {
  const reviewHelper = await import("../../../db/helpers/tenantSetupReview.js");
  return reviewHelper.patchSetupReviewDraft(input);
}

async function defaultGetOrCreateActiveSetupReviewSession(input) {
  const reviewHelper = await import("../../../db/helpers/tenantSetupReview.js");
  return reviewHelper.getOrCreateActiveSetupReviewSession(input);
}

async function defaultUpdateSetupReviewSession(sessionId, patch) {
  const reviewHelper = await import("../../../db/helpers/tenantSetupReview.js");
  return reviewHelper.updateSetupReviewSession(sessionId, patch);
}

function slugify(value = "") {
  const out = s(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

  return out || "service";
}

export function normalizeSetupServiceDraftInput(input = {}, fallbackId = "") {
  const body = obj(input);
  const title = s(body.title || body.name);
  if (!title) {
    throw new Error("Service title is required");
  }

  const key = s(body.key || body.serviceKey || body.service_key || slugify(title));

  return compactDraftObject({
    id: s(body.id || fallbackId || `draft_${key}`),
    key,
    serviceKey: key,
    title,
    description: s(body.description || body.summary),
    category: s(body.category || "general").toLowerCase() || "general",
    priceFrom:
      body.priceFrom ?? body.price_from ?? body.startingPrice ?? body.starting_price,
    currency: s(body.currency || "AZN").toUpperCase() || "AZN",
    pricingModel:
      s(body.pricingModel || body.pricing_model || "custom_quote").toLowerCase() ||
      "custom_quote",
    durationMinutes: body.durationMinutes ?? body.duration_minutes,
    isActive:
      typeof body.isActive === "boolean"
        ? body.isActive
        : typeof body.is_active === "boolean"
          ? body.is_active
          : true,
    sortOrder: Number(body.sortOrder ?? body.sort_order ?? 0) || 0,
    highlights: arr(body.highlights),
    metadataJson: mergeDraftState(obj(body.metadataJson), {
      stagedInSetupReview: true,
    }),
  });
}

function findDraftServiceIndex(items = [], idOrKey = "") {
  const needle = s(idOrKey).toLowerCase();
  if (!needle) return -1;

  return arr(items).findIndex((item) => {
    const id = s(item?.id).toLowerCase();
    const key = s(item?.key || item?.serviceKey || item?.service_key).toLowerCase();
    return id === needle || key === needle;
  });
}

export async function listSetupServicesFromDraftOrCanonical({
  db,
  actor,
  getCurrentSetupReview = defaultGetCurrentSetupReview,
}) {
  const current = await getCurrentSetupReview(actor.tenantId);
  const draftServices = arr(current?.draft?.services);

  if (current?.session?.id) {
    return {
      items: draftServices,
      services: draftServices,
      source: "setup_review_draft",
      staged: true,
      canonicalWriteDeferred: true,
    };
  }

  const data = await listSetupServices({
    db,
    tenantId: actor.tenantId,
    tenantKey: actor.tenantKey,
    role: actor.role,
    tenant: actor.tenant,
  });

  return {
    ...data,
    source: "canonical_read_only",
    staged: false,
    canonicalWriteDeferred: false,
  };
}

export async function stageSetupServiceMutation({
  db,
  actor,
  mode,
  serviceId = "",
  body = {},
  loadCurrentReviewPayload,
  getOrCreateSetupDraftSession: loadOrCreateSession = getOrCreateSetupDraftSession,
  patchSetupReviewDraft: patchDraft = defaultPatchSetupReviewDraft,
}) {
  const current = await loadOrCreateSession(actor);
  const draftServices = arr(current?.draft?.services);
  const index = findDraftServiceIndex(draftServices, serviceId);
  const nextServices = [...draftServices];

  if (mode === "create") {
    nextServices.push(normalizeSetupServiceDraftInput(body));
  } else if (mode === "update") {
    if (index < 0) throw new Error("service not found in setup review draft");
    nextServices[index] = normalizeSetupServiceDraftInput(
      mergeDraftState(nextServices[index], body),
      s(nextServices[index]?.id || serviceId)
    );
  } else if (mode === "delete") {
    if (index < 0) throw new Error("service not found in setup review draft");
    nextServices.splice(index, 1);
  } else {
    throw new Error("unsupported staged service mutation");
  }

  await patchDraft({
    sessionId: current.session.id,
    tenantId: actor.tenantId,
    patch: {
      services: nextServices,
      draftPayload: mergeDraftState(obj(current?.draft?.draftPayload), {
        stagedInputs: {
          services: {
            updatedAt: new Date().toISOString(),
            count: nextServices.length,
          },
        },
      }),
    },
    bumpVersion: true,
  });

  return loadCurrentReviewPayload({
    db,
    actor,
    eventLimit: 30,
  });
}

function buildServiceDraftFromCandidate(candidate = {}) {
  const valueJson = obj(candidate.value_json);
  return normalizeSetupServiceDraftInput({
    key:
      s(valueJson.service_key || valueJson.serviceKey) ||
      s(candidate.item_key),
    title:
      s(candidate.title) ||
      s(valueJson.title || valueJson.name) ||
      s(candidate.value_text),
    description:
      s(valueJson.description || valueJson.summary) ||
      s(candidate.value_text),
    category: s(candidate.category || "service"),
    priceFrom:
      valueJson.priceFrom ??
      valueJson.price_from ??
      valueJson.startingPrice ??
      valueJson.starting_price,
    currency: s(valueJson.currency || "AZN").toUpperCase() || "AZN",
    pricingModel:
      s(valueJson.pricingModel || valueJson.pricing_model || "custom_quote").toLowerCase() ||
      "custom_quote",
    durationMinutes: valueJson.durationMinutes ?? valueJson.duration_minutes,
    isActive:
      typeof valueJson.isActive === "boolean"
        ? valueJson.isActive
        : typeof valueJson.is_active === "boolean"
          ? valueJson.is_active
          : true,
    sortOrder: Number(valueJson.sortOrder ?? valueJson.sort_order ?? 0) || 0,
    highlights: arr(
      valueJson.highlights ??
        valueJson.highlights_json ??
        valueJson.highlightsText ??
        valueJson.highlights_text
    ),
    metadataJson: {
      source: "workspace_knowledge_candidate_approval",
      approvedCandidateId: s(candidate.id),
      sourceId: s(candidate.source_id),
      sourceRunId: s(candidate.source_run_id),
      candidateCategory: s(candidate.category),
      candidateItemKey: s(candidate.item_key),
      stagedInMaintenanceReview: true,
    },
  });
}

function normalizePublishedServicesSnapshot(version = {}) {
  return arr(
    version?.services_snapshot_json ||
      version?.servicesSnapshot ||
      version?.metadata_json?.servicesSnapshot ||
      version?.metadata_json?.services_snapshot_json
  );
}

function hasPublishedServicesSnapshot(version = {}) {
  const metadata = obj(version?.metadata_json);
  return (
    Object.prototype.hasOwnProperty.call(metadata, "servicesSnapshot") ||
    Object.prototype.hasOwnProperty.call(metadata, "services_snapshot_json") ||
    Array.isArray(version?.services_snapshot_json) ||
    Array.isArray(version?.servicesSnapshot)
  );
}

function buildServiceSeedItem(item = {}) {
  return compactDraftObject({
    id: s(item.id || item.serviceId || item.service_id || `seed_${s(item.serviceKey || item.service_key)}`),
    key: s(item.key || item.serviceKey || item.service_key),
    serviceKey: s(item.key || item.serviceKey || item.service_key),
    title: s(item.title || item.name),
    description: s(item.description || item.summary),
    category: s(item.category || "general").toLowerCase() || "general",
    priceFrom: item.priceFrom ?? item.price_from ?? null,
    currency: s(item.currency || "AZN").toUpperCase() || "AZN",
    pricingModel: s(item.pricingModel || item.pricing_model || "custom_quote").toLowerCase() || "custom_quote",
    durationMinutes: item.durationMinutes ?? item.duration_minutes ?? null,
    isActive:
      typeof item.isActive === "boolean"
        ? item.isActive
        : typeof item.is_active === "boolean"
          ? item.is_active
          : true,
    sortOrder: Number(item.sortOrder ?? item.sort_order ?? 0) || 0,
    highlights: arr(item.highlights || item.highlights_json),
    metadataJson: obj(item.metadataJson || item.metadata_json),
  });
}

function mergeServiceDraftItems(items = [], incoming = {}) {
  const next = arr(items).map((item) => ({ ...item }));
  const needleKey = s(incoming.key || incoming.serviceKey || incoming.service_key).toLowerCase();
  const needleTitle = s(incoming.title).toLowerCase();
  const matchIndex = next.findIndex((item) => {
    const itemKey = s(item.key || item.serviceKey || item.service_key).toLowerCase();
    const itemTitle = s(item.title || item.name).toLowerCase();
    return (needleKey && itemKey && needleKey === itemKey) || (needleTitle && itemTitle && needleTitle === itemTitle);
  });

  if (matchIndex >= 0) {
    next[matchIndex] = compactDraftObject({
      ...next[matchIndex],
      ...incoming,
      metadataJson: mergeDraftState(
        obj(next[matchIndex]?.metadataJson),
        obj(incoming?.metadataJson)
      ),
    });
    return next;
  }

  next.push(incoming);
  return next;
}

export async function stageApprovedServiceCandidateInMaintenanceSession({
  db,
  actor,
  candidate,
  reviewedBy = "",
  getCurrentSetupReview = defaultGetCurrentSetupReview,
  getOrCreateActiveSetupReviewSession = defaultGetOrCreateActiveSetupReviewSession,
  patchSetupReviewDraft = defaultPatchSetupReviewDraft,
  updateSetupReviewSession = defaultUpdateSetupReviewSession,
  truthVersionHelper = createTenantTruthVersionHelpers({ db }),
} = {}) {
  const tenantId = s(actor?.tenantId || candidate?.tenant_id);
  const tenantKey = s(actor?.tenantKey || candidate?.tenant_key);
  if (!tenantId || !tenantKey) {
    throw new Error("Tenant scope is required");
  }

  const current = await getCurrentSetupReview(tenantId);
  const activeSession = current?.session || null;

  if (activeSession?.id && s(activeSession.mode) && s(activeSession.mode) !== "refresh") {
    const error = new Error(
      "An active setup review session is already in progress. Publish or discard it before staging a service maintenance change."
    );
    error.code = "TRUTH_MAINTENANCE_SESSION_CONFLICT";
    error.statusCode = 409;
    error.currentReview = current;
    throw error;
  }

  const latestTruthVersion =
    truthVersionHelper &&
    typeof truthVersionHelper.getLatestVersion === "function"
      ? await truthVersionHelper.getLatestVersion({ tenantId, tenantKey })
      : null;

  const publishedServices = normalizePublishedServicesSnapshot(latestTruthVersion).map(
    buildServiceSeedItem
  );
  const canonicalServicesData =
    hasPublishedServicesSnapshot(latestTruthVersion)
      ? null
      : await listSetupServices({
          db,
          tenantId,
          tenantKey,
          role: s(actor?.role),
          tenant: actor?.tenant || null,
          includeSetup: false,
        });
  const canonicalServices =
    hasPublishedServicesSnapshot(latestTruthVersion)
      ? publishedServices
      : arr(
          canonicalServicesData?.items ||
            canonicalServicesData?.services ||
            canonicalServicesData
        ).map(buildServiceSeedItem);

  const session =
    activeSession?.id && s(activeSession.mode) === "refresh"
      ? activeSession
      : await getOrCreateActiveSetupReviewSession({
          tenantId,
          mode: "refresh",
          currentStep: "maintenance_review",
          metadata: {
            sourceCurrentTruthVersionId: s(latestTruthVersion?.id),
            stagedFrom: "approved_service_candidate",
            candidateId: s(candidate?.id),
            reviewerId: s(reviewedBy),
            reviewerName: s(reviewedBy),
          },
          ensureDraft: true,
        });

  const existingDraftServices = arr(current?.draft?.services);
  const baseServices = existingDraftServices.length ? existingDraftServices : canonicalServices;
  const stagedService = buildServiceDraftFromCandidate(candidate);
  const nextServices = mergeServiceDraftItems(baseServices, stagedService);

  const sourceSummary = mergeDraftState(obj(current?.draft?.sourceSummary), {
    maintenance: {
      mode: "refresh",
      stagedFrom: "approved_service_candidate",
      reviewSessionId: s(session?.id),
      sourceCurrentTruthVersionId: s(latestTruthVersion?.id),
      stagedCandidateIds: [
        ...new Set(
          [...arr(obj(current?.draft?.sourceSummary)?.maintenance?.stagedCandidateIds), s(candidate?.id)].filter(Boolean)
        ),
      ],
      stagedServiceKeys: [
        ...new Set(
          nextServices
            .map((item) => s(item.key || item.serviceKey || item.service_key))
            .filter(Boolean)
        ),
      ],
    },
  });

  const draft = await patchSetupReviewDraft({
    sessionId: session.id,
    tenantId,
    patch: {
      services: nextServices,
      sourceSummary,
      draftPayload: mergeDraftState(obj(current?.draft?.draftPayload), {
        maintenanceMode: "post_publish_truth_change_set",
        latestCandidateId: s(candidate?.id),
        latestCandidateCategory: s(candidate?.category),
        stagedInputs: {
          services: {
            updatedAt: new Date().toISOString(),
            count: nextServices.length,
          },
        },
      }),
    },
    bumpVersion: true,
  });

  const updatedSession = await updateSetupReviewSession(session.id, {
    mode: "refresh",
    status: "ready",
    currentStep: "maintenance_review",
    metadata: mergeDraftState(obj(session?.metadata), {
      sourceCurrentTruthVersionId: s(latestTruthVersion?.id),
      stagedFrom: "approved_service_candidate",
      latestCandidateId: s(candidate?.id),
      latestCandidateCategory: s(candidate?.category),
      reviewerId: s(reviewedBy),
      reviewerName: s(reviewedBy),
    }),
  });

  return {
    publishStatus: "review_required",
    reviewRequired: true,
    staged: true,
    liveMutationDeferred: true,
    runtimeProjectionRefreshed: false,
    truthVersionCreated: false,
    maintenanceSession: {
      id: s(updatedSession?.id || session?.id),
      mode: s(updatedSession?.mode || session?.mode || "refresh"),
      status: s(updatedSession?.status || session?.status || "ready"),
      currentStep: s(updatedSession?.currentStep || session?.currentStep || "maintenance_review"),
      sourceCurrentTruthVersionId: s(latestTruthVersion?.id),
    },
    maintenanceDraft: {
      version: Number(draft?.version || 0),
      services: arr(draft?.services || nextServices),
      sourceSummary: obj(draft?.sourceSummary || sourceSummary),
    },
  };
}

export const __test__ = {
  normalizeSetupServiceDraftInput,
  buildServiceDraftFromCandidate,
  mergeServiceDraftItems,
};
