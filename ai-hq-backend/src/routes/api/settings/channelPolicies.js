// src/routes/api/settings/channelPolicies.js

import express from "express";
import { dbGetTenantByKey } from "../../../db/helpers/tenants.js";
import {
  dbListTenantChannelPolicies,
  dbUpsertTenantChannelPolicy,
  dbDeleteTenantChannelPolicy,
} from "../../../db/helpers/tenantBusinessBrain.js";
import {
  ok,
  bad,
  requireDb,
  requireTenant,
  requireOwnerOrAdmin,
  serverErr,
  safeJsonObj,
  cleanLower,
  cleanString,
  normalizeBool,
  normalizeNumber,
  isInternalServiceRequest,
  getUserRole,
  auditSafe,
} from "./utils.js";

export function channelPoliciesSettingsRoutes({ db }) {
  const router = express.Router();

  router.get("/channel-policies", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const policies = await dbListTenantChannelPolicies(db, tenant.id);

      return ok(res, {
        policies,
        configSurface: "operational_runtime_config",
        publishGovernance: "not_applicable",
        truthPublicationRequired: false,
        publishedTruthChanged: false,
        viewerRole: isInternalServiceRequest(req) ? "internal" : getUserRole(req),
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to load channel policies");
    }
  });

  router.post("/channel-policies", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const role = requireOwnerOrAdmin(req, res);
      if (!role) return;

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const body = safeJsonObj(req.body, {});
      const saved = await dbUpsertTenantChannelPolicy(db, tenant.id, {
        channel: cleanLower(body.channel),
        subchannel: cleanLower(body.subchannel || "default"),
        enabled: normalizeBool(body.enabled, true),
        auto_reply_enabled: normalizeBool(body.auto_reply_enabled, true),
        ai_reply_enabled: normalizeBool(body.ai_reply_enabled, true),
        human_handoff_enabled: normalizeBool(body.human_handoff_enabled, true),
        pricing_visibility: cleanLower(body.pricing_visibility || "inherit"),
        public_reply_mode: cleanLower(body.public_reply_mode || "inherit"),
        contact_capture_mode: cleanLower(body.contact_capture_mode || "inherit"),
        escalation_mode: cleanLower(body.escalation_mode || "inherit"),
        reply_style: cleanString(body.reply_style),
        max_reply_sentences: normalizeNumber(body.max_reply_sentences, 2),
        rules: safeJsonObj(body.rules, {}),
        meta: safeJsonObj(body.meta, {}),
      });

      if (!saved?.id) {
        return bad(res, "Failed to save channel policy");
      }

      await auditSafe(
        db,
        req,
        tenant,
        "settings.channel_policy.operational_config.updated",
        "tenant_channel_policy",
        saved.id,
        {
          channel: saved.channel,
          subchannel: saved.subchannel,
        }
      );

      return ok(res, {
        policy: saved,
        configSurface: "operational_runtime_config",
        publishGovernance: "not_applicable",
        truthPublicationRequired: false,
        publishedTruthChanged: false,
        truthVersionCreated: false,
        savedAsOperationalConfig: true,
        runtimeConsumption: "operational_config_projection_input",
        viewerRole: role,
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to save channel policy");
    }
  });

  router.delete("/channel-policies/:id", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const role = requireOwnerOrAdmin(req, res);
      if (!role) return;

      const policyId = cleanString(req.params.id);
      if (!policyId) return bad(res, "policy id is required");

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const deleted = await dbDeleteTenantChannelPolicy(db, tenant.id, policyId);
      if (!deleted) {
        return res.status(404).json({ ok: false, error: "Channel policy not found" });
      }

      await auditSafe(
        db,
        req,
        tenant,
        "settings.channel_policy.operational_config.deleted",
        "tenant_channel_policy",
        policyId
      );

      return ok(res, {
        deleted: true,
        id: policyId,
        configSurface: "operational_runtime_config",
        publishGovernance: "not_applicable",
        truthPublicationRequired: false,
        publishedTruthChanged: false,
        truthVersionCreated: false,
        savedAsOperationalConfig: true,
        runtimeConsumption: "operational_config_projection_input",
        viewerRole: role,
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to delete channel policy");
    }
  });

  return router;
}
