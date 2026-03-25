import express from "express";
import { dbListTenantAgents, dbUpsertTenantAgent } from "../../../db/helpers/settings.js";
import { dbGetTenantByKey } from "../../../db/helpers/tenants.js";
import {
  ok,
  bad,
  requireDb,
  requireTenant,
  requireOwnerOrAdmin,
  serverErr,
  safeJsonObj,
  cleanLower,
  isInternalServiceRequest,
  getUserRole,
  auditSafe,
} from "./utils.js";
import { buildAgentSaveInput } from "./builders.js";

export function agentsSettingsRoutes({ db }) {
  const router = express.Router();

  router.get("/settings/agents", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const agents = await dbListTenantAgents(db, tenant.id);
      return ok(res, {
        agents,
        viewerRole: isInternalServiceRequest(req) ? "internal" : getUserRole(req),
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to load agents");
    }
  });

  router.post("/settings/agents/:key", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const role = requireOwnerOrAdmin(req, res);
      if (!role) return;

      const agentKey = cleanLower(req.params.key);
      if (!agentKey) return bad(res, "agent key is required");

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const body = safeJsonObj(req.body, {});
      const saveInput = buildAgentSaveInput(body, role);

      const agent = await dbUpsertTenantAgent(db, tenant.id, agentKey, saveInput);

      await auditSafe(
        db,
        req,
        tenant,
        "settings.agent.updated",
        "tenant_agent",
        agent?.id || agentKey,
        {
          agentKey,
        }
      );

      return ok(res, { agent, viewerRole: role });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to save agent");
    }
  });

  return router;
}