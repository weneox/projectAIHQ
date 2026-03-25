// src/routes/api/workspace/knowledge.js
// FINAL v1.1 — workspace knowledge candidate routes

import express from "express";
import { requireTenantPermission } from "../../../utils/auth.js";
import {
  approveKnowledgeCandidate,
  listKnowledgeCandidates,
  rejectKnowledgeCandidate,
} from "../../../services/workspace/candidates.js";
import { pickWorkspaceActor } from "./shared.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function requireKnowledgeActor(req, res) {
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

function pickErrorStatus(err, fallback = 400) {
  const message = s(err?.message).toLowerCase();

  if (message.includes("not found")) return 404;
  if (message.includes("unauthorized")) return 401;
  if (message.includes("tenant")) return 400;
  if (message.includes("required")) return 400;

  return fallback;
}

export function workspaceKnowledgeRoutes({ db }) {
  const r = express.Router();
  const requireWorkspaceReviewer = (req, res, next) =>
    requireTenantPermission(req, res, next, {
      resource: "workspace",
      action: "manage",
    });

  r.get("/knowledge/candidates", async (req, res) => {
    const actor = requireKnowledgeActor(req, res);
    if (!actor) return;

    const { tenantId, tenantKey } = actor;

    try {
      const status = s(req.query?.status);
      const category = s(req.query?.category);
      const limit = s(req.query?.limit || 100);

      const data = await listKnowledgeCandidates({
        db,
        tenantId,
        tenantKey,
        status,
        category,
        limit,
      });

      return res.json({
        ok: true,
        items: data.items,
        count: data.count,
        filters: {
          status,
          category,
          limit: Number(limit) || 100,
        },
      });
    } catch (err) {
      return res.status(pickErrorStatus(err, 500)).json({
        ok: false,
        error: "KnowledgeCandidatesListFailed",
        reason: err?.message || "failed to list knowledge candidates",
      });
    }
  });

  r.post("/knowledge/candidates/:id/approve", requireWorkspaceReviewer, async (req, res) => {
    const actor = requireKnowledgeActor(req, res);
    if (!actor) return;

    const { user, tenant, tenantId, tenantKey, role } = actor;

    try {
      const reviewedBy = user.email || user.id || "system";

      const data = await approveKnowledgeCandidate({
        db,
        tenantId,
        tenantKey,
        role,
        tenant,
        candidateId: req.params.id,
        reviewedBy,
      });

      return res.json({
        ok: true,
        message: "Knowledge candidate approved",
        ...data,
      });
    } catch (err) {
      return res.status(pickErrorStatus(err, 400)).json({
        ok: false,
        error: "KnowledgeCandidateApproveFailed",
        reason: err?.message || "failed to approve knowledge candidate",
      });
    }
  });

  r.post("/knowledge/candidates/:id/reject", requireWorkspaceReviewer, async (req, res) => {
    const actor = requireKnowledgeActor(req, res);
    if (!actor) return;

    const { user, tenant, tenantId, tenantKey, role } = actor;

    try {
      const reviewedBy = user.email || user.id || "system";

      const data = await rejectKnowledgeCandidate({
        db,
        tenantId,
        tenantKey,
        role,
        tenant,
        candidateId: req.params.id,
        reviewedBy,
        reason: req.body?.reason || "",
      });

      return res.json({
        ok: true,
        message: "Knowledge candidate rejected",
        ...data,
      });
    } catch (err) {
      return res.status(pickErrorStatus(err, 400)).json({
        ok: false,
        error: "KnowledgeCandidateRejectFailed",
        reason: err?.message || "failed to reject knowledge candidate",
      });
    }
  });

  return r;
}
