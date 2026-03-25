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
  upsertBusinessProfileInternal,
  upsertBusinessCapabilitiesInternal,
} from "./writers.js";

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
