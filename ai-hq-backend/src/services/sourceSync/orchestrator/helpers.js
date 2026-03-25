import { arr, obj, s } from "../shared.js";

export function dedupeWarnings(list = []) {
  return [...new Set(arr(list).map((x) => s(x)).filter(Boolean))];
}

export function buildWebsiteTrustSummaryPayload(websiteTrust = null) {
  if (!websiteTrust) return null;

  return {
    score: websiteTrust.score,
    band: websiteTrust.band,
    sourceHost: websiteTrust.sourceHost,
    finalHost: websiteTrust.finalHost,
    sourceMatchesFinalSite: websiteTrust.sourceMatchesFinalSite,
    firstPartyEmailCount: websiteTrust.firstPartyEmailCount,
    shouldAllowCandidateCreation: websiteTrust.shouldAllowCandidateCreation,
    reviewMode: websiteTrust.reviewMode,
    warnings: arr(websiteTrust.warnings),
    criticalWarnings: arr(websiteTrust.criticalWarnings),
  };
}

export function buildSourceSignalPayload({
  sourceType = "",
  rawSignals = null,
  websiteTrust = null,
}) {
  if (sourceType === "website") {
    return {
      ...obj(rawSignals),
      trust: websiteTrust,
    };
  }

  return obj(rawSignals);
}

export function safeWebsitePageCount(extracted = null) {
  return Math.max(
    Number(extracted?.site?.pagesScanned || 0),
    arr(extracted?.pages).length
  );
}

export function shouldTreatSyncAsPartial({
  candidateAdmission = null,
  createdObservations = [],
  persistedCreatedCount = 0,
}) {
  if (!candidateAdmission?.allowCandidateCreation) return true;
  if (!(persistedCreatedCount || arr(createdObservations).length)) return true;
  return false;
}