export async function runProcessingStage(context, state) {
  const { source, run, sourceType, sourceUrl, fusion, deps } = context;

  state.stage = "normalize_observations";

  const safeObservationDrafts = deps.arr(state.observationsDraft)
    .map((item) => deps.normalizeObservationRecord(item))
    .filter(Boolean);

  const droppedDraftObservationCount =
    deps.arr(state.observationsDraft).length - safeObservationDrafts.length;

  if (droppedDraftObservationCount > 0) {
    state.warnings = deps.dedupeWarnings([
      ...state.warnings,
      `${droppedDraftObservationCount} invalid observation draft(s) were dropped before persistence`,
    ]);
  }

  state.stage = "persist_observations";

  if (safeObservationDrafts.length > 0) {
    const createdObservationsRaw = await fusion.createObservationsBulk(
      safeObservationDrafts
    );

    state.createdObservations = deps.arr(createdObservationsRaw)
      .map((item) => deps.normalizeObservationRecord(item))
      .filter(Boolean);
  } else {
    state.createdObservations = [];
  }

  state.stage = "load_scoped_observations";

  const scoped = await deps.loadScopedObservations({
    fusion,
    source,
    run,
    sourceType,
  });

  state.scopedObservations = deps.arr(scoped.observations);
  state.scopedObservationScope = deps.s(scoped.scope);

  const synthesisInputObservations =
    state.scopedObservations.length > 0
      ? state.scopedObservations
      : state.createdObservations;

  if (!synthesisInputObservations.length) {
    state.warnings = deps.dedupeWarnings([
      ...state.warnings,
      "No valid observations were available for synthesis",
    ]);
  }

  state.stage = "synthesize";

  if (
    sourceType === "google_maps" &&
    state.weakGoogleMapsExtraction &&
    !synthesisInputObservations.length
  ) {
    state.synthesis = deps.normalizeSynthesisResult(
      {},
      {
        fallbackProfile: state.sourceProfile,
        sourceType,
        sourceUrl,
      }
    );
  } else if (
    sourceType === "instagram" &&
    state.weakInstagramExtraction &&
    !synthesisInputObservations.length
  ) {
    state.synthesis = deps.normalizeSynthesisResult(
      {},
      {
        fallbackProfile: state.sourceProfile,
        sourceType,
        sourceUrl,
      }
    );
  } else {
    state.synthesis = deps.normalizeSynthesisResult(
      deps.synthesizeTenantBusinessFromObservations({
        observations: synthesisInputObservations,
      }),
      {
        fallbackProfile: state.sourceProfile,
        sourceType,
        sourceUrl,
      }
    );
  }

  state.candidateAdmission = deps.buildCandidateAdmission({
    sourceType,
    weakGoogleMapsExtraction: state.weakGoogleMapsExtraction,
    weakWebsiteExtraction: state.weakWebsiteExtraction,
    weakInstagramExtraction: state.weakInstagramExtraction,
    websiteTrust: state.websiteTrust,
  });

  state.stage = "build_candidates";

  if (!state.candidateAdmission.allowCandidateCreation) {
    state.candidateDrafts = [];

    if (sourceType === "google_maps") {
      state.warnings = deps.dedupeWarnings([
        ...state.warnings,
        "google_maps candidate creation was skipped because google_places resolution quality is too weak",
      ]);
    }

    if (sourceType === "website") {
      state.warnings = deps.dedupeWarnings([
        ...state.warnings,
        state.candidateAdmission.reason ===
        "website_trust_guard_blocked_candidate_creation"
          ? "website_trust_guard_blocked_candidate_creation"
          : "weak_website_extraction",
      ]);
    }

    if (sourceType === "instagram") {
      state.warnings = deps.dedupeWarnings([
        ...state.warnings,
        "instagram candidate creation was skipped because connected account data is too weak",
      ]);
    }
  } else {
    try {
      state.candidateDrafts = deps.arr(
        deps.buildCandidatesFromSynthesis({
          tenantId: source.tenant_id,
          tenantKey: source.tenant_key,
          sourceId: source.id,
          sourceRunId: run.id,
          synthesis: state.synthesis,
        })
      )
        .map((item) =>
          deps.normalizeCandidateRecord({
            ...item,
            status: "needs_review",
          })
        )
        .filter(Boolean);

      const quarantinedCount = deps.arr(state.synthesis?.governance?.quarantinedClaims).length;
      if (quarantinedCount > 0) {
        state.warnings = deps.dedupeWarnings([
          ...state.warnings,
          `${quarantinedCount} weak or conflicting claim(s) were quarantined from candidate promotion`,
        ]);
      }
    } catch (candidateErr) {
      state.candidateDrafts = [];
      state.warnings = deps.dedupeWarnings([
        ...state.warnings,
        `candidate_build_skipped: ${candidateErr?.message || "unknown error"}`,
      ]);
    }
  }

  return {
    safeObservationDrafts,
    droppedDraftObservationCount,
    synthesisInputObservationCount: deps.arr(synthesisInputObservations).length,
  };
}
