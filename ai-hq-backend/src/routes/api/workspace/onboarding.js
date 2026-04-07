import express from "express";
import { pickWorkspaceActor } from "./shared.js";
import {
  loadCurrentOnboardingSession,
  startOnboardingSession,
  updateOnboardingDraft,
} from "../../../services/workspace/setup/onboardingApp.js";

// Legacy compatibility aliases. The canonical product-facing flow now lives
// under /api/setup/assistant/session/* and persists into the same setup review
// draft storage.

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function requireOnboardingActor(req, res) {
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

function pickErrorStatus(error, fallback = 500) {
  const explicit = Number(error?.status || error?.statusCode || 0);
  if (Number.isFinite(explicit) && explicit >= 400) return explicit;

  const message = s(error?.message).toLowerCase();
  if (message.includes("not found")) return 404;
  if (message.includes("required")) return 400;
  if (message.includes("invalid")) return 400;
  if (message.includes("unauthorized")) return 401;

  return fallback;
}

async function runUpdateDraft(req, res, actor, updateDraft, db) {
  try {
    const result = await updateDraft({
      db,
      actor,
      body: req.body || {},
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(pickErrorStatus(error, 500)).json({
      ok: false,
      error: "OnboardingDraftUpdateFailed",
      reason: s(error?.message || "failed to update onboarding draft"),
    });
  }
}

export function workspaceOnboardingRoutes({ db, services = {} } = {}) {
  const router = express.Router();
  const loadCurrentSession =
    services.loadCurrentOnboardingSession || loadCurrentOnboardingSession;
  const startSession =
    services.startOnboardingSession || startOnboardingSession;
  const updateDraft =
    services.updateOnboardingDraft || updateOnboardingDraft;

  router.post("/onboarding/session/start", async (req, res) => {
    const actor = requireOnboardingActor(req, res);
    if (!actor) return;

    try {
      const result = await startSession({
        db,
        actor,
      });
      return res.status(result.status).json(result.body);
    } catch (error) {
      return res.status(pickErrorStatus(error, 500)).json({
        ok: false,
        error: "OnboardingSessionStartFailed",
        reason: s(error?.message || "failed to start onboarding session"),
      });
    }
  });

  router.get("/onboarding/session/current", async (req, res) => {
    const actor = requireOnboardingActor(req, res);
    if (!actor) return;

    try {
      const result = await loadCurrentSession({
        db,
        actor,
      });
      return res.status(result.status).json(result.body);
    } catch (error) {
      return res.status(pickErrorStatus(error, 500)).json({
        ok: false,
        error: "OnboardingSessionLoadFailed",
        reason: s(error?.message || "failed to load onboarding session"),
      });
    }
  });

  router.patch("/onboarding/session/current", async (req, res) => {
    const actor = requireOnboardingActor(req, res);
    if (!actor) return;
    return runUpdateDraft(req, res, actor, updateDraft, db);
  });

  router.post("/onboarding/session/current/message", async (req, res) => {
    const actor = requireOnboardingActor(req, res);
    if (!actor) return;
    return runUpdateDraft(req, res, actor, updateDraft, db);
  });

  return router;
}
