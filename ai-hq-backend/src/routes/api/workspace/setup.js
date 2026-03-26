// src/routes/api/workspace/setup.js
// FINAL v3.2 — workspace setup routes with unified source + manual analyze
// fixes:
// - keep source import flow as-is
// - add manual/voice-ready unified analyze endpoint
// - allow setup to work without any source
// - keep finalize path unchanged: review draft -> canonical truth

import express from "express";
import {
  importWebsiteSource,
  importGoogleMapsSource,
  importSourceBundle,
  importSource,
} from "../../../services/workspace/import.js";
import { runSetupIntakeAnalyze } from "../../../services/workspace/intakeAnalyze.js";
import { pickWorkspaceActor } from "./shared.js";
import {
  getCurrentSetupReview,
  patchSetupReviewDraft,
  listSetupReviewEvents,
} from "../../../db/helpers/tenantSetupReview.js";
import {
  buildCanonicalTruthProfile,
  buildCanonicalTruthFieldProvenance,
  buildTruthVersionHistoryEntry,
} from "../../../db/helpers/tenantTruthVersions.js";
import { buildFrontendReviewShape as buildFrontendReviewShapeService } from "../../../services/workspace/setup/reviewShape.js";
import {
  buildFinalizeProtectionInfo as buildFinalizeProtectionInfoService,
  buildReviewConcurrencyInfo as buildReviewConcurrencyInfoService,
  buildReviewLockConflict as buildReviewLockConflictService,
  loadCurrentReviewPayload as loadCurrentReviewPayloadService,
  normalizeRequestedReviewLock,
} from "../../../services/workspace/setup/reviewFlow.js";
import { buildImportResponse } from "../../../services/workspace/setup/importFlow.js";
import {
  buildCanonicalProfileSourceSummary as buildCanonicalProfileSourceSummaryService,
  projectSetupReviewDraftToCanonical as projectSetupReviewDraftToCanonicalService,
} from "../../../services/workspace/setup/projection.js";
import {
  buildBusinessProfileDraftPatch,
  buildRuntimePreferencesDraftPatch,
  stageSetupBusinessProfileMutation,
  stageSetupRuntimePreferencesMutation,
} from "../../../services/workspace/setup/draftProfile.js";
import {
  safeUuidOrNull,
} from "../../../services/workspace/setup/draftShared.js";
import {
  listSetupServicesFromDraftOrCanonical,
  normalizeSetupServiceDraftInput,
  stageSetupServiceMutation as stageSetupServiceMutationService,
} from "../../../services/workspace/setup/draftServices.js";
import {
  applySetupReviewPatch,
  finalizeSetupReviewComposition,
  normalizeReviewPatchBody,
} from "../../../services/workspace/setup/reviewApp.js";
import {
  executeSetupImport,
} from "../../../services/workspace/setup/importApp.js";
import {
  loadCurrentSetupReviewResponse,
  loadSetupReviewDraftResponse,
  loadSetupTruthCurrentResponse,
  loadSetupTruthPayloadWithStatus,
  loadSetupTruthVersionResponse,
  loadSetupTruthVersionPayloadWithStatus,
} from "../../../services/workspace/setup/readApp.js";
import {
  loadSetupStatusResponse,
  requireSetupActor as requireSetupActorService,
} from "../../../services/workspace/setup/actorApp.js";
import { auditSetupAction } from "../../../services/workspace/setup/auditApp.js";
import { discardSetupReviewComposition } from "../../../services/workspace/setup/discardApp.js";
import { registerSetupReadRoutes } from "./setupRoutesReads.js";
import { registerSetupReviewRoutes } from "./setupRoutesReview.js";
import { registerSetupImportRoutes } from "./setupRoutesImports.js";
import { registerSetupStagingRoutes } from "./setupRoutesStaging.js";

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

function buildFrontendReviewShape({ session = null, draft = null, sources = [], events = [] } = {}) {
  return buildFrontendReviewShapeService({ session, draft, sources, events });
}

function requireSetupActor(req, res) {
  return requireSetupActorService(req, res, {
    pickWorkspaceActor,
  });
}

async function handleSetupStatus(req, res, db, errorCode = "SetupStatusFailed") {
  const actor = requireSetupActor(req, res);
  if (!actor) return;

  const result = await loadSetupStatusResponse({
    db,
    actor,
    errorCode,
  });

  return res.status(result.status).json(result.body);
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
  return projectSetupReviewDraftToCanonicalService(
    { db, actor, session, draft, sources },
    deps
  );
}

async function loadCurrentReviewPayload({ db, actor, eventLimit = 30 }) {
  return loadCurrentReviewPayloadService(
    { db, actor, eventLimit },
    {
      getCurrentSetupReview,
      listSetupReviewEvents,
      buildSetupStatus,
    }
  );
}

async function stageSetupServiceMutation(args = {}) {
  return stageSetupServiceMutationService({
    ...args,
    loadCurrentReviewPayload,
  });
}

function buildReviewConcurrencyInfo(review = {}) {
  return buildReviewConcurrencyInfoService(review);
}

function buildFinalizeProtectionInfo(review = {}) {
  return buildFinalizeProtectionInfoService(review);
}

function buildReviewLockConflict(current = {}, body = {}) {
  return buildReviewLockConflictService(current, body);
}

async function loadSetupTruthPayload(args = {}, deps = {}) {
  return loadSetupTruthPayloadWithStatus(args, deps);
}

async function loadSetupTruthVersionPayload(args = {}, deps = {}) {
  return loadSetupTruthVersionPayloadWithStatus(args, deps);
}

async function loadSetupTruthCurrentRequest(args = {}) {
  return loadSetupTruthCurrentResponse(args, {
    loadSetupTruthPayload,
  });
}

async function loadCurrentReviewRequest(args = {}) {
  return loadCurrentSetupReviewResponse(args, {
    loadCurrentReviewPayload,
  });
}

async function loadSetupTruthVersionRequest(args = {}) {
  return loadSetupTruthVersionResponse(args, {
    loadSetupTruthVersionPayload,
  });
}

async function loadSetupReviewDraftRequest(args = {}) {
  return loadSetupReviewDraftResponse(args, {
    loadCurrentReviewPayload,
    arr,
  });
}

async function applySetupReviewPatchRequest(args = {}) {
  return applySetupReviewPatch(args, {
    getCurrentSetupReview,
    buildReviewLockConflict,
    normalizeReviewPatchBody,
    patchSetupReviewDraft,
    loadCurrentReviewPayload,
    auditSetupAction,
  });
}

async function finalizeSetupReviewRequest(args = {}) {
  return finalizeSetupReviewComposition(args, {
    auditSetupAction,
    projectSetupReviewDraftToCanonical,
    buildReviewConcurrencyInfo,
    buildFinalizeProtectionInfo,
  });
}

async function discardSetupReviewRequest(args = {}) {
  return discardSetupReviewComposition(args, {
    auditSetupAction,
  });
}

async function executeSetupImportRequest(args = {}) {
  return executeSetupImport(args);
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

  registerSetupReadRoutes(r, {
    db,
    handleSetupStatus,
    requireSetupActor,
    loadSetupTruthCurrent: loadSetupTruthCurrentRequest,
    loadCurrentReview: loadCurrentReviewRequest,
    loadSetupTruthVersion: loadSetupTruthVersionRequest,
    loadSetupReviewDraft: loadSetupReviewDraftRequest,
    s,
  });

  registerSetupReviewRoutes(r, {
    db,
    requireSetupActor,
    handleSetupAnalyze,
    applySetupReviewPatch: applySetupReviewPatchRequest,
    finalizeSetupReview: finalizeSetupReviewRequest,
    discardSetupReview: discardSetupReviewRequest,
    s,
    obj,
    buildReviewConcurrencyInfo,
    buildFinalizeProtectionInfo,
  });

  registerSetupImportRoutes(r, {
    db,
    requireSetupActor,
    resolveSourceUrlFromBody,
    resolveInstagramBundleUrl,
    normalizeIncomingSourceType,
    importWebsiteSource,
    importGoogleMapsSource,
    importSource,
    importSourceBundle,
    executeSetupImport: executeSetupImportRequest,
    s,
  });

  registerSetupStagingRoutes(r, {
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
