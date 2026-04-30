function localS(value, fallback = "") {
  const next = String(value ?? fallback).trim();
  return next || fallback;
}

function localObj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function localArr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function slugifyTruthMaintenanceKey(value = "") {
  return localS(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function splitMaintenanceList(value = "") {
  if (Array.isArray(value)) {
    return value.map((item) => localS(item)).filter(Boolean);
  }

  return localS(value)
    .split(/\r?\n|;|\|/g)
    .map((item) => localS(item))
    .filter(Boolean);
}

function normalizeTruthMaintenanceChanges(body = {}) {
  return localArr(body?.changes)
    .map((item) => {
      const change = localObj(item);
      const key = localS(change.key || change.fieldKey || change.field_key);
      const to = localS(change.to ?? change.nextValue ?? change.value);
      const from = localS(change.from ?? change.previousValue ?? change.currentValue);

      if (!key || !to || to === from) return null;

      return {
        key,
        label: localS(change.label || key),
        from,
        to,
        note: localS(change.note),
        stagedAt: localS(change.stagedAt) || new Date().toISOString(),
      };
    })
    .filter(Boolean);
}

function upsertByKey(rows = [], keyName = "key", keyValue = "", nextItem = {}) {
  const key = localS(keyValue);
  const existing = localArr(rows);
  const index = existing.findIndex((item) => localS(item?.[keyName]) === key);

  if (index >= 0) {
    const copy = [...existing];
    copy[index] = compactDraftObject({
      ...localObj(copy[index]),
      ...nextItem,
    });
    return copy;
  }

  return [...existing, compactDraftObject(nextItem)];
}

function buildMaintenanceKnowledgeItem(change = {}, category = "general") {
  const key = localS(change.key);
  return compactDraftObject({
    key,
    itemKey: key,
    category,
    title: localS(change.label || key),
    valueText: localS(change.to),
    normalizedText: localS(change.to),
    status: "approved",
    confidence: 1,
    confidenceLabel: "manual",
    origin: "truth_maintenance_inline_edit",
    metadataJson: {
      origin: "truth_maintenance_inline_edit",
      changedFrom: localS(change.from),
      note: localS(change.note),
      stagedAt: localS(change.stagedAt),
    },
  });
}

function buildMaintenanceServices(change = {}, currentServices = []) {
  const rows = splitMaintenanceList(change.to);
  if (!rows.length) return currentServices;

  return rows.map((title, index) => {
    const key = slugifyTruthMaintenanceKey(title) || `service_${index + 1}`;

    return compactDraftObject({
      key,
      serviceKey: key,
      title,
      name: title,
      description: title,
      category: "service",
      metadataJson: {
        origin: "truth_maintenance_inline_edit",
        changedFrom: localS(change.from),
        note: localS(change.note),
        stagedAt: localS(change.stagedAt),
      },
    });
  });
}

function buildTruthMaintenanceDraftPatch(changes = [], currentDraft = {}) {
  const currentProfile = localObj(currentDraft.businessProfile);
  const currentCapabilities = localObj(currentDraft.capabilities);
  let businessProfile = { ...currentProfile };
  let capabilities = { ...currentCapabilities };
  let contacts = localArr(currentDraft.contacts);
  let locations = localArr(currentDraft.locations);
  let services = localArr(currentDraft.services);
  let knowledgeItems = localArr(currentDraft.knowledgeItems);

  for (const change of localArr(changes)) {
    const key = localS(change.key);
    const value = localS(change.to);

    if (!key || !value) continue;

    if (key === "companyName") {
      businessProfile.companyName = value;
      continue;
    }

    if (
      [
        "description",
        "summary",
        "summaryShort",
        "summaryLong",
        "shortDescription",
        "businessSummary",
        "valueProposition",
      ].includes(key)
    ) {
      businessProfile.description = value;
      businessProfile.summary = value;
      businessProfile.summaryShort = value;
      businessProfile.summaryLong = value;
      businessProfile.shortDescription = value;
      businessProfile.businessSummary = value;
      businessProfile.valueProposition = value;
      businessProfile.brandSummary = value;
      continue;
    }

    if (key === "mainLanguage") {
      businessProfile.languages = [value];
      businessProfile.defaultLanguage = value;
      capabilities.supportedLanguages = [value];
      capabilities.primaryLanguage = value;
      capabilities.supportsMultilanguage = false;
      continue;
    }

    if (key === "websiteUrl") {
      businessProfile.websiteUrl = value;
      continue;
    }

    if (key === "socialLinks") {
      businessProfile.socialLinks = splitMaintenanceList(value);
      continue;
    }

    if (key === "primaryPhone") {
      businessProfile.primaryPhone = value;

      contacts = upsertByKey(contacts, "contactKey", "primary_phone", {
        contactKey: "primary_phone",
        key: "primary_phone",
        channel: "phone",
        label: "Phone",
        value,
        isPrimary: true,
        enabled: true,
        visiblePublic: true,
        visibleInAi: true,
        meta: {
          origin: "truth_maintenance_inline_edit",
          changedFrom: localS(change.from),
          note: localS(change.note),
          stagedAt: localS(change.stagedAt),
        },
      });
      continue;
    }

    if (key === "primaryEmail") {
      businessProfile.primaryEmail = value;

      contacts = upsertByKey(contacts, "contactKey", "primary_email", {
        contactKey: "primary_email",
        key: "primary_email",
        channel: "email",
        label: "Email",
        value,
        isPrimary: true,
        enabled: true,
        visiblePublic: true,
        visibleInAi: true,
        meta: {
          origin: "truth_maintenance_inline_edit",
          changedFrom: localS(change.from),
          note: localS(change.note),
          stagedAt: localS(change.stagedAt),
        },
      });
      continue;
    }

    if (key === "primaryAddress") {
      businessProfile.primaryAddress = value;

      locations = upsertByKey(locations, "locationKey", "primary", {
        locationKey: "primary",
        key: "primary",
        title: "Primary location",
        addressLine: value,
        isPrimary: true,
        enabled: true,
        sortOrder: 0,
        meta: {
          origin: "truth_maintenance_inline_edit",
          changedFrom: localS(change.from),
          note: localS(change.note),
          stagedAt: localS(change.stagedAt),
        },
      });
      continue;
    }

    if (key === "services") {
      services = buildMaintenanceServices(change, services);
      continue;
    }

    if (["pricingHints", "pricingPolicy", "pricingSummary"].includes(key)) {
      knowledgeItems = upsertByKey(
        knowledgeItems,
        "key",
        "pricingHints",
        buildMaintenanceKnowledgeItem(
          { ...change, key: "pricingHints", label: "Pricing" },
          "pricing"
        )
      );
      continue;
    }

    if (key === "hours") {
      knowledgeItems = upsertByKey(
        knowledgeItems,
        "key",
        "hours",
        buildMaintenanceKnowledgeItem(change, "hours")
      );
      continue;
    }

    if (key === "faqQuestions") {
      knowledgeItems = upsertByKey(
        knowledgeItems,
        "key",
        "faqQuestions",
        buildMaintenanceKnowledgeItem(change, "faq")
      );
      continue;
    }

    if (key === "products") {
      knowledgeItems = upsertByKey(
        knowledgeItems,
        "key",
        "products",
        buildMaintenanceKnowledgeItem(change, "offering")
      );
      continue;
    }

    knowledgeItems = upsertByKey(
      knowledgeItems,
      "key",
      key,
      buildMaintenanceKnowledgeItem(change, "business_record")
    );
  }

  return compactDraftObject({
    businessProfile,
    capabilities,
    contacts,
    locations,
    services,
    knowledgeItems,
    draftPayload: mergeDraftState(localObj(currentDraft.draftPayload), {
      stagedTruthMaintenance: {
        changes: localArr(changes),
        stagedAt: new Date().toISOString(),
        source: "truth_viewer_inline_edit",
      },
      stagedInputs: {
        truthMaintenance: {
          changes: localArr(changes),
        },
      },
    }),
  });
}

import {
  compactDraftObject,
  mergeDraftState,
} from "../../../services/workspace/setup/draftShared.js";
import { getOrCreateActiveSetupReviewSession } from "../../../db/helpers/tenantSetupReview.js";
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
) {  router.post("/truth/maintenance/stage", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      const changes = normalizeTruthMaintenanceChanges(req.body || {});
      if (!changes.length) {
        return res.status(400).json({
          ok: false,
          error: "TruthMaintenanceChangesInvalid",
          reason: "No valid truth maintenance changes were provided",
        });
      }

      const session = await getOrCreateActiveSetupReviewSession({
        tenantId: actor.tenantId,
        mode: "refresh",
        currentStep: "truth-maintenance",
        title: "Business record maintenance",
        notes: "Inline approved truth maintenance",
        metadata: {
          canonicalBaseline: null,
          origin: "truth_maintenance_inline_edit",
          truthMaintenance: true,
          maintenanceChanges: changes.map((item) => item.key),
        },
        ensureDraft: true,
      });

      const current = {
        session,
        draft: {},
      };

      const patch = buildTruthMaintenanceDraftPatch(changes, current.draft);

      const draft = await patchSetupReviewDraft({
        sessionId: current.session.id,
        tenantId: actor.tenantId,
        patch,
        bumpVersion: true,
      });

      const data = await loadCurrentReviewPayload({
        db,
        actor,
        eventLimit: 30,
      });

      await auditSetupAction(
        db,
        actor,
        "truth.maintenance.staged",
        "tenant_setup_review_session",
        current.session.id,
        {
          sessionId: current.session.id,
          draftVersion: Number(draft?.version || data?.review?.draft?.version || 0),
          changeCount: changes.length,
          fields: changes.map((item) => item.key),
        }
      );

      return res.json({
        ok: true,
        message: "Truth maintenance changes staged",
        staged: true,
        canonicalWriteDeferred: true,
        saved: {
          changeCount: changes.length,
          fields: changes.map((item) => item.key),
        },
        draft: data.review?.draft || draft || null,
        session: data.review?.session || current.session || null,
        sources: arr(data.review?.sources),
        events: arr(data.review?.events),
        setup: data.setup,
      });
    } catch (err) {
      return res.status(400).json({
        ok: false,
        error: "TruthMaintenanceStageFailed",
        reason: err?.message || "failed to stage truth maintenance changes",
      });
    }
  });

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
