export function registerSetupReviewRoutes(
  router,
  {
    db,
    requireSetupActor,
    handleSetupAnalyze,
    applySetupReviewPatch,
    executeTruthRollback,
    finalizeSetupReview,
    discardSetupReview,
    s,
    obj,
    buildReviewConcurrencyInfo,
    buildFinalizeProtectionInfo,
  }
) {
  router.post("/setup/review/current/analyze", async (req, res) => {
    return handleSetupAnalyze(req, res, db);
  });

  router.post("/setup/analyze", async (req, res) => {
    return handleSetupAnalyze(req, res, db);
  });

  router.patch("/setup/review/current", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      const result = await applySetupReviewPatch({
        db,
        actor,
        body: req.body || {},
      });
      return res.status(result.status).json(result.body);
    } catch (err) {
      return res.status(400).json({
        ok: false,
        error: "SetupReviewPatchFailed",
        reason: err?.message || "failed to patch setup review draft",
      });
    }
  });

  router.post("/setup/review/current/discard", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      const result = await discardSetupReview({
        db,
        actor,
        body: req.body || {},
      });
      return res.status(result.status).json(result.body);
    } catch (err) {
      return res.status(400).json({
        ok: false,
        error: "SetupReviewDiscardFailed",
        reason: err?.message || "failed to discard setup review session",
      });
    }
  });

  router.post("/setup/truth/history/:versionId/rollback", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      const result = await executeTruthRollback({
        db,
        actor,
        versionId: s(req.params?.versionId),
        body: req.body || {},
      });
      return res.status(result.status).json(result.body);
    } catch (err) {
      return res.status(400).json({
        ok: false,
        error: "SetupTruthRollbackFailed",
        reason: err?.message || "failed to execute governed rollback",
      });
    }
  });

  async function handleFinalize(req, res) {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    let current = null;

    try {
      const result = await finalizeSetupReview({
        db,
        actor,
        body: req.body || {},
        log: req.log,
      });
      return res.status(result.status).json(result.body);
    } catch (err) {
      current = err?.currentReview || current;
      const authority = obj(err?.runtimeAuthority || err?.authority);
      const freshness = obj(err?.freshness);
      const statusCode = Number.isFinite(Number(err?.statusCode))
        ? Number(err.statusCode)
        : s(err?.code) === "TENANT_RUNTIME_AUTHORITY_UNAVAILABLE"
          ? 409
          : 400;

      return res.status(statusCode).json({
        ok: false,
        error: "SetupReviewFinalizeFailed",
        reason: err?.message || "failed to finalize setup review",
        code: s(err?.code),
        reasonCode: s(
          err?.reasonCode ||
            authority?.reasonCode ||
            authority?.reason ||
            err?.reason
        ),
        authority,
        freshness,
        baseline: obj(err?.baseline),
        current: obj(err?.current),
        concurrency: current ? buildReviewConcurrencyInfo(current) : {},
        finalizeProtection: current ? buildFinalizeProtectionInfo(current) : {},
      });
    }
  }

  router.post("/setup/review/current/finalize", handleFinalize);
  router.post("/setup/review-finalize", handleFinalize);
}
