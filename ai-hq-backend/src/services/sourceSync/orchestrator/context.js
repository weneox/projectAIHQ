import { createLogger } from "../../../utils/logger.js";
import { arr, obj, s } from "../shared.js";
import { resolveGooglePlaceFromSeed } from "../googlePlacesClient.js";
import { extractWebsiteSource } from "../websiteExtractor.js";
import { extractInstagramSource } from "../instagramGraphClient.js";
import {
  buildCandidatesFromSynthesis,
  buildWebsiteObservations,
  synthesizeTenantBusinessFromObservations,
} from "../../sourceFusion/index.js";
import {
  buildGoogleMapsExtractionWarnings,
  buildGoogleMapsObservations,
  buildGoogleMapsProfile,
  buildGoogleMapsResolvedExtraction,
  buildGoogleMapsSyncQualitySummary,
  isWeakGoogleMapsExtraction,
} from "../googleMapsHelpers.js";
import {
  buildInstagramExtractionWarnings,
  buildInstagramObservations,
  buildInstagramSignals,
  buildInstagramSyncQualitySummary,
  isWeakInstagramExtraction,
  synthesizeInstagramBusinessProfile,
} from "../instagramHelpers.js";
import {
  normalizeCandidateRecord,
  normalizeObservationRecord,
  normalizeSynthesisResult,
} from "../normalize.js";
import { loadScopedObservations, persistSynthesisOutputs } from "../persistence.js";
import {
  buildWebsiteExtractionWarnings,
  buildWebsiteSignals,
  buildWebsiteSyncQualitySummary,
  buildWebsiteTrustSummary,
  isWeakWebsiteExtraction,
  synthesizeBusinessProfile,
} from "../websiteHelpers.js";
import { SOURCE_FUSION_VERSION, SOURCE_SYNC_VERSION } from "./constants.js";
import { buildCandidateAdmission } from "./admission.js";
import { buildFinishWarnings } from "./websiteWarnings.js";
import {
  classifyWebsitePartialBarrier,
  finishWebsiteBarrierAsPartial,
} from "./barrier.js";
import {
  buildSourceSignalPayload,
  buildWebsiteTrustSummaryPayload,
  dedupeWarnings,
  safeWebsitePageCount,
  shouldTreatSyncAsPartial,
} from "./helpers.js";
import { buildTimeoutWarning, resolveStepTimeouts, withTimeout } from "./timeouts.js";

export function createSourceSyncOrchestratorContext({
  db,
  source,
  run,
  requestedBy = "",
  sources,
  knowledge,
  fusion,
  stageDeps = {},
}) {
  if (!source?.id) throw new Error("runSourceSync: source is required");
  if (!run?.id) throw new Error("runSourceSync: run is required");
  if (!sources || !knowledge || !fusion) {
    throw new Error("runSourceSync: sources, knowledge and fusion helpers are required");
  }
  if (typeof knowledge.createCandidatesBulk !== "function") {
    throw new Error("runSourceSync: knowledge.createCandidatesBulk is required");
  }
  if (typeof fusion.createObservationsBulk !== "function") {
    throw new Error("runSourceSync: fusion.createObservationsBulk is required");
  }
  if (typeof fusion.listObservations !== "function") {
    throw new Error("runSourceSync: fusion.listObservations is required");
  }
  if (typeof fusion.createSynthesisSnapshot !== "function") {
    throw new Error("runSourceSync: fusion.createSynthesisSnapshot is required");
  }

  const sourceType = s(source.source_type || source.type).toLowerCase();
  const sourceUrl = s(source.source_url || source.url);

  return {
    db,
    source,
    run,
    requestedBy,
    sources,
    knowledge,
    fusion,
    sourceType,
    sourceUrl,
    stepTimeouts: resolveStepTimeouts(),
    logger: createLogger({
      component: "source-sync-orchestrator",
      requestId: s(run?.metadata_json?.requestId),
      correlationId: s(run?.metadata_json?.correlationId),
      runId: s(run?.id),
      sourceId: s(source?.id),
      reviewSessionId:
        s(run?.review_session_id) ||
        s(run?.metadata_json?.reviewSessionId) ||
        s(source?.review_session_id),
      tenantId: s(run?.tenant_id || source?.tenant_id),
      tenantKey: s(run?.tenant_key || source?.tenant_key),
      sourceType,
    }),
    deps: {
      arr,
      obj,
      s,
      extractWebsiteSource,
      extractInstagramSource,
      resolveGooglePlaceFromSeed,
      buildWebsiteSignals,
      synthesizeBusinessProfile,
      buildWebsiteTrustSummary,
      isWeakWebsiteExtraction,
      buildWebsiteExtractionWarnings,
      buildWebsiteObservations,
      buildWebsiteSyncQualitySummary,
      buildInstagramSignals,
      synthesizeInstagramBusinessProfile,
      isWeakInstagramExtraction,
      buildInstagramExtractionWarnings,
      buildInstagramObservations,
      buildInstagramSyncQualitySummary,
      buildGoogleMapsResolvedExtraction,
      buildGoogleMapsProfile,
      buildGoogleMapsObservations,
      isWeakGoogleMapsExtraction,
      buildGoogleMapsExtractionWarnings,
      buildGoogleMapsSyncQualitySummary,
      normalizeObservationRecord,
      loadScopedObservations,
      normalizeSynthesisResult,
      synthesizeTenantBusinessFromObservations,
      buildCandidateAdmission,
      buildCandidatesFromSynthesis,
      normalizeCandidateRecord,
      buildFinishWarnings,
      persistSynthesisOutputs,
      shouldTreatSyncAsPartial,
      buildSourceSignalPayload,
      buildWebsiteTrustSummaryPayload,
      dedupeWarnings,
      safeWebsitePageCount,
      withTimeout,
      classifyWebsitePartialBarrier,
      finishWebsiteBarrierAsPartial,
      buildTimeoutWarning,
      SOURCE_FUSION_VERSION,
      SOURCE_SYNC_VERSION,
      ...stageDeps,
    },
  };
}

export function createSourceSyncStageState(sourceType = "") {
  return {
    stage: "start",
    extracted: null,
    rawSignals: null,
    sourceProfile: null,
    observationsDraft: [],
    createdObservations: [],
    scopedObservations: [],
    scopedObservationScope: "",
    synthesis: null,
    candidateDrafts: [],
    quality: {},
    warnings: [],
    surfacedWarnings: [],
    debugWarnings: [],
    websiteWarningDiagnostics: null,
    weakGoogleMapsExtraction: false,
    weakWebsiteExtraction: false,
    weakInstagramExtraction: false,
    websiteTrust: null,
    candidateAdmission: buildCandidateAdmission({ sourceType }),
  };
}
