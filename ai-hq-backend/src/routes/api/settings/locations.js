// src/routes/api/settings/locations.js

import express from "express";
import { dbGetTenantByKey } from "../../../db/helpers/tenants.js";
import {
  dbListTenantLocations,
  dbUpsertTenantLocation,
  dbDeleteTenantLocation,
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

export function locationsSettingsRoutes({ db }) {
  const router = express.Router();

  router.get("/locations", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const locations = await dbListTenantLocations(db, tenant.id);

      return ok(res, {
        locations,
        viewerRole: isInternalServiceRequest(req) ? "internal" : getUserRole(req),
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to load locations");
    }
  });

  router.post("/locations", async (req, res) => {
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
      const saved = await dbUpsertTenantLocation(db, tenant.id, {
        location_key: cleanLower(body.location_key || body.locationKey),
        title: cleanString(body.title),
        country_code: cleanNullableString(body.country_code || body.countryCode),
        city: cleanNullableString(body.city),
        address_line: cleanNullableString(body.address_line || body.addressLine),
        map_url: cleanNullableString(body.map_url || body.mapUrl),
        phone: cleanNullableString(body.phone),
        email: cleanNullableString(body.email),
        working_hours: safeJsonObj(body.working_hours || body.workingHours, {}),
        delivery_areas: safeJsonArr(body.delivery_areas || body.deliveryAreas, []),
        is_primary: normalizeBool(body.is_primary, false),
        enabled: normalizeBool(body.enabled, true),
        sort_order: normalizeNumber(body.sort_order, 0),
        meta: safeJsonObj(body.meta, {}),
      });

      if (!saved?.id) {
        return bad(res, "Failed to save location");
      }

      await auditSafe(
        db,
        req,
        tenant,
        "settings.location.updated",
        "tenant_location",
        saved.id,
        {
          locationKey: saved.location_key,
        }
      );

      return ok(res, { location: saved, viewerRole: role });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to save location");
    }
  });

  router.delete("/locations/:id", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const role = requireOwnerOrAdmin(req, res);
      if (!role) return;

      const locationId = cleanString(req.params.id);
      if (!locationId) return bad(res, "location id is required");

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const deleted = await dbDeleteTenantLocation(db, tenant.id, locationId);
      if (!deleted) {
        return res.status(404).json({ ok: false, error: "Location not found" });
      }

      await auditSafe(
        db,
        req,
        tenant,
        "settings.location.deleted",
        "tenant_location",
        locationId
      );

      return ok(res, { deleted: true, id: locationId, viewerRole: role });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to delete location");
    }
  });

  return router;
}