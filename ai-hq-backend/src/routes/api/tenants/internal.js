// src/routes/api/tenants/internal.js

import express from "express";
import { requireInternalToken } from "../../../utils/auth.js";
import { dbGetTenantProviderSecrets } from "../../../db/helpers/tenantSecrets.js";
import { sanitizeProviderSecrets } from "../../../utils/securitySurface.js";
import { validateResolveChannelQuery } from "@aihq/shared-contracts/critical";
import {
  buildRuntimeAuthorityFailurePayload,
  getTenantBrainRuntime,
  isRuntimeAuthorityError,
} from "../../../services/businessBrain/getTenantBrainRuntime.js";
import { buildProjectedTenantRuntime } from "../../../services/projectedTenantRuntime.js";
import { buildOperationalChannels } from "../../../services/operationalChannels.js";
import {
  resolveTenantChannelByExternalIds,
  resolveTenantMetaProviderAccess,
} from "../../../services/tenantProviderSecrets.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function cleanNullableString(v) {
  if (v === null || v === undefined) return null;
  const x = String(v).trim();
  if (!x) return null;
  const lx = x.toLowerCase();
  if (lx === "null" || lx === "undefined") return null;
  return x;
}

function cleanLower(v, d = "") {
  return s(v, d).toLowerCase();
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function ok(res, data = {}) {
  return res.status(200).json({ ok: true, ...data });
}

function bad(res, error, extra = {}) {
  return res.status(400).json({ ok: false, error, ...extra });
}

function serverErr(res, error, extra = {}) {
  return res.status(500).json({ ok: false, error, ...extra });
}

export function tenantInternalRoutes({ db, getRuntime = getTenantBrainRuntime }) {
  const router = express.Router();

  router.get("/tenants/resolve-channel", requireInternalToken, async (req, res) => {
    try {
      if (!db?.query) {
        return res.status(500).json({
          ok: false,
          error: "Database is not available",
        });
      }

      const checked = validateResolveChannelQuery(req.query || {});
      if (!checked.ok) {
        return bad(res, checked.error);
      }

      const channel = checked.value.channel;
      const recipientId = cleanNullableString(checked.value.recipientId);
      const pageId = cleanNullableString(checked.value.pageId);
      const igUserId = cleanNullableString(checked.value.igUserId);
      console.log("[ai-hq] resolve-channel hit", { channel, recipientId, pageId, igUserId });

      const startedAt = Date.now();

      console.log("[ai-hq] resolve-channel before db", {
        channel,
        recipientId,
        pageId,
        igUserId,
        candidateIds: [recipientId, pageId, igUserId].filter(Boolean),
      });

      const match = await resolveTenantChannelByExternalIds(db, {
        channel,
        recipientId,
        pageId,
        igUserId,
      });

      console.log("[ai-hq] resolve-channel after db", {
        tookMs: Date.now() - startedAt,
        found: Boolean(match?.tenant_id),
      });

      if (!match?.tenant_id) {
        return res.status(404).json({
          ok: false,
          error: "Tenant channel not found",
          channel,
          recipientId: recipientId || null,
          pageId: pageId || null,
          igUserId: igUserId || null,
        });
      }

      console.log("[ai-hq] resolve-channel matched", {
        tenantKey: match.tenant_key,
        tenantId: match.tenant_id,
        channelType: match.channel_type,
        external_page_id: match.external_page_id,
        external_user_id: match.external_user_id,
        external_account_id: match.external_account_id,
      });

      const providerKey =
        cleanLower(match.provider || "") ||
        cleanLower(match.secrets_ref || "") ||
        "meta";

      const providerSecrets = await dbGetTenantProviderSecrets(
        db,
        match.tenant_id,
        providerKey
      );

      const secretSummary = sanitizeProviderSecrets(providerSecrets, {
        includeValues: false,
      });

      let runtime = null;
      try {
        runtime = await getRuntime({
          db,
          tenantId: match.tenant_id,
          tenantKey: match.tenant_key,
          authorityMode: "strict",
        });
      } catch (error) {
        if (isRuntimeAuthorityError(error)) {
          const failure = buildRuntimeAuthorityFailurePayload(error, {
            service: "tenants.resolve-channel",
            tenantKey: match.tenant_key,
          });
          return res.status(Number(error?.statusCode || 409)).json(failure);
        }
        throw error;
      }

      const operationalChannels = await buildOperationalChannels({
        db,
        tenantId: match.tenant_id,
        matchedChannel: match,
      });

      const projectedRuntime = buildProjectedTenantRuntime({
        runtime,
        matchedChannel: match,
        operationalChannels,
        providerSecrets: {
          provider: providerKey,
          rawValuesExposed: false,
          ...secretSummary,
        },
      });

      console.log("[ai-hq] resolve-channel secrets loaded", {
        tenantKey: match.tenant_key,
        provider: providerKey,
        secretKeys: secretSummary.secretKeys,
        hasPageAccessToken: secretSummary.secrets.some(
          (x) => cleanLower(x.key) === "page_access_token" && x.present
        ),
      });

      return ok(res, {
        tenantKey: match.tenant_key,
        tenantId: match.tenant_id,
        resolvedChannel: match.channel_type,
        tenant: {
          id: match.tenant_id,
          tenant_key: match.tenant_key,
          company_name: match.company_name,
          legal_name: match.legal_name,
          industry_key: match.industry_key,
          country_code: match.country_code,
          timezone: match.timezone,
          default_language: match.default_language,
          enabled_languages: match.enabled_languages,
          market_region: match.market_region,
          plan_key: match.plan_key,
          status: match.tenant_status,
          active: match.tenant_active,
        },
        channelConfig: {
          id: match.id,
          tenant_id: match.tenant_id,
          tenantKey: match.tenant_key,
          channel_type: match.channel_type,
          channelType: match.channel_type,
          provider: match.provider,
          display_name: match.display_name,
          external_account_id: match.external_account_id,
          external_page_id: match.external_page_id,
          external_user_id: match.external_user_id,
          external_username: match.external_username,
          pageId: match.external_page_id,
          page_id: match.external_page_id,
          igUserId: match.external_user_id,
          ig_user_id: match.external_user_id,
          instagram_business_account_id: match.external_user_id,
          status: match.status,
          is_primary: match.is_primary,
          config: match.config,
          secrets_ref: match.secrets_ref,
          health: match.health,
          last_sync_at: match.last_sync_at,
          created_at: match.created_at,
          updated_at: match.updated_at,
        },
        providerSecrets: {
          provider: providerKey,
          rawValuesExposed: false,
          ...secretSummary,
        },
        operationalChannels,
        projectedRuntime,
      });
    } catch (err) {
      console.error("[ai-hq] resolve-channel failed", {
        error: err?.message || String(err),
      });

      return serverErr(res, err?.message || "Failed to resolve tenant channel");
    }
  });

  router.get(
    "/internal/providers/meta-channel-access",
    requireInternalToken,
    async (req, res) => {
      try {
        if (!db?.query) {
          return res.status(500).json({
            ok: false,
            error: "Database is not available",
          });
        }

        const checked = validateResolveChannelQuery(req.query || {});
        if (!checked.ok) {
          return bad(res, checked.error);
        }

        const resolved = await resolveTenantMetaProviderAccess(db, {
          channel: checked.value.channel,
          recipientId: cleanNullableString(checked.value.recipientId),
          pageId: cleanNullableString(checked.value.pageId),
          igUserId: cleanNullableString(checked.value.igUserId),
        });

        if (!resolved?.ok || !resolved?.tenantId) {
          return res.status(404).json({
            ok: false,
            error: s(resolved?.error || "tenant_channel_not_found"),
          });
        }

        let runtime = null;
        try {
          runtime = await getRuntime({
            db,
            tenantId: resolved.tenantId,
            tenantKey: resolved.tenantKey,
            authorityMode: "strict",
          });
        } catch (error) {
          if (isRuntimeAuthorityError(error)) {
            const failure = buildRuntimeAuthorityFailurePayload(error, {
              service: "providers.meta-channel-access",
              tenantKey: resolved.tenantKey,
            });
            return res.status(Number(error?.statusCode || 409)).json(failure);
          }
          throw error;
        }

        const operationalChannels = await buildOperationalChannels({
          db,
          tenantId: resolved.tenantId,
          matchedChannel: resolved.matchedChannel,
        });

        const projectedRuntime = buildProjectedTenantRuntime({
          runtime,
          matchedChannel: resolved.matchedChannel,
          operationalChannels,
        });

        const providerAccess = {
          ...obj(resolved.providerAccess),
          authority: obj(runtime.authority),
        };

        if (operationalChannels?.meta?.ready !== true) {
          return res.status(409).json({
            ok: false,
            error: "meta_operational_unavailable",
            tenantKey: resolved.tenantKey,
            tenantId: resolved.tenantId,
            reasonCode: s(
              operationalChannels?.meta?.reasonCode || "channel_identifiers_missing"
            ),
          });
        }

        if (!providerAccess.available) {
          return res.status(409).json({
            ok: false,
            error: "provider_access_unavailable",
            tenantKey: resolved.tenantKey,
            tenantId: resolved.tenantId,
            reasonCode: s(providerAccess.reasonCode || "provider_access_incomplete"),
          });
        }

        return ok(res, {
          tenantKey: resolved.tenantKey,
          tenantId: resolved.tenantId,
          projectedRuntime,
          operationalChannels,
          providerAccess,
        });
      } catch (err) {
        console.error("[ai-hq] meta-channel-access failed", {
          error: err?.message || String(err),
        });

        return serverErr(
          res,
          err?.message || "Failed to resolve provider channel access"
        );
      }
    }
  );

  return router;
}
