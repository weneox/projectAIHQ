import express from "express";

import { buildLaunchPosture } from "../../../services/launch/posture.js";
import { getDefaultTenantKey } from "../../../tenancy/index.js";
import { createInternalTokenGuard } from "../../../utils/auth.js";
import { okJson } from "../../../utils/http.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function resolveInternalTenantKey(req = {}) {
  return (
    s(req.query?.tenantKey) ||
    s(req.query?.tenant_key) ||
    s(req.headers?.["x-tenant-key"]) ||
    s(req.headers?.["x-tenant"]) ||
    getDefaultTenantKey()
  ).toLowerCase();
}

function attachInternalLaunchActor(req = {}) {
  const tenantKey = resolveInternalTenantKey(req);
  const tenantId =
    s(req.query?.tenantId) ||
    s(req.query?.tenant_id) ||
    s(req.headers?.["x-tenant-id"]);

  req.tenantKey = tenantKey;
  req.tenantId = tenantId;
  req.auth = {
    ...(req.auth || {}),
    userId: "internal-launch-posture-smoke",
    tenantId,
    tenantKey,
    role: "owner",
    email: "internal-launch-posture@aihq.local",
  };
  req.user = {
    ...(req.user || {}),
    id: "internal-launch-posture-smoke",
    tenantId,
    tenantKey,
    tenant_id: tenantId,
    tenant_key: tenantKey,
    role: "owner",
    email: "internal-launch-posture@aihq.local",
  };

  return req;
}

export function launchRoutes({ db }) {
  const r = express.Router();

  r.get("/launch/posture", async (req, res) => {
    try {
      const payload = await buildLaunchPosture({ db, req });
      return okJson(res, payload);
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: "LaunchPostureFailed",
        reason: String(err?.message || "failed to load launch posture"),
      });
    }
  });

  return r;
}

export function launchInternalRoutes({ db }) {
  const r = express.Router();
  const requireLaunchPostureInternal = createInternalTokenGuard({
    allowedAudiences: ["aihq-backend.launch-posture"],
  });

  r.get(
    "/internal/launch/posture",
    requireLaunchPostureInternal,
    async (req, res) => {
      try {
        const payload = await buildLaunchPosture({
          db,
          req: attachInternalLaunchActor(req),
        });
        return okJson(res, payload);
      } catch (err) {
        return res.status(500).json({
          ok: false,
          error: "LaunchPostureFailed",
          reason: String(err?.message || "failed to load launch posture"),
        });
      }
    }
  );

  return r;
}
