export function buildCandidateAdmission({
  sourceType = "",
  weakGoogleMapsExtraction = false,
  weakWebsiteExtraction = false,
  weakInstagramExtraction = false,
  websiteTrust = null,
}) {
  if (sourceType === "google_maps") {
    const allow = !weakGoogleMapsExtraction;

    return {
      allowCandidateCreation: allow,
      reason: allow
        ? "allowed"
        : "google_places_resolution_too_weak_for_candidate_creation",
      reviewMode: allow
        ? "candidate_generation_allowed_but_manual_review_required"
        : "review_only_no_candidate_generation",
      requiresManualReview: true,
      requiresOwnershipVerification: false,
      canonicalProjection: "deferred_to_review",
    };
  }

  if (sourceType === "website") {
    if (weakWebsiteExtraction) {
      return {
        allowCandidateCreation: false,
        reason: "weak_website_extraction",
        reviewMode:
          websiteTrust?.reviewMode || "review_only_no_candidate_generation",
        requiresManualReview: true,
        requiresOwnershipVerification: true,
        canonicalProjection: "deferred_to_review",
      };
    }

    if (websiteTrust && websiteTrust.shouldAllowCandidateCreation === false) {
      return {
        allowCandidateCreation: false,
        reason: "website_trust_guard_blocked_candidate_creation",
        reviewMode:
          websiteTrust.reviewMode || "review_only_no_candidate_generation",
        requiresManualReview: true,
        requiresOwnershipVerification: true,
        canonicalProjection: "deferred_to_review",
      };
    }

    return {
      allowCandidateCreation: true,
      reason: "allowed",
      reviewMode:
        websiteTrust?.reviewMode ||
        "candidate_generation_allowed_but_manual_review_required",
      requiresManualReview: true,
      requiresOwnershipVerification: true,
      canonicalProjection: "deferred_to_review",
    };
  }

  if (sourceType === "instagram") {
    if (weakInstagramExtraction) {
      return {
        allowCandidateCreation: false,
        reason: "weak_instagram_extraction",
        reviewMode: "review_only_no_candidate_generation",
        requiresManualReview: true,
        requiresOwnershipVerification: false,
        canonicalProjection: "deferred_to_review",
      };
    }

    return {
      allowCandidateCreation: true,
      reason: "allowed",
      reviewMode: "candidate_generation_allowed_but_manual_review_required",
      requiresManualReview: true,
      requiresOwnershipVerification: false,
      canonicalProjection: "deferred_to_review",
    };
  }

  return {
    allowCandidateCreation: true,
    reason: "allowed",
    reviewMode: "candidate_generation_allowed_but_manual_review_required",
    requiresManualReview: true,
    requiresOwnershipVerification: false,
    canonicalProjection: "deferred_to_review",
  };
}