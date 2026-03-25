import express from "express";
import { dbListTenantChannels, dbUpsertTenantChannel } from "../../../db/helpers/settings.js";
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
import { buildChannelSaveInput } from "./builders.js";

export function channelsSettingsRoutes({ db }) {
  const router = express.Router();

  router.get("/settings/channels", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const channels = await dbListTenantChannels(db, tenant.id);
      return ok(res, {
        channels,
        viewerRole: isInternalServiceRequest(req) ? "internal" : getUserRole(req),
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to load channels");
    }
  });

  router.post("/settings/channels/:type", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const role = requireOwnerOrAdmin(req, res);
      if (!role) return;

      const channelType = cleanLower(req.params.type);
      if (!channelType) return bad(res, "channel type is required");

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const body = safeJsonObj(req.body, {});
      const saveInput = buildChannelSaveInput(body, role);

      const channel = await dbUpsertTenantChannel(db, tenant.id, channelType, saveInput);

      await auditSafe(
        db,
        req,
        tenant,
        "settings.channel.updated",
        "tenant_channel",
        channel?.id || channelType,
        {
          channelType,
          provider: saveInput.provider,
        }
      );

      return ok(res, { channel, viewerRole: role });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to save channel");
    }
  });

  return router;
}