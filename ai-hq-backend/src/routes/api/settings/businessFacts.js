import express from "express";
import { dbGetTenantByKey } from "../../../db/helpers/tenants.js";
import {
  dbListTenantBusinessFacts,
  dbUpsertTenantBusinessFact,
  dbDeleteTenantBusinessFact,
} from "../../../db/helpers/tenantBusinessBrain.js";
import {
  ok,
  bad,
  requireDb,
  requireTenant,
  requireOwnerOrAdmin,
  serverErr,
  safeJsonObj,
  safeJsonArr,
  cleanLower,
  cleanString,
  cleanNullableString,
  normalizeBool,
  normalizeNumber,
  isInternalServiceRequest,
  getUserRole,
  auditSafe,
} from "./utils.js";

export function businessFactsSettingsRoutes({ db }) {
  const router = express.Router();

  router.get("/business-facts", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const language = cleanLower(req.query.language || "");
      const factGroup = cleanLower(req.query.factGroup || req.query.fact_group || "");

      const facts = await dbListTenantBusinessFacts(db, tenant.id, {
        language,
        factGroup,
        enabledOnly: false,
      });

      return ok(res, {
        facts,
        viewerRole: isInternalServiceRequest(req) ? "internal" : getUserRole(req),
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to load business facts");
    }
  });

  router.post("/business-facts", async (req, res) => {
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
      const saved = await dbUpsertTenantBusinessFact(db, tenant.id, {
        fact_key: cleanLower(body.fact_key || body.factKey),
        fact_group: cleanLower(body.fact_group || body.factGroup || "general"),
        title: cleanString(body.title),
        value_text: cleanString(body.value_text || body.valueText),
        value_json: safeJsonObj(body.value_json || body.valueJson, {}),
        language: cleanLower(body.language || "en"),
        channel_scope: safeJsonArr(body.channel_scope || body.channelScope, []),
        usecase_scope: safeJsonArr(body.usecase_scope || body.usecaseScope, []),
        priority: normalizeNumber(body.priority, 100),
        enabled: normalizeBool(body.enabled, true),
        source_type: cleanLower(body.source_type || body.sourceType || "manual"),
        source_ref: cleanNullableString(body.source_ref || body.sourceRef),
        meta: safeJsonObj(body.meta, {}),
      });

      if (!saved?.id) {
        return bad(res, "Failed to save business fact");
      }

      await auditSafe(
        db,
        req,
        tenant,
        "settings.business_fact.updated",
        "tenant_business_fact",
        saved.id,
        {
          factKey: saved.fact_key,
          factGroup: saved.fact_group,
        }
      );

      return ok(res, { fact: saved, viewerRole: role });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to save business fact");
    }
  });

  router.delete("/business-facts/:id", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const role = requireOwnerOrAdmin(req, res);
      if (!role) return;

      const factId = cleanString(req.params.id);
      if (!factId) return bad(res, "fact id is required");

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const deleted = await dbDeleteTenantBusinessFact(db, tenant.id, factId);
      if (!deleted) {
        return res.status(404).json({ ok: false, error: "Business fact not found" });
      }

      await auditSafe(
        db,
        req,
        tenant,
        "settings.business_fact.deleted",
        "tenant_business_fact",
        factId
      );

      return ok(res, { deleted: true, id: factId, viewerRole: role });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to delete business fact");
    }
  });

  return router;
}