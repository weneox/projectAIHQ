import express from "express";
import { dbGetWorkspaceSettings, dbUpsertTenantCore, dbUpsertTenantProfile, dbUpsertTenantAiPolicy } from "../../../db/helpers/settings.js";
import { dbGetTenantByKey } from "../../../db/helpers/tenants.js";
import { requireSafeDiagnostics } from "../../../utils/securitySurface.js";
import { cfg } from "../../../config.js";
import {
  ok,
  requireDb,
  requireTenant,
  requireOwnerOrAdmin,
  serverErr,
  safeJsonObj,
  isInternalServiceRequest,
  getUserRole,
  resolveTenantKey,
  hasDb,
  auditSafe,
} from "./utils.js";
import {
  buildTenantCoreSaveInput,
  buildProfileSaveInput,
  buildAiPolicySaveInput,
} from "./builders.js";

export function workspaceSettingsRoutes({ db }) {
  const router = express.Router();

  router.get(
    "/settings/__debug-auth",
    (req, res, next) => requireSafeDiagnostics(req, res, next, { env: cfg.app.env }),
    async (req, res) => {
    return res.status(200).json({
      ok: true,
      marker: "SETTINGS_DEBUG_AUTH_V2",
      auth: req.auth || null,
      user: req.user || null,
      tenantKeyResolved: resolveTenantKey(req),
      roleResolved: getUserRole(req),
      isInternal: isInternalServiceRequest(req),
      hasDb: hasDb(db),
    });
  });

  router.get("/settings/workspace", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const settings = await dbGetWorkspaceSettings(db, tenantKey);
      if (!settings) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      return ok(res, {
        ...settings,
        viewerRole: isInternalServiceRequest(req) ? "internal" : getUserRole(req),
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to load workspace settings");
    }
  });

  router.post("/settings/workspace", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const role = requireOwnerOrAdmin(req, res);
      if (!role) return;

      const body = safeJsonObj(req.body, {});
      const tenantInput = safeJsonObj(body.tenant, {});
      const profileInput = safeJsonObj(body.profile, {});
      const aiPolicyInput = safeJsonObj(body.aiPolicy, {});

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const tenantCoreInput = buildTenantCoreSaveInput(tenantInput, role);
      const profileSaveInput = buildProfileSaveInput(profileInput);
      const aiPolicySaveInput = buildAiPolicySaveInput(aiPolicyInput, role, tenantCoreInput);

      const tenantCore = await dbUpsertTenantCore(db, tenantKey, tenantCoreInput);
      const profile = await dbUpsertTenantProfile(db, tenant.id, profileSaveInput);
      const aiPolicy = await dbUpsertTenantAiPolicy(db, tenant.id, aiPolicySaveInput);

      const settings = await dbGetWorkspaceSettings(db, tenantKey);

      await auditSafe(db, req, tenant, "settings.workspace.updated", "tenant", tenant.id, {
        scope: "workspace",
      });

      return ok(res, {
        tenant: settings?.tenant || tenantCore,
        profile: settings?.profile || profile,
        aiPolicy: settings?.aiPolicy || aiPolicy,
        viewerRole: role,
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to save workspace settings");
    }
  });

  return router;
}
