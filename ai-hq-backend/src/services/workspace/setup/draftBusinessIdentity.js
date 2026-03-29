import { createTenantTruthVersionHelpers } from "../../../db/helpers/tenantTruthVersions.js";
import {
  dbListTenantContacts,
  dbListTenantLocations,
} from "../../../db/helpers/tenantBusinessBrain.js";
import {
  arr,
  compactDraftObject,
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

function normalizeContactDraftInput(input = {}, fallbackId = "") {
  const body = obj(input);
  const contactKey = s(body.contactKey || body.contact_key || body.key);
  const label = s(body.label);
  const value = s(body.value);

  if (!contactKey) {
    throw new Error("Contact key is required");
  }

  return compactDraftObject({
    id: s(body.id || fallbackId || `draft_${contactKey}`),
    contactKey,
    channel: s(body.channel || "other").toLowerCase() || "other",
    label,
    value,
    isPrimary:
      typeof body.isPrimary === "boolean"
        ? body.isPrimary
        : typeof body.is_primary === "boolean"
          ? body.is_primary
          : false,
    enabled:
      typeof body.enabled === "boolean"
        ? body.enabled
        : true,
    visiblePublic:
      typeof body.visiblePublic === "boolean"
        ? body.visiblePublic
        : typeof body.visible_public === "boolean"
          ? body.visible_public
          : true,
    visibleInAi:
      typeof body.visibleInAi === "boolean"
        ? body.visibleInAi
        : typeof body.visible_in_ai === "boolean"
          ? body.visible_in_ai
          : true,
    sortOrder: Number(body.sortOrder ?? body.sort_order ?? 0) || 0,
    meta: obj(body.meta),
  });
}

function normalizeLocationDraftInput(input = {}, fallbackId = "") {
  const body = obj(input);
  const locationKey = s(body.locationKey || body.location_key || body.key);
  const title = s(body.title);

  if (!locationKey) {
    throw new Error("Location key is required");
  }

  return compactDraftObject({
    id: s(body.id || fallbackId || `draft_${locationKey}`),
    locationKey,
    title,
    countryCode: s(body.countryCode || body.country_code),
    city: s(body.city),
    addressLine: s(body.addressLine || body.address_line),
    mapUrl: s(body.mapUrl || body.map_url),
    phone: s(body.phone),
    email: s(body.email),
    workingHours: obj(body.workingHours || body.working_hours),
    deliveryAreas: arr(body.deliveryAreas || body.delivery_areas),
    isPrimary:
      typeof body.isPrimary === "boolean"
        ? body.isPrimary
        : typeof body.is_primary === "boolean"
          ? body.is_primary
          : false,
    enabled:
      typeof body.enabled === "boolean"
        ? body.enabled
        : true,
    sortOrder: Number(body.sortOrder ?? body.sort_order ?? 0) || 0,
    meta: obj(body.meta),
  });
}

function normalizePublishedContactsSnapshot(version = {}) {
  return arr(
    version?.contacts_snapshot_json ||
      version?.contactsSnapshot ||
      version?.metadata_json?.contactsSnapshot ||
      version?.metadata_json?.contacts_snapshot_json
  );
}

function normalizePublishedLocationsSnapshot(version = {}) {
  return arr(
    version?.locations_snapshot_json ||
      version?.locationsSnapshot ||
      version?.metadata_json?.locationsSnapshot ||
      version?.metadata_json?.locations_snapshot_json
  );
}

function hasPublishedContactsSnapshot(version = {}) {
  const metadata = obj(version?.metadata_json);
  return (
    Object.prototype.hasOwnProperty.call(metadata, "contactsSnapshot") ||
    Object.prototype.hasOwnProperty.call(metadata, "contacts_snapshot_json") ||
    Array.isArray(version?.contacts_snapshot_json) ||
    Array.isArray(version?.contactsSnapshot)
  );
}

function hasPublishedLocationsSnapshot(version = {}) {
  const metadata = obj(version?.metadata_json);
  return (
    Object.prototype.hasOwnProperty.call(metadata, "locationsSnapshot") ||
    Object.prototype.hasOwnProperty.call(metadata, "locations_snapshot_json") ||
    Array.isArray(version?.locations_snapshot_json) ||
    Array.isArray(version?.locationsSnapshot)
  );
}

function buildContactSeedItem(item = {}) {
  return normalizeContactDraftInput(
    {
      id: item.id || item.contactId || item.contact_id,
      contactKey: item.contactKey || item.contact_key || item.key,
      channel: item.channel,
      label: item.label,
      value: item.value,
      isPrimary: item.isPrimary ?? item.is_primary,
      enabled: item.enabled,
      visiblePublic: item.visiblePublic ?? item.visible_public,
      visibleInAi: item.visibleInAi ?? item.visible_in_ai,
      sortOrder: item.sortOrder ?? item.sort_order,
      meta: item.meta,
    },
    s(item.id || item.contactId || item.contact_id)
  );
}

function buildLocationSeedItem(item = {}) {
  return normalizeLocationDraftInput(
    {
      id: item.id || item.locationId || item.location_id,
      locationKey: item.locationKey || item.location_key || item.key,
      title: item.title,
      countryCode: item.countryCode || item.country_code,
      city: item.city,
      addressLine: item.addressLine || item.address_line,
      mapUrl: item.mapUrl || item.map_url,
      phone: item.phone,
      email: item.email,
      workingHours: item.workingHours || item.working_hours,
      deliveryAreas: item.deliveryAreas || item.delivery_areas,
      isPrimary: item.isPrimary ?? item.is_primary,
      enabled: item.enabled,
      sortOrder: item.sortOrder ?? item.sort_order,
      meta: item.meta,
    },
    s(item.id || item.locationId || item.location_id)
  );
}

function findBusinessIdentityIndex(items = [], idOrKey = "", keyField = "") {
  const needle = s(idOrKey).toLowerCase();
  if (!needle) return -1;

  return arr(items).findIndex((item) => {
    const id = s(item?.id).toLowerCase();
    const key = s(item?.[keyField]).toLowerCase();
    return id === needle || key === needle;
  });
}

function buildMaintenanceDraftResult({
  surface = "",
  mutation = "",
  draft = {},
  session = {},
  latestTruthVersion = null,
  stagedItem = null,
} = {}) {
  return {
    publishStatus: "review_required",
    reviewRequired: true,
    staged: true,
    liveMutationDeferred: true,
    runtimeProjectionRefreshed: false,
    truthVersionCreated: false,
    action: `stage_${surface}_${mutation}`,
    maintenanceSession: {
      id: s(session?.id),
      mode: s(session?.mode || "refresh"),
      status: s(session?.status || "ready"),
      currentStep: s(session?.currentStep || "maintenance_review"),
      sourceCurrentTruthVersionId: s(latestTruthVersion?.id),
    },
    maintenanceDraft: {
      version: Number(draft?.version || 0),
      contacts: arr(draft?.contacts),
      locations: arr(draft?.locations),
      sourceSummary: obj(draft?.sourceSummary),
    },
    stagedItem,
  };
}

export async function listSetupContactsFromDraftOrCanonical({
  db,
  actor,
  getCurrentSetupReview = defaultGetCurrentSetupReview,
}) {
  const current = await getCurrentSetupReview(actor.tenantId);
  const draftContacts = arr(current?.draft?.contacts);

  if (current?.session?.id && Array.isArray(current?.draft?.contacts)) {
    return {
      contacts: draftContacts,
      source: "setup_review_draft",
      staged: true,
      canonicalWriteDeferred: true,
    };
  }

  return {
    contacts: await dbListTenantContacts(db, actor.tenantId),
    source: "canonical_read_only",
    staged: false,
    canonicalWriteDeferred: false,
  };
}

export async function listSetupLocationsFromDraftOrCanonical({
  db,
  actor,
  getCurrentSetupReview = defaultGetCurrentSetupReview,
}) {
  const current = await getCurrentSetupReview(actor.tenantId);
  const draftLocations = arr(current?.draft?.locations);

  if (current?.session?.id && Array.isArray(current?.draft?.locations)) {
    return {
      locations: draftLocations,
      source: "setup_review_draft",
      staged: true,
      canonicalWriteDeferred: true,
    };
  }

  return {
    locations: await dbListTenantLocations(db, actor.tenantId),
    source: "canonical_read_only",
    staged: false,
    canonicalWriteDeferred: false,
  };
}

export async function stageContactMutationInMaintenanceSession({
  db,
  actor,
  mode,
  contactId = "",
  body = {},
  getCurrentSetupReview = defaultGetCurrentSetupReview,
  getOrCreateActiveSetupReviewSession = defaultGetOrCreateActiveSetupReviewSession,
  patchSetupReviewDraft = defaultPatchSetupReviewDraft,
  updateSetupReviewSession = defaultUpdateSetupReviewSession,
  truthVersionHelper = createTenantTruthVersionHelpers({ db }),
} = {}) {
  const current = await getCurrentSetupReview(actor.tenantId);
  const activeSession = current?.session || null;

  if (activeSession?.id && s(activeSession.mode) && s(activeSession.mode) !== "refresh") {
    const error = new Error(
      "An active setup review session is already in progress. Publish or discard it before staging a contact change."
    );
    error.code = "TRUTH_MAINTENANCE_SESSION_CONFLICT";
    error.statusCode = 409;
    throw error;
  }

  const latestTruthVersion =
    truthVersionHelper &&
    typeof truthVersionHelper.getLatestVersion === "function"
      ? await truthVersionHelper.getLatestVersion({
          tenantId: actor.tenantId,
          tenantKey: actor.tenantKey,
        })
      : null;

  const publishedContacts = normalizePublishedContactsSnapshot(latestTruthVersion).map(
    buildContactSeedItem
  );
  const canonicalContacts =
    hasPublishedContactsSnapshot(latestTruthVersion)
      ? publishedContacts
      : arr(await dbListTenantContacts(db, actor.tenantId)).map(buildContactSeedItem);
  const baseContacts = Array.isArray(current?.draft?.contacts)
    ? arr(current?.draft?.contacts)
    : canonicalContacts;
  const nextContacts = [...baseContacts];
  let stagedItem = null;

  if (mode === "delete") {
    const index = findBusinessIdentityIndex(nextContacts, contactId, "contactKey");
    if (index < 0) {
      throw new Error("contact not found in maintenance draft");
    }
    stagedItem = nextContacts[index];
    nextContacts.splice(index, 1);
  } else {
    stagedItem = normalizeContactDraftInput(
      body,
      s(body.id || contactId || body.contactKey || body.contact_key)
    );
    const index = findBusinessIdentityIndex(
      nextContacts,
      body.contactKey || body.contact_key || contactId,
      "contactKey"
    );
    if (index >= 0) {
      nextContacts[index] = mergeDraftState(nextContacts[index], stagedItem);
    } else {
      nextContacts.push(stagedItem);
    }
  }

  const session =
    activeSession?.id && s(activeSession.mode) === "refresh"
      ? activeSession
      : await getOrCreateActiveSetupReviewSession({
          tenantId: actor.tenantId,
          mode: "refresh",
          currentStep: "maintenance_review",
          metadata: {
            sourceCurrentTruthVersionId: s(latestTruthVersion?.id),
            stagedFrom: "settings_contacts",
          },
          ensureDraft: true,
        });

  const sourceSummary = mergeDraftState(obj(current?.draft?.sourceSummary), {
    maintenance: {
      mode: "refresh",
      stagedFrom: "settings_contacts",
      sourceCurrentTruthVersionId: s(latestTruthVersion?.id),
      reviewSessionId: s(session?.id),
    },
  });

  const draft = await patchSetupReviewDraft({
    sessionId: session.id,
    tenantId: actor.tenantId,
    patch: {
      contacts: nextContacts,
      sourceSummary,
      draftPayload: mergeDraftState(obj(current?.draft?.draftPayload), {
        maintenanceMode: "post_publish_truth_change_set",
        stagedInputs: {
          contacts: {
            updatedAt: new Date().toISOString(),
            count: nextContacts.length,
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
      stagedFrom: "settings_contacts",
    }),
  });

  return buildMaintenanceDraftResult({
    surface: "contacts",
    mutation: mode === "delete" ? "delete_review" : "review",
    draft: {
      ...draft,
      contacts: arr(draft?.contacts || nextContacts),
      locations: arr(current?.draft?.locations),
      sourceSummary: obj(draft?.sourceSummary || sourceSummary),
    },
    session: updatedSession || session,
    latestTruthVersion,
    stagedItem,
  });
}

export async function stageLocationMutationInMaintenanceSession({
  db,
  actor,
  mode,
  locationId = "",
  body = {},
  getCurrentSetupReview = defaultGetCurrentSetupReview,
  getOrCreateActiveSetupReviewSession = defaultGetOrCreateActiveSetupReviewSession,
  patchSetupReviewDraft = defaultPatchSetupReviewDraft,
  updateSetupReviewSession = defaultUpdateSetupReviewSession,
  truthVersionHelper = createTenantTruthVersionHelpers({ db }),
} = {}) {
  const current = await getCurrentSetupReview(actor.tenantId);
  const activeSession = current?.session || null;

  if (activeSession?.id && s(activeSession.mode) && s(activeSession.mode) !== "refresh") {
    const error = new Error(
      "An active setup review session is already in progress. Publish or discard it before staging a location change."
    );
    error.code = "TRUTH_MAINTENANCE_SESSION_CONFLICT";
    error.statusCode = 409;
    throw error;
  }

  const latestTruthVersion =
    truthVersionHelper &&
    typeof truthVersionHelper.getLatestVersion === "function"
      ? await truthVersionHelper.getLatestVersion({
          tenantId: actor.tenantId,
          tenantKey: actor.tenantKey,
        })
      : null;

  const publishedLocations = normalizePublishedLocationsSnapshot(latestTruthVersion).map(
    buildLocationSeedItem
  );
  const canonicalLocations =
    hasPublishedLocationsSnapshot(latestTruthVersion)
      ? publishedLocations
      : arr(await dbListTenantLocations(db, actor.tenantId)).map(buildLocationSeedItem);
  const baseLocations = Array.isArray(current?.draft?.locations)
    ? arr(current?.draft?.locations)
    : canonicalLocations;
  const nextLocations = [...baseLocations];
  let stagedItem = null;

  if (mode === "delete") {
    const index = findBusinessIdentityIndex(nextLocations, locationId, "locationKey");
    if (index < 0) {
      throw new Error("location not found in maintenance draft");
    }
    stagedItem = nextLocations[index];
    nextLocations.splice(index, 1);
  } else {
    stagedItem = normalizeLocationDraftInput(
      body,
      s(body.id || locationId || body.locationKey || body.location_key)
    );
    const index = findBusinessIdentityIndex(
      nextLocations,
      body.locationKey || body.location_key || locationId,
      "locationKey"
    );
    if (index >= 0) {
      nextLocations[index] = mergeDraftState(nextLocations[index], stagedItem);
    } else {
      nextLocations.push(stagedItem);
    }
  }

  const session =
    activeSession?.id && s(activeSession.mode) === "refresh"
      ? activeSession
      : await getOrCreateActiveSetupReviewSession({
          tenantId: actor.tenantId,
          mode: "refresh",
          currentStep: "maintenance_review",
          metadata: {
            sourceCurrentTruthVersionId: s(latestTruthVersion?.id),
            stagedFrom: "settings_locations",
          },
          ensureDraft: true,
        });

  const sourceSummary = mergeDraftState(obj(current?.draft?.sourceSummary), {
    maintenance: {
      mode: "refresh",
      stagedFrom: "settings_locations",
      sourceCurrentTruthVersionId: s(latestTruthVersion?.id),
      reviewSessionId: s(session?.id),
    },
  });

  const draft = await patchSetupReviewDraft({
    sessionId: session.id,
    tenantId: actor.tenantId,
    patch: {
      locations: nextLocations,
      sourceSummary,
      draftPayload: mergeDraftState(obj(current?.draft?.draftPayload), {
        maintenanceMode: "post_publish_truth_change_set",
        stagedInputs: {
          locations: {
            updatedAt: new Date().toISOString(),
            count: nextLocations.length,
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
      stagedFrom: "settings_locations",
    }),
  });

  return buildMaintenanceDraftResult({
    surface: "locations",
    mutation: mode === "delete" ? "delete_review" : "review",
    draft: {
      ...draft,
      contacts: arr(current?.draft?.contacts),
      locations: arr(draft?.locations || nextLocations),
      sourceSummary: obj(draft?.sourceSummary || sourceSummary),
    },
    session: updatedSession || session,
    latestTruthVersion,
    stagedItem,
  });
}

export const __test__ = {
  normalizeContactDraftInput,
  normalizeLocationDraftInput,
  buildContactSeedItem,
  buildLocationSeedItem,
};
