import { s, arr } from "./shared.js";
import {
  sanitizeProjectedProfilePatchFromCandidate,
  sanitizeProjectedCapabilitiesPatchFromCandidate,
  hasMeaningfulProfileProjectionPatch,
  hasMeaningfulCapabilitiesProjectionPatch,
} from "./authority.js";
import {
  buildProfileProjectionPatchFromCandidate,
  buildCapabilitiesProjectionPatchFromCandidate,
} from "./merge.js";
import { refreshRuntimeProjectionRequired } from "./core.js";
import {
  getCurrentSetupReview,
  getOrCreateActiveSetupReviewSession,
  patchSetupReviewDraft,
  readSetupReviewDraft,
  updateSetupReviewSession,
} from "../tenantSetupReview.js";
import {
  buildCanonicalTruthCapabilities,
  buildCanonicalTruthProfile,
  createTenantTruthVersionHelpers,
} from "../tenantTruthVersions.js";
import {
  getBusinessCapabilitiesInternal,
  getBusinessProfileInternal,
  resolveTenantIdentity,
} from "./core.js";
import {
  upsertBusinessProfileInternal,
  upsertBusinessCapabilitiesInternal,
} from "./writers.js";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
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

function mergeDraftProfile(base = {}, patch = {}) {
  const current = compactObject(base);
  const next = compactObject(patch);
  const mergedProfileJson = {
    ...obj(current.profileJson),
    ...obj(next.profileJson),
  };

  return compactObject({
    ...current,
    ...next,
    profileJson: mergedProfileJson,
  });
}

function mergeDraftCapabilities(base = {}, patch = {}) {
  return compactObject({
    ...compactObject(base),
    ...compactObject(patch),
  });
}

function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildSourceChannelCapabilitiesPatch({
  sourceTypes = [],
  baseCapabilities = {},
} = {}) {
  const types = new Set(arr(sourceTypes).map((item) => s(item)).filter(Boolean));
  const base = compactObject(baseCapabilities);

  return compactObject({
    supportsInstagramDm: types.has("instagram"),
    supportsFacebookMessenger:
      types.has("messenger") ||
      types.has("facebook_page") ||
      types.has("facebook"),
    supportsWhatsapp: types.has("whatsapp_business"),
    supportsComments:
      types.has("facebook_comments") ||
      types.has("instagram") ||
      types.has("facebook"),
    supportsEmail: types.has("email") || Boolean(base.supportsEmail),
  });
}

function diffCapabilityPatchAgainstBase(base = {}, patch = {}) {
  const current = compactObject(base);
  const next = compactObject(patch);

  return Object.keys(next).reduce((acc, key) => {
    if (!valuesEqual(current[key], next[key])) {
      acc[key] = next[key];
    }
    return acc;
  }, {});
}

function buildSourceCapabilityMaintenanceSummary({
  current = {},
  latestTruthVersion = null,
  session = {},
  sourceTypes = [],
  stagedCapabilityFields = [],
  source = "",
} = {}) {
  const existingMaintenance = obj(obj(current).maintenance);

  return compactObject({
    ...obj(current),
    maintenance: {
      ...existingMaintenance,
      mode: "refresh",
      stagedFrom: "source_channel_capability_refresh",
      reviewSessionId: s(session.id),
      sourceCurrentTruthVersionId: s(latestTruthVersion?.id),
      sourceTypes: arr(sourceTypes),
      source,
      stagedCapabilityFields: arr(stagedCapabilityFields),
    },
  });
}

function buildMaintenanceDraftSeed({
  latestTruthVersion = null,
  currentProfile = null,
  currentCapabilities = null,
} = {}) {
  const publishedProfile = Object.keys(
    obj(latestTruthVersion?.profile_snapshot_json)
  ).length
    ? compactObject(latestTruthVersion.profile_snapshot_json)
    : buildCanonicalTruthProfile(currentProfile || {});
  const publishedCapabilities = Object.keys(
    obj(latestTruthVersion?.capabilities_snapshot_json)
  ).length
    ? compactObject(latestTruthVersion.capabilities_snapshot_json)
    : buildCanonicalTruthCapabilities(currentCapabilities || {});

  return {
    businessProfile: publishedProfile,
    capabilities: publishedCapabilities,
  };
}

function buildMaintenanceSourceSummary({
  current = {},
  candidate = {},
  latestTruthVersion = null,
  authority = {},
  profileProjection = {},
  capabilitiesProjection = {},
  session = {},
} = {}) {
  const existingMaintenance = obj(obj(current).maintenance);
  const stagedCandidateIds = [
    ...new Set(
      [...arr(existingMaintenance.stagedCandidateIds), s(candidate.id)].filter(Boolean)
    ),
  ];

  return compactObject({
    ...obj(current),
    maintenance: {
      ...existingMaintenance,
      mode: "refresh",
      reviewSessionId: s(session.id),
      sourceCurrentTruthVersionId: s(latestTruthVersion?.id),
      stagedCandidateIds,
      strongestSourceType: s(authority?.strongestSourceType),
      strongestAuthorityClass: s(authority?.strongestAuthorityClass),
      sourceTypes: arr(authority?.sourceTypes),
      stagedProfileFields: arr(profileProjection?.skippedFields).length
        ? []
        : Object.keys(obj(profileProjection?.patch)).filter((key) => key !== "profileJson"),
      stagedCapabilityFields: Object.keys(obj(capabilitiesProjection?.patch)).filter(
        (key) => !["tenantId", "tenantKey", "writeIntent", "approvedBy"].includes(key)
      ),
    },
  });
}

export async function stageApprovedCandidateInMaintenanceSessionInternal(
  db,
  candidate,
  options = {},
  deps = {}
) {
  if (!candidate) {
    return {
      profile: null,
      capabilities: null,
      projectionGuard: null,
      runtimeProjection: null,
      maintenanceSession: null,
      maintenanceDraft: null,
      truthVersion: null,
    };
  }

  const reviewerId = s(options.reviewerId);
  const reviewerName = s(options.reviewerName);

  const rawProfilePatch = buildProfileProjectionPatchFromCandidate(candidate);
  const rawCapabilitiesPatch = buildCapabilitiesProjectionPatchFromCandidate(candidate);
  const profileProjection = sanitizeProjectedProfilePatchFromCandidate(
    candidate,
    rawProfilePatch
  );
  const capabilitiesProjection = sanitizeProjectedCapabilitiesPatchFromCandidate(
    candidate,
    rawCapabilitiesPatch
  );
  const authority = profileProjection.authority || capabilitiesProjection.authority;
  const hasProfilePatch = hasMeaningfulProfileProjectionPatch(profileProjection.patch);
  const hasCapabilitiesPatch = hasMeaningfulCapabilitiesProjectionPatch(
    capabilitiesProjection.patch
  );

  if (!hasProfilePatch && !hasCapabilitiesPatch) {
    return {
      profile: null,
      capabilities: null,
      projectionGuard: {
        strongestSourceType: authority?.strongestSourceType || "",
        strongestAuthorityClass: authority?.strongestAuthorityClass || "",
        strongestAuthorityRank: Number(authority?.strongestAuthorityRank || 0),
        sourceTypes: arr(authority?.sourceTypes),
        onlyWeakSources: Boolean(authority?.onlyWeakSources),
        hasOfficialConnected: Boolean(authority?.hasOfficialConnected),
        hasWebsiteOrBetter: Boolean(authority?.hasWebsiteOrBetter),
        hasStructuredOrBetter: Boolean(authority?.hasStructuredOrBetter),
        skippedProfileFields: arr(profileProjection.skippedFields),
        skippedCapabilityFields: arr(capabilitiesProjection.skippedFields),
        profileProjected: false,
        capabilitiesProjected: false,
        maintenanceStaged: false,
      },
      runtimeProjection: null,
      maintenanceSession: null,
      maintenanceDraft: null,
      truthVersion: null,
    };
  }

  const truthVersions =
    deps.truthVersionHelpers || createTenantTruthVersionHelpers({ db });
  const loadCurrentProfile =
    deps.getBusinessProfileInternal || getBusinessProfileInternal;
  const loadCurrentCapabilities =
    deps.getBusinessCapabilitiesInternal || getBusinessCapabilitiesInternal;
  const loadCurrentReview = deps.getCurrentSetupReview || getCurrentSetupReview;
  const getOrCreateReviewSession =
    deps.getOrCreateActiveSetupReviewSession || getOrCreateActiveSetupReviewSession;
  const loadReviewDraft = deps.readSetupReviewDraft || readSetupReviewDraft;
  const patchReviewDraft = deps.patchSetupReviewDraft || patchSetupReviewDraft;
  const patchReviewSession =
    deps.updateSetupReviewSession || updateSetupReviewSession;

  const latestTruthVersion = await truthVersions.getLatestVersion({
    tenantId: candidate.tenant_id,
    tenantKey: candidate.tenant_key,
  });
  const currentProfile = await loadCurrentProfile(db, {
    tenantId: candidate.tenant_id,
    tenantKey: candidate.tenant_key,
  });
  const currentCapabilities = await loadCurrentCapabilities(db, {
    tenantId: candidate.tenant_id,
    tenantKey: candidate.tenant_key,
  });

  const currentReview = await loadCurrentReview(candidate.tenant_id, db);
  if (
    currentReview?.session?.id &&
    s(currentReview.session.mode) &&
    s(currentReview.session.mode) !== "refresh"
  ) {
    const error = new Error(
      "An active setup review session is already in progress. Publish or discard it before staging post-publish truth maintenance."
    );
    error.code = "TRUTH_MAINTENANCE_SESSION_CONFLICT";
    error.statusCode = 409;
    error.currentReview = currentReview;
    throw error;
  }

  const session =
    currentReview?.session?.id && s(currentReview?.session?.mode) === "refresh"
      ? currentReview.session
      : await getOrCreateReviewSession(
          {
            tenantId: candidate.tenant_id,
            mode: "refresh",
            currentStep: "maintenance_review",
            metadata: {
              sourceCurrentTruthVersionId: s(latestTruthVersion?.id),
              stagedFrom: "approved_candidate",
              candidateId: s(candidate.id),
              reviewerId,
              reviewerName,
            },
          },
          db
        );

  const existingDraft =
    (await loadReviewDraft(
      { sessionId: session.id, tenantId: candidate.tenant_id },
      db
    )) || null;
  const seed = buildMaintenanceDraftSeed({
    latestTruthVersion,
    currentProfile,
    currentCapabilities,
  });
  const nextBusinessProfile = hasProfilePatch
    ? mergeDraftProfile(
        Object.keys(obj(existingDraft?.businessProfile)).length
          ? existingDraft.businessProfile
          : seed.businessProfile,
        profileProjection.patch
      )
    : Object.keys(obj(existingDraft?.businessProfile)).length
      ? existingDraft.businessProfile
      : seed.businessProfile;
  const nextCapabilities = hasCapabilitiesPatch
    ? mergeDraftCapabilities(
        Object.keys(obj(existingDraft?.capabilities)).length
          ? existingDraft.capabilities
          : seed.capabilities,
        capabilitiesProjection.patch
      )
    : Object.keys(obj(existingDraft?.capabilities)).length
      ? existingDraft.capabilities
      : seed.capabilities;

  const sourceSummary = buildMaintenanceSourceSummary({
    current: existingDraft?.sourceSummary,
    candidate,
    latestTruthVersion,
    authority,
    profileProjection,
    capabilitiesProjection,
    session,
  });

  const draft = await patchReviewDraft(
    {
      sessionId: session.id,
      tenantId: candidate.tenant_id,
      patch: {
        businessProfile: nextBusinessProfile,
        capabilities: nextCapabilities,
        sourceSummary,
        draftPayload: {
          ...obj(existingDraft?.draftPayload),
          maintenanceMode: "post_publish_truth_change_set",
          latestCandidateId: s(candidate.id),
          latestCandidateCategory: s(candidate.category),
        },
      },
      bumpVersion: true,
    },
    db
  );

  const updatedSession = await patchReviewSession(
    session.id,
    {
      mode: "refresh",
      status: "ready",
      currentStep: "maintenance_review",
      metadata: compactObject({
        ...obj(session.metadata),
        sourceCurrentTruthVersionId: s(latestTruthVersion?.id),
        stagedFrom: "approved_candidate",
        latestCandidateId: s(candidate.id),
        latestCandidateCategory: s(candidate.category),
        reviewerId,
        reviewerName,
      }),
    },
    db
  );

  return {
    profile: null,
    capabilities: null,
    projectionGuard: {
      strongestSourceType: authority?.strongestSourceType || "",
      strongestAuthorityClass: authority?.strongestAuthorityClass || "",
      strongestAuthorityRank: Number(authority?.strongestAuthorityRank || 0),
      sourceTypes: arr(authority?.sourceTypes),
      onlyWeakSources: Boolean(authority?.onlyWeakSources),
      hasOfficialConnected: Boolean(authority?.hasOfficialConnected),
      hasWebsiteOrBetter: Boolean(authority?.hasWebsiteOrBetter),
      hasStructuredOrBetter: Boolean(authority?.hasStructuredOrBetter),
      skippedProfileFields: arr(profileProjection.skippedFields),
      skippedCapabilityFields: arr(capabilitiesProjection.skippedFields),
      profileProjected: false,
      capabilitiesProjected: false,
      maintenanceStaged: true,
    },
    runtimeProjection: null,
    maintenanceSession: {
      id: s(updatedSession?.id || session.id),
      mode: s(updatedSession?.mode || session.mode || "refresh"),
      status: s(updatedSession?.status || session.status || "ready"),
      currentStep: s(
        updatedSession?.currentStep || session.currentStep || "maintenance_review"
      ),
      sourceCurrentTruthVersionId: s(latestTruthVersion?.id),
    },
    maintenanceDraft: {
      version: Number(draft?.version || 0),
      businessProfile: draft?.businessProfile || nextBusinessProfile,
      capabilities: draft?.capabilities || nextCapabilities,
      sourceSummary: draft?.sourceSummary || sourceSummary,
    },
    truthVersion: null,
  };
}

export async function stageSourceChannelCapabilitiesInMaintenanceSessionInternal(
  db,
  {
    tenantId = "",
    tenantKey = "",
    sourceTypes = [],
    reviewerId = "",
    reviewerName = "",
    source = "source_channel_capability_refresh",
  } = {},
  deps = {}
) {
  const resolveTenant =
    deps.resolveTenantIdentity || resolveTenantIdentity;
  const truthVersions =
    deps.truthVersionHelpers || createTenantTruthVersionHelpers({ db });
  const loadCurrentProfile =
    deps.getBusinessProfileInternal || getBusinessProfileInternal;
  const loadCurrentCapabilities =
    deps.getBusinessCapabilitiesInternal || getBusinessCapabilitiesInternal;
  const loadCurrentReview = deps.getCurrentSetupReview || getCurrentSetupReview;
  const getOrCreateReviewSession =
    deps.getOrCreateActiveSetupReviewSession || getOrCreateActiveSetupReviewSession;
  const loadReviewDraft = deps.readSetupReviewDraft || readSetupReviewDraft;
  const patchReviewDraft = deps.patchSetupReviewDraft || patchSetupReviewDraft;
  const patchReviewSession =
    deps.updateSetupReviewSession || updateSetupReviewSession;

  const tenant = await resolveTenant(db, { tenantId, tenantKey });
  if (!tenant?.tenant_id) {
    return null;
  }

  const latestTruthVersion = await truthVersions.getLatestVersion({
    tenantId: tenant.tenant_id,
    tenantKey: tenant.tenant_key,
  });
  const currentProfile = await loadCurrentProfile(db, {
    tenantId: tenant.tenant_id,
    tenantKey: tenant.tenant_key,
  });
  const currentCapabilities = await loadCurrentCapabilities(db, {
    tenantId: tenant.tenant_id,
    tenantKey: tenant.tenant_key,
  });

  const currentReview = await loadCurrentReview(tenant.tenant_id, db);
  if (
    currentReview?.session?.id &&
    s(currentReview.session.mode) &&
    s(currentReview.session.mode) !== "refresh"
  ) {
    return {
      profile: null,
      capabilities: null,
      runtimeProjection: null,
      truthVersion: null,
      publishStatus: "blocked",
      reviewRequired: true,
      canonicalCapabilitiesMutated: false,
      runtimeProjectionRefreshed: false,
      blockedReason: "active_setup_review_conflict",
      projectionGuard: {
        maintenanceStaged: false,
        sourceTypes: arr(sourceTypes),
        stagedCapabilityFields: [],
      },
      currentReview: {
        sessionId: s(currentReview.session.id),
        mode: s(currentReview.session.mode),
        status: s(currentReview.session.status),
        currentStep: s(currentReview.session.currentStep),
      },
      maintenanceSession: null,
      maintenanceDraft: null,
    };
  }

  const existingDraft =
    currentReview?.session?.id && s(currentReview?.session?.mode) === "refresh"
      ? (await loadReviewDraft(
          { sessionId: currentReview.session.id, tenantId: tenant.tenant_id },
          db
        )) || null
      : null;

  const seed = buildMaintenanceDraftSeed({
    latestTruthVersion,
    currentProfile,
    currentCapabilities,
  });
  const baseCapabilities = Object.keys(obj(existingDraft?.capabilities)).length
    ? existingDraft.capabilities
    : seed.capabilities;
  const computedCapabilityPatch = buildSourceChannelCapabilitiesPatch({
    sourceTypes,
    baseCapabilities,
  });
  const capabilityPatch = diffCapabilityPatchAgainstBase(
    baseCapabilities,
    computedCapabilityPatch
  );
  const stagedCapabilityFields = Object.keys(capabilityPatch);

  if (!stagedCapabilityFields.length) {
    return {
      profile: null,
      capabilities: null,
      runtimeProjection: null,
      truthVersion: null,
      publishStatus: "no_change",
      reviewRequired: false,
      canonicalCapabilitiesMutated: false,
      runtimeProjectionRefreshed: false,
      sourceTypes: arr(sourceTypes),
      projectionGuard: {
        maintenanceStaged: false,
        sourceTypes: arr(sourceTypes),
        stagedCapabilityFields: [],
      },
      maintenanceSession: null,
      maintenanceDraft: existingDraft
        ? {
            version: Number(existingDraft.version || 0),
            capabilities: existingDraft.capabilities,
            businessProfile: existingDraft.businessProfile || seed.businessProfile,
            sourceSummary: existingDraft.sourceSummary || {},
          }
        : null,
    };
  }

  const session =
    currentReview?.session?.id && s(currentReview?.session?.mode) === "refresh"
      ? currentReview.session
      : await getOrCreateReviewSession(
          {
            tenantId: tenant.tenant_id,
            mode: "refresh",
            currentStep: "maintenance_review",
            metadata: {
              sourceCurrentTruthVersionId: s(latestTruthVersion?.id),
              stagedFrom: "source_channel_capability_refresh",
              reviewerId: s(reviewerId),
              reviewerName: s(reviewerName),
              sourceTypes: arr(sourceTypes),
              source,
            },
          },
          db
        );

  const nextCapabilities = mergeDraftCapabilities(baseCapabilities, capabilityPatch);
  const sourceSummary = buildSourceCapabilityMaintenanceSummary({
    current: existingDraft?.sourceSummary,
    latestTruthVersion,
    session,
    sourceTypes,
    stagedCapabilityFields,
    source,
  });

  const draft = await patchReviewDraft(
    {
      sessionId: session.id,
      tenantId: tenant.tenant_id,
      patch: {
        businessProfile: Object.keys(obj(existingDraft?.businessProfile)).length
          ? existingDraft.businessProfile
          : seed.businessProfile,
        capabilities: nextCapabilities,
        sourceSummary,
        draftPayload: {
          ...obj(existingDraft?.draftPayload),
          maintenanceMode: "post_publish_truth_change_set",
          latestCapabilityRefreshSource: source,
          latestCapabilityRefreshSourceTypes: arr(sourceTypes),
        },
      },
      bumpVersion: true,
    },
    db
  );

  const updatedSession = await patchReviewSession(
    session.id,
    {
      mode: "refresh",
      status: "ready",
      currentStep: "maintenance_review",
      metadata: compactObject({
        ...obj(session.metadata),
        sourceCurrentTruthVersionId: s(latestTruthVersion?.id),
        stagedFrom: "source_channel_capability_refresh",
        reviewerId: s(reviewerId),
        reviewerName: s(reviewerName),
        sourceTypes: arr(sourceTypes),
        source,
      }),
    },
    db
  );

  return {
    profile: null,
    capabilities: null,
    runtimeProjection: null,
    truthVersion: null,
    publishStatus: "review_required",
    reviewRequired: true,
    canonicalCapabilitiesMutated: false,
    runtimeProjectionRefreshed: false,
    sourceTypes: arr(sourceTypes),
    projectionGuard: {
      maintenanceStaged: true,
      sourceTypes: arr(sourceTypes),
      stagedCapabilityFields,
      capabilitiesProjected: false,
    },
    maintenanceSession: {
      id: s(updatedSession?.id || session.id),
      mode: s(updatedSession?.mode || session.mode || "refresh"),
      status: s(updatedSession?.status || session.status || "ready"),
      currentStep: s(
        updatedSession?.currentStep || session.currentStep || "maintenance_review"
      ),
      sourceCurrentTruthVersionId: s(latestTruthVersion?.id),
    },
    maintenanceDraft: {
      version: Number(draft?.version || 0),
      businessProfile: draft?.businessProfile || seed.businessProfile,
      capabilities: draft?.capabilities || nextCapabilities,
      sourceSummary: draft?.sourceSummary || sourceSummary,
    },
  };
}

export async function projectApprovedCandidateToCanonicalInternal(db, candidate, options = {}) {
  if (!candidate) {
    return {
      profile: null,
      capabilities: null,
      projectionGuard: null,
      runtimeProjection: null,
    };
  }

  const reviewerId = s(options.reviewerId);
  const reviewerName = s(options.reviewerName);

  const rawProfilePatch = buildProfileProjectionPatchFromCandidate(candidate);
  const rawCapabilitiesPatch = buildCapabilitiesProjectionPatchFromCandidate(candidate);

  const profileProjection = sanitizeProjectedProfilePatchFromCandidate(candidate, rawProfilePatch);
  const capabilitiesProjection = sanitizeProjectedCapabilitiesPatchFromCandidate(candidate, rawCapabilitiesPatch);

  const authority = profileProjection.authority || capabilitiesProjection.authority;

  let savedProfile = null;
  let savedCapabilities = null;

  if (hasMeaningfulProfileProjectionPatch(profileProjection.patch)) {
    savedProfile = await upsertBusinessProfileInternal(db, {
      ...profileProjection.patch,
      writeIntent: "approved_projection",
      approvedBy: reviewerId,
      generatedBy: reviewerName || reviewerId || "candidate_approval",
      approvedAt: new Date().toISOString(),
      metadataJson: {
        projection_source: "approved_candidate",
        candidate_id: candidate.id,
        strongest_source_type: authority?.strongestSourceType || "",
        strongest_authority_class: authority?.strongestAuthorityClass || "",
        source_types: arr(authority?.sourceTypes),
        skipped_fields: arr(profileProjection.skippedFields),
      },
    });
  }

  if (hasMeaningfulCapabilitiesProjectionPatch(capabilitiesProjection.patch)) {
    savedCapabilities = await upsertBusinessCapabilitiesInternal(db, {
      ...capabilitiesProjection.patch,
      tenantId: candidate.tenant_id,
      tenantKey: candidate.tenant_key,
      approvedBy: reviewerId,
      metadataJson: {
        projection_source: "approved_candidate",
        candidate_id: candidate.id,
        strongest_source_type: authority?.strongestSourceType || "",
        strongest_authority_class: authority?.strongestAuthorityClass || "",
        source_types: arr(authority?.sourceTypes),
        skipped_fields: arr(capabilitiesProjection.skippedFields),
      },
      derivedFromProfile: true,
    });
  }

  const runtimeProjection = await refreshRuntimeProjectionRequired(db, {
    tenantId: candidate.tenant_id,
    tenantKey: candidate.tenant_key,
    triggerType: "review_approval",
    requestedBy: reviewerId || "candidate_approval",
    runnerKey: "tenantKnowledge.projectApprovedCandidateToCanonical",
    generatedBy: reviewerName || reviewerId || "system",
    metadata: {
      source: "projectApprovedCandidateToCanonical",
      candidateId: candidate.id,
    },
  });

  return {
    profile: savedProfile,
    capabilities: savedCapabilities,
    projectionGuard: {
      strongestSourceType: authority?.strongestSourceType || "",
      strongestAuthorityClass: authority?.strongestAuthorityClass || "",
      strongestAuthorityRank: Number(authority?.strongestAuthorityRank || 0),
      sourceTypes: arr(authority?.sourceTypes),
      onlyWeakSources: Boolean(authority?.onlyWeakSources),
      hasOfficialConnected: Boolean(authority?.hasOfficialConnected),
      hasWebsiteOrBetter: Boolean(authority?.hasWebsiteOrBetter),
      hasStructuredOrBetter: Boolean(authority?.hasStructuredOrBetter),
      skippedProfileFields: arr(profileProjection.skippedFields),
      skippedCapabilityFields: arr(capabilitiesProjection.skippedFields),
      profileProjected: Boolean(savedProfile),
      capabilitiesProjected: Boolean(savedCapabilities),
    },
    runtimeProjection,
  };
}
