import { firstLanguage, obj, s } from "../lib/setupStudioHelpers.js";
import { resolveMainLanguageValue, normalizeReviewState } from "../state/shared.js";
import {
  chooseBestProfileForForm,
  formFromProfile,
  hasMeaningfulProfile,
  hydrateBusinessFormFromProfile,
} from "../state/profile.js";
import {
  buildManualSectionsFromReview,
  mapCurrentReviewToLegacyDraft,
  resolveReviewSourceInfo,
  reviewStateMatchesSource,
} from "../state/reviewState.js";
import { lowerText } from "./helpers.js";
import { DEFAULT_BUSINESS_FORM } from "./constants.js";

export function reconcileSetupStudioLoadedReview({
  reviewPayload = {},
  preserveBusinessForm = false,
  sourceScope = {},
}) {
  const normalized = normalizeReviewState(reviewPayload);
  const legacy = mapCurrentReviewToLegacyDraft(normalized);

  const shouldApplyIntoActiveStudio =
    !preserveBusinessForm ||
    !s(sourceScope.sourceUrl) ||
    sourceScope.sourceType === "manual" ||
    reviewStateMatchesSource(
      normalized,
      legacy,
      sourceScope.sourceType,
      sourceScope.sourceUrl
    );

  return {
    normalized,
    legacy,
    shouldApplyIntoActiveStudio,
  };
}

export function buildSetupStudioSourceMismatchIssue({
  normalized = {},
  legacy = {},
  message = "",
}) {
  return {
    sessionId: s(normalized?.session?.id || legacy?.reviewSessionId),
    sessionStatus: s(normalized?.session?.status || legacy?.reviewSessionStatus),
    revision: s(normalized?.session?.revision || legacy?.reviewSessionRevision),
    freshness: "source_mismatch",
    message,
  };
}

export function buildSetupStudioReviewLoadFailureIssue(error) {
  return {
    freshness: "unknown",
    message: String(
      error?.message || error || "The current review session could not be loaded."
    ),
  };
}

export function buildSetupStudioHydratedBusinessForm({
  prev = {},
  baseProfile = {},
  preserveBusinessForm = false,
  reviewInfo = {},
}) {
  if (!hasMeaningfulProfile(baseProfile)) {
    return {
      ...DEFAULT_BUSINESS_FORM,
      timezone: s(prev.timezone || "Asia/Baku"),
      language: s(prev.language || "en"),
      websiteUrl: s(reviewInfo.sourceUrl),
    };
  }

  if (!preserveBusinessForm) {
    return hydrateBusinessFormFromProfile(
      formFromProfile(baseProfile, {
        ...prev,
        timezone: s(baseProfile?.timezone || "Asia/Baku"),
        language:
          resolveMainLanguageValue(
            baseProfile?.mainLanguage,
            baseProfile?.primaryLanguage,
            baseProfile?.language,
            firstLanguage(baseProfile)
          ) || "en",
      }),
      baseProfile,
      { force: true }
    );
  }

  return hydrateBusinessFormFromProfile(prev, baseProfile, {
    force: false,
  });
}

export function buildSetupStudioHydratedReviewUi({
  reviewState = {},
  legacyDraft = {},
}) {
  const reviewInfo = resolveReviewSourceInfo(reviewState, legacyDraft);
  const baseProfile = chooseBestProfileForForm(legacyDraft?.overview);
  const manualSections = buildManualSectionsFromReview(reviewState);
  const shouldUpdateActiveSource =
    !!s(reviewInfo.sourceUrl) || lowerText(reviewInfo.sourceType) === "manual";

  return {
    reviewInfo,
    baseProfile,
    manualSections: {
      servicesText: s(manualSections.servicesText),
      faqsText: s(manualSections.faqsText),
      policiesText: s(manualSections.policiesText),
    },
    shouldUpdateActiveSource,
  };
}
