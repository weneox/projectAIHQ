// src/routes/api/settings/contacts.js

import express from "express";
import { dbGetTenantByKey } from "../../../db/helpers/tenants.js";
import {
  dbListTenantContacts,
} from "../../../db/helpers/tenantBusinessBrain.js";
import {
  listSetupContactsFromDraftOrCanonical,
  stageContactMutationInMaintenanceSession,
} from "../../../services/workspace/setup/draftBusinessIdentity.js";
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

      const data = await listSetupContactsFromDraftOrCanonical({
        db,
        actor: {
          tenantId: tenant.id,
          tenantKey,
        },
      });

      return ok(res, {
        contacts: data.contacts,
        source: data.source,
        staged: data.staged,
        canonicalWriteDeferred: data.canonicalWriteDeferred,
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
      const staged = await stageContactMutationInMaintenanceSession({
        db,
        actor: {
          tenantId: tenant.id,
          tenantKey,
        },
        mode: "upsert",
        body: {
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
        },
      });

      if (!staged?.stagedItem?.id && !staged?.stagedItem?.contactKey) {
        return bad(res, "Failed to save contact");
      }

      await auditSafe(
        db,
        req,
        tenant,
        "settings.contact.staged_for_review",
        "tenant_setup_review_draft",
        staged.maintenanceSession?.id,
        {
          contactKey: staged.stagedItem?.contactKey,
          channel: staged.stagedItem?.channel,
          publishStatus: staged.publishStatus,
        }
      );

      return ok(res, {
        contact: staged.stagedItem,
        publishStatus: staged.publishStatus,
        reviewRequired: staged.reviewRequired,
        maintenanceSession: staged.maintenanceSession,
        maintenanceDraft: staged.maintenanceDraft,
        liveMutationDeferred: staged.liveMutationDeferred,
        runtimeProjectionRefreshed: staged.runtimeProjectionRefreshed,
        viewerRole: role,
      });
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

      const existingContacts = await dbListTenantContacts(db, tenant.id);
      const target = existingContacts.find(
        (item) => cleanString(item.id) === contactId
      );
      if (!target?.id) {
        return res.status(404).json({ ok: false, error: "Contact not found" });
      }

      const staged = await stageContactMutationInMaintenanceSession({
        db,
        actor: {
          tenantId: tenant.id,
          tenantKey,
        },
        mode: "delete",
        contactId: target.contact_key || target.id,
      });

      await auditSafe(
        db,
        req,
        tenant,
        "settings.contact.delete_staged_for_review",
        "tenant_setup_review_draft",
        staged.maintenanceSession?.id,
        {
          contactKey: target.contact_key,
          publishStatus: staged.publishStatus,
        }
      );

      return ok(res, {
        deleted: true,
        id: contactId,
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
      return serverErr(res, err?.message || "Failed to delete contact");
    }
  });

  return router;
}
