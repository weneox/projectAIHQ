export function registerSetupStagingRoutes(
  router,
  {
    db,
    requireSetupActor,
    stageSetupBusinessProfileMutation,
    stageSetupRuntimePreferencesMutation,
    patchSetupReviewDraft,
    loadCurrentReviewPayload,
    auditSetupAction,
    s,
    arr,
    listSetupServicesFromDraftOrCanonical,
    stageSetupServiceMutation,
  }
) {
  router.put("/setup/business-profile", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      const mutation = await stageSetupBusinessProfileMutation({
        db,
        actor,
        body: req.body || {},
        patchSetupReviewDraft,
        loadCurrentReviewPayload,
      });

      await auditSetupAction(
        db,
        actor,
        "setup.review.updated",
        "tenant_setup_review_session",
        mutation.current.session.id,
        {
          sessionId: mutation.current.session.id,
          draftVersion: Number(
            mutation.draft?.version || mutation.data?.review?.draft?.version || 0
          ),
          currentStep: s(
            mutation.data?.review?.session?.currentStep ||
              mutation.current.session.currentStep
          ),
        }
      );

      return res.json({
        ok: true,
        message: "Business profile staged in setup review draft",
        staged: true,
        canonicalWriteDeferred: true,
        saved: mutation.staged.saved,
        draft: mutation.data.review?.draft || null,
        session: mutation.data.review?.session || null,
        sources: arr(mutation.data.review?.sources),
        events: arr(mutation.data.review?.events),
        setup: mutation.data.setup,
      });
    } catch (err) {
      return res.status(400).json({
        ok: false,
        error: "BusinessProfileSaveFailed",
        reason: err?.message || "failed to save business profile",
      });
    }
  });

  router.put("/setup/runtime-preferences", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      const mutation = await stageSetupRuntimePreferencesMutation({
        db,
        actor,
        body: req.body || {},
        patchSetupReviewDraft,
        loadCurrentReviewPayload,
      });

      return res.json({
        ok: true,
        message: "Runtime preferences staged in setup review draft",
        staged: true,
        canonicalWriteDeferred: true,
        saved: mutation.staged.saved,
        draft: mutation.data.review?.draft || null,
        session: mutation.data.review?.session || null,
        sources: arr(mutation.data.review?.sources),
        events: arr(mutation.data.review?.events),
        setup: mutation.data.setup,
      });
    } catch (err) {
      return res.status(400).json({
        ok: false,
        error: "RuntimePreferencesSaveFailed",
        reason: err?.message || "failed to save runtime preferences",
      });
    }
  });

  router.get("/setup/services", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      const data = await listSetupServicesFromDraftOrCanonical({
        db,
        actor,
      });

      return res.json({
        ok: true,
        ...data,
      });
    } catch (err) {
      return res.status(400).json({
        ok: false,
        error: "SetupServicesLoadFailed",
        reason: err?.message || "failed to load setup services",
      });
    }
  });

  router.post("/setup/services", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      const data = await stageSetupServiceMutation({
        db,
        actor,
        mode: "create",
        body: req.body || {},
      });

      return res.json({
        ok: true,
        message: "Service staged in setup review draft",
        staged: true,
        canonicalWriteDeferred: true,
        draft: data.review?.draft || null,
        session: data.review?.session || null,
        sources: arr(data.review?.sources),
        events: arr(data.review?.events),
        setup: data.setup,
      });
    } catch (err) {
      req.log?.error("setup.services.create.failed", err, {
        tenantId: s(actor?.tenantId),
        tenantKey: s(actor?.tenantKey),
      });
      return res.status(400).json({
        ok: false,
        error: "SetupServiceCreateFailed",
        reason: err?.message || "failed to create service",
      });
    }
  });

  router.put("/setup/services/:id", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      const data = await stageSetupServiceMutation({
        db,
        actor,
        mode: "update",
        serviceId: req.params.id,
        body: req.body || {},
      });

      return res.json({
        ok: true,
        message: "Service staged in setup review draft",
        staged: true,
        canonicalWriteDeferred: true,
        draft: data.review?.draft || null,
        session: data.review?.session || null,
        sources: arr(data.review?.sources),
        events: arr(data.review?.events),
        setup: data.setup,
      });
    } catch (err) {
      req.log?.error("setup.services.update.failed", err, {
        serviceId: s(req.params?.id),
        tenantId: s(actor?.tenantId),
        tenantKey: s(actor?.tenantKey),
      });
      return res.status(400).json({
        ok: false,
        error: "SetupServiceUpdateFailed",
        reason: err?.message || "failed to update service",
      });
    }
  });

  router.delete("/setup/services/:id", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      const data = await stageSetupServiceMutation({
        db,
        actor,
        mode: "delete",
        serviceId: req.params.id,
      });

      return res.json({
        ok: true,
        message: "Service removal staged in setup review draft",
        staged: true,
        canonicalWriteDeferred: true,
        draft: data.review?.draft || null,
        session: data.review?.session || null,
        sources: arr(data.review?.sources),
        events: arr(data.review?.events),
        setup: data.setup,
      });
    } catch (err) {
      req.log?.error("setup.services.delete.failed", err, {
        serviceId: s(req.params?.id),
        tenantId: s(actor?.tenantId),
        tenantKey: s(actor?.tenantKey),
      });
      return res.status(400).json({
        ok: false,
        error: "SetupServiceDeleteFailed",
        reason: err?.message || "failed to delete service",
      });
    }
  });
}
