import { s } from "../lib/setupStudioHelpers.js";
import { normalizeScanRequest, scanStartLabel } from "../state/shared.js";
import {
  buildAnalyzePayloadFromStudioState,
  normalizeRequestedSourceRows,
  pickRequestedPrimarySource,
  sourceLabelFor,
} from "./helpers.js";

export function createSetupStudioScanPlan({
  input,
  discoveryForm,
  businessForm,
  manualSections,
}) {
  const request = normalizeScanRequest(input, discoveryForm);
  const requestedSources = normalizeRequestedSourceRows(request.sources);
  const requestedPrimarySource = pickRequestedPrimarySource({
    sources: requestedSources,
    primarySource: request.primarySource,
  });

  const sourceType = s(request.sourceType);
  const sourceUrl = s(request.url);
  const hasImportableSource = !!(
    request?.hasImportableSource &&
    sourceType &&
    sourceUrl
  );
  const hasRequestedSources = requestedSources.length > 0;
  const requestedPrimarySourceType = s(
    request.requestedPrimarySourceType || requestedPrimarySource?.sourceType
  );
  const requestedPrimarySourceUrl = s(
    request.requestedPrimarySourceUrl || requestedPrimarySource?.url
  );
  const shouldUseBundledImport = !!(
    hasImportableSource &&
    requestedSources.length > 1 &&
    requestedPrimarySourceType === "website"
  );

  const analyzePayload = buildAnalyzePayloadFromStudioState({
    businessForm,
    manualSections,
    discoveryForm: {
      ...discoveryForm,
      note: request.note,
    },
    fallbackSourceUrl: sourceUrl || requestedPrimarySourceUrl,
    scanRequest: {
      ...request,
      sources: requestedSources,
      primarySource: requestedPrimarySource,
    },
  });

  const validationError =
    !hasImportableSource &&
    !analyzePayload.hasAnyInput &&
    !hasRequestedSources
      ? "Add a source, manual notes, or a business description before continuing."
      : "";

  const uiSourceType = hasImportableSource
    ? requestedPrimarySourceType || sourceType
    : "manual";

  const displaySourceType =
    requestedPrimarySourceType ||
    (hasImportableSource ? sourceType : "manual");

  const displaySourceUrl = requestedPrimarySourceUrl || sourceUrl;

  return {
    request,
    requestedSources,
    requestedPrimarySource,
    sourceType,
    sourceUrl,
    hasImportableSource,
    hasRequestedSources,
    requestedPrimarySourceType,
    requestedPrimarySourceUrl,
    shouldUseBundledImport,
    analyzePayload,
    validationError,
    uiSourceType,
    displaySourceType,
    displaySourceUrl,
  };
}

export function buildSetupStudioRunningScanState(plan) {
  return {
    mode: "running",
    lastUrl: plan.hasImportableSource ? plan.displaySourceUrl : "",
    lastSourceType: plan.uiSourceType,
    sourceLabel: sourceLabelFor(plan.displaySourceType),
    message: plan.hasImportableSource
      ? scanStartLabel(plan.sourceType)
      : plan.hasRequestedSources
        ? `${sourceLabelFor(plan.displaySourceType)} context attached to the temporary draft...`
        : "Building the temporary business draft...",
    warnings: [],
    shouldReview: false,
    reviewRequired: false,
    reviewFlags: [],
    fieldConfidence: {},
    hasResults: false,
    resultCount: 0,
    importedKnowledgeItems: [],
    importedServices: [],
  };
}
