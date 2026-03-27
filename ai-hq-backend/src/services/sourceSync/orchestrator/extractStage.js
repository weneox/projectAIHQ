export async function runExtractionStage(context, state) {
  const { db, source, run, sourceType, sourceUrl, stepTimeouts, deps } = context;

  state.stage = "extract";

  if (sourceType === "website") {
    state.extracted = await deps.withTimeout(
      () => deps.extractWebsiteSource(source),
      stepTimeouts.websiteExtractMs,
      { sourceType, stage: state.stage }
    );

    state.rawSignals = deps.buildWebsiteSignals(state.extracted);
    state.sourceProfile = deps.synthesizeBusinessProfile(state.rawSignals);
    state.websiteTrust = deps.buildWebsiteTrustSummary({
      extracted: state.extracted,
      signals: state.rawSignals,
      profile: state.sourceProfile,
    });
    state.weakWebsiteExtraction = deps.isWeakWebsiteExtraction({
      extracted: state.extracted,
      profile: state.sourceProfile,
      trust: state.websiteTrust,
    });
    state.warnings = deps.dedupeWarnings([
      ...state.warnings,
      ...deps.buildWebsiteExtractionWarnings({
        extracted: state.extracted,
        signals: state.rawSignals,
        profile: state.sourceProfile,
        trust: state.websiteTrust,
      }),
    ]);
    state.observationsDraft = deps.buildWebsiteObservations({
      source,
      run,
      extracted: state.extracted,
      profile: state.sourceProfile,
    });
    state.quality = deps.buildWebsiteSyncQualitySummary({
      extracted: state.extracted,
      signals: state.rawSignals,
      profile: state.sourceProfile,
      observationCount: deps.arr(state.observationsDraft).length,
      trust: state.websiteTrust,
    });
    return state;
  }

  if (sourceType === "instagram") {
    if (!db || typeof db.query !== "function") {
      throw new Error("runSourceSync: instagram source sync requires db.query(...)");
    }

    state.extracted = await deps.withTimeout(
      () => deps.extractInstagramSource(source, { db }),
      stepTimeouts.instagramExtractMs,
      { sourceType, stage: state.stage }
    );

    state.rawSignals = deps.buildInstagramSignals(state.extracted);
    state.sourceProfile = deps.synthesizeInstagramBusinessProfile(state.rawSignals);
    state.weakInstagramExtraction = deps.isWeakInstagramExtraction({
      extracted: state.extracted,
      profile: state.sourceProfile,
      signals: state.rawSignals,
    });
    state.warnings = deps.dedupeWarnings([
      ...state.warnings,
      ...deps.buildInstagramExtractionWarnings({
        extracted: state.extracted,
        signals: state.rawSignals,
        profile: state.sourceProfile,
      }),
    ]);
    state.observationsDraft = deps.buildInstagramObservations({
      source,
      run,
      extracted: state.extracted,
      profile: state.sourceProfile,
    });
    state.quality = deps.buildInstagramSyncQualitySummary({
      extracted: state.extracted,
      signals: state.rawSignals,
      profile: state.sourceProfile,
      observationCount: deps.arr(state.observationsDraft).length,
    });
    return state;
  }

  if (sourceType === "google_maps") {
    const resolved = await deps.withTimeout(
      () => deps.resolveGooglePlaceFromSeed(sourceUrl, {}),
      stepTimeouts.googleMapsResolveMs,
      { sourceType, stage: state.stage }
    );

    state.extracted = deps.buildGoogleMapsResolvedExtraction({ source, resolved });
    state.rawSignals = {
      googlePlaces: {
        provider: state.extracted.provider,
        query: state.extracted.query,
        confidence: state.extracted.confidence,
        place: deps.obj(state.extracted.place),
        candidateCount: deps.arr(state.extracted.candidates).length,
      },
    };
    state.sourceProfile = deps.buildGoogleMapsProfile(state.extracted);
    state.observationsDraft = deps.buildGoogleMapsObservations({
      source,
      run,
      extracted: state.extracted,
      profile: state.sourceProfile,
    });
    state.weakGoogleMapsExtraction = deps.isWeakGoogleMapsExtraction(
      state.extracted,
      state.sourceProfile
    );
    state.warnings = deps.dedupeWarnings([
      ...state.warnings,
      ...deps.buildGoogleMapsExtractionWarnings(
        state.extracted,
        state.sourceProfile
      ),
    ]);
    state.quality = deps.buildGoogleMapsSyncQualitySummary({
      extracted: state.extracted,
      profile: state.sourceProfile,
      observationCount: deps.arr(state.observationsDraft).length,
    });
  }

  return state;
}
