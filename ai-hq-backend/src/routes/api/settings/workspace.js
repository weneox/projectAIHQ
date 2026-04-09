import express from "express";
import { dbGetWorkspaceSettings, dbUpsertTenantAiPolicy } from "../../../db/helpers/settings.js";
import { dbGetTenantByKey } from "../../../db/helpers/tenants.js";
import { requireSafeDiagnostics } from "../../../utils/securitySurface.js";
import { cfg } from "../../../config.js";
import {
  ok,
  requireDb,
  requireTenant,
  requireSettingsWriteMutation,
  serverErr,
  safeJsonObj,
  getViewerRole,
  resolveTenantKey,
  hasDb,
  auditSafe,
} from "./utils.js";
import {
  buildAiPolicySaveInput,
} from "./builders.js";

const GOVERNED_WORKSPACE_FIELDS = Object.freeze({
  tenant: [
    "company_name",
    "legal_name",
    "industry_key",
    "country_code",
    "timezone",
    "default_language",
    "enabled_languages",
    "market_region",
  ],
  profile: [
    "brand_name",
    "website_url",
    "public_email",
    "public_phone",
    "audience_summary",
    "services_summary",
    "value_proposition",
    "brand_summary",
    "tone_of_voice",
    "preferred_cta",
    "banned_phrases",
    "communication_rules",
    "visual_style",
    "extra_context",
  ],
});

function buildWorkspaceGovernanceContract() {
  return {
    directWorkspaceWritesBlocked: true,
    governedSections: ["tenant", "profile"],
    directlyEditableSections: ["aiPolicy"],
    governedFields: GOVERNED_WORKSPACE_FIELDS,
    setupRoute: "/home?assistant=setup",
    truthRoute: "/truth",
  };
}

function collectGovernedWorkspaceWriteAttempt({ tenantInput = {}, profileInput = {} } = {}) {
  const attemptedTenantFields = GOVERNED_WORKSPACE_FIELDS.tenant.filter((key) =>
    Object.prototype.hasOwnProperty.call(tenantInput, key)
  );
  const attemptedProfileFields = GOVERNED_WORKSPACE_FIELDS.profile.filter((key) =>
    Object.prototype.hasOwnProperty.call(profileInput, key)
  );

  return {
    attemptedTenantFields,
    attemptedProfileFields,
    hasGovernedWriteAttempt:
      attemptedTenantFields.length > 0 || attemptedProfileFields.length > 0,
  };
}

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
      roleResolved: getViewerRole(req),
      isInternal: getViewerRole(req) === "internal",
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
        viewerRole: getViewerRole(req),
        governance: buildWorkspaceGovernanceContract(),
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

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const role = await requireSettingsWriteMutation(req, res, {
        db,
        tenant,
        auditAction: "settings.workspace.updated",
        objectType: "tenant",
        objectId: tenant.id,
        targetArea: "workspace",
      });
      if (!role) return;

      const body = safeJsonObj(req.body, {});
      const tenantInput = safeJsonObj(body.tenant, {});
      const profileInput = safeJsonObj(body.profile, {});
      const aiPolicyInput = safeJsonObj(body.aiPolicy, {});
      const governedWriteAttempt = collectGovernedWorkspaceWriteAttempt({
        tenantInput,
        profileInput,
      });

      if (governedWriteAttempt.hasGovernedWriteAttempt) {
        await auditSafe(
          db,
          req,
          tenant,
          "settings.workspace.updated",
          "tenant",
          tenant.id,
          {
            scope: "workspace",
            outcome: "blocked",
            reasonCode: "governed_workspace_fields_require_review",
            governedFields: {
              tenant: governedWriteAttempt.attemptedTenantFields,
              profile: governedWriteAttempt.attemptedProfileFields,
            },
            setupRoute: "/home?assistant=setup",
            truthRoute: "/truth",
          }
        );

        return res.status(409).json({
          ok: false,
          error: "GovernedWorkspaceFieldsRequireReview",
          code: "GOVERNED_WORKSPACE_FIELDS_REQUIRE_REVIEW",
          message:
            "Business identity and profile fields are governed through setup review and can no longer be saved directly from workspace settings.",
          governedFields: {
            tenant: governedWriteAttempt.attemptedTenantFields,
            profile: governedWriteAttempt.attemptedProfileFields,
          },
          governance: buildWorkspaceGovernanceContract(),
        });
      }

      const currentSettings = (await dbGetWorkspaceSettings(db, tenantKey)) || {};
      const tenantInputForPolicy = {
        timezone:
          currentSettings?.tenant?.timezone || tenant?.timezone || "Asia/Baku",
      };
      const aiPolicySaveInput = buildAiPolicySaveInput(
        aiPolicyInput,
        role,
        tenantInputForPolicy
      );

      const aiPolicy = await dbUpsertTenantAiPolicy(db, tenant.id, aiPolicySaveInput);

      const settings = await dbGetWorkspaceSettings(db, tenantKey);

      await auditSafe(db, req, tenant, "settings.workspace.updated", "tenant", tenant.id, {
        scope: "workspace",
      });

      return ok(res, {
        tenant: settings?.tenant || currentSettings?.tenant || null,
        profile: settings?.profile || currentSettings?.profile || null,
        aiPolicy: settings?.aiPolicy || aiPolicy,
        viewerRole: role,
        governance: buildWorkspaceGovernanceContract(),
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to save workspace settings");
    }
  });

  return router;
}
