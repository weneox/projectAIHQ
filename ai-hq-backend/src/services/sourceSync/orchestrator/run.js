import { cfg } from "../../../config.js";
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
import { arr, obj, s } from "../shared.js";
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
import { createLogger } from "../../../utils/logger.js";

const DEFAULT_STEP_TIMEOUTS = Object.freeze({
  websiteExtractMs: 120_000,
  instagramExtractMs: 45_000,
  googleMapsResolveMs: 30_000,
  finishSyncMs: 20_000,
  markErrorMs: 20_000,
});

function safeNum(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function clampMs(v, fallback, min = 1000, max = 300000) {
  const x = safeNum(v, fallback);
  return Math.max(min, Math.min(max, x));
}

function resolveStepTimeouts() {
  const innerWebsiteExtractMs = clampMs(
    cfg?.sourceSync?.websiteExtractTimeoutMs,
    90_000,
    10_000,
    240_000
  );

  const explicitOuterWebsiteSyncMs = safeNum(
    cfg?.sourceSync?.websiteSyncTimeoutMs,
    0
  );

  const websiteExtractMs =
    explicitOuterWebsiteSyncMs > 0
      ? clampMs(
          explicitOuterWebsiteSyncMs,
          innerWebsiteExtractMs + 20_000,
          innerWebsiteExtractMs + 5_000,
          300_000
        )
      : clampMs(
          Math.max(
            DEFAULT_STEP_TIMEOUTS.websiteExtractMs,
            innerWebsiteExtractMs + 20_000
          ),
          DEFAULT_STEP_TIMEOUTS.websiteExtractMs,
          innerWebsiteExtractMs + 5_000,
          300_000
        );

  return {
    websiteExtractMs,
    instagramExtractMs: clampMs(
      cfg?.sourceSync?.instagramExtractTimeoutMs,
      DEFAULT_STEP_TIMEOUTS.instagramExtractMs,
      5_000,
      120_000
    ),
    googleMapsResolveMs: clampMs(
      cfg?.sourceSync?.googleMapsResolveTimeoutMs,
      DEFAULT_STEP_TIMEOUTS.googleMapsResolveMs,
      5_000,
      120_000
    ),
    finishSyncMs: clampMs(
      cfg?.sourceSync?.finishSyncTimeoutMs,
      DEFAULT_STEP_TIMEOUTS.finishSyncMs,
      5_000,
      120_000
    ),
    markErrorMs: clampMs(
      cfg?.sourceSync?.markErrorTimeoutMs,
      DEFAULT_STEP_TIMEOUTS.markErrorMs,
      5_000,
      120_000
    ),
  };
}

function buildStepTimeoutError({ sourceType, stage, timeoutMs }) {
  const safeSourceType = s(sourceType || "source").toLowerCase();
  const safeStage = s(stage || "step")
    .replace(/[^a-z0-9]+/gi, "_")
    .toLowerCase();

  const err = new Error(
    `${safeSourceType} ${safeStage} timed out after ${timeoutMs}ms`
  );

  err.code = `${safeSourceType}_${safeStage}_timeout`.toUpperCase();
  err.sourceType = safeSourceType;
  err.stage = safeStage;
  err.timeoutMs = timeoutMs;
  err.isTimeout = true;

  return err;
}

async function withTimeout(task, timeoutMs, meta = {}) {
  const run = typeof task === "function" ? task : () => task;
  const budget = clampMs(timeoutMs, 0, 1, 300000);

  let timer = null;

  try {
    return await Promise.race([
      Promise.resolve().then(run),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(
            buildStepTimeoutError({
              ...meta,
              timeoutMs: budget,
            })
          );
        }, budget);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function buildTimeoutWarning({ sourceType, stage, timeoutMs }) {
  const safeSourceType = s(sourceType || "source").toLowerCase();
  const safeStage = s(stage || "step")
    .replace(/[^a-z0-9]+/gi, "_")
    .toLowerCase();

  if (Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0) {
    return `${safeSourceType}_${safeStage}_timeout_${Number(timeoutMs)}ms`;
  }

  return `${safeSourceType}_${safeStage}_timeout`;
}

async function finishWebsiteTimeoutAsPartial({
  source,
  run,
  requestedBy,
  sources,
  sourceUrl,
  stage,
  err,
  extracted,
  rawSignals,
  sourceProfile,
  synthesis,
  warnings,
  debugWarnings,
  quality,
  createdObservations,
  scopedObservations,
  scopedObservationScope,
  websiteTrust,
  candidateAdmission,
  weakWebsiteExtraction,
  stepTimeouts,
}) {
  const timeoutStage = s(err?.step || stage || "extract").toLowerCase();

  const timeoutWarning = buildTimeoutWarning({
    sourceType: "website",
    stage: timeoutStage,
    timeoutMs: err?.timeoutMs,
  });

  const rawWarnings = dedupeWarnings([...warnings, timeoutWarning]);
  const surfacedWarnings = rawWarnings;

  const timeoutQuality = {
    ...quality,
    sourceFusionVersion: SOURCE_FUSION_VERSION,
    sourceSyncVersion: SOURCE_SYNC_VERSION,
    observationCount: arr(createdObservations).length,
    scopedObservationCount: arr(scopedObservations).length,
    scopedObservationScope,
    candidateAdmission,
    websiteTrust: buildWebsiteTrustSummaryPayload(websiteTrust),
    timeoutStage,
    timeoutMs: err?.timeoutMs || null,
    surfacedWarnings,
    debugWarnings: arr(debugWarnings),
    orchestratorTimeoutMs: stepTimeouts?.websiteExtractMs || null,
  };

  let finished = null;

  try {
    finished = await withTimeout(
      () =>
        sources.finishSourceSync({
          sourceId: source.id,
          runId: run.id,
          syncStatus: "partial",
          runStatus: "partial",
          requestedBy,
          inputSummaryJson: {
            sourceType: "website",
            sourceUrl,
          },
          extractionSummaryJson: {
            finalUrl: extracted?.finalUrl || "",
            crawl: extracted?.crawl || {},
            discovery: extracted?.discovery || {},
            quality: timeoutQuality,
            sourceFusion: {
              version: SOURCE_FUSION_VERSION,
              observationsCreated: arr(createdObservations).length,
              scopedObservationCount: arr(scopedObservations).length,
              scopedObservationScope,
              conflictCount: arr(synthesis?.conflicts).length,
              currentSnapshotId: "",
              canonicalProjection: "deferred_to_review",
            },
          },
          resultSummaryJson: {
            sourceFusionVersion: SOURCE_FUSION_VERSION,
            sourceSyncVersion: SOURCE_SYNC_VERSION,
            stage: timeoutStage,
            summary:
              synthesis?.profile?.summaryShort ||
              synthesis?.profile?.companySummaryShort ||
              synthesis?.profile?.summaryLong ||
              synthesis?.profile?.companySummaryLong ||
              sourceProfile?.summaryShort ||
              sourceProfile?.companySummaryShort ||
              sourceProfile?.summaryLong ||
              sourceProfile?.companySummaryLong ||
              "",
            companySummaryLong:
              synthesis?.profile?.summaryLong ||
              synthesis?.profile?.companySummaryLong ||
              sourceProfile?.summaryLong ||
              sourceProfile?.companySummaryLong ||
              "",
            supportMode:
              synthesis?.profile?.supportMode ||
              sourceProfile?.supportMode ||
              "",
            pricingPolicy:
              synthesis?.profile?.pricingPolicy ||
              sourceProfile?.pricingPolicy ||
              "",
            candidateCount: 0,
            weakWebsiteExtraction,
            websiteTrust,
            candidateAdmission,
            warnings: surfacedWarnings,
            rawWarnings,
            debugWarnings,
            timeoutStage,
            timeoutMs: err?.timeoutMs || null,
            canonicalProjection: "deferred_to_review",
          },
          pagesScanned: safeWebsitePageCount(extracted),
          recordsScanned: arr(createdObservations).length,
          candidatesCreated: 0,
          warningsCount: surfacedWarnings.length > 0 ? surfacedWarnings.length : 1,
          logsJson: [
            {
              level: "warn",
              message:
                err?.message ||
                `website ${timeoutStage} timed out and was finished as partial`,
              stage: timeoutStage,
              timeoutMs: err?.timeoutMs || null,
              orchestratorTimeoutMs: stepTimeouts?.websiteExtractMs || null,
              sourceFusionVersion: SOURCE_FUSION_VERSION,
              sourceSyncVersion: SOURCE_SYNC_VERSION,
              websiteTrust,
              candidateAdmission,
            },
            ...surfacedWarnings.map((message) => ({
              level: "warn",
              message,
              stage: timeoutStage,
            })),
            ...arr(debugWarnings).map((message) => ({
              level: "info",
              message: `debug_warning_suppressed_from_ui: ${message}`,
              stage: timeoutStage,
            })),
          ],
        }),
      stepTimeouts.finishSyncMs,
      {
        sourceType: "website",
        stage: "finish_sync",
      }
    );
  } catch (_) {
    finished = null;
  }

  const sourceSignalPayload = buildSourceSignalPayload({
    sourceType: "website",
    rawSignals,
    websiteTrust,
  });

  return {
    ok: true,
    mode: "partial",
    stage: timeoutStage,
    warnings: surfacedWarnings,
    rawWarnings,
    debugWarnings: arr(debugWarnings),
    source: finished?.source || source,
    run: finished?.run || run,
    candidates: [],
    candidateCount: 0,
    extracted,
    signals: {
      website: sourceSignalPayload,
      sourceFusion: synthesis,
    },
    profile: synthesis?.profile || sourceProfile || null,
    snapshot: null,
    trust: websiteTrust,
    admission: candidateAdmission,
  };
}

async function runSourceSync({
  db,
  source,
  run,
  requestedBy = "",
  sources,
  knowledge,
  fusion,
}) {
  const stepTimeouts = resolveStepTimeouts();

  if (!source?.id) {
    throw new Error("runSourceSync: source is required");
  }
  if (!run?.id) {
    throw new Error("runSourceSync: run is required");
  }
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
  const logger = createLogger({
    component: "source-sync-orchestrator",
    requestId: s(run?.metadata_json?.requestId),
    runId: s(run?.id),
    sourceId: s(source?.id),
    reviewSessionId:
      s(run?.review_session_id) ||
      s(run?.metadata_json?.reviewSessionId) ||
      s(source?.review_session_id),
    tenantId: s(run?.tenant_id || source?.tenant_id),
    tenantKey: s(run?.tenant_key || source?.tenant_key),
    sourceType,
  });
  logger.info("source_sync.orchestrator.started", {
    sourceUrl,
    requestedBy: s(requestedBy),
  });

  if (!["website", "google_maps", "instagram"].includes(sourceType)) {
    const result = await withTimeout(
      () =>
        sources.finishSourceSync({
          sourceId: source.id,
          runId: run.id,
          syncStatus: "partial",
          runStatus: "partial",
          requestedBy,
          inputSummaryJson: {
            sourceType: sourceType || "unknown",
            sourceUrl,
          },
          extractionSummaryJson: {
            mode: "unsupported_source_type_for_v8_3",
            sourceFusionVersion: SOURCE_FUSION_VERSION,
            sourceSyncVersion: SOURCE_SYNC_VERSION,
          },
          resultSummaryJson: {
            message: "sync v8.3 currently supports website, instagram and google_maps sources",
          },
          warningsCount: 1,
          logsJson: [
            {
              level: "warn",
              message: `source type '${
                sourceType || source.source_type || source.type || "unknown"
              }' is not supported by source sync v8.3`,
            },
          ],
        }),
      stepTimeouts.finishSyncMs,
      {
        sourceType: sourceType || "unknown",
        stage: "finish_sync",
      }
    );

    logger.warn("source_sync.orchestrator.unsupported_source_type", {
      sourceUrl,
    });
    logger.info("source_sync.orchestrator.completed", {
      mode: "partial",
      stage: "unsupported_source_type",
      candidateCount: 0,
      warningCount: 1,
    });
    return {
      ok: true,
      mode: "partial",
      stage: "unsupported_source_type",
      warnings: ["unsupported_source_type"],
      rawWarnings: ["unsupported_source_type"],
      debugWarnings: [],
      source: result?.source || source,
      run: result?.run || run,
      candidates: [],
      candidateCount: 0,
      extracted: null,
      signals: null,
      profile: null,
      snapshot: null,
      trust: null,
      admission: null,
    };
  }

  let stage = "start";
  let extracted = null;
  let rawSignals = null;
  let sourceProfile = null;
  let observationsDraft = [];
  let createdObservations = [];
  let scopedObservations = [];
  let scopedObservationScope = "";
  let synthesis = null;
  let candidateDrafts = [];
  let quality = {};
  let warnings = [];
  let surfacedWarnings = [];
  let debugWarnings = [];
  let websiteWarningDiagnostics = null;
  let weakGoogleMapsExtraction = false;
  let weakWebsiteExtraction = false;
  let weakInstagramExtraction = false;
  let websiteTrust = null;
  let candidateAdmission = buildCandidateAdmission({ sourceType });

  try {
    stage = "extract";

    if (sourceType === "website") {
      extracted = await withTimeout(
        () => extractWebsiteSource(source),
        stepTimeouts.websiteExtractMs,
        {
          sourceType,
          stage,
        }
      );

      rawSignals = buildWebsiteSignals(extracted);
      sourceProfile = synthesizeBusinessProfile(rawSignals);

      websiteTrust = buildWebsiteTrustSummary({
        extracted,
        signals: rawSignals,
        profile: sourceProfile,
      });

      weakWebsiteExtraction = isWeakWebsiteExtraction({
        extracted,
        profile: sourceProfile,
        trust: websiteTrust,
      });

      warnings = dedupeWarnings([
        ...warnings,
        ...buildWebsiteExtractionWarnings({
          extracted,
          signals: rawSignals,
          profile: sourceProfile,
          trust: websiteTrust,
        }),
      ]);

      observationsDraft = buildWebsiteObservations({
        source,
        run,
        extracted,
        profile: sourceProfile,
      });

      quality = buildWebsiteSyncQualitySummary({
        extracted,
        signals: rawSignals,
        profile: sourceProfile,
        observationCount: arr(observationsDraft).length,
        trust: websiteTrust,
      });
    }

    if (sourceType === "instagram") {
      if (!db || typeof db.query !== "function") {
        throw new Error("runSourceSync: instagram source sync requires db.query(...)");
      }

      extracted = await withTimeout(
        () => extractInstagramSource(source, { db }),
        stepTimeouts.instagramExtractMs,
        {
          sourceType,
          stage,
        }
      );

      rawSignals = buildInstagramSignals(extracted);
      sourceProfile = synthesizeInstagramBusinessProfile(rawSignals);

      weakInstagramExtraction = isWeakInstagramExtraction({
        extracted,
        profile: sourceProfile,
        signals: rawSignals,
      });

      warnings = dedupeWarnings([
        ...warnings,
        ...buildInstagramExtractionWarnings({
          extracted,
          signals: rawSignals,
          profile: sourceProfile,
        }),
      ]);

      observationsDraft = buildInstagramObservations({
        source,
        run,
        extracted,
        profile: sourceProfile,
      });

      quality = buildInstagramSyncQualitySummary({
        extracted,
        signals: rawSignals,
        profile: sourceProfile,
        observationCount: arr(observationsDraft).length,
      });
    }

    if (sourceType === "google_maps") {
      const resolved = await withTimeout(
        () => resolveGooglePlaceFromSeed(sourceUrl, {}),
        stepTimeouts.googleMapsResolveMs,
        {
          sourceType,
          stage,
        }
      );

      extracted = buildGoogleMapsResolvedExtraction({ source, resolved });

      rawSignals = {
        googlePlaces: {
          provider: extracted.provider,
          query: extracted.query,
          confidence: extracted.confidence,
          place: obj(extracted.place),
          candidateCount: arr(extracted.candidates).length,
        },
      };

      sourceProfile = buildGoogleMapsProfile(extracted);

      observationsDraft = buildGoogleMapsObservations({
        source,
        run,
        extracted,
        profile: sourceProfile,
      });

      weakGoogleMapsExtraction = isWeakGoogleMapsExtraction(extracted, sourceProfile);

      warnings = dedupeWarnings([
        ...warnings,
        ...buildGoogleMapsExtractionWarnings(extracted, sourceProfile),
      ]);

      quality = buildGoogleMapsSyncQualitySummary({
        extracted,
        profile: sourceProfile,
        observationCount: arr(observationsDraft).length,
      });
    }

    stage = "normalize_observations";

    const safeObservationDrafts = arr(observationsDraft)
      .map((item) => normalizeObservationRecord(item))
      .filter(Boolean);

    const droppedDraftObservationCount =
      arr(observationsDraft).length - safeObservationDrafts.length;

    if (droppedDraftObservationCount > 0) {
      warnings = dedupeWarnings([
        ...warnings,
        `${droppedDraftObservationCount} invalid observation draft(s) were dropped before persistence`,
      ]);
    }

    stage = "persist_observations";

    if (safeObservationDrafts.length > 0) {
      const createdObservationsRaw = await fusion.createObservationsBulk(
        safeObservationDrafts
      );

      createdObservations = arr(createdObservationsRaw)
        .map((item) => normalizeObservationRecord(item))
        .filter(Boolean);
    } else {
      createdObservations = [];
    }

    stage = "load_scoped_observations";

    const scoped = await loadScopedObservations({
      fusion,
      source,
      run,
      sourceType,
    });

    scopedObservations = arr(scoped.observations);
    scopedObservationScope = s(scoped.scope);

    const synthesisInputObservations =
      scopedObservations.length > 0 ? scopedObservations : createdObservations;

    if (!synthesisInputObservations.length) {
      warnings = dedupeWarnings([
        ...warnings,
        "No valid observations were available for synthesis",
      ]);
    }

    stage = "synthesize";

    if (
      sourceType === "google_maps" &&
      weakGoogleMapsExtraction &&
      !synthesisInputObservations.length
    ) {
      synthesis = normalizeSynthesisResult(
        {},
        {
          fallbackProfile: sourceProfile,
          sourceType,
          sourceUrl,
        }
      );
    } else if (
      sourceType === "instagram" &&
      weakInstagramExtraction &&
      !synthesisInputObservations.length
    ) {
      synthesis = normalizeSynthesisResult(
        {},
        {
          fallbackProfile: sourceProfile,
          sourceType,
          sourceUrl,
        }
      );
    } else {
      synthesis = normalizeSynthesisResult(
        synthesizeTenantBusinessFromObservations({
          observations: synthesisInputObservations,
        }),
        {
          fallbackProfile: sourceProfile,
          sourceType,
          sourceUrl,
        }
      );
    }

    candidateAdmission = buildCandidateAdmission({
      sourceType,
      weakGoogleMapsExtraction,
      weakWebsiteExtraction,
      weakInstagramExtraction,
      websiteTrust,
    });

    stage = "build_candidates";

    if (!candidateAdmission.allowCandidateCreation) {
      candidateDrafts = [];

      if (sourceType === "google_maps") {
        warnings = dedupeWarnings([
          ...warnings,
          "google_maps candidate creation was skipped because google_places resolution quality is too weak",
        ]);
      }

      if (sourceType === "website") {
        warnings = dedupeWarnings([
          ...warnings,
          candidateAdmission.reason === "website_trust_guard_blocked_candidate_creation"
            ? "website_trust_guard_blocked_candidate_creation"
            : "weak_website_extraction",
        ]);
      }

      if (sourceType === "instagram") {
        warnings = dedupeWarnings([
          ...warnings,
          "instagram candidate creation was skipped because connected account data is too weak",
        ]);
      }
    } else {
      try {
        candidateDrafts = arr(
          buildCandidatesFromSynthesis({
            tenantId: source.tenant_id,
            tenantKey: source.tenant_key,
            sourceId: source.id,
            sourceRunId: run.id,
            synthesis,
          })
        )
          .map((item) =>
            normalizeCandidateRecord({
              ...item,
              status: "needs_review",
            })
          )
          .filter(Boolean);
      } catch (candidateErr) {
        candidateDrafts = [];
        warnings = dedupeWarnings([
          ...warnings,
          `candidate_build_skipped: ${candidateErr?.message || "unknown error"}`,
        ]);
      }
    }

    const warningDecision = buildFinishWarnings({
      sourceType,
      warnings,
      extracted,
      rawSignals,
      sourceProfile,
      observationsDraft: safeObservationDrafts,
      synthesis,
      weakWebsiteExtraction,
      websiteTrust,
      candidateAdmission,
    });

    surfacedWarnings = arr(warningDecision.surfacedWarnings);
    debugWarnings = arr(warningDecision.debugWarnings);
    websiteWarningDiagnostics = warningDecision.diagnostics;

    stage = "persist_outputs";

    const persisted = await persistSynthesisOutputs({
      source,
      run,
      requestedBy,
      knowledge,
      fusion,
      synthesis,
      candidateDrafts,
      createdObservations,
      sourceType,
      sourceUrl,
      skipCandidateCreate: !candidateAdmission.allowCandidateCreation,
      candidateAdmission,
      trust: websiteTrust,
    });

    stage = "finish_sync";

    const shouldTreatAsPartial = shouldTreatSyncAsPartial({
      candidateAdmission,
      createdObservations,
      persistedCreatedCount: persisted.createdCount,
    });

    quality = {
      ...quality,
      sourceFusionVersion: SOURCE_FUSION_VERSION,
      sourceSyncVersion: SOURCE_SYNC_VERSION,
      observationCount: arr(createdObservations).length,
      candidateCount: persisted.createdCount,
      conflictCount: arr(synthesis?.conflicts).length,
      scopedObservationCount: arr(scopedObservations).length,
      scopedObservationScope,
      droppedDraftObservationCount,
      synthesisInputObservationCount: arr(synthesisInputObservations).length,
      synthesisMetrics: obj(synthesis?.metrics),
      canonicalProjection: "deferred_to_review",
      candidateAdmission,
      websiteTrust: buildWebsiteTrustSummaryPayload(websiteTrust),
      surfacedWarnings,
      debugWarnings,
      orchestratorTimeoutMs:
        sourceType === "website" ? stepTimeouts.websiteExtractMs : null,
      warningDiagnostics:
        sourceType === "website"
          ? {
              signalStrength: websiteWarningDiagnostics?.signalStrength || null,
              hardWebsiteWarnings: websiteWarningDiagnostics?.hardWebsiteWarnings || [],
            }
          : null,
    };

    const sourceSignalPayload = buildSourceSignalPayload({
      sourceType,
      rawSignals,
      websiteTrust,
    });

    const finished = await withTimeout(
      () =>
        sources.finishSourceSync({
          sourceId: source.id,
          runId: run.id,
          syncStatus: shouldTreatAsPartial ? "partial" : "success",
          runStatus: shouldTreatAsPartial ? "partial" : "success",
          requestedBy,
          inputSummaryJson: {
            sourceType,
            sourceUrl,
          },
          extractionSummaryJson: {
            finalUrl: extracted?.finalUrl || "",
            crawl: extracted?.crawl || {},
            discovery: extracted?.discovery || {},
            quality,
            sourceFusion: {
              version: SOURCE_FUSION_VERSION,
              observationsCreated: arr(createdObservations).length,
              scopedObservationCount: arr(scopedObservations).length,
              scopedObservationScope,
              conflictCount: arr(synthesis?.conflicts).length,
              currentSnapshotId: persisted.snapshot?.id || "",
              canonicalProjection: "deferred_to_review",
            },
          },
          resultSummaryJson: {
            sourceFusionVersion: SOURCE_FUSION_VERSION,
            sourceSyncVersion: SOURCE_SYNC_VERSION,
            summary:
              synthesis?.profile?.summaryShort ||
              synthesis?.profile?.companySummaryShort ||
              synthesis?.profile?.summaryLong ||
              synthesis?.profile?.companySummaryLong ||
              "",
            companySummaryLong:
              synthesis?.profile?.summaryLong ||
              synthesis?.profile?.companySummaryLong ||
              "",
            supportMode: synthesis?.profile?.supportMode || "",
            pricingPolicy: synthesis?.profile?.pricingPolicy || "",
            candidateCount: persisted.createdCount,
            weakGoogleMapsExtraction,
            weakWebsiteExtraction,
            weakInstagramExtraction,
            websiteTrust,
            candidateAdmission,
            stage,
            warnings: surfacedWarnings,
            rawWarnings: warnings,
            debugWarnings,
            synthesisMetrics: obj(synthesis?.metrics),
            canonicalProjection: "deferred_to_review",
          },
          pagesScanned:
            sourceType === "website"
              ? safeWebsitePageCount(extracted)
              : extracted
                ? 1
                : 0,
          recordsScanned: arr(createdObservations).length,
          candidatesCreated: persisted.createdCount,
          warningsCount: surfacedWarnings.length > 0 ? surfacedWarnings.length : 0,
          logsJson: [
            {
              level: "info",
              message:
                sourceType === "google_maps"
                  ? "google_maps seed sync completed via Google Places"
                  : sourceType === "instagram"
                    ? "instagram connected-source sync completed via Meta Graph"
                    : "website multi-page sync completed with source fusion and trust guardrails",
              stage,
              sourceFusionVersion: SOURCE_FUSION_VERSION,
              sourceSyncVersion: SOURCE_SYNC_VERSION,
              finalUrl: extracted?.finalUrl || "",
              observationCount: arr(createdObservations).length,
              scopedObservationCount: arr(scopedObservations).length,
              scopedObservationScope,
              candidateCount: persisted.createdCount,
              conflictCount: arr(synthesis?.conflicts).length,
              weakGoogleMapsExtraction,
              weakWebsiteExtraction,
              weakInstagramExtraction,
              websiteTrust,
              candidateAdmission,
              synthesisMetrics: obj(synthesis?.metrics),
              snapshotId: persisted.snapshot?.id || "",
              canonicalProjection: "deferred_to_review",
            },
            ...warnings.map((message) => ({
              level: surfacedWarnings.includes(message) ? "warn" : "info",
              message: surfacedWarnings.includes(message)
                ? message
                : `debug_warning_suppressed_from_ui: ${message}`,
              stage,
              surfaced: surfacedWarnings.includes(message),
            })),
          ],
        }),
      stepTimeouts.finishSyncMs,
      {
        sourceType,
        stage,
      }
    );

    logger.info("source_sync.orchestrator.completed", {
      mode: shouldTreatAsPartial ? "partial" : "success",
      stage,
      candidateCount: Number(persisted.createdCount || 0),
      warningCount: Number(surfacedWarnings.length || 0),
    });

    return {
      ok: true,
      mode: shouldTreatAsPartial ? "partial" : "success",
      stage,
      warnings: surfacedWarnings,
      rawWarnings: warnings,
      debugWarnings,
      source: finished?.source || source,
      run: finished?.run || run,
      candidates: persisted.createdRows,
      candidateCount: persisted.createdCount,
      extracted,
      signals: {
        [sourceType]: sourceSignalPayload,
        sourceFusion: synthesis,
      },
      profile: synthesis.profile,
      snapshot: persisted.snapshot,
      trust: websiteTrust,
      admission: candidateAdmission,
    };
  } catch (err) {
    logger.error("source_sync.orchestrator.failed", err, {
      stage,
      sourceUrl,
    });
    if (sourceType === "website" && err?.isTimeout) {
      logger.warn("source_sync.orchestrator.timeout_partial", {
        stage,
        sourceUrl,
        timeoutMs: err?.timeoutMs || null,
      });
      return await finishWebsiteTimeoutAsPartial({
        source,
        run,
        requestedBy,
        sources,
        sourceUrl,
        stage,
        err,
        extracted,
        rawSignals,
        sourceProfile,
        synthesis,
        warnings,
        debugWarnings,
        quality,
        createdObservations,
        scopedObservations,
        scopedObservationScope,
        websiteTrust,
        candidateAdmission,
        weakWebsiteExtraction,
        stepTimeouts,
      });
    }

    if (sourceType === "website") {
      const barrier = classifyWebsitePartialBarrier({
        err,
        stage,
        extracted,
        createdObservations,
      });

      if (barrier) {
        logger.warn("source_sync.orchestrator.barrier_partial", {
          stage,
          sourceUrl,
          barrier: barrier.code || barrier.reason || "website_partial_barrier",
        });
        return await finishWebsiteBarrierAsPartial({
          source,
          run,
          requestedBy,
          sources,
          sourceUrl,
          stage,
          barrier,
          extracted,
          rawSignals,
          sourceProfile,
          warnings,
        });
      }
    }

    let failed = null;

    try {
      const finishWarnings = buildFinishWarnings({
        sourceType,
        warnings,
        extracted,
        rawSignals,
        sourceProfile,
        observationsDraft,
        synthesis,
        weakWebsiteExtraction,
        websiteTrust,
        candidateAdmission,
      });

      surfacedWarnings = arr(finishWarnings.surfacedWarnings);
      debugWarnings = arr(finishWarnings.debugWarnings);

      failed = await withTimeout(
        () =>
          sources.markSourceSyncError({
            sourceId: source.id,
            runId: run.id,
            requestedBy,
            errorCode: `${sourceType.toUpperCase()}_SYNC_FAILED`,
            errorMessage: err?.message || `${sourceType} sync failed`,
            inputSummaryJson: {
              sourceType,
              sourceUrl,
              stage,
            },
            extractionSummaryJson: {
              quality: {
                ...quality,
                sourceFusionVersion: SOURCE_FUSION_VERSION,
                sourceSyncVersion: SOURCE_SYNC_VERSION,
                observationCount: arr(createdObservations).length,
                scopedObservationCount: arr(scopedObservations).length,
                scopedObservationScope,
                candidateAdmission,
                websiteTrust: buildWebsiteTrustSummaryPayload(websiteTrust),
                surfacedWarnings,
                debugWarnings,
                orchestratorTimeoutMs:
                  sourceType === "website" ? stepTimeouts.websiteExtractMs : null,
              },
            },
            resultSummaryJson: {
              sourceFusionVersion: SOURCE_FUSION_VERSION,
              sourceSyncVersion: SOURCE_SYNC_VERSION,
              stage,
              warnings: surfacedWarnings.length ? surfacedWarnings : warnings,
              rawWarnings: warnings,
              debugWarnings,
              websiteTrust,
              candidateAdmission,
              synthesisMetrics: obj(synthesis?.metrics),
              canonicalProjection: "deferred_to_review",
            },
            pagesScanned:
              sourceType === "website"
                ? safeWebsitePageCount(extracted)
                : extracted
                  ? 1
                  : 0,
            recordsScanned: arr(createdObservations).length,
            candidatesCreated: 0,
            errorsCount: 1,
            logsJson: [
              {
                level: "error",
                message: err?.message || `${sourceType} sync failed`,
                stage,
                sourceFusionVersion: SOURCE_FUSION_VERSION,
                sourceSyncVersion: SOURCE_SYNC_VERSION,
                websiteTrust,
                candidateAdmission,
              },
              ...arr(surfacedWarnings.length ? surfacedWarnings : warnings).map(
                (message) => ({
                  level: "warn",
                  message,
                  stage,
                })
              ),
              ...debugWarnings.map((message) => ({
                level: "info",
                message: `debug_warning_suppressed_from_ui: ${message}`,
                stage,
              })),
            ],
          }),
        stepTimeouts.markErrorMs,
        {
          sourceType,
          stage: "mark_source_sync_error",
        }
      );
    } catch (markErr) {
      warnings = dedupeWarnings([
        ...warnings,
        `mark_source_sync_error_failed: ${markErr?.message || "unknown error"}`,
      ]);
    }

    return {
      ok: false,
      mode: "error",
      stage,
      warnings: surfacedWarnings.length ? surfacedWarnings : warnings,
      rawWarnings: warnings,
      debugWarnings,
      source: failed?.source || source,
      run: failed?.run || run,
      candidates: [],
      candidateCount: 0,
      extracted: null,
      signals: null,
      profile: null,
      snapshot: null,
      trust: websiteTrust,
      admission: candidateAdmission,
      error: err?.message || `${sourceType} sync failed`,
    };
  }
}

export { runSourceSync };
