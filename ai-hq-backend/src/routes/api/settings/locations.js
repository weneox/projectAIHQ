// src/routes/api/settings/locations.js

import express from "express";
import { dbGetTenantByKey } from "../../../db/helpers/tenants.js";
import {
  dbListTenantLocations,
} from "../../../db/helpers/tenantBusinessBrain.js";
import {
  listSetupLocationsFromDraftOrCanonical,
  stageLocationMutationInMaintenanceSession,
} from "../../../services/workspace/setup/draftBusinessIdentity.js";
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

      const data = await listSetupLocationsFromDraftOrCanonical({
        db,
        actor: {
          tenantId: tenant.id,
          tenantKey,
        },
      });

      return ok(res, {
        locations: data.locations,
        source: data.source,
        staged: data.staged,
        canonicalWriteDeferred: data.canonicalWriteDeferred,
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
      const staged = await stageLocationMutationInMaintenanceSession({
        db,
        actor: {
          tenantId: tenant.id,
          tenantKey,
        },
        mode: "upsert",
        body: {
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
        },
      });

      if (!staged?.stagedItem?.id && !staged?.stagedItem?.locationKey) {
        return bad(res, "Failed to save location");
      }

      await auditSafe(
        db,
        req,
        tenant,
        "settings.location.staged_for_review",
        "tenant_setup_review_draft",
        staged.maintenanceSession?.id,
        {
          locationKey: staged.stagedItem?.locationKey,
          publishStatus: staged.publishStatus,
        }
      );

      return ok(res, {
        location: staged.stagedItem,
        publishStatus: staged.publishStatus,
        reviewRequired: staged.reviewRequired,
        maintenanceSession: staged.maintenanceSession,
        maintenanceDraft: staged.maintenanceDraft,
        liveMutationDeferred: staged.liveMutationDeferred,
        runtimeProjectionRefreshed: staged.runtimeProjectionRefreshed,
        viewerRole: role,
      });
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

      const existingLocations = await dbListTenantLocations(db, tenant.id);
      const target = existingLocations.find(
        (item) => cleanString(item.id) === locationId
      );
      if (!target?.id) {
        return res.status(404).json({ ok: false, error: "Location not found" });
      }

      const staged = await stageLocationMutationInMaintenanceSession({
        db,
        actor: {
          tenantId: tenant.id,
          tenantKey,
        },
        mode: "delete",
        locationId: target.location_key || target.id,
      });

      await auditSafe(
        db,
        req,
        tenant,
        "settings.location.delete_staged_for_review",
        "tenant_setup_review_draft",
        staged.maintenanceSession?.id,
        {
          locationKey: target.location_key,
          publishStatus: staged.publishStatus,
        }
      );

      return ok(res, {
        deleted: true,
        id: locationId,
        stagedDeletion: true,
        publishStatus: staged.publishStatus,
        reviewRequired: staged.reviewRequired,
        maintenanceSession: staged.maintenanceSession,
        maintenanceDraft: staged.maintenanceDraft,
        liveMutationDeferred: staged.liveMutationDeferred,
        runtimeProjectionRefreshed: staged.runtimeProjectionRefreshed,
        viewerRole: role,
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to delete location");
    }
  });

  return router;
}
