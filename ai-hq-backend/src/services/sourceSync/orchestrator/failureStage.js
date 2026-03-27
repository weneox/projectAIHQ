async function finishWebsiteTimeoutAsPartial(context, state, err) {
  const { source, run, requestedBy, sources, sourceUrl, stepTimeouts, deps } =
    context;
  const timeoutStage = deps.s(err?.step || state.stage || "extract").toLowerCase();

  const timeoutWarning = deps.buildTimeoutWarning({
    sourceType: "website",
    stage: timeoutStage,
    timeoutMs: err?.timeoutMs,
  });

  const rawWarnings = deps.dedupeWarnings([...state.warnings, timeoutWarning]);
  const surfacedWarnings = rawWarnings;

  const timeoutQuality = {
    ...state.quality,
    sourceFusionVersion: deps.SOURCE_FUSION_VERSION,
    sourceSyncVersion: deps.SOURCE_SYNC_VERSION,
    observationCount: deps.arr(state.createdObservations).length,
    scopedObservationCount: deps.arr(state.scopedObservations).length,
    scopedObservationScope: state.scopedObservationScope,
    candidateAdmission: state.candidateAdmission,
    websiteTrust: deps.buildWebsiteTrustSummaryPayload(state.websiteTrust),
    timeoutStage,
    timeoutMs: err?.timeoutMs || null,
    surfacedWarnings,
    debugWarnings: deps.arr(state.debugWarnings),
    orchestratorTimeoutMs: stepTimeouts?.websiteExtractMs || null,
  };

  let finished = null;

  try {
    finished = await deps.withTimeout(
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
            finalUrl: state.extracted?.finalUrl || "",
            crawl: state.extracted?.crawl || {},
            discovery: state.extracted?.discovery || {},
            quality: timeoutQuality,
            sourceFusion: {
              version: deps.SOURCE_FUSION_VERSION,
              observationsCreated: deps.arr(state.createdObservations).length,
              scopedObservationCount: deps.arr(state.scopedObservations).length,
              scopedObservationScope: state.scopedObservationScope,
              conflictCount: deps.arr(state.synthesis?.conflicts).length,
              currentSnapshotId: "",
              canonicalProjection: "deferred_to_review",
            },
          },
          resultSummaryJson: {
            sourceFusionVersion: deps.SOURCE_FUSION_VERSION,
            sourceSyncVersion: deps.SOURCE_SYNC_VERSION,
            stage: timeoutStage,
            summary:
              state.synthesis?.profile?.summaryShort ||
              state.synthesis?.profile?.companySummaryShort ||
              state.synthesis?.profile?.summaryLong ||
              state.synthesis?.profile?.companySummaryLong ||
              state.sourceProfile?.summaryShort ||
              state.sourceProfile?.companySummaryShort ||
              state.sourceProfile?.summaryLong ||
              state.sourceProfile?.companySummaryLong ||
              "",
            companySummaryLong:
              state.synthesis?.profile?.summaryLong ||
              state.synthesis?.profile?.companySummaryLong ||
              state.sourceProfile?.summaryLong ||
              state.sourceProfile?.companySummaryLong ||
              "",
            supportMode:
              state.synthesis?.profile?.supportMode ||
              state.sourceProfile?.supportMode ||
              "",
            pricingPolicy:
              state.synthesis?.profile?.pricingPolicy ||
              state.sourceProfile?.pricingPolicy ||
              "",
            candidateCount: 0,
            weakWebsiteExtraction: state.weakWebsiteExtraction,
            websiteTrust: state.websiteTrust,
            candidateAdmission: state.candidateAdmission,
            warnings: surfacedWarnings,
            rawWarnings,
            debugWarnings: state.debugWarnings,
            timeoutStage,
            timeoutMs: err?.timeoutMs || null,
            canonicalProjection: "deferred_to_review",
          },
          pagesScanned: deps.safeWebsitePageCount(state.extracted),
          recordsScanned: deps.arr(state.createdObservations).length,
          candidatesCreated: 0,
          warningsCount:
            surfacedWarnings.length > 0 ? surfacedWarnings.length : 1,
          logsJson: [
            {
              level: "warn",
              message:
                err?.message ||
                `website ${timeoutStage} timed out and was finished as partial`,
              stage: timeoutStage,
              timeoutMs: err?.timeoutMs || null,
              orchestratorTimeoutMs: stepTimeouts?.websiteExtractMs || null,
              sourceFusionVersion: deps.SOURCE_FUSION_VERSION,
              sourceSyncVersion: deps.SOURCE_SYNC_VERSION,
              websiteTrust: state.websiteTrust,
              candidateAdmission: state.candidateAdmission,
            },
            ...surfacedWarnings.map((message) => ({
              level: "warn",
              message,
              stage: timeoutStage,
            })),
            ...deps.arr(state.debugWarnings).map((message) => ({
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
  } catch {
    finished = null;
  }

  const sourceSignalPayload = deps.buildSourceSignalPayload({
    sourceType: "website",
    rawSignals: state.rawSignals,
    websiteTrust: state.websiteTrust,
  });

  return {
    ok: true,
    mode: "partial",
    stage: timeoutStage,
    warnings: surfacedWarnings,
    rawWarnings,
    debugWarnings: deps.arr(state.debugWarnings),
    source: finished?.source || source,
    run: finished?.run || run,
    candidates: [],
    candidateCount: 0,
    extracted: state.extracted,
    signals: {
      website: sourceSignalPayload,
      sourceFusion: state.synthesis,
    },
    profile: state.synthesis?.profile || state.sourceProfile || null,
    snapshot: null,
    trust: state.websiteTrust,
    admission: state.candidateAdmission,
  };
}

export async function runFailureSourceSyncStage(context, state, err) {
  const {
    source,
    run,
    requestedBy,
    sources,
    sourceType,
    sourceUrl,
    stepTimeouts,
    logger,
    deps,
  } = context;

  logger.error("source_sync.orchestrator.failed", err, {
    stage: state.stage,
    sourceUrl,
  });

  if (sourceType === "website" && err?.isTimeout) {
    logger.warn("source_sync.orchestrator.timeout_partial", {
      stage: state.stage,
      sourceUrl,
      timeoutMs: err?.timeoutMs || null,
    });
    return finishWebsiteTimeoutAsPartial(context, state, err);
  }

  if (sourceType === "website") {
    const barrier = deps.classifyWebsitePartialBarrier({
      err,
      stage: state.stage,
      extracted: state.extracted,
      createdObservations: state.createdObservations,
    });

    if (barrier) {
      logger.warn("source_sync.orchestrator.barrier_partial", {
        stage: state.stage,
        sourceUrl,
        barrier: barrier.code || barrier.reason || "website_partial_barrier",
      });
      return deps.finishWebsiteBarrierAsPartial({
        source,
        run,
        requestedBy,
        sources,
        sourceUrl,
        stage: state.stage,
        barrier,
        extracted: state.extracted,
        rawSignals: state.rawSignals,
        sourceProfile: state.sourceProfile,
        warnings: state.warnings,
      });
    }
  }

  let failed = null;

  try {
    const finishWarnings = deps.buildFinishWarnings({
      sourceType,
      warnings: state.warnings,
      extracted: state.extracted,
      rawSignals: state.rawSignals,
      sourceProfile: state.sourceProfile,
      observationsDraft: state.observationsDraft,
      synthesis: state.synthesis,
      weakWebsiteExtraction: state.weakWebsiteExtraction,
      websiteTrust: state.websiteTrust,
      candidateAdmission: state.candidateAdmission,
    });

    state.surfacedWarnings = deps.arr(finishWarnings.surfacedWarnings);
    state.debugWarnings = deps.arr(finishWarnings.debugWarnings);

    failed = await deps.withTimeout(
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
            stage: state.stage,
          },
          extractionSummaryJson: {
            quality: {
              ...state.quality,
              sourceFusionVersion: deps.SOURCE_FUSION_VERSION,
              sourceSyncVersion: deps.SOURCE_SYNC_VERSION,
              observationCount: deps.arr(state.createdObservations).length,
              scopedObservationCount: deps.arr(state.scopedObservations).length,
              scopedObservationScope: state.scopedObservationScope,
              candidateAdmission: state.candidateAdmission,
              websiteTrust: deps.buildWebsiteTrustSummaryPayload(
                state.websiteTrust
              ),
              surfacedWarnings: state.surfacedWarnings,
              debugWarnings: state.debugWarnings,
              orchestratorTimeoutMs:
                sourceType === "website" ? stepTimeouts.websiteExtractMs : null,
            },
          },
          resultSummaryJson: {
            sourceFusionVersion: deps.SOURCE_FUSION_VERSION,
            sourceSyncVersion: deps.SOURCE_SYNC_VERSION,
            stage: state.stage,
            warnings: state.surfacedWarnings.length
              ? state.surfacedWarnings
              : state.warnings,
            rawWarnings: state.warnings,
            debugWarnings: state.debugWarnings,
            websiteTrust: state.websiteTrust,
            candidateAdmission: state.candidateAdmission,
            synthesisMetrics: deps.obj(state.synthesis?.metrics),
            canonicalProjection: "deferred_to_review",
          },
          pagesScanned:
            sourceType === "website"
              ? deps.safeWebsitePageCount(state.extracted)
              : state.extracted
                ? 1
                : 0,
          recordsScanned: deps.arr(state.createdObservations).length,
          candidatesCreated: 0,
          errorsCount: 1,
          logsJson: [
            {
              level: "error",
              message: err?.message || `${sourceType} sync failed`,
              stage: state.stage,
              sourceFusionVersion: deps.SOURCE_FUSION_VERSION,
              sourceSyncVersion: deps.SOURCE_SYNC_VERSION,
              websiteTrust: state.websiteTrust,
              candidateAdmission: state.candidateAdmission,
            },
            ...deps
              .arr(
                state.surfacedWarnings.length
                  ? state.surfacedWarnings
                  : state.warnings
              )
              .map((message) => ({
                level: "warn",
                message,
                stage: state.stage,
              })),
            ...state.debugWarnings.map((message) => ({
              level: "info",
              message: `debug_warning_suppressed_from_ui: ${message}`,
              stage: state.stage,
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
    state.warnings = deps.dedupeWarnings([
      ...state.warnings,
      `mark_source_sync_error_failed: ${markErr?.message || "unknown error"}`,
    ]);
  }

  return {
    ok: false,
    mode: "error",
    stage: state.stage,
    warnings: state.surfacedWarnings.length
      ? state.surfacedWarnings
      : state.warnings,
    rawWarnings: state.warnings,
    debugWarnings: state.debugWarnings,
    source: failed?.source || source,
    run: failed?.run || run,
    candidates: [],
    candidateCount: 0,
    extracted: null,
    signals: null,
    profile: null,
    snapshot: null,
    trust: state.websiteTrust,
    admission: state.candidateAdmission,
    error: err?.message || `${sourceType} sync failed`,
  };
}
