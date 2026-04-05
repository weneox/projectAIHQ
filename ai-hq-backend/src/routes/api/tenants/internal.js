// src/routes/api/tenants/internal.js

import express from "express";
import { createInternalTokenGuard } from "../../../utils/auth.js";
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
import {
  buildOperationalRepairGuidance,
  buildReadinessSurface,
} from "../../../services/operationalReadiness.js";
import {
  buildInstagramLifecycleChannelPayload,
  META_CONNECT_SELECTION_SECRET_KEY,
  markInstagramSourceDisconnected,
  readPendingMetaSelection,
} from "../channelConnect/meta.js";
import {
  auditSafe,
  deleteMetaSecretKeys,
  markInstagramDisconnected,
} from "../channelConnect/repository.js";

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

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function uniqStrings(values = []) {
  return [...new Set(arr(values).map((x) => s(x)).filter(Boolean))];
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

function createSafeLogger(baseLogger, childContext = null) {
  const root = baseLogger && typeof baseLogger === "object" ? baseLogger : null;

  let active = root;
  if (childContext && root && typeof root.child === "function") {
    try {
      active = root.child(childContext) || root;
    } catch {
      active = root;
    }
  }

  function call(method, ...args) {
    try {
      const fn =
        (active && typeof active[method] === "function" && active[method]) ||
        (root && typeof root[method] === "function" && root[method]) ||
        null;
      if (fn) {
        return fn.apply(active || root, args);
      }
    } catch {
      // noop
    }
    return undefined;
  }

  return {
    child(context = {}) {
      return createSafeLogger(active || root, context);
    },
    info(...args) {
      return call("info", ...args);
    },
    warn(...args) {
      return call("warn", ...args);
    },
    error(...args) {
      return call("error", ...args);
    },
    debug(...args) {
      return call("debug", ...args);
    },
  };
}

function inferMatchedMetaIds(matchedChannel = {}) {
  const channel = obj(matchedChannel);

  const pageId = cleanNullableString(
    channel.external_page_id || channel.pageId || channel.page_id
  );

  const igUserId = cleanNullableString(
    channel.external_user_id ||
      channel.igUserId ||
      channel.ig_user_id ||
      channel.instagram_business_account_id
  );

  return { pageId, igUserId };
}

function normalizeOperationalChannels({
  operationalChannels = {},
  matchedChannel = {},
} = {}) {
  const base = obj(operationalChannels);
  const meta = obj(base.meta);
  const inferred = inferMatchedMetaIds(matchedChannel);

  const pageId = cleanNullableString(
    meta.pageId || meta.page_id || inferred.pageId
  );
  const igUserId = cleanNullableString(
    meta.igUserId ||
      meta.ig_user_id ||
      meta.instagram_business_account_id ||
      inferred.igUserId
  );

  const inferredReady = meta.ready === true || Boolean(pageId || igUserId);

  const reasonCode = inferredReady
    ? cleanNullableString(meta.reasonCode || meta.reason_code)
    : s(meta.reasonCode || meta.reason_code || "channel_identifiers_missing");

  return {
    ...base,
    meta: {
      ...meta,
      pageId,
      page_id: pageId,
      igUserId,
      ig_user_id: igUserId,
      instagram_business_account_id: igUserId,
      ready: inferredReady,
      reasonCode,
      reason_code: reasonCode,
    },
  };
}

function normalizeProviderAccess(providerAccess = {}, matchedChannel = {}) {
  const source = obj(providerAccess);
  const matched = obj(matchedChannel);

  const pageAccessToken = cleanNullableString(
    source.pageAccessToken ||
      source.page_access_token ||
      source.accessToken ||
      source.access_token
  );

  const explicitAvailable =
    typeof source.available === "boolean" ? source.available : null;

  const secretKeys = uniqStrings([
    ...arr(source.secretKeys),
    ...arr(source.secret_keys),
    ...(pageAccessToken ? ["page_access_token"] : []),
  ]);

  const available = Boolean(pageAccessToken) || explicitAvailable === true;

  const reasonCode = available
    ? cleanNullableString(source.reasonCode || source.reason_code)
    : s(
        source.reasonCode ||
          source.reason_code ||
          (secretKeys.length
            ? "provider_access_incomplete"
            : "provider_secret_missing")
      );

  const inferredIds = inferMatchedMetaIds(matched);

  return {
    ...source,
    provider: s(source.provider || matched.provider || "meta"),
    pageAccessToken,
    page_access_token: pageAccessToken,
    secretKeys,
    secret_keys: secretKeys,
    available,
    reasonCode,
    reason_code: reasonCode,
    pageId: cleanNullableString(
      source.pageId || source.page_id || inferredIds.pageId
    ),
    page_id: cleanNullableString(
      source.pageId || source.page_id || inferredIds.pageId
    ),
    igUserId: cleanNullableString(
      source.igUserId ||
        source.ig_user_id ||
        source.instagram_business_account_id ||
        inferredIds.igUserId
    ),
    ig_user_id: cleanNullableString(
      source.igUserId ||
        source.ig_user_id ||
        source.instagram_business_account_id ||
        inferredIds.igUserId
    ),
  };
}

function buildMetaRuntimeReadiness({
  operationalChannels = {},
  providerAccess = {},
  includeProviderAccess = false,
} = {}) {
  const blockers = [];
  const operationalMeta = obj(operationalChannels.meta);
  const access = obj(providerAccess);

  if (operationalMeta.ready !== true) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: s(operationalMeta.reasonCode || "channel_identifiers_missing"),
        viewerRole: "internal",
        missingFields: [
          !s(operationalMeta.pageId) && !s(operationalMeta.igUserId)
            ? "external_page_id_or_external_user_id"
            : "",
        ].filter(Boolean),
        title: "Meta operational blocker",
        subtitle:
          "Strict runtime delivery is blocked until the persisted Meta operational identifiers are complete.",
        action: {
          id: "repair_channel_identifiers",
          kind: "focus",
          label: "Repair channel identifiers",
          requiredRole: "operator",
        },
        target: {
          section: "operational",
          panel: "meta",
          field: "externalPageId",
        },
      })
    );
  }

  if (includeProviderAccess && access.available !== true) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: s(access.reasonCode || "provider_secret_missing"),
        viewerRole: "internal",
        missingFields: arr(access.secretKeys).length
          ? arr(access.secretKeys)
          : ["provider_access"],
        title: "Provider access blocker",
        subtitle:
          "Internal provider access remains unavailable until the required secret-backed Meta access is repaired.",
        action: {
          id: "open_provider_secrets",
          kind: "admin_route",
          label: "Open secure secrets",
          requiredRole: "admin",
        },
        target: {
          path: "/admin/secrets",
          provider: "meta",
        },
      })
    );
  }

  return buildReadinessSurface({
    status: blockers.length ? "blocked" : "ready",
    message: blockers.length
      ? "Strict runtime dependencies for Meta delivery are blocked."
      : "Strict runtime dependencies for Meta delivery are aligned.",
    blockers,
  });
}

function buildMatchedTenantRow(matchedChannel = {}, runtime = null) {
  const matched = obj(matchedChannel);
  const runtimeValue = obj(runtime);
  const runtimeTenant =
    obj(runtimeValue.tenant) ||
    obj(runtimeValue.tenantRow) ||
    obj(runtimeValue.tenantScope);
  const authority = obj(runtimeValue.authority);

  const tenantId = cleanNullableString(
    matched.tenant_id ||
      matched.tenantId ||
      runtimeTenant.id ||
      runtimeTenant.tenant_id ||
      authority.tenantId ||
      authority.tenant_id
  );

  const tenantKey = cleanNullableString(
    matched.tenant_key ||
      matched.tenantKey ||
      runtimeTenant.tenant_key ||
      runtimeTenant.tenantKey ||
      authority.tenantKey ||
      authority.tenant_key
  );

  return {
    id: tenantId,
    tenant_id: tenantId,
    tenant_key: tenantKey,
    tenantKey: tenantKey,
    company_name: s(
      matched.company_name || runtimeTenant.company_name || runtimeTenant.companyName
    ),
    legal_name: s(
      matched.legal_name || runtimeTenant.legal_name || runtimeTenant.legalName
    ),
    industry_key: s(
      matched.industry_key || runtimeTenant.industry_key || runtimeTenant.industryKey
    ),
    country_code: s(
      matched.country_code || runtimeTenant.country_code || runtimeTenant.countryCode
    ),
    timezone: s(matched.timezone || runtimeTenant.timezone),
    default_language: s(
      matched.default_language ||
        runtimeTenant.default_language ||
        runtimeTenant.defaultLanguage
    ),
    enabled_languages: arr(
      matched.enabled_languages || runtimeTenant.enabled_languages
    ),
    market_region: s(
      matched.market_region || runtimeTenant.market_region || runtimeTenant.marketRegion
    ),
    plan_key: s(matched.plan_key || runtimeTenant.plan_key),
    status: s(
      matched.tenant_status || matched.status || runtimeTenant.status || runtimeTenant.tenant_status
    ),
    tenant_status: s(
      matched.tenant_status || matched.status || runtimeTenant.status || runtimeTenant.tenant_status
    ),
    active:
      typeof matched.tenant_active === "boolean"
        ? matched.tenant_active
        : typeof matched.active === "boolean"
          ? matched.active
          : typeof runtimeTenant.active === "boolean"
            ? runtimeTenant.active
            : typeof runtimeTenant.tenant_active === "boolean"
              ? runtimeTenant.tenant_active
              : false,
    tenant_active:
      typeof matched.tenant_active === "boolean"
        ? matched.tenant_active
        : typeof matched.active === "boolean"
          ? matched.active
          : typeof runtimeTenant.active === "boolean"
            ? runtimeTenant.active
            : typeof runtimeTenant.tenant_active === "boolean"
              ? runtimeTenant.tenant_active
              : false,
  };
}

function buildInternalProjectedRuntime({
  runtime,
  matchedChannel = {},
  operationalChannels = {},
  providerSecrets = null,
}) {
  const runtimeValue = obj(runtime);
  const authority = obj(runtimeValue.authority);
  const tenantRow = buildMatchedTenantRow(matchedChannel, runtimeValue);

  try {
    return buildProjectedTenantRuntime({
      runtime: runtimeValue,
      tenantRow,
      matchedChannel,
      operationalChannels,
      providerSecrets,
    });
  } catch (error) {
    if (
      authority.available === true &&
      s(authority.source) === "approved_runtime_projection"
    ) {
      return {
        ...runtimeValue,
        authority: {
          ...authority,
          strict: true,
          unavailable: false,
        },
      };
    }

    throw error;
  }
}

function normalizeMetaDeauthorizeSignal(body = {}) {
  const payload = obj(body);
  return {
    metaUserId: cleanNullableString(
      payload.metaUserId || payload.meta_user_id || payload.user_id
    ),
    pageId: cleanNullableString(payload.pageId || payload.page_id),
    igUserId: cleanNullableString(
      payload.igUserId ||
        payload.ig_user_id ||
        payload.instagram_business_account_id
    ),
    reasonCode: s(payload.reasonCode || payload.reason_code || "meta_app_deauthorized"),
    occurredAt: s(payload.occurredAt || payload.occurred_at || new Date().toISOString()),
    signedRequestMeta: obj(payload.signedRequestMeta || payload.signed_request_meta),
  };
}

async function resolveInstagramLifecycleChannelByIds(
  db,
  { metaUserId = "", pageId = "", igUserId = "" } = {}
) {
  if (!db?.query) return null;

  const safeMetaUserId = cleanNullableString(metaUserId);
  const safePageId = cleanNullableString(pageId);
  const safeIgUserId = cleanNullableString(igUserId);

  if (!safeMetaUserId && !safePageId && !safeIgUserId) {
    return null;
  }

  const result = await db.query(
    `
      select
        tc.*,
        t.tenant_key,
        t.company_name,
        t.plan_key,
        t.status as tenant_status,
        t.active as tenant_active
      from tenant_channels tc
      join tenants t on t.id = tc.tenant_id
      where tc.channel_type = 'instagram'
        and (
          ($1::text is not null and (
            nullif(btrim(coalesce(tc.config->>'meta_user_id', '')), '') = $1
            or nullif(btrim(coalesce(tc.health->>'meta_user_id', '')), '') = $1
          ))
          or ($2::text is not null and (
            tc.external_page_id = $2
            or nullif(btrim(coalesce(tc.config->>'last_known_page_id', '')), '') = $2
          ))
          or ($3::text is not null and (
            tc.external_user_id = $3
            or nullif(btrim(coalesce(tc.config->>'last_known_ig_user_id', '')), '') = $3
          ))
        )
      order by tc.is_primary desc, tc.updated_at desc, tc.created_at desc
      limit 1
    `,
    [safeMetaUserId, safePageId, safeIgUserId]
  );

  return result?.rows?.[0] || null;
}

function pendingSelectionMatchesSignal(
  pendingSelection = {},
  { metaUserId = "", pageId = "", igUserId = "" } = {}
) {
  const safeMetaUserId = cleanNullableString(metaUserId);
  const safePageId = cleanNullableString(pageId);
  const safeIgUserId = cleanNullableString(igUserId);

  if (
    safeMetaUserId &&
    cleanNullableString(pendingSelection?.metaUserId) === safeMetaUserId
  ) {
    return true;
  }

  return arr(pendingSelection?.candidates).some((candidate) => {
    if (safePageId && cleanNullableString(candidate?.pageId) === safePageId) {
      return true;
    }

    if (safeIgUserId && cleanNullableString(candidate?.igUserId) === safeIgUserId) {
      return true;
    }

    return false;
  });
}

async function resolvePendingInstagramSelectionByIds(
  db,
  { metaUserId = "", pageId = "", igUserId = "" } = {}
) {
  if (!db?.query) return null;
  if (!cleanNullableString(metaUserId) && !cleanNullableString(pageId) && !cleanNullableString(igUserId)) {
    return null;
  }

  const result = await db.query(
    `
      select distinct
        ts.tenant_id,
        t.tenant_key,
        t.company_name
      from tenant_secrets ts
      join tenants t on t.id = ts.tenant_id
      where ts.provider = 'meta'
        and ts.secret_key = $1
        and ts.is_active = true
      order by ts.tenant_id asc
      limit 200
    `,
    [META_CONNECT_SELECTION_SECRET_KEY]
  );

  for (const row of arr(result?.rows)) {
    const secrets = await dbGetTenantProviderSecrets(db, row.tenant_id, "meta");
    const pendingSelection = readPendingMetaSelection(secrets);
    if (!pendingSelection?.selectionId) continue;
    if (!pendingSelectionMatchesSignal(pendingSelection, { metaUserId, pageId, igUserId })) {
      continue;
    }

    return {
      tenant_id: row.tenant_id,
      tenant_key: row.tenant_key,
      company_name: row.company_name,
      pendingSelection,
    };
  }

  return null;
}

export function tenantInternalRoutes({ db, getRuntime = getTenantBrainRuntime }) {
  const router = express.Router();
  const requireMetaTenantResolve = createInternalTokenGuard({
    allowedServices: ["meta-bot-backend"],
    allowedAudiences: ["aihq-backend.tenants.resolve-channel"],
  });
  const requireMetaProviderAccess = createInternalTokenGuard({
    allowedServices: ["meta-bot-backend"],
    allowedAudiences: ["aihq-backend.providers.meta-channel-access"],
  });
  const requireMetaChannelLifecycle = createInternalTokenGuard({
    allowedServices: ["meta-bot-backend"],
    allowedAudiences: ["aihq-backend.channels.meta-deauthorize"],
  });

  router.get("/tenants/resolve-channel", requireMetaTenantResolve, async (req, res) => {
    const log = createSafeLogger(req.log);

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
      const flowLogger = log.child({
        flow: "resolve_channel",
        channel,
        recipientId,
        pageId,
        igUserId,
      });

      flowLogger.info("internal.resolve_channel.requested", {
        channel,
        recipientId,
        pageId,
        igUserId,
      });

      const startedAt = Date.now();

      const match = await resolveTenantChannelByExternalIds(db, {
        channel,
        recipientId,
        pageId,
        igUserId,
      });

      flowLogger.info("internal.resolve_channel.lookup_completed", {
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

      flowLogger.info("internal.resolve_channel.matched", {
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
          logger: flowLogger,
        });
      } catch (error) {
        if (isRuntimeAuthorityError(error)) {
          flowLogger.warn("internal.resolve_channel.runtime_authority_blocked", {
            tenantKey: match.tenant_key,
            tenantId: match.tenant_id,
            reasonCode: s(
              error?.runtimeAuthority?.reasonCode || "runtime_authority_unavailable"
            ),
          });
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

      const projectedRuntime = buildInternalProjectedRuntime({
        runtime,
        matchedChannel: match,
        operationalChannels,
        providerSecrets: {
          provider: providerKey,
          rawValuesExposed: false,
          ...secretSummary,
        },
      });

      flowLogger.info("internal.resolve_channel.provider_secrets_resolved", {
        tenantKey: match.tenant_key,
        provider: providerKey,
        secretKeys: arr(secretSummary.secrets).map((x) => s(x?.key)).filter(Boolean),
        hasPageAccessToken: arr(secretSummary.secrets).some(
          (x) => cleanLower(x?.key) === "page_access_token" && x?.present
        ),
      });

      flowLogger.info("internal.resolve_channel.completed", {
        tenantKey: match.tenant_key,
        tenantId: match.tenant_id,
        runtimeProjectionId: s(projectedRuntime?.authority?.runtimeProjectionId),
        authoritySource: s(projectedRuntime?.authority?.source),
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
        readiness: buildMetaRuntimeReadiness({
          operationalChannels,
        }),
      });
    } catch (err) {
      log.error("internal.resolve_channel.failed", err);

      return serverErr(res, err?.message || "Failed to resolve tenant channel");
    }
  });

  router.get(
    "/internal/providers/meta-channel-access",
    requireMetaProviderAccess,
    async (req, res) => {
      const log = createSafeLogger(req.log);

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

        const matchedChannel = obj(resolved.matchedChannel);
        const flowLogger = log.child({
          flow: "meta_channel_access",
          tenantId: resolved.tenantId,
          tenantKey: resolved.tenantKey,
        });

        let runtime = null;
        try {
          runtime = await getRuntime({
            db,
            tenantId: resolved.tenantId,
            tenantKey: resolved.tenantKey,
            authorityMode: "strict",
            logger: flowLogger,
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

        const builtOperationalChannels =
          resolved.operationalChannels ||
          (await buildOperationalChannels({
            db,
            tenantId: resolved.tenantId,
            matchedChannel,
          }));

        const operationalChannels = normalizeOperationalChannels({
          operationalChannels: builtOperationalChannels,
          matchedChannel,
        });

        const providerAccess = normalizeProviderAccess(
          resolved.providerAccess || resolved.provider_access,
          matchedChannel
        );

        const readiness = buildMetaRuntimeReadiness({
          operationalChannels,
          providerAccess: {
            ...providerAccess,
            authority: obj(runtime?.authority),
          },
          includeProviderAccess: true,
        });

        if (operationalChannels?.meta?.ready !== true) {
          flowLogger.warn("internal.meta_channel_access.operational_unavailable", {
            tenantKey: resolved.tenantKey,
            tenantId: resolved.tenantId,
            reasonCode: s(
              operationalChannels?.meta?.reasonCode || "channel_identifiers_missing"
            ),
          });
          return res.status(409).json({
            ok: false,
            error: "meta_operational_unavailable",
            tenantKey: resolved.tenantKey,
            tenantId: resolved.tenantId,
            reasonCode: s(
              operationalChannels?.meta?.reasonCode || "channel_identifiers_missing"
            ),
            readiness,
            operationalChannels,
          });
        }

        if (providerAccess.available !== true) {
          flowLogger.warn("internal.meta_channel_access.provider_unavailable", {
            tenantKey: resolved.tenantKey,
            tenantId: resolved.tenantId,
            reasonCode: s(providerAccess.reasonCode || "provider_access_incomplete"),
          });
          return res.status(409).json({
            ok: false,
            error: "provider_access_unavailable",
            tenantKey: resolved.tenantKey,
            tenantId: resolved.tenantId,
            reasonCode: s(providerAccess.reasonCode || "provider_access_incomplete"),
            readiness,
            operationalChannels,
            providerAccess,
          });
        }

        const projectedRuntime = buildInternalProjectedRuntime({
          runtime,
          matchedChannel,
          operationalChannels,
          providerSecrets: {
            provider: s(providerAccess.provider || "meta"),
            rawValuesExposed: false,
            secretKeys: arr(providerAccess.secretKeys),
          },
        });

        return ok(res, {
          tenantKey: resolved.tenantKey,
          tenantId: resolved.tenantId,
          projectedRuntime,
          operationalChannels,
          providerAccess: {
            ...providerAccess,
            authority: obj(runtime?.authority),
          },
          readiness,
        });
      } catch (err) {
        log.error("internal.meta_channel_access.failed", err);

        return serverErr(
          res,
          err?.message || "Failed to resolve provider channel access"
        );
      }
    }
  );

  router.post(
    "/internal/channels/meta/deauthorize",
    requireMetaChannelLifecycle,
    async (req, res) => {
      const log = createSafeLogger(req.log);

      try {
        if (!db?.query) {
          return res.status(500).json({
            ok: false,
            error: "Database is not available",
          });
        }

        const signal = normalizeMetaDeauthorizeSignal(req.body || {});
        if (!signal.metaUserId && !signal.pageId && !signal.igUserId) {
          return bad(res, "meta_deauthorize_identity_missing");
        }

        const matchedChannel = await resolveInstagramLifecycleChannelByIds(db, signal);
        const matchedPendingSelection = matchedChannel?.tenant_id
          ? null
          : await resolvePendingInstagramSelectionByIds(db, signal);

        if (!matchedChannel?.tenant_id && !matchedPendingSelection?.tenant_id) {
          return res.status(404).json({
            ok: false,
            error: "tenant_channel_not_found",
            reasonCode: signal.reasonCode,
          });
        }

        const actor = s(req?.internalAuth?.service || "meta-bot-backend");
        const occurredAt = s(signal.occurredAt || new Date().toISOString());
        const matchedTenant = matchedChannel?.tenant_id
          ? matchedChannel
          : matchedPendingSelection;
        const tenant = {
          id: matchedTenant.tenant_id,
          tenant_key: matchedTenant.tenant_key,
          company_name: matchedTenant.company_name,
        };

        await deleteMetaSecretKeys(db, matchedTenant.tenant_id, [
          META_CONNECT_SELECTION_SECRET_KEY,
        ]);

        if (!matchedChannel?.tenant_id) {
          await auditSafe(
            db,
            actor,
            tenant,
            "settings.channel.meta.selection_deauthorized",
            "tenant_channel",
            "instagram",
            {
              reasonCode: signal.reasonCode || "meta_app_deauthorized",
              occurredAt,
              metaUserId: signal.metaUserId,
              pageId: signal.pageId,
              igUserId: signal.igUserId,
              signedRequestMeta: signal.signedRequestMeta,
              selectionId: s(matchedPendingSelection?.pendingSelection?.selectionId),
            }
          );

          log.info("internal.meta_channel_deauthorize.selection_cleared", {
            tenantKey: tenant.tenant_key,
            tenantId: tenant.id,
            metaUserId: signal.metaUserId,
            pageId: signal.pageId,
            igUserId: signal.igUserId,
            reasonCode: signal.reasonCode,
          });

          return ok(res, {
            tenantKey: tenant.tenant_key,
            tenantId: tenant.id,
            channel: "instagram",
            processed: true,
            pendingSelectionCleared: true,
            reasonCode: signal.reasonCode || "meta_app_deauthorized",
            occurredAt,
          });
        }

        await deleteMetaSecretKeys(db, matchedChannel.tenant_id, [
          "page_access_token",
          "access_token",
          "meta_page_access_token",
          "page_id",
          "ig_user_id",
        ]);

        await markInstagramDisconnected(
          db,
          matchedChannel.tenant_id,
          buildInstagramLifecycleChannelPayload({
            channel: matchedChannel,
            transition: "deauthorized",
            reasonCode: signal.reasonCode || "meta_app_deauthorized",
            occurredAt,
          })
        );

        const capabilityGovernance = await markInstagramSourceDisconnected({
          db,
          tenant,
          actor,
          authStatus: "revoked",
        });

        await auditSafe(
          db,
          actor,
          tenant,
          "settings.channel.meta.deauthorized",
          "tenant_channel",
          "instagram",
          {
            reasonCode: signal.reasonCode || "meta_app_deauthorized",
            occurredAt,
            metaUserId: signal.metaUserId,
            pageId: signal.pageId,
            igUserId: signal.igUserId,
            signedRequestMeta: signal.signedRequestMeta,
            capabilityGovernance: {
              publishStatus: s(capabilityGovernance?.publishStatus),
              reviewRequired: !!capabilityGovernance?.reviewRequired,
              maintenanceSessionId: s(
                capabilityGovernance?.maintenanceSession?.id
              ),
              blockedReason: s(capabilityGovernance?.blockedReason),
            },
          }
        );

        log.info("internal.meta_channel_deauthorize.processed", {
          tenantKey: tenant.tenant_key,
          tenantId: tenant.id,
          metaUserId: signal.metaUserId,
          pageId: signal.pageId,
          igUserId: signal.igUserId,
          reasonCode: signal.reasonCode,
        });

        return ok(res, {
          tenantKey: tenant.tenant_key,
          tenantId: tenant.id,
          channel: "instagram",
          processed: true,
          reasonCode: signal.reasonCode || "meta_app_deauthorized",
          occurredAt,
          capabilityGovernance,
        });
      } catch (err) {
        log.error("internal.meta_channel_deauthorize.failed", err);
        return serverErr(res, err?.message || "Failed to process Meta deauthorize");
      }
    }
  );

  return router;
}
