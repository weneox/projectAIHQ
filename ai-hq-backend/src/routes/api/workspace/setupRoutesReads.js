export function registerSetupReadRoutes(
  router,
  {
    db,
    handleSetupState,
    requireSetupActor,
    loadSetupTruthCurrent,
    loadCurrentReview,
    loadSetupTruthVersion,
    loadSetupReviewDraft,
    s,
  }
) {
  const respondWithSetupState = async (req, res, errorCode = "SetupStateFailed") =>
    handleSetupState(req, res, db, errorCode);

  router.get("/setup/status", async (req, res) => {
    return respondWithSetupState(req, res);
  });

  router.get("/setup/truth/current", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    const result = await loadSetupTruthCurrent({ db, actor });
    return res.status(result.status).json(result.body);
  });

  router.get("/setup/review/current", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    const result = await loadCurrentReview({
      db,
      actor,
      eventLimit: Number(req.query?.eventLimit || 30) || 30,
    });

    return res.status(result.status).json(result.body);
  });

  router.get("/setup/truth/history/:versionId", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    const result = await loadSetupTruthVersion({
      db,
      actor,
      versionId: s(req.params?.versionId),
      compareToVersionId: s(req.query?.compareTo),
    });

    return res.status(result.status).json(result.body);
  });

  router.get("/setup/review-draft", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    const result = await loadSetupReviewDraft({
      db,
      actor,
    });

    return res.status(result.status).json(result.body);
  });
}
