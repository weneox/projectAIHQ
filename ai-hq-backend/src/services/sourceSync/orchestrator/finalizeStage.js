export async function runUnsupportedSourceSyncStage(context, state) {
  const { source, run, requestedBy, sources, sourceType, sourceUrl, stepTimeouts, logger, deps } =
    context;

  const result = await deps.withTimeout(
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
          sourceFusionVersion: deps.SOURCE_FUSION_VERSION,
          sourceSyncVersion: deps.SOURCE_SYNC_VERSION,
        },
        resultSummaryJson: {
          message:
            "sync v8.3 currently supports website, instagram and google_maps sources",
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

export async function runFinalizeSourceSyncStage(
  context,
  state,
  processingMetrics = {}
) {
  const {
    source,
    run,
    requestedBy,
    sources,
    knowledge,
    fusion,
    sourceType,
    sourceUrl,
    stepTimeouts,
    logger,
    deps,
  } = context;

  const warningDecision = deps.buildFinishWarnings({
    sourceType,
    warnings: state.warnings,
    extracted: state.extracted,
    rawSignals: state.rawSignals,
    sourceProfile: state.sourceProfile,
    observationsDraft: processingMetrics.safeObservationDrafts || [],
    synthesis: state.synthesis,
    weakWebsiteExtraction: state.weakWebsiteExtraction,
    websiteTrust: state.websiteTrust,
    candidateAdmission: state.candidateAdmission,
  });

  state.surfacedWarnings = deps.arr(warningDecision.surfacedWarnings);
  state.debugWarnings = deps.arr(warningDecision.debugWarnings);
  state.websiteWarningDiagnostics = warningDecision.diagnostics;

  state.stage = "persist_outputs";

  const persisted = await deps.persistSynthesisOutputs({
    source,
    run,
    requestedBy,
    knowledge,
    fusion,
    synthesis: state.synthesis,
    candidateDrafts: state.candidateDrafts,
    createdObservations: state.createdObservations,
    sourceType,
    sourceUrl,
    skipCandidateCreate: !state.candidateAdmission.allowCandidateCreation,
    candidateAdmission: state.candidateAdmission,
    trust: state.websiteTrust,
  });

  state.stage = "finish_sync";

  const shouldTreatAsPartial = deps.shouldTreatSyncAsPartial({
    candidateAdmission: state.candidateAdmission,
    createdObservations: state.createdObservations,
    persistedCreatedCount: persisted.createdCount,
  });

  state.quality = {
    ...state.quality,
    sourceFusionVersion: deps.SOURCE_FUSION_VERSION,
    sourceSyncVersion: deps.SOURCE_SYNC_VERSION,
    observationCount: deps.arr(state.createdObservations).length,
    candidateCount: persisted.createdCount,
    conflictCount: deps.arr(state.synthesis?.conflicts).length,
    quarantinedClaimCount: deps.arr(state.synthesis?.governance?.quarantinedClaims).length,
    scopedObservationCount: deps.arr(state.scopedObservations).length,
    scopedObservationScope: state.scopedObservationScope,
    droppedDraftObservationCount:
      Number(processingMetrics.droppedDraftObservationCount || 0),
    synthesisInputObservationCount:
      Number(processingMetrics.synthesisInputObservationCount || 0),
    synthesisMetrics: deps.obj(state.synthesis?.metrics),
    canonicalProjection: "deferred_to_review",
    candidateAdmission: state.candidateAdmission,
    websiteTrust: deps.buildWebsiteTrustSummaryPayload(state.websiteTrust),
    surfacedWarnings: state.surfacedWarnings,
    debugWarnings: state.debugWarnings,
    orchestratorTimeoutMs:
      sourceType === "website" ? stepTimeouts.websiteExtractMs : null,
    warningDiagnostics:
      sourceType === "website"
        ? {
            signalStrength:
              state.websiteWarningDiagnostics?.signalStrength || null,
            hardWebsiteWarnings:
              state.websiteWarningDiagnostics?.hardWebsiteWarnings || [],
          }
        : null,
  };

  const sourceSignalPayload = deps.buildSourceSignalPayload({
    sourceType,
    rawSignals: state.rawSignals,
    websiteTrust: state.websiteTrust,
  });

  const finished = await deps.withTimeout(
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
          finalUrl: state.extracted?.finalUrl || "",
          crawl: state.extracted?.crawl || {},
          discovery: state.extracted?.discovery || {},
          quality: state.quality,
          sourceFusion: {
            version: deps.SOURCE_FUSION_VERSION,
            observationsCreated: deps.arr(state.createdObservations).length,
            scopedObservationCount: deps.arr(state.scopedObservations).length,
            scopedObservationScope: state.scopedObservationScope,
            conflictCount: deps.arr(state.synthesis?.conflicts).length,
            quarantinedClaimCount: deps.arr(state.synthesis?.governance?.quarantinedClaims).length,
            currentSnapshotId: persisted.snapshot?.id || "",
            canonicalProjection: "deferred_to_review",
          },
        },
        resultSummaryJson: {
          sourceFusionVersion: deps.SOURCE_FUSION_VERSION,
          sourceSyncVersion: deps.SOURCE_SYNC_VERSION,
          summary:
            state.synthesis?.profile?.summaryShort ||
            state.synthesis?.profile?.companySummaryShort ||
            state.synthesis?.profile?.summaryLong ||
            state.synthesis?.profile?.companySummaryLong ||
            "",
          companySummaryLong:
            state.synthesis?.profile?.summaryLong ||
            state.synthesis?.profile?.companySummaryLong ||
            "",
          supportMode: state.synthesis?.profile?.supportMode || "",
          pricingPolicy: state.synthesis?.profile?.pricingPolicy || "",
          candidateCount: persisted.createdCount,
          weakGoogleMapsExtraction: state.weakGoogleMapsExtraction,
          weakWebsiteExtraction: state.weakWebsiteExtraction,
          weakInstagramExtraction: state.weakInstagramExtraction,
          websiteTrust: state.websiteTrust,
          candidateAdmission: state.candidateAdmission,
          stage: state.stage,
          warnings: state.surfacedWarnings,
          rawWarnings: state.warnings,
          debugWarnings: state.debugWarnings,
          synthesisMetrics: deps.obj(state.synthesis?.metrics),
          governance: deps.obj(state.synthesis?.governance),
          canonicalProjection: "deferred_to_review",
        },
        pagesScanned:
          sourceType === "website"
            ? deps.safeWebsitePageCount(state.extracted)
            : state.extracted
              ? 1
              : 0,
        recordsScanned: deps.arr(state.createdObservations).length,
        candidatesCreated: persisted.createdCount,
        warningsCount:
          state.surfacedWarnings.length > 0 ? state.surfacedWarnings.length : 0,
        logsJson: [
          {
            level: "info",
            message:
              sourceType === "google_maps"
                ? "google_maps seed sync completed via Google Places"
                : sourceType === "instagram"
                  ? "instagram connected-source sync completed via Meta Graph"
                  : "website multi-page sync completed with source fusion and trust guardrails",
            stage: state.stage,
            sourceFusionVersion: deps.SOURCE_FUSION_VERSION,
            sourceSyncVersion: deps.SOURCE_SYNC_VERSION,
            finalUrl: state.extracted?.finalUrl || "",
            observationCount: deps.arr(state.createdObservations).length,
            scopedObservationCount: deps.arr(state.scopedObservations).length,
            scopedObservationScope: state.scopedObservationScope,
            candidateCount: persisted.createdCount,
            conflictCount: deps.arr(state.synthesis?.conflicts).length,
            quarantinedClaimCount: deps.arr(state.synthesis?.governance?.quarantinedClaims).length,
            weakGoogleMapsExtraction: state.weakGoogleMapsExtraction,
            weakWebsiteExtraction: state.weakWebsiteExtraction,
            weakInstagramExtraction: state.weakInstagramExtraction,
            websiteTrust: state.websiteTrust,
            candidateAdmission: state.candidateAdmission,
            synthesisMetrics: deps.obj(state.synthesis?.metrics),
            snapshotId: persisted.snapshot?.id || "",
            canonicalProjection: "deferred_to_review",
          },
          ...state.warnings.map((message) => ({
            level: state.surfacedWarnings.includes(message) ? "warn" : "info",
            message: state.surfacedWarnings.includes(message)
              ? message
              : `debug_warning_suppressed_from_ui: ${message}`,
            stage: state.stage,
            surfaced: state.surfacedWarnings.includes(message),
          })),
        ],
      }),
    stepTimeouts.finishSyncMs,
    {
      sourceType,
      stage: state.stage,
    }
  );

  logger.info("source_sync.orchestrator.completed", {
    mode: shouldTreatAsPartial ? "partial" : "success",
    stage: state.stage,
    candidateCount: Number(persisted.createdCount || 0),
    warningCount: Number(state.surfacedWarnings.length || 0),
  });

  return {
    ok: true,
    mode: shouldTreatAsPartial ? "partial" : "success",
    stage: state.stage,
    warnings: state.surfacedWarnings,
    rawWarnings: state.warnings,
    debugWarnings: state.debugWarnings,
    source: finished?.source || source,
    run: finished?.run || run,
    candidates: persisted.createdRows,
    candidateCount: persisted.createdCount,
    extracted: state.extracted,
    signals: {
      [sourceType]: sourceSignalPayload,
      sourceFusion: state.synthesis,
    },
    profile: state.synthesis.profile,
    snapshot: persisted.snapshot,
    trust: state.websiteTrust,
    admission: state.candidateAdmission,
  };
}
