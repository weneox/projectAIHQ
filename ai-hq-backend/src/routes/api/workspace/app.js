// src/routes/api/workspace/app.js
// FINAL v1.0 — workspace app routes

import express from "express";
import { buildAppBootstrap } from "../../../services/workspace/bootstrap.js";
import { pickWorkspaceActor } from "./shared.js";

export function workspaceAppRoutes({ db }) {
  const r = express.Router();

  r.get("/app/bootstrap", async (req, res) => {
    const { user, tenant, tenantId, tenantKey } = pickWorkspaceActor(req);

    if (!user) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized",
        reason: "authenticated user is required",
      });
    }

    if (!tenantId && !tenantKey) {
      return res.status(400).json({
        ok: false,
        error: "TenantRequired",
        reason: "tenant context is required",
      });
    }

    try {
      const data = await buildAppBootstrap({
        db,
        user,
        tenant,
        tenantId,
        tenantKey,
      });

      return res.json({
        ok: true,
        ...data,
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: "AppBootstrapFailed",
        reason: err?.message || "failed to build bootstrap payload",
      });
    }
  });

  return r;
}