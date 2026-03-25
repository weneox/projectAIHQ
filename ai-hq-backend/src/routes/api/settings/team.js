import express from "express";
import { dbGetTenantByKey } from "../../../db/helpers/tenants.js";
import { dbListTenantUsers } from "../../../db/helpers/tenantUsers.js";
import {
  ok,
  requireDb,
  requireTenant,
  serverErr,
  isInternalServiceRequest,
  getUserRole,
} from "./utils.js";

export function teamSettingsRoutes({ db }) {
  const router = express.Router();

  router.get("/settings/team", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const users = await dbListTenantUsers(db, tenant.id);
      return ok(res, {
        users,
        viewerRole: isInternalServiceRequest(req) ? "internal" : getUserRole(req),
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to load team");
    }
  });

  return router;
}