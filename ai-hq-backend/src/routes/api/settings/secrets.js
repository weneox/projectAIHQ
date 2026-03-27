import express from "express";
import { dbGetTenantByKey } from "../../../db/helpers/tenants.js";
import {
  dbListTenantSecretsMasked,
  dbGetTenantProviderSecrets,
  dbUpsertTenantSecret,
  dbDeleteTenantSecret,
} from "../../../db/helpers/tenantSecrets.js";
import {
  ok,
  bad,
  requireDb,
  requireTenant,
  requireOwnerOrAdmin,
  requireOwnerOrAdminMutation,
  serverErr,
  cleanLower,
  cleanString,
  getActor,
  isInternalServiceRequest,
  getUserRole,
  auditSafe,
} from "./utils.js";

export function secretsSettingsRoutes({ db }) {
  const router = express.Router();

  router.get("/settings/secrets", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const internal = isInternalServiceRequest(req);

      if (!internal) {
        const role = requireOwnerOrAdmin(req, res);
        if (!role) return;
      }

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const provider = cleanLower(req.query.provider || "");

      if (internal) {
        const secrets = await dbListTenantSecretsMasked(db, tenant.id, provider);
        return ok(res, {
          secrets,
          viewerRole: "internal",
          rawValuesExposed: false,
        });
      }

      const secrets = await dbListTenantSecretsMasked(db, tenant.id, provider);
      return ok(res, {
        secrets,
        viewerRole: getUserRole(req),
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to load secrets");
    }
  });

  router.post("/settings/secrets/:provider/:key", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const provider = cleanLower(req.params.provider);
      const secretKey = cleanLower(req.params.key);

      if (!provider) return bad(res, "provider is required");
      if (!secretKey) return bad(res, "secret key is required");

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const role = await requireOwnerOrAdminMutation(req, res, {
        db,
        tenant,
        message: "Only owner/admin can manage provider secrets",
        auditAction: "settings.secret.updated",
        objectType: "tenant_secret",
        objectId: `${provider}:${secretKey}`,
        targetArea: "provider_secret",
        auditMeta: {
          provider,
          secretKey,
        },
      });
      if (!role) return;

      const secretValue = cleanString(req.body?.value || req.body?.secret || "");
      if (!secretValue) {
        await auditSafe(
          db,
          req,
          tenant,
          "settings.secret.updated",
          "tenant_secret",
          `${provider}:${secretKey}`,
          {
            outcome: "blocked",
            reasonCode: "secret_value_required",
            targetArea: "provider_secret",
            provider,
            secretKey,
          }
        );
        return bad(res, "secret value is required");
      }

      const saved = await dbUpsertTenantSecret(
        db,
        tenant.id,
        provider,
        secretKey,
        secretValue,
        getActor(req)
      );

      await auditSafe(
        db,
        req,
        tenant,
        "settings.secret.updated",
        "tenant_secret",
        saved?.id || `${provider}:${secretKey}`,
        {
          outcome: "succeeded",
          targetArea: "provider_secret",
          provider,
          secretKey,
        }
      );

      return ok(res, {
        saved: true,
        secret: saved,
        viewerRole: role,
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to save secret");
    }
  });

  router.delete("/settings/secrets/:provider/:key", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const provider = cleanLower(req.params.provider);
      const secretKey = cleanLower(req.params.key);

      if (!provider) return bad(res, "provider is required");
      if (!secretKey) return bad(res, "secret key is required");

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const role = await requireOwnerOrAdminMutation(req, res, {
        db,
        tenant,
        message: "Only owner/admin can manage provider secrets",
        auditAction: "settings.secret.deleted",
        objectType: "tenant_secret",
        objectId: `${provider}:${secretKey}`,
        targetArea: "provider_secret",
        auditMeta: {
          provider,
          secretKey,
        },
      });
      if (!role) return;

      const deleted = await dbDeleteTenantSecret(db, tenant.id, provider, secretKey);
      if (!deleted) {
        await auditSafe(
          db,
          req,
          tenant,
          "settings.secret.deleted",
          "tenant_secret",
          `${provider}:${secretKey}`,
          {
            outcome: "blocked",
            reasonCode: "secret_not_found",
            targetArea: "provider_secret",
            provider,
            secretKey,
          }
        );
        return res.status(404).json({ ok: false, error: "Secret not found" });
      }

      await auditSafe(
        db,
        req,
        tenant,
        "settings.secret.deleted",
        "tenant_secret",
        `${provider}:${secretKey}`,
        {
          outcome: "succeeded",
          targetArea: "provider_secret",
          provider,
          secretKey,
        }
      );

      return ok(res, {
        deleted: true,
        provider,
        secretKey,
        viewerRole: role,
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to delete secret");
    }
  });

  return router;
}
