// src/routes/api/tenants/internal.js

import express from "express";
import { requireInternalToken } from "../../../utils/auth.js";
import { dbGetTenantProviderSecrets } from "../../../db/helpers/tenantSecrets.js";
import { sanitizeProviderSecrets } from "../../../utils/securitySurface.js";
import { validateResolveChannelQuery } from "@aihq/shared-contracts/critical";

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

function ok(res, data = {}) {
  return res.status(200).json({ ok: true, ...data });
}

function bad(res, error, extra = {}) {
  return res.status(400).json({ ok: false, error, ...extra });
}

function serverErr(res, error, extra = {}) {
  return res.status(500).json({ ok: false, error, ...extra });
}

function rowOrNull(r) {
  return r?.rows?.[0] || null;
}

async function dbResolveTenantChannel(
  db,
  { channel, recipientId, pageId, igUserId }
) {
  if (!db?.query) return null;

  const safeChannel = cleanLower(channel);
  const safeRecipientId = cleanNullableString(recipientId);
  const safePageId = cleanNullableString(pageId);
  const safeIgUserId = cleanNullableString(igUserId);

  if (!safeChannel) return null;
  if (!safeRecipientId && !safePageId && !safeIgUserId) return null;

  if (safePageId) {
    const q = await db.query(
      `
        select
          tc.id,
          tc.tenant_id,
          tc.channel_type,
          tc.provider,
          tc.display_name,
          tc.external_account_id,
          tc.external_page_id,
          tc.external_user_id,
          tc.external_username,
          tc.status,
          tc.is_primary,
          tc.config,
          tc.secrets_ref,
          tc.health,
          tc.last_sync_at,
          tc.created_at,
          tc.updated_at,
          t.tenant_key,
          t.company_name,
          t.legal_name,
          t.industry_key,
          t.country_code,
          t.timezone,
          t.default_language,
          t.enabled_languages,
          t.market_region,
          t.plan_key,
          t.status as tenant_status,
          t.active as tenant_active
        from tenant_channels tc
        join tenants t on t.id = tc.tenant_id
        where tc.channel_type = $1
          and (
            tc.external_page_id = $2
            or tc.external_user_id = $2
            or tc.external_account_id = $2
          )
        order by
          tc.is_primary desc,
          tc.updated_at desc,
          tc.created_at desc
        limit 1
      `,
      [safeChannel, safePageId]
    );

    const row = rowOrNull(q);
    if (row) return row;
  }

  if (safeIgUserId) {
    const q = await db.query(
      `
        select
          tc.id,
          tc.tenant_id,
          tc.channel_type,
          tc.provider,
          tc.display_name,
          tc.external_account_id,
          tc.external_page_id,
          tc.external_user_id,
          tc.external_username,
          tc.status,
          tc.is_primary,
          tc.config,
          tc.secrets_ref,
          tc.health,
          tc.last_sync_at,
          tc.created_at,
          tc.updated_at,
          t.tenant_key,
          t.company_name,
          t.legal_name,
          t.industry_key,
          t.country_code,
          t.timezone,
          t.default_language,
          t.enabled_languages,
          t.market_region,
          t.plan_key,
          t.status as tenant_status,
          t.active as tenant_active
        from tenant_channels tc
        join tenants t on t.id = tc.tenant_id
        where tc.channel_type = $1
          and (
            tc.external_user_id = $2
            or tc.external_account_id = $2
          )
        order by
          tc.is_primary desc,
          tc.updated_at desc,
          tc.created_at desc
        limit 1
      `,
      [safeChannel, safeIgUserId]
    );

    const row = rowOrNull(q);
    if (row) return row;
  }

  if (safeRecipientId) {
    const q = await db.query(
      `
        select
          tc.id,
          tc.tenant_id,
          tc.channel_type,
          tc.provider,
          tc.display_name,
          tc.external_account_id,
          tc.external_page_id,
          tc.external_user_id,
          tc.external_username,
          tc.status,
          tc.is_primary,
          tc.config,
          tc.secrets_ref,
          tc.health,
          tc.last_sync_at,
          tc.created_at,
          tc.updated_at,
          t.tenant_key,
          t.company_name,
          t.legal_name,
          t.industry_key,
          t.country_code,
          t.timezone,
          t.default_language,
          t.enabled_languages,
          t.market_region,
          t.plan_key,
          t.status as tenant_status,
          t.active as tenant_active
        from tenant_channels tc
        join tenants t on t.id = tc.tenant_id
        where tc.channel_type = $1
          and (
            tc.external_user_id = $2
            or tc.external_account_id = $2
            or tc.external_page_id = $2
          )
        order by
          tc.is_primary desc,
          tc.updated_at desc,
          tc.created_at desc
        limit 1
      `,
      [safeChannel, safeRecipientId]
    );

    return rowOrNull(q);
  }

  return null;
}

export function tenantInternalRoutes({ db }) {
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

      const match = await dbResolveTenantChannel(db, {
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
      });
    } catch (err) {
      console.error("[ai-hq] resolve-channel failed", {
        error: err?.message || String(err),
      });

      return serverErr(res, err?.message || "Failed to resolve tenant channel");
    }
  });

  return router;
}
