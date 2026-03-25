// src/routes/api/settings/contacts.js

import express from "express";
import { dbGetTenantByKey } from "../../../db/helpers/tenants.js";
import {
  dbListTenantContacts,
  dbUpsertTenantContact,
  dbDeleteTenantContact,
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

export function contactsSettingsRoutes({ db }) {
  const router = express.Router();

  router.get("/contacts", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const contacts = await dbListTenantContacts(db, tenant.id);

      return ok(res, {
        contacts,
        viewerRole: isInternalServiceRequest(req) ? "internal" : getUserRole(req),
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to load contacts");
    }
  });

  router.post("/contacts", async (req, res) => {
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
      const saved = await dbUpsertTenantContact(db, tenant.id, {
        contact_key: cleanLower(body.contact_key || body.contactKey),
        channel: cleanLower(body.channel || "other"),
        label: cleanString(body.label),
        value: cleanString(body.value),
        is_primary: normalizeBool(body.is_primary, false),
        enabled: normalizeBool(body.enabled, true),
        visible_public: normalizeBool(body.visible_public, true),
        visible_in_ai: normalizeBool(body.visible_in_ai, true),
        sort_order: normalizeNumber(body.sort_order, 0),
        meta: safeJsonObj(body.meta, {}),
      });

      if (!saved?.id) {
        return bad(res, "Failed to save contact");
      }

      await auditSafe(
        db,
        req,
        tenant,
        "settings.contact.updated",
        "tenant_contact",
        saved.id,
        {
          contactKey: saved.contact_key,
          channel: saved.channel,
        }
      );

      return ok(res, { contact: saved, viewerRole: role });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to save contact");
    }
  });

  router.delete("/contacts/:id", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const role = requireOwnerOrAdmin(req, res);
      if (!role) return;

      const contactId = cleanString(req.params.id);
      if (!contactId) return bad(res, "contact id is required");

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const deleted = await dbDeleteTenantContact(db, tenant.id, contactId);
      if (!deleted) {
        return res.status(404).json({ ok: false, error: "Contact not found" });
      }

      await auditSafe(
        db,
        req,
        tenant,
        "settings.contact.deleted",
        "tenant_contact",
        contactId
      );

      return ok(res, { deleted: true, id: contactId, viewerRole: role });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to delete contact");
    }
  });

  return router;
}