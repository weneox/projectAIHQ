// src/routes/api/workspace/setup.js
// FINAL v3.2 — workspace setup routes with unified source + manual analyze
// fixes:
// - keep source import flow as-is
// - add manual/voice-ready unified analyze endpoint
// - allow setup to work without any source
// - keep finalize path unchanged: review draft -> canonical truth

import express from "express";
import { buildSetupStatus } from "../../../services/workspace/setup.js";
import {
  importWebsiteSource,
  importGoogleMapsSource,
  importSourceBundle,
  importSource,
} from "../../../services/workspace/import.js";
import {
  sanitizeSetupBusinessProfile,
  sanitizeSetupReviewDraft,
} from "../../../services/workspace/import/draft.js";
import {
  createSetupService,
  deleteSetupService,
  listSetupServices,
  updateSetupService,
} from "../../../services/workspace/services.js";
import { runSetupIntakeAnalyze } from "../../../services/workspace/intakeAnalyze.js";
import { pickWorkspaceActor } from "./shared.js";
import {
  discardSetupReviewSession,
  finalizeSetupReviewSession,
  getOrCreateActiveSetupReviewSession,
  getCurrentSetupReview,
  patchSetupReviewDraft,
  listSetupReviewEvents,
} from "../../../db/helpers/tenantSetupReview.js";
import { createTenantKnowledgeHelpers } from "../../../db/helpers/tenantKnowledge.js";
import {
  buildCanonicalTruthProfile,
  buildCanonicalTruthFieldProvenance,
  buildTruthVersionHistoryEntry,
  createTenantTruthVersionHelpers,
} from "../../../db/helpers/tenantTruthVersions.js";
import { dbAudit } from "../../../db/helpers/audit.js";
import {
  normalizeBusinessProfileInput,
  normalizeRuntimePreferencesInput,
  buildSavedBusinessPayload,
  buildSavedRuntimePayload,
} from "../../../services/workspace/mutations/normalize.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function isUuid(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s(value)
  );
}

function safeUuidOrNull(value = "") {
  const x = s(value);
  return isUuid(x) ? x : null;
}

function compactObject(input = {}) {
  const out = {};

  for (const [key, raw] of Object.entries(obj(input))) {
    if (raw == null) continue;

    if (Array.isArray(raw)) {
      if (raw.length) out[key] = raw;
      continue;
    }

    if (raw && typeof raw === "object") {
      const nested = compactObject(raw);
      if (Object.keys(nested).length) out[key] = nested;
      continue;
    }

    if (typeof raw === "string") {
      const text = s(raw);
      if (text) out[key] = text;
      continue;
    }

    out[key] = raw;
  }

  return out;
}

function mergeDeep(...items) {
  const out = {};

  for (const item of items) {
    const source = obj(item);

    for (const [key, raw] of Object.entries(source)) {
      if (raw === undefined || raw === null) continue;

      if (Array.isArray(raw)) {
        out[key] = JSON.parse(JSON.stringify(raw));
        continue;
      }

      if (
        raw &&
        typeof raw === "object" &&
        !Array.isArray(raw) &&
        out[key] &&
        typeof out[key] === "object" &&
        !Array.isArray(out[key])
      ) {
        out[key] = mergeDeep(out[key], raw);
        continue;
      }

      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        out[key] = mergeDeep(raw);
        continue;
      }

      if (typeof raw === "string") {
        const text = s(raw);
        if (!text) continue;
        out[key] = text;
        continue;
      }

      out[key] = raw;
    }
  }

  return out;
}

function slugify(value = "") {
  const out = s(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

  return out || "service";
}

function normalizeSetupServiceDraftInput(input = {}, fallbackId = "") {
  const body = obj(input);
  const title = s(body.title || body.name);
  if (!title) {
    throw new Error("Service title is required");
  }

  const key = s(
    body.key ||
      body.serviceKey ||
      body.service_key ||
      slugify(title)
  );

  return compactObject({
    id: s(body.id || fallbackId || `draft_${key}`),
    key,
    serviceKey: key,
    title,
    description: s(body.description || body.summary),
    category: s(body.category || "general").toLowerCase() || "general",
    priceFrom:
      body.priceFrom ?? body.price_from ?? body.startingPrice ?? body.starting_price,
    currency: s(body.currency || "AZN").toUpperCase() || "AZN",
    pricingModel:
      s(body.pricingModel || body.pricing_model || "custom_quote").toLowerCase() ||
      "custom_quote",
    durationMinutes: body.durationMinutes ?? body.duration_minutes,
    isActive:
      typeof body.isActive === "boolean"
        ? body.isActive
        : typeof body.is_active === "boolean"
          ? body.is_active
          : true,
    sortOrder: Number(body.sortOrder ?? body.sort_order ?? 0) || 0,
    highlights: arr(body.highlights),
    metadataJson: mergeDeep(obj(body.metadataJson), {
      stagedInSetupReview: true,
    }),
  });
}

function findDraftServiceIndex(items = [], idOrKey = "") {
  const needle = s(idOrKey).toLowerCase();
  if (!needle) return -1;

  return arr(items).findIndex((item) => {
    const id = s(item?.id).toLowerCase();
    const key = s(item?.key || item?.serviceKey || item?.service_key).toLowerCase();
    return id === needle || key === needle;
  });
}

async function listSetupServicesFromDraftOrCanonical({ db, actor }) {
  const current = await getCurrentSetupReview(actor.tenantId);
  const draftServices = arr(current?.draft?.services);

  if (current?.session?.id) {
    return {
      items: draftServices,
      services: draftServices,
      source: "setup_review_draft",
      staged: true,
      canonicalWriteDeferred: true,
    };
  }

  const data = await listSetupServices({
    db,
    tenantId: actor.tenantId,
    tenantKey: actor.tenantKey,
    role: actor.role,
    tenant: actor.tenant,
  });

  return {
    ...data,
    source: "canonical_read_only",
    staged: false,
    canonicalWriteDeferred: false,
  };
}

async function stageSetupServiceMutation({
  db,
  actor,
  mode,
  serviceId = "",
  body = {},
}) {
  const current = await getOrCreateSetupDraftSession(actor);
  const draftServices = arr(current?.draft?.services);
  const index = findDraftServiceIndex(draftServices, serviceId);
  const nextServices = [...draftServices];

  if (mode === "create") {
    nextServices.push(normalizeSetupServiceDraftInput(body));
  } else if (mode === "update") {
    if (index < 0) throw new Error("service not found in setup review draft");
    nextServices[index] = normalizeSetupServiceDraftInput(
      mergeDeep(nextServices[index], body),
      s(nextServices[index]?.id || serviceId)
    );
  } else if (mode === "delete") {
    if (index < 0) throw new Error("service not found in setup review draft");
    nextServices.splice(index, 1);
  } else {
    throw new Error("unsupported staged service mutation");
  }

  await patchSetupReviewDraft({
    sessionId: current.session.id,
    tenantId: actor.tenantId,
    patch: {
      services: nextServices,
      draftPayload: mergeDeep(obj(current?.draft?.draftPayload), {
        stagedInputs: {
          services: {
            updatedAt: new Date().toISOString(),
            count: nextServices.length,
          },
        },
      }),
    },
    bumpVersion: true,
  });

  return loadCurrentReviewPayload({
    db,
    actor,
    eventLimit: 30,
  });
}

async function getOrCreateSetupDraftSession(actor) {
  const current = await getCurrentSetupReview(actor.tenantId);
  if (current?.session?.id) {
    return current;
  }

  const startedBy =
    safeUuidOrNull(actor?.user?.id) ||
    safeUuidOrNull(actor?.user?.userId) ||
    safeUuidOrNull(actor?.user?.user_id) ||
    null;

  await getOrCreateActiveSetupReviewSession({
    tenantId: actor.tenantId,
    mode: "setup",
    currentStep: "review",
    startedBy,
    title: "Setup review",
    notes: "",
    metadata: {
      setupDraftOnly: true,
      setupCanonicalWriteWall: true,
    },
    ensureDraft: true,
  });

  return getCurrentSetupReview(actor.tenantId);
}

function buildBusinessProfileDraftPatch(body = {}, currentDraft = {}) {
  const { normalized, provided, providedKeys } = normalizeBusinessProfileInput(body);
  if (!providedKeys.length) {
    throw new Error("No business profile fields were provided");
  }

  const existingProfile = obj(currentDraft.businessProfile);
  const existingCapabilities = obj(currentDraft.capabilities);

  const nextBusinessProfile = { ...existingProfile };
  const nextCapabilities = { ...existingCapabilities };

  if (provided.companyName) nextBusinessProfile.companyName = normalized.companyName;
  if (provided.description) nextBusinessProfile.description = normalized.description;
  if (provided.timezone) nextBusinessProfile.timezone = normalized.timezone;
  if (provided.languages) {
    nextBusinessProfile.languages = arr(normalized.languages);
    nextCapabilities.supportedLanguages = arr(normalized.languages);
    nextCapabilities.primaryLanguage = s(normalized.languages?.[0]);
    nextCapabilities.supportsMultilanguage = arr(normalized.languages).length > 1;
  }
  if (provided.tone) {
    nextBusinessProfile.tone = normalized.tone;
    nextCapabilities.toneProfile = normalized.tone;
  }

  return {
    saved: buildSavedBusinessPayload(normalized, {
      companyName: s(nextBusinessProfile.companyName),
      timezone: s(nextBusinessProfile.timezone),
      enabledLanguages: arr(nextBusinessProfile.languages),
    }),
    patch: {
      businessProfile: compactObject(nextBusinessProfile),
      capabilities: compactObject(nextCapabilities),
      draftPayload: mergeDeep(obj(currentDraft.draftPayload), {
        stagedInputs: {
          businessProfile: compactObject({
            companyName: provided.companyName ? normalized.companyName : undefined,
            description: provided.description ? normalized.description : undefined,
            timezone: provided.timezone ? normalized.timezone : undefined,
            languages: provided.languages ? arr(normalized.languages) : undefined,
            tone: provided.tone ? normalized.tone : undefined,
          }),
        },
      }),
    },
  };
}

function buildRuntimePreferencesDraftPatch(body = {}, currentDraft = {}) {
  const { normalized, provided, providedKeys } = normalizeRuntimePreferencesInput(body);
  if (!providedKeys.length) {
    throw new Error("No runtime preference fields were provided");
  }

  const existingProfile = obj(currentDraft.businessProfile);
  const existingCapabilities = obj(currentDraft.capabilities);
  const existingPayload = obj(currentDraft.draftPayload);

  const nextBusinessProfile = { ...existingProfile };
  const nextCapabilities = { ...existingCapabilities };

  if (provided.defaultLanguage) {
    nextCapabilities.primaryLanguage = normalized.defaultLanguage;
    nextBusinessProfile.defaultLanguage = normalized.defaultLanguage;
  }
  if (provided.languages) {
    nextCapabilities.supportedLanguages = arr(normalized.languages);
    nextCapabilities.supportsMultilanguage = arr(normalized.languages).length > 1;
    nextBusinessProfile.languages = arr(normalized.languages);
  }
  if (provided.tone) {
    nextBusinessProfile.tone = normalized.tone;
    nextCapabilities.toneProfile = normalized.tone;
  }
  if (provided.replyStyle) nextCapabilities.replyStyle = normalized.replyStyle;
  if (provided.replyLength) nextCapabilities.replyLength = normalized.replyLength;
  if (provided.emojiLevel) nextCapabilities.emojiLevel = normalized.emojiLevel;
  if (provided.ctaStyle) nextCapabilities.ctaStyle = normalized.ctaStyle;

  return {
    saved: buildSavedRuntimePayload(normalized, {
      defaultLanguage: s(nextCapabilities.primaryLanguage),
      enabledLanguages: arr(nextCapabilities.supportedLanguages),
    }),
    patch: {
      businessProfile: compactObject(nextBusinessProfile),
      capabilities: compactObject(nextCapabilities),
      draftPayload: mergeDeep(existingPayload, {
        stagedInputs: {
          runtimePreferences: compactObject({
            defaultLanguage:
              provided.defaultLanguage ? normalized.defaultLanguage : undefined,
            languages: provided.languages ? arr(normalized.languages) : undefined,
            tone: provided.tone ? normalized.tone : undefined,
            autoReplyEnabled:
              provided.autoReplyEnabled ? normalized.autoReplyEnabled : undefined,
            humanApprovalRequired:
              provided.humanApprovalRequired
                ? normalized.humanApprovalRequired
                : undefined,
            inboxApprovalMode:
              provided.inboxApprovalMode ? normalized.inboxApprovalMode : undefined,
            commentApprovalMode:
              provided.commentApprovalMode ? normalized.commentApprovalMode : undefined,
            replyStyle: provided.replyStyle ? normalized.replyStyle : undefined,
            replyLength: provided.replyLength ? normalized.replyLength : undefined,
            emojiLevel: provided.emojiLevel ? normalized.emojiLevel : undefined,
            ctaStyle: provided.ctaStyle ? normalized.ctaStyle : undefined,
            policies: provided.policies ? obj(normalized.policies) : undefined,
          }),
        },
      }),
    },
  };
}

function normalizeBundleSources({ session = {}, draft = {}, sources = [] } = {}) {
  const summary = obj(draft?.sourceSummary);
  const imports = arr(summary.imports);
  const linkedSources = arr(sources);
  const sourceMap = new Map();

  for (const item of linkedSources) {
    const sourceId = s(item.sourceId || item.id);
    const key = sourceId || `${lower(item.sourceType)}|${lower(item.label)}`;
    sourceMap.set(key, {
      sourceId,
      sourceType: s(item.sourceType),
      role: s(item.role || "context"),
      label: s(item.label),
      attachedAt: item.attachedAt || null,
      metadata: obj(item.metadata),
    });
  }

  for (const item of imports) {
    const key =
      s(item.sourceId) || `${lower(item.sourceType)}|${lower(item.sourceUrl)}`;
    const current = obj(sourceMap.get(key));
    sourceMap.set(key, compactObject({
      ...current,
      sourceId: s(item.sourceId || current.sourceId),
      sourceType: s(item.sourceType || current.sourceType),
      role:
        s(session?.primarySourceId) && s(session.primarySourceId) === s(item.sourceId)
          ? "primary"
          : s(current.role || "supporting"),
      label: s(item.sourceLabel || current.label),
      sourceUrl: s(item.sourceUrl),
      sourceAuthorityClass: s(item.sourceAuthorityClass),
      runId: item.runId || null,
      lastSnapshotId: item.lastSnapshotId || null,
      mode: s(item.mode),
      stage: s(item.stage),
      warningCount: Number(item.warningCount || 0),
      candidateCount: Number(item.candidateCount || 0),
      observationCount: Number(item.observationCount || 0),
      attachedAt: current.attachedAt || null,
      metadata: current.metadata,
    }));
  }

  const out = [...sourceMap.values()];
  out.sort((a, b) => {
    const aPrimary = a.role === "primary" ? 1 : 0;
    const bPrimary = b.role === "primary" ? 1 : 0;
    return bPrimary - aPrimary;
  });
  return out;
}

function normalizeContributionSummary(draft = {}) {
  const sourceContributions = obj(obj(draft?.draftPayload).sourceContributions);

  return Object.entries(sourceContributions).map(([key, value]) => {
    const contribution = obj(value);
    const summary = obj(contribution.sourceSummary);
    const latestImport = obj(summary.latestImport);
    const profile = obj(contribution.businessProfile);

    return compactObject({
      key,
      sourceType: s(latestImport.sourceType || summary.primarySourceType),
      sourceUrl: s(latestImport.sourceUrl || summary.primarySourceUrl),
      sourceLabel: s(latestImport.sourceLabel),
      sourceAuthorityClass: s(latestImport.sourceAuthorityClass),
      companyName: s(profile.companyName || profile.displayName),
      fields: Object.keys(profile).filter((field) => field !== "fieldSources"),
      serviceCount: arr(contribution.services).length,
      knowledgeCount: arr(contribution.knowledgeItems).length,
      warningCount: arr(contribution.warnings).length,
      latestRunId: latestImport.runId || null,
      lastSnapshotId: latestImport.lastSnapshotId || null,
    });
  });
}

function normalizeFieldProvenance(draft = {}) {
  const fieldSources = obj(obj(draft?.businessProfile).fieldSources);
  const importantFields = [
    "companyName",
    "displayName",
    "websiteUrl",
    "primaryPhone",
    "primaryEmail",
    "primaryAddress",
    "companySummaryShort",
    "companySummaryLong",
    "mainLanguage",
  ];

  return Object.fromEntries(
    importantFields
      .filter((field) => obj(fieldSources[field]).sourceType || obj(fieldSources[field]).sourceUrl)
      .map((field) => [
        field,
        compactObject({
          sourceType: s(fieldSources[field].sourceType),
          sourceUrl: s(fieldSources[field].sourceUrl),
          authorityRank: Number(fieldSources[field].authorityRank || 0),
        }),
      ])
  );
}

function normalizeReviewDraftSummary(draft = {}) {
  return {
    completeness: obj(draft?.completeness),
    confidence: obj(draft?.confidenceSummary),
    warningCount: arr(draft?.warnings).length,
    warnings: arr(draft?.warnings),
    serviceCount: arr(draft?.services).length,
    knowledgeCount: arr(draft?.knowledgeItems).length,
    hasBusinessProfile: Object.keys(compactObject(draft?.businessProfile)).filter((x) => x !== "fieldSources").length > 0,
  };
}

function buildFrontendReviewShape({ session = null, draft = null, sources = [], events = [] } = {}) {
  const safeDraft = draft ? sanitizeSetupReviewDraft(draft) : draft || null;
  return {
    session: session || null,
    draft: safeDraft || null,
    sources: arr(sources),
    events: arr(events),
    bundleSources: normalizeBundleSources({ session, draft: safeDraft, sources }),
    contributionSummary: normalizeContributionSummary(safeDraft),
    fieldProvenance: normalizeFieldProvenance(safeDraft),
    reviewDraftSummary: normalizeReviewDraftSummary(safeDraft),
  };
}

function requireSetupActor(req, res) {
  const actor = pickWorkspaceActor(req);
  const { user, tenantId, tenantKey } = actor || {};

  if (!user) {
    res.status(401).json({
      ok: false,
      error: "Unauthorized",
      reason: "authenticated user is required",
    });
    return null;
  }

  if (!tenantId && !tenantKey) {
    res.status(400).json({
      ok: false,
      error: "TenantRequired",
      reason: "tenant context is required",
    });
    return null;
  }

  return actor;
}

function getSetupAuditActor(actor = {}) {
  return (
    s(actor?.user?.email) ||
    s(actor?.user?.name) ||
    s(actor?.user?.full_name) ||
    s(actor?.user?.fullName) ||
    s(actor?.user?.id) ||
    "system"
  );
}

async function auditSetupAction(db, actor, action, objectType, objectId, meta = {}) {
  try {
    await dbAudit(db, getSetupAuditActor(actor), action, objectType, objectId, {
      tenantId: actor?.tenantId || actor?.tenant?.id || null,
      tenantKey: actor?.tenantKey || actor?.tenant?.tenant_key || null,
      role: s(actor?.role || actor?.user?.role || "member"),
      ...compactObject(meta),
    });
  } catch {}
}

async function handleSetupStatus(req, res, db, errorCode = "SetupStatusFailed") {
  const actor = requireSetupActor(req, res);
  if (!actor) return;

  const { tenant, tenantId, tenantKey, role } = actor;

  try {
    const data = await buildSetupStatus({
      db,
      tenantId,
      tenantKey,
      role,
      tenant,
    });

    return res.json({
      ok: true,
      ...data,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: errorCode,
      reason: err?.message || "failed to load setup status",
    });
  }
}

function normalizeIncomingSourceType(value = "") {
  const x = lower(value);

  if (x === "website" || x === "site" || x === "web") return "website";
  if (
    x === "google_maps" ||
    x === "google-maps" ||
    x === "google maps" ||
    x === "maps" ||
    x === "gmaps"
  ) {
    return "google_maps";
  }

  return "";
}

function resolveSourceUrlFromBody(body = {}) {
  return s(
    body?.url ||
      body?.sourceUrl ||
      body?.source_url ||
      body?.link ||
      body?.value
  );
}

function resolveInstagramBundleUrl(body = {}) {
  return s(
    body?.instagramUrl ||
      body?.instagram_url ||
      body?.connectedInstagramUrl ||
      body?.connected_instagram_url
  );
}

function buildImportResponse({
  data,
  successMessage,
  acceptedMessage,
  partialMessage,
  errorCode,
  errorMessage,
}) {
  const mode = lower(data?.mode || (data?.ok === false ? "error" : "success"));
  const isError = data?.ok === false || mode === "error";
  const isPartial = mode === "partial";
  const isAccepted =
    data?.accepted === true ||
    mode === "accepted" ||
    mode === "queued" ||
    mode === "running";

  if (isError) {
    return {
      status: 422,
      body: {
        ok: false,
        error: errorCode,
        reason: data?.error || errorMessage,
        ...data,
      },
    };
  }

  if (isAccepted) {
    return {
      status: 202,
      body: {
        ok: true,
        accepted: true,
        partial: false,
        message: acceptedMessage || successMessage,
        ...data,
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      partial: isPartial,
      message: isPartial ? partialMessage : successMessage,
      ...data,
    },
  };
}

function buildImportArgs({ actor, body = {}, requestId = "" }) {
  const { user, tenant, tenantId, tenantKey, role } = actor || {};

  const userId =
    safeUuidOrNull(user?.id) ||
    safeUuidOrNull(user?.userId) ||
    safeUuidOrNull(user?.user_id) ||
    null;

  const userEmail = s(user?.email);
  const userName =
    s(user?.name) ||
    s(user?.full_name) ||
    s(user?.fullName) ||
    s(user?.display_name) ||
    s(user?.displayName);

  return {
    tenant,
    tenantId,
    tenantKey,
    role,
    requestedBy: userId || userEmail || userName || "system",
    requestedByUserId: userId,
    requestedByEmail: userEmail,
    requestedByName: userName,
    note: s(body?.note),
    requestId: s(requestId),
    sources: arr(body?.sources),
    primarySource: body?.primarySource || body?.primary_source || null,
    metadataJson: obj(body?.metadataJson || body?.metadata_json),
  };
}

async function enrichImportDataWithReview({ db, actor, data }) {
  const sanitizedData = data?.draft
    ? {
        ...data,
        draft: sanitizeSetupReviewDraft(data.draft),
        profile: sanitizeSetupBusinessProfile(
          obj(data.profile || data.draft?.businessProfile)
        ),
      }
    : data;

  if (!s(sanitizedData?.reviewSessionId) && !sanitizedData?.draft) return sanitizedData;

  try {
    const review = await getCurrentSetupReview(actor.tenantId);
    const events = s(review?.session?.id)
      ? await listSetupReviewEvents({
          sessionId: review.session.id,
          limit: 20,
        })
      : [];

    return {
      ...sanitizedData,
      review: buildFrontendReviewShape({
        session: review?.session || null,
        draft: review?.draft || null,
        sources: arr(review?.sources),
        events,
      }),
    };
  } catch (err) {
    return {
      ...sanitizedData,
      reviewError: err?.message || "failed to load current review",
    };
  }
}

function normalizeReviewPatchBody(body = {}) {
  const patch = obj(body?.patch) || obj(body);

  const businessProfile =
    patch.businessProfile !== undefined
      ? obj(patch.businessProfile)
      : patch.business_profile !== undefined
        ? obj(patch.business_profile)
        : undefined;

  const capabilities =
    patch.capabilities !== undefined
      ? obj(patch.capabilities)
      : patch.capabilities_json !== undefined
        ? obj(patch.capabilities_json)
        : undefined;

  const services =
    patch.services !== undefined
      ? arr(patch.services)
      : patch.serviceItems !== undefined
        ? arr(patch.serviceItems)
        : undefined;

  const knowledgeItems =
    patch.knowledgeItems !== undefined
      ? arr(patch.knowledgeItems)
      : patch.knowledge_items !== undefined
        ? arr(patch.knowledge_items)
        : undefined;

  const channels =
    patch.channels !== undefined ? arr(patch.channels) : undefined;

  const sourceSummary =
    patch.sourceSummary !== undefined
      ? obj(patch.sourceSummary)
      : patch.source_summary !== undefined
        ? obj(patch.source_summary)
        : undefined;

  const warnings =
    patch.warnings !== undefined ? arr(patch.warnings) : undefined;

  const completeness =
    patch.completeness !== undefined ? obj(patch.completeness) : undefined;

  const confidenceSummary =
    patch.confidenceSummary !== undefined
      ? obj(patch.confidenceSummary)
      : patch.confidence_summary !== undefined
        ? obj(patch.confidence_summary)
        : undefined;

  const diffFromCanonical =
    patch.diffFromCanonical !== undefined
      ? obj(patch.diffFromCanonical)
      : patch.diff_from_canonical !== undefined
        ? obj(patch.diff_from_canonical)
        : undefined;

  const draftPayload =
    patch.draftPayload !== undefined
      ? obj(patch.draftPayload)
      : patch.draft_payload !== undefined
        ? obj(patch.draft_payload)
        : undefined;

  const lastSnapshotId =
    patch.lastSnapshotId !== undefined
      ? patch.lastSnapshotId || null
      : patch.last_snapshot_id !== undefined
        ? patch.last_snapshot_id || null
        : undefined;

  const out = {};

  if (draftPayload !== undefined) out.draftPayload = draftPayload;
  if (businessProfile !== undefined) out.businessProfile = businessProfile;
  if (capabilities !== undefined) out.capabilities = capabilities;
  if (services !== undefined) out.services = services;
  if (knowledgeItems !== undefined) out.knowledgeItems = knowledgeItems;
  if (channels !== undefined) out.channels = channels;
  if (sourceSummary !== undefined) out.sourceSummary = sourceSummary;
  if (warnings !== undefined) out.warnings = warnings;
  if (completeness !== undefined) out.completeness = completeness;
  if (confidenceSummary !== undefined) out.confidenceSummary = confidenceSummary;
  if (diffFromCanonical !== undefined) out.diffFromCanonical = diffFromCanonical;
  if (lastSnapshotId !== undefined) out.lastSnapshotId = lastSnapshotId;

  return out;
}

function extractPrimarySourceInfo(session = {}, draft = {}, sources = []) {
  const summary = obj(draft?.sourceSummary);
  const latestImport = obj(summary.latestImport);

  const primarySourceId =
    session?.primarySourceId ||
    summary.primarySourceId ||
    latestImport.sourceId ||
    null;

  const primarySourceType =
    s(session?.primarySourceType) ||
    s(summary.primarySourceType) ||
    s(latestImport.sourceType);

  const latestRunId =
    summary.latestRunId ||
    latestImport.runId ||
    draft?.draftPayload?.latestImport?.runId ||
    null;

  const sourceUrl =
    s(summary.primarySourceUrl) ||
    s(latestImport.sourceUrl) ||
    s(draft?.draftPayload?.sourceUrl);

  return {
    primarySourceId,
    primarySourceType,
    latestRunId,
    sourceUrl,
    sources: arr(sources),
  };
}

function extractServiceRows(data = {}) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.services)) return data.services;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function normalizeServiceForProjection(item = {}) {
  const x = obj(item);

  const key = s(
    x.key ||
      x.serviceKey ||
      x.service_key ||
      x.slug
  );

  const title = s(
    x.title ||
      x.name ||
      x.label
  );

  const description = s(
    x.description ||
      x.summary ||
      x.valueText ||
      x.value_text
  );

  const category = s(
    x.category ||
      x.type ||
      x.group ||
      "service"
  );

  if (!title && !key) return null;

  return {
    key,
    title: title || key,
    description,
    category,
    valueJson: obj(x.valueJson || x.value_json),
    normalizedJson: obj(x.normalizedJson || x.normalized_json),
    metadataJson: mergeDeep(
      obj(x.metadataJson || x.metadata_json),
      {
        origin: s(x.origin || "setup_review_session"),
        confidence:
          typeof x.confidence === "number"
            ? x.confidence
            : Number(x.confidence || 0) || 0,
        confidenceLabel: s(x.confidenceLabel || x.confidence_label),
        reviewReason: s(x.reviewReason || x.review_reason),
        sourceId: s(x.sourceId || x.source_id),
        sourceRunId: s(x.sourceRunId || x.source_run_id),
        sourceType: s(x.sourceType || x.source_type),
      }
    ),
  };
}

function normalizeKnowledgeForProjection(item = {}) {
  const x = obj(item);

  const title = s(
    x.title ||
      x.label ||
      x.itemKey ||
      x.item_key ||
      x.key
  );

  if (!title) return null;

  return {
    key: s(x.key || x.itemKey || x.item_key),
    category: s(x.category || x.group || "general"),
    title,
    valueText: s(x.valueText || x.value_text),
    valueJson: obj(x.valueJson || x.value_json),
    normalizedText: s(x.normalizedText || x.normalized_text),
    normalizedJson: obj(x.normalizedJson || x.normalized_json),
    confidence:
      typeof x.confidence === "number"
        ? x.confidence
        : Number(x.confidence || 0) || 0,
    confidenceLabel: s(x.confidenceLabel || x.confidence_label),
    status: s(x.status || "approved"),
    reviewReason: s(x.reviewReason || x.review_reason),
    sourceId: s(x.sourceId || x.source_id),
    sourceRunId: s(x.sourceRunId || x.source_run_id),
    sourceType: s(x.sourceType || x.source_type),
    metadataJson: mergeDeep(
      obj(x.metadataJson || x.metadata_json),
      {
        origin: s(x.origin || "setup_review_session"),
      }
    ),
  };
}

function buildBusinessProfileProjection(draft = {}, sourceInfo = {}) {
  const profile = compactObject(draft?.businessProfile);

  if (s(sourceInfo.sourceUrl)) {
    if (lower(sourceInfo.primarySourceType) === "website") {
      profile.websiteUrl = s(profile.websiteUrl || sourceInfo.sourceUrl);
    }
    if (lower(sourceInfo.primarySourceType) === "google_maps") {
      profile.googleMapsSeedUrl = s(
        profile.googleMapsSeedUrl || sourceInfo.sourceUrl
      );
    }
  }

  return profile;
}

function buildCapabilitiesProjection(draft = {}) {
  return compactObject(draft?.capabilities);
}

async function projectDraftServicesToCanonical({
  db,
  actor,
  draft,
  sourceInfo,
}) {
  const services = arr(draft?.services)
    .map((item) => normalizeServiceForProjection(item))
    .filter(Boolean);

  if (!services.length) {
    return {
      created: 0,
      updated: 0,
      skipped: 0,
      total: 0,
    };
  }

  const existingData = await listSetupServices({
    db,
    tenantId: actor.tenantId,
    tenantKey: actor.tenantKey,
    role: actor.role,
    tenant: actor.tenant,
  });

  const existingServices = extractServiceRows(existingData);

  const findMatch = (service) => {
    const serviceKey = lower(service.key);
    const serviceTitle = lower(service.title);

    return existingServices.find((row) => {
      const rowKey = lower(
        row?.key ||
          row?.serviceKey ||
          row?.service_key ||
          row?.slug
      );

      const rowTitle = lower(
        row?.title ||
          row?.name ||
          row?.label
      );

      if (serviceKey && rowKey && serviceKey === rowKey) return true;
      if (serviceTitle && rowTitle && serviceTitle === rowTitle) return true;
      return false;
    });
  };

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const service of services) {
    const body = {
      key: service.key,
      serviceKey: service.key,
      service_key: service.key,
      title: service.title,
      name: service.title,
      description: service.description,
      category: service.category,
      metadataJson: mergeDeep(service.metadataJson, {
        reviewSessionProjection: true,
        sourceId: sourceInfo.primarySourceId || null,
        sourceRunId: sourceInfo.latestRunId || null,
        sourceType: sourceInfo.primarySourceType || "",
      }),
    };

    const match = findMatch(service);

    if (match?.id) {
      await updateSetupService({
        db,
        tenantId: actor.tenantId,
        tenantKey: actor.tenantKey,
        role: actor.role,
        tenant: actor.tenant,
        serviceId: match.id,
        body,
      });
      updated += 1;
      continue;
    }

    try {
      await createSetupService({
        db,
        tenantId: actor.tenantId,
        tenantKey: actor.tenantKey,
        role: actor.role,
        tenant: actor.tenant,
        body,
      });
      created += 1;
    } catch {
      skipped += 1;
    }
  }

  return {
    created,
    updated,
    skipped,
    total: services.length,
  };
}

async function projectDraftKnowledgeToCanonical({
  db,
  actor,
  draft,
  session,
  sourceInfo,
}) {
  const items = arr(draft?.knowledgeItems)
    .map((item) => normalizeKnowledgeForProjection(item))
    .filter(Boolean);

  if (!items.length) {
    return {
      projected: 0,
      skipped: 0,
      total: 0,
      method: "",
    };
  }

  const knowledgeHelper = createTenantKnowledgeHelpers({ db });

  const payload = items.map((item) => ({
    tenantId: actor.tenantId,
    tenantKey: actor.tenantKey,
    reviewSessionId: s(session?.id),
    sourceId: s(item.sourceId || sourceInfo.primarySourceId),
    sourceRunId: s(item.sourceRunId || sourceInfo.latestRunId),
    sourceType: s(item.sourceType || sourceInfo.primarySourceType),
    itemKey: s(item.key),
    key: s(item.key),
    category: s(item.category),
    title: s(item.title),
    valueText: s(item.valueText),
    valueJson: obj(item.valueJson),
    normalizedText: s(item.normalizedText),
    normalizedJson: obj(item.normalizedJson),
    confidence: item.confidence,
    confidenceLabel: s(item.confidenceLabel),
    status: s(item.status || "approved"),
    reviewReason: s(item.reviewReason),
    metadataJson: mergeDeep(obj(item.metadataJson), {
      reviewSessionProjection: true,
    }),
  }));

  const bulkMethods = [
    "upsertKnowledgeItemsBulk",
    "upsertKnowledgeItems",
    "createKnowledgeItemsBulk",
    "mergeKnowledgeItems",
  ];

  for (const method of bulkMethods) {
    if (typeof knowledgeHelper[method] === "function") {
      await knowledgeHelper[method](payload);
      return {
        projected: payload.length,
        skipped: 0,
        total: payload.length,
        method,
      };
    }
  }

  const singleMethods = [
    "upsertKnowledgeItem",
    "createKnowledgeItem",
    "saveKnowledgeItem",
  ];

  for (const method of singleMethods) {
    if (typeof knowledgeHelper[method] === "function") {
      let projected = 0;
      let skipped = 0;

      for (const item of payload) {
        try {
          await knowledgeHelper[method](item);
          projected += 1;
        } catch {
          skipped += 1;
        }
      }

      return {
        projected,
        skipped,
        total: payload.length,
        method,
      };
    }
  }

  return {
    projected: 0,
    skipped: payload.length,
    total: payload.length,
    method: "",
  };
}

async function projectSetupReviewDraftToCanonical(
  {
    db,
    actor,
    session,
    draft,
    sources,
  },
  deps = {},
) {
  const knowledgeHelper = deps.knowledgeHelper || createTenantKnowledgeHelpers({ db });
  const truthVersionHelper =
    deps.truthVersionHelper || createTenantTruthVersionHelpers({ db });
  const sourceInfo = extractPrimarySourceInfo(session, draft, sources);
  const currentProfile =
    typeof knowledgeHelper.getBusinessProfile === "function"
      ? await knowledgeHelper.getBusinessProfile({
          tenantId: actor.tenantId,
          tenantKey: actor.tenantKey,
        })
      : null;
  const currentCapabilities =
    typeof knowledgeHelper.getBusinessCapabilities === "function"
      ? await knowledgeHelper.getBusinessCapabilities({
          tenantId: actor.tenantId,
          tenantKey: actor.tenantKey,
        })
      : null;

  const businessProfile = buildBusinessProfileProjection(draft, sourceInfo);
  const capabilities = buildCapabilitiesProjection(draft);

  let projectedProfile = false;
  let projectedCapabilities = false;
  let savedProfile = currentProfile;
  let savedCapabilities = currentCapabilities;
  let truthVersion = null;

  if (
    Object.keys(businessProfile).length &&
    typeof knowledgeHelper.upsertBusinessProfile === "function"
  ) {
    const approvedAt = new Date().toISOString();
    const approvedBy =
      s(actor?.user?.name) ||
      s(actor?.user?.full_name) ||
      s(actor?.user?.fullName) ||
      s(actor?.user?.email) ||
      s(actor?.user?.id) ||
      "system";

    savedProfile = await knowledgeHelper.upsertBusinessProfile({
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      reviewSessionId: s(session?.id),
      sourceId: sourceInfo.primarySourceId || null,
      sourceRunId: sourceInfo.latestRunId || null,
      profileStatus: "approved",
      profileJson: businessProfile,
      businessProfile,
      profile: businessProfile,
      sourceSummaryJson: buildCanonicalProfileSourceSummary({
        session,
        draft,
        sources,
        sourceInfo,
        approvedAt,
      }),
      metadataJson: {
        reviewSessionProjection: true,
        reviewSessionId: s(session?.id),
        draftVersion: toFiniteNumber(draft?.version, 0) || undefined,
      },
      generatedBy: approvedBy,
      approvedBy,
      approvedAt,
    });
    projectedProfile = true;
  }

  if (
    Object.keys(capabilities).length &&
    typeof knowledgeHelper.upsertBusinessCapabilities === "function"
  ) {
    const approvedBy =
      s(actor?.user?.name) ||
      s(actor?.user?.full_name) ||
      s(actor?.user?.fullName) ||
      s(actor?.user?.email) ||
      s(actor?.user?.id) ||
      "system";

    savedCapabilities = await knowledgeHelper.upsertBusinessCapabilities({
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      reviewSessionId: s(session?.id),
      sourceId: sourceInfo.primarySourceId || null,
      sourceRunId: sourceInfo.latestRunId || null,
      capabilitiesJson: capabilities,
      capabilities,
      signals: capabilities,
      metadataJson: {
        reviewSessionProjection: true,
        reviewSessionId: s(session?.id),
      },
      approvedBy,
    });
    projectedCapabilities = true;
  }

  if (typeof truthVersionHelper.createVersion === "function") {
    const approvedAt =
      s(savedProfile?.approved_at) ||
      s(currentProfile?.approved_at) ||
      new Date().toISOString();
    const approvedBy =
      s(savedProfile?.approved_by) ||
      s(savedCapabilities?.approved_by) ||
      s(currentProfile?.approved_by) ||
      s(actor?.user?.name) ||
      s(actor?.user?.full_name) ||
      s(actor?.user?.fullName) ||
      s(actor?.user?.email) ||
      s(actor?.user?.id) ||
      "system";

    truthVersion = await truthVersionHelper.createVersion({
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      businessProfileId: s(savedProfile?.id),
      businessCapabilitiesId: s(savedCapabilities?.id),
      reviewSessionId: s(session?.id),
      approvedAt,
      approvedBy,
      profile: savedProfile,
      capabilities: savedCapabilities,
      sourceSummaryJson: obj(savedProfile?.source_summary_json),
      metadataJson: compactObject({
        reviewSessionProjection: true,
        reviewSessionId: s(session?.id),
        draftVersion: toFiniteNumber(draft?.version, 0) || undefined,
        sourceId: sourceInfo.primarySourceId || undefined,
        sourceRunId: sourceInfo.latestRunId || undefined,
      }),
    });
  }

  const serviceProjection = await projectDraftServicesToCanonical({
    db,
    actor,
    draft,
    sourceInfo,
  });

  const knowledgeProjection = await projectDraftKnowledgeToCanonical({
    db,
    actor,
    draft,
    session,
    sourceInfo,
  });

  return {
    projectedProfile,
    projectedCapabilities,
    truthVersion,
    serviceProjection,
    knowledgeProjection,
    sourceInfo,
  };
}

async function loadCurrentReviewPayload({ db, actor, eventLimit = 30 }) {
  const review = await getCurrentSetupReview(actor.tenantId);
  const setup = await buildSetupStatus({
    db,
    tenantId: actor.tenantId,
    tenantKey: actor.tenantKey,
    role: actor.role,
    tenant: actor.tenant,
  });

  const events = s(review?.session?.id)
    ? await listSetupReviewEvents({
        sessionId: review.session.id,
        limit: eventLimit,
      })
      : [];

  const frontendReview = buildFrontendReviewShape({
    session: review?.session || null,
    draft: review?.draft || null,
    sources: arr(review?.sources),
    events,
  });

  return {
    review: frontendReview,
    bundleSources: frontendReview.bundleSources,
    contributionSummary: frontendReview.contributionSummary,
    fieldProvenance: frontendReview.fieldProvenance,
    reviewDraftSummary: frontendReview.reviewDraftSummary,
    setup,
  };
}

function toFiniteNumber(value, fallback = 0) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}

function normalizeRequestedReviewLock(body = {}) {
  const root = obj(body);
  const meta = obj(root.metadata);
  const concurrency = obj(root.concurrency);

  const draftVersion = toFiniteNumber(
    root.draftVersion ??
      root.draft_version ??
      root.version ??
      root.revision ??
      concurrency.draftVersion ??
      concurrency.draft_version ??
      concurrency.version ??
      meta.draftVersion ??
      meta.draft_version ??
      meta.version ??
      meta.revision,
    0
  );

  return compactObject({
    sessionId: s(
      root.sessionId ||
        root.session_id ||
        root.reviewSessionId ||
        root.review_session_id ||
        concurrency.sessionId ||
        concurrency.session_id ||
        meta.sessionId ||
        meta.session_id ||
        meta.reviewSessionId ||
        meta.review_session_id
    ),
    draftVersion: draftVersion > 0 ? draftVersion : undefined,
  });
}

function buildReviewConcurrencyInfo(review = {}) {
  const session = obj(review?.session);
  const draft = obj(review?.draft);
  const canonicalBaseline = obj(obj(session.metadata).canonicalBaseline);

  return compactObject({
    sessionId: s(session.id),
    draftVersion: toFiniteNumber(draft.version, 0) || undefined,
    sessionStatus: s(session.status),
    currentStep: s(session.currentStep),
    protectionMode: "canonical_baseline_drift",
    baselineCaptured: !!s(canonicalBaseline.capturedAt),
  });
}

function buildFinalizeProtectionInfo(review = {}) {
  const session = obj(review?.session);
  const canonicalBaseline = obj(obj(session.metadata).canonicalBaseline);

  return {
    mode: "canonical_baseline_drift",
    baselineCaptured: !!s(canonicalBaseline.capturedAt),
    sessionId: s(session.id),
    sessionStatus: s(session.status),
  };
}

function buildReviewLockConflict(current = {}, body = {}) {
  const requested = normalizeRequestedReviewLock(body);
  if (!requested.sessionId && !requested.draftVersion) return null;

  const concurrency = buildReviewConcurrencyInfo(current);

  if (requested.sessionId && requested.sessionId !== concurrency.sessionId) {
    return {
      status: 409,
      error: "SetupReviewSessionConflict",
      code: "SETUP_REVIEW_SESSION_MISMATCH",
      reason: "requested setup review session does not match the current active session",
      requested,
      concurrency,
      finalizeProtection: buildFinalizeProtectionInfo(current),
    };
  }

  if (
    requested.draftVersion &&
    concurrency.draftVersion &&
    requested.draftVersion != concurrency.draftVersion
  ) {
    return {
      status: 409,
      error: "SetupReviewVersionConflict",
      code: "SETUP_REVIEW_DRAFT_VERSION_MISMATCH",
      reason: "requested setup review draft version does not match the current active draft",
      requested,
      concurrency,
      finalizeProtection: buildFinalizeProtectionInfo(current),
    };
  }

  return null;
}

function buildCanonicalProfileSourceSummary({ session = {}, draft = {}, sources = [], sourceInfo = {}, approvedAt = "" } = {}) {
  return compactObject({
    reviewSessionId: s(session?.id),
    primarySourceType: s(sourceInfo.primarySourceType),
    primarySourceId: s(sourceInfo.primarySourceId),
    primarySourceUrl: s(sourceInfo.sourceUrl),
    latestRunId: s(sourceInfo.latestRunId),
    lastSnapshotId: s(draft?.lastSnapshotId),
    approvedAt: s(approvedAt),
    sources: arr(sources)
      .map((item) =>
        compactObject({
          sourceId: s(item?.sourceId || item?.id),
          sourceType: s(item?.sourceType),
          role: s(item?.role),
          label: s(item?.label),
          sourceUrl: s(item?.sourceUrl || item?.url),
        })
      )
      .filter((item) => Object.keys(item).length),
  });
}

async function loadSetupTruthPayload({ db, actor }, deps = {}) {
  const knowledgeHelper = deps.knowledgeHelper || createTenantKnowledgeHelpers({ db });
  const truthVersionHelper =
    deps.truthVersionHelper || createTenantTruthVersionHelpers({ db });
  const setupBuilder = deps.setupBuilder || buildSetupStatus;
  const [profile, versions, setup] = await Promise.all([
    knowledgeHelper.getBusinessProfile({
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
    }),
    truthVersionHelper.listVersions({
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      limit: 20,
      offset: 0,
    }),
    setupBuilder({
      db,
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      role: actor.role,
      tenant: actor.tenant,
    }),
  ]);

  return {
    truth: {
      profile: buildCanonicalTruthProfile(profile),
      fieldProvenance: buildCanonicalTruthFieldProvenance(profile),
      history: arr(truthVersionHelper.buildHistoryEntries(versions)).filter(
        (item) => Object.keys(item).length
      ),
      approvedAt: s(profile?.approved_at),
      approvedBy: s(profile?.approved_by),
      generatedAt: s(profile?.generated_at),
      generatedBy: s(profile?.generated_by),
      profileStatus: s(profile?.profile_status),
      sourceSummary: obj(profile?.source_summary_json),
      metadata: obj(profile?.metadata_json),
    },
    setup,
  };
}

async function loadSetupTruthVersionPayload(
  { db, actor, versionId = "", compareToVersionId = "" },
  deps = {}
) {
  const truthVersionHelper =
    deps.truthVersionHelper || createTenantTruthVersionHelpers({ db });
  const setupBuilder = deps.setupBuilder || buildSetupStatus;

  const [comparison, setup] = await Promise.all([
    truthVersionHelper.compareVersions({
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      versionId,
      compareToVersionId,
    }),
    setupBuilder({
      db,
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      role: actor.role,
      tenant: actor.tenant,
    }),
  ]);

  return {
    truthVersion: comparison?.version
      ? buildTruthVersionHistoryEntry(comparison.version, comparison.diff)
      : null,
    previousTruthVersion: comparison?.previousVersion
      ? buildTruthVersionHistoryEntry(comparison.previousVersion)
      : null,
    compare: comparison?.diff || null,
    setup,
  };
}
async function handleSetupAnalyze(req, res, db) {
  const actor = requireSetupActor(req, res);
  if (!actor) return;

  try {
    const data = await runSetupIntakeAnalyze({
      db,
      actor,
      body: req.body || {},
    });

    const payload = await loadCurrentReviewPayload({
      db,
      actor,
      eventLimit: Number(req.query?.eventLimit || 30) || 30,
    });

    return res.json({
      ok: true,
      message: "Business draft analyzed",
      ...data,
      ...payload,
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: "SetupAnalyzeFailed",
      reason: err?.message || "failed to analyze setup intake",
    });
  }
}

export function workspaceSetupRoutes({ db }) {
  const r = express.Router();

  r.get("/setup/status", async (req, res) => {
    return handleSetupStatus(req, res, db, "SetupStatusFailed");
  });

  r.get("/setup/overview", async (req, res) => {
    return handleSetupStatus(req, res, db, "SetupOverviewFailed");
  });

  r.get("/setup/truth/current", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      const data = await loadSetupTruthPayload({ db, actor });
      return res.json({
        ok: true,
        ...data,
      });
    } catch (err) {
      return res.status(400).json({
        ok: false,
        error: "SetupTruthLoadFailed",
        reason: err?.message || "failed to load setup truth",
      });
    }
  });

  r.get("/setup/review/current", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      const data = await loadCurrentReviewPayload({
        db,
        actor,
        eventLimit: Number(req.query?.eventLimit || 30) || 30,
      });

      return res.json({
        ok: true,
        ...data,
      });
    } catch (err) {
      return res.status(400).json({
        ok: false,
        error: "SetupReviewCurrentLoadFailed",
        reason: err?.message || "failed to load current setup review",
      });
    }
  });

  r.post("/setup/review/current/analyze", async (req, res) => {
    return handleSetupAnalyze(req, res, db);
  });

  r.post("/setup/analyze", async (req, res) => {
    return handleSetupAnalyze(req, res, db);
  });

  r.patch("/setup/review/current", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      const current = await getCurrentSetupReview(actor.tenantId);

      if (!current?.session?.id) {
        return res.status(404).json({
          ok: false,
          error: "SetupReviewSessionNotFound",
          reason: "active setup review session not found",
        });
      }

      const lockConflict = buildReviewLockConflict(current, req.body || {});
      if (lockConflict) {
        return res.status(lockConflict.status).json({
          ok: false,
          error: lockConflict.error,
          reason: lockConflict.reason,
          code: lockConflict.code,
          requested: lockConflict.requested,
          concurrency: lockConflict.concurrency,
          finalizeProtection: lockConflict.finalizeProtection,
        });
      }

      const patch = normalizeReviewPatchBody(req.body || {});

      if (!Object.keys(patch).length) {
        return res.status(400).json({
          ok: false,
          error: "SetupReviewPatchInvalid",
          reason: "no valid draft patch fields were provided",
        });
      }

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

      await auditSetupAction(db, actor, "setup.review.updated", "tenant_setup_review_session", current.session.id, {
        sessionId: current.session.id,
        draftVersion: Number(draft?.version || data?.review?.draft?.version || 0),
        currentStep: s(data?.review?.session?.currentStep || current.session.currentStep),
      });

      return res.json({
        ok: true,
        message: "Setup review draft updated",
        draft,
        ...data,
      });
    } catch (err) {
      return res.status(400).json({
        ok: false,
        error: "SetupReviewPatchFailed",
        reason: err?.message || "failed to patch setup review draft",
      });
    }
  });

  r.post("/setup/review/current/discard", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      const discarded = await discardSetupReviewSession({
        tenantId: actor.tenantId,
        reason: s(req.body?.reason),
        metadata: obj(req.body?.metadata),
      });

      const setup = await buildSetupStatus({
        db,
        tenantId: actor.tenantId,
        tenantKey: actor.tenantKey,
        role: actor.role,
        tenant: actor.tenant,
      });

      await auditSetupAction(db, actor, "setup.review.discarded", "tenant_setup_review_session", discarded?.id || null, {
        sessionId: s(discarded?.id),
        reason: s(req.body?.reason),
      });

      return res.json({
        ok: true,
        message: "Setup review session discarded",
        session: discarded || null,
        setup,
      });
    } catch (err) {
      return res.status(400).json({
        ok: false,
        error: "SetupReviewDiscardFailed",
        reason: err?.message || "failed to discard setup review session",
      });
    }
  });

  r.post("/setup/review/current/finalize", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      let projectionSummary = null;

      const reviewerId =
        safeUuidOrNull(actor?.user?.id) ||
        safeUuidOrNull(actor?.user?.userId) ||
        safeUuidOrNull(actor?.user?.user_id) ||
        null;

      const reviewerEmail = s(actor?.user?.email);
      const reviewerName =
        s(actor?.user?.name) ||
        s(actor?.user?.full_name) ||
        s(actor?.user?.fullName) ||
        reviewerEmail ||
        s(actor?.user?.id) ||
        "system";

      const finalized = await finalizeSetupReviewSession({
        tenantId: actor.tenantId,
        currentStep: "finalize",
        refreshRuntime: true,
        metadata: compactObject({
          reviewerId,
          reviewerEmail,
          reviewerName,
          finalizeReason: s(req.body?.reason),
        }),
        async projectDraftToCanonical({ client, tenantId, session, draft, sources }) {
          projectionSummary = await projectSetupReviewDraftToCanonical({
            db: client,
            actor: {
              ...actor,
              tenantId,
            },
            session,
            draft,
            sources,
          });
        },
      });

      const setup = await buildSetupStatus({
        db,
        tenantId: actor.tenantId,
        tenantKey: actor.tenantKey,
        role: actor.role,
        tenant: actor.tenant,
      });

      await auditSetupAction(db, actor, "setup.review.finalized", "tenant_setup_review_session", finalized?.session?.id || finalized?.id || null, {
        sessionId: s(finalized?.session?.id || finalized?.id),
        reviewSessionId: s(finalized?.session?.id || finalized?.reviewSessionId),
        reason: s(req.body?.reason),
        truthVersionId: s(projectionSummary?.truthVersion?.id),
        runtimeProjectionId: s(projectionSummary?.runtimeProjection?.id),
      });

      if (projectionSummary?.truthVersion?.id) {
        await auditSetupAction(db, actor, "truth.version.created", "tenant_business_profile_version", projectionSummary.truthVersion.id, {
          truthVersionId: s(projectionSummary?.truthVersion?.id),
          reviewSessionId: s(finalized?.session?.id || finalized?.reviewSessionId),
          approvedAt: s(projectionSummary?.truthVersion?.approvedAt),
          approvedBy: s(projectionSummary?.truthVersion?.approvedBy),
        });
      }

      return res.json({
        ok: true,
        message: "Setup review finalized",
        ...finalized,
        concurrency: buildReviewConcurrencyInfo(finalized),
        finalizeProtection: buildFinalizeProtectionInfo(finalized),
        projectionSummary,
        setup,
      });
    } catch (err) {
      return res.status(400).json({
        ok: false,
        error: "SetupReviewFinalizeFailed",
        reason: err?.message || "failed to finalize setup review",
        code: s(err?.code),
        baseline: obj(err?.baseline),
        current: obj(err?.current),
        concurrency: buildReviewConcurrencyInfo(current),
        finalizeProtection: buildFinalizeProtectionInfo(current),
      });
    }
  });

  r.get("/setup/truth/history/:versionId", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      const data = await loadSetupTruthVersionPayload({
        db,
        actor,
        versionId: s(req.params?.versionId),
        compareToVersionId: s(req.query?.compareTo),
      });

      if (!data.truthVersion?.id) {
        return res.status(404).json({
          ok: false,
          error: "SetupTruthVersionNotFound",
          reason: "truth version not found",
        });
      }

      return res.json({
        ok: true,
        ...data,
      });
    } catch (err) {
      return res.status(400).json({
        ok: false,
        error: "SetupTruthVersionLoadFailed",
        reason: err?.message || "failed to load setup truth version",
      });
    }
  });

  r.get("/setup/review-draft", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      const data = await loadCurrentReviewPayload({
        db,
        actor,
        eventLimit: 30,
      });

      return res.json({
        ok: true,
        draft: data.review?.draft || null,
        session: data.review?.session || null,
        sources: arr(data.review?.sources),
        events: arr(data.review?.events),
        setup: data.setup,
      });
    } catch (err) {
      return res.status(400).json({
        ok: false,
        error: "SetupReviewDraftLoadFailed",
        reason: err?.message || "failed to load setup review draft",
      });
    }
  });

  r.post("/setup/review-finalize", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      let projectionSummary = null;

      const reviewerId =
        safeUuidOrNull(actor?.user?.id) ||
        safeUuidOrNull(actor?.user?.userId) ||
        safeUuidOrNull(actor?.user?.user_id) ||
        null;

      const reviewerEmail = s(actor?.user?.email);
      const reviewerName =
        s(actor?.user?.name) ||
        s(actor?.user?.full_name) ||
        s(actor?.user?.fullName) ||
        reviewerEmail ||
        s(actor?.user?.id) ||
        "system";

      const finalized = await finalizeSetupReviewSession({
        tenantId: actor.tenantId,
        currentStep: "finalize",
        refreshRuntime: true,
        metadata: compactObject({
          reviewerId,
          reviewerEmail,
          reviewerName,
          finalizeReason: s(req.body?.reason),
        }),
        async projectDraftToCanonical({ client, tenantId, session, draft, sources }) {
          projectionSummary = await projectSetupReviewDraftToCanonical({
            db: client,
            actor: {
              ...actor,
              tenantId,
            },
            session,
            draft,
            sources,
          });
        },
      });

      const setup = await buildSetupStatus({
        db,
        tenantId: actor.tenantId,
        tenantKey: actor.tenantKey,
        role: actor.role,
        tenant: actor.tenant,
      });

      await auditSetupAction(db, actor, "setup.review.finalized", "tenant_setup_review_session", finalized?.session?.id || finalized?.id || null, {
        sessionId: s(finalized?.session?.id || finalized?.id),
        reviewSessionId: s(finalized?.session?.id || finalized?.reviewSessionId),
        reason: s(req.body?.reason),
        truthVersionId: s(projectionSummary?.truthVersion?.id),
        runtimeProjectionId: s(projectionSummary?.runtimeProjection?.id),
      });

      if (projectionSummary?.truthVersion?.id) {
        await auditSetupAction(db, actor, "truth.version.created", "tenant_business_profile_version", projectionSummary.truthVersion.id, {
          truthVersionId: s(projectionSummary?.truthVersion?.id),
          reviewSessionId: s(finalized?.session?.id || finalized?.reviewSessionId),
          approvedAt: s(projectionSummary?.truthVersion?.approvedAt),
          approvedBy: s(projectionSummary?.truthVersion?.approvedBy),
        });
      }

      return res.json({
        ok: true,
        message: "Setup review finalized",
        ...finalized,
        concurrency: buildReviewConcurrencyInfo(finalized),
        finalizeProtection: buildFinalizeProtectionInfo(finalized),
        projectionSummary,
        setup,
      });
    } catch (err) {
      return res.status(400).json({
        ok: false,
        error: "SetupReviewFinalizeFailed",
        reason: err?.message || "failed to finalize setup review",
        code: s(err?.code),
        baseline: obj(err?.baseline),
        current: obj(err?.current),
        concurrency: buildReviewConcurrencyInfo(current),
        finalizeProtection: buildFinalizeProtectionInfo(current),
      });
    }
  });

  r.put("/setup/business-profile", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      const current = await getOrCreateSetupDraftSession(actor);
      const staged = buildBusinessProfileDraftPatch(req.body || {}, current?.draft || {});

      await patchSetupReviewDraft({
        sessionId: current.session.id,
        tenantId: actor.tenantId,
        patch: staged.patch,
        bumpVersion: true,
      });

      const data = await loadCurrentReviewPayload({
        db,
        actor,
        eventLimit: 30,
      });

      await auditSetupAction(db, actor, "setup.review.updated", "tenant_setup_review_session", current.session.id, {
        sessionId: current.session.id,
        draftVersion: Number(draft?.version || data?.review?.draft?.version || 0),
        currentStep: s(data?.review?.session?.currentStep || current.session.currentStep),
      });

      return res.json({
        ok: true,
        message: "Business profile staged in setup review draft",
        staged: true,
        canonicalWriteDeferred: true,
        saved: staged.saved,
        draft: data.review?.draft || null,
        session: data.review?.session || null,
        sources: arr(data.review?.sources),
        events: arr(data.review?.events),
        setup: data.setup,
      });
    } catch (err) {
      return res.status(400).json({
        ok: false,
        error: "BusinessProfileSaveFailed",
        reason: err?.message || "failed to save business profile",
      });
    }
  });

  r.put("/setup/runtime-preferences", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    try {
      const current = await getOrCreateSetupDraftSession(actor);
      const staged = buildRuntimePreferencesDraftPatch(
        req.body || {},
        current?.draft || {}
      );

      await patchSetupReviewDraft({
        sessionId: current.session.id,
        tenantId: actor.tenantId,
        patch: staged.patch,
        bumpVersion: true,
      });

      const data = await loadCurrentReviewPayload({
        db,
        actor,
        eventLimit: 30,
      });

      return res.json({
        ok: true,
        message: "Runtime preferences staged in setup review draft",
        staged: true,
        canonicalWriteDeferred: true,
        saved: staged.saved,
        draft: data.review?.draft || null,
        session: data.review?.session || null,
        sources: arr(data.review?.sources),
        events: arr(data.review?.events),
        setup: data.setup,
      });
    } catch (err) {
      return res.status(400).json({
        ok: false,
        error: "RuntimePreferencesSaveFailed",
        reason: err?.message || "failed to save runtime preferences",
      });
    }
  });

  r.post("/setup/import/website", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    const body = req.body || {};
    const url = resolveSourceUrlFromBody(body);

    if (!url) {
      return res.status(400).json({
        ok: false,
        error: "WebsiteImportFailed",
        reason: "website url is required",
      });
    }

    try {
      req.log?.info("setup.import.website.requested", { sourceUrl: url });
      const data = await importWebsiteSource({
        db,
        url,
        ...buildImportArgs({ actor, body, requestId: req.requestId }),
      });

      const enriched = await enrichImportDataWithReview({
        db,
        actor,
        data,
      });

      const result = buildImportResponse({
        data: enriched,
        successMessage: "Website import completed",
        acceptedMessage: "Website import accepted",
        partialMessage: "Website import finished with warnings",
        errorCode: "WebsiteImportFailed",
        errorMessage: "website import failed",
      });

      return res.status(result.status).json(result.body);
    } catch (err) {
      req.log?.error("setup.import.website.failed", err, { sourceUrl: url });
      return res.status(400).json({
        ok: false,
        error: "WebsiteImportFailed",
        reason: err?.message || "failed to import website",
      });
    }
  });

  r.post("/setup/import/google-maps", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    const body = req.body || {};
    const url = resolveSourceUrlFromBody(body);

    if (!url) {
      return res.status(400).json({
        ok: false,
        error: "GoogleMapsImportFailed",
        reason: "google maps url is required",
      });
    }

    try {
      req.log?.info("setup.import.google_maps.requested", { sourceUrl: url });
      const data = await importGoogleMapsSource({
        db,
        url,
        ...buildImportArgs({ actor, body, requestId: req.requestId }),
      });

      const enriched = await enrichImportDataWithReview({
        db,
        actor,
        data,
      });

      const result = buildImportResponse({
        data: enriched,
        successMessage: "Google Maps import completed",
        acceptedMessage: "Google Maps import accepted",
        partialMessage: "Google Maps import finished with warnings",
        errorCode: "GoogleMapsImportFailed",
        errorMessage: "google maps import failed",
      });

      return res.status(result.status).json(result.body);
    } catch (err) {
      req.log?.error("setup.import.google_maps.failed", err, { sourceUrl: url });
      return res.status(400).json({
        ok: false,
        error: "GoogleMapsImportFailed",
        reason: err?.message || "failed to import google maps source",
      });
    }
  });

  r.post("/setup/import/source", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    const body = req.body || {};
    const sourceType = normalizeIncomingSourceType(
      body?.sourceType || body?.source_type || body?.type
    );
    const url = resolveSourceUrlFromBody(body);

    if (!sourceType) {
      return res.status(400).json({
        ok: false,
        error: "SourceImportFailed",
        reason: "supported sourceType is required",
        supportedSourceTypes: ["website", "google_maps"],
      });
    }

    if (!url) {
      return res.status(400).json({
        ok: false,
        error: "SourceImportFailed",
        reason: "source url is required",
      });
    }

    try {
      req.log?.info("setup.import.source.requested", {
        sourceType,
        sourceUrl: url,
      });
      const data = await importSource({
        db,
        sourceType,
        url,
        ...buildImportArgs({ actor, body, requestId: req.requestId }),
      });

      const enriched = await enrichImportDataWithReview({
        db,
        actor,
        data,
      });

      const result = buildImportResponse({
        data: enriched,
        successMessage: `${sourceType} import completed`,
        acceptedMessage: `${sourceType} import accepted`,
        partialMessage: `${sourceType} import finished with warnings`,
        errorCode: "SourceImportFailed",
        errorMessage: "source import failed",
      });

      return res.status(result.status).json({
        ...result.body,
        sourceType,
      });
    } catch (err) {
      req.log?.error("setup.import.source.failed", err, {
        sourceType,
        sourceUrl: url,
      });
      return res.status(400).json({
        ok: false,
        error: "SourceImportFailed",
        reason: err?.message || "failed to import source",
      });
    }
  });

  r.post("/setup/import/bundle", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    const body = req.body || {};
    const websiteUrl = s(body?.websiteUrl || body?.website_url || resolveSourceUrlFromBody(body));
    const instagramUrl = resolveInstagramBundleUrl(body);

    if (!websiteUrl) {
      return res.status(400).json({
        ok: false,
        error: "SetupBundleImportFailed",
        reason: "website url is required",
      });
    }

    try {
      req.log?.info("setup.import.bundle.requested", {
        websiteUrl,
        instagramUrl,
      });
      const data = await importSourceBundle({
        db,
        websiteUrl,
        instagramUrl,
        ...buildImportArgs({ actor, body, requestId: req.requestId }),
      });

      const enriched = await enrichImportDataWithReview({
        db,
        actor,
        data,
      });

      const result = buildImportResponse({
        data: enriched,
        successMessage: "Setup bundle import completed",
        acceptedMessage: "Setup bundle import accepted",
        partialMessage: "Setup bundle import finished with warnings",
        errorCode: "SetupBundleImportFailed",
        errorMessage: "setup bundle import failed",
      });

      return res.status(result.status).json(result.body);
    } catch (err) {
      req.log?.error("setup.import.bundle.failed", err, {
        websiteUrl,
        instagramUrl,
      });
      return res.status(400).json({
        ok: false,
        error: "SetupBundleImportFailed",
        reason: err?.message || "failed to import setup bundle",
      });
    }
  });

  r.get("/setup/services", async (req, res) => {
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

  r.post("/setup/services", async (req, res) => {
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

  r.put("/setup/services/:id", async (req, res) => {
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

  r.delete("/setup/services/:id", async (req, res) => {
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

  return r;
}

export const __test__ = {
  buildBusinessProfileDraftPatch,
  buildRuntimePreferencesDraftPatch,
  buildImportResponse,
  normalizeSetupServiceDraftInput,
  buildFrontendReviewShape,
  normalizeRequestedReviewLock,
  buildReviewConcurrencyInfo,
  projectSetupReviewDraftToCanonical,
  loadSetupTruthPayload,
  loadSetupTruthVersionPayload,
  buildCanonicalTruthProfile,
  buildCanonicalTruthFieldProvenance,
  buildTruthVersionHistoryEntry,
};
