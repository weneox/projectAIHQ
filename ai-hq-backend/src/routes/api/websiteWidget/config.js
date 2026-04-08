import crypto from "crypto";

import { cfg } from "../../../config.js";
import {
  isAllowedOrigin,
  normalizeOriginValue,
} from "../../../utils/securitySurface.js";

const WEBSITE_WIDGET_CHANNEL = "webchat";
const WEBSITE_WIDGET_PROVIDER = "website_widget";
const ACTIVE_WIDGET_STATUSES = new Set(["active", "connected"]);

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function uniq(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

function truncate(value, limit = 280) {
  const text = s(value);
  if (!text || text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3))}...`;
}

function requestHostOrigin(req) {
  const host =
    s(req?.headers?.["x-forwarded-host"]) ||
    s(req?.headers?.host) ||
    s(req?.get?.("host"));
  if (!host) return "";

  const forwardedProto = s(req?.headers?.["x-forwarded-proto"]).split(",")[0].trim();
  const protocol = s(req?.protocol || forwardedProto || "").toLowerCase();
  const safeProtocol = protocol === "https" ? "https" : "http";

  return normalizeOriginValue(`${safeProtocol}://${host}`);
}

export function normalizeUrl(raw = "") {
  const value = s(raw);
  if (!value) return null;

  try {
    const parsed = new URL(value);
    return {
      raw: value,
      href: parsed.href,
      origin: `${parsed.protocol}//${parsed.host}`.toLowerCase(),
      hostname: parsed.hostname.toLowerCase().replace(/^www\./, ""),
      host: parsed.host.toLowerCase(),
      pathname: parsed.pathname || "/",
    };
  } catch {
    return null;
  }
}

export function hostMatches(expectedHost = "", candidateHost = "") {
  const expected = s(expectedHost).toLowerCase().replace(/^www\./, "");
  const candidate = s(candidateHost).toLowerCase().replace(/^www\./, "");
  if (!expected || !candidate) return false;
  return candidate === expected || candidate.endsWith(`.${expected}`);
}

export function normalizeWidgetPublicId(raw = "") {
  const value = lower(raw).replace(/[^a-z0-9_-]/g, "");
  if (!/^[a-z0-9][a-z0-9_-]{5,63}$/.test(value)) return "";
  return value;
}

export function generateWidgetPublicId(seed = "") {
  const cleanSeed = lower(seed).replace(/[^a-z0-9]/g, "").slice(0, 12);
  const random = crypto.randomBytes(10).toString("hex");
  return normalizeWidgetPublicId(
    `ww_${cleanSeed ? `${cleanSeed}_` : ""}${random}`.slice(0, 63)
  );
}

function normalizeConfiguredList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => s(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[,\n]/)
      .map((item) => s(item))
      .filter(Boolean);
  }

  return [];
}

export function normalizeAllowedOrigins(config = {}) {
  return uniq(
    normalizeConfiguredList(
      config.allowedOrigins ||
        config.allowed_origins ||
        config.origins ||
        config.publicOrigins ||
        config.public_origins
    ).map((item) => lower(item))
  );
}

export function normalizeAllowedDomains(config = {}) {
  return uniq(
    normalizeConfiguredList(
      config.allowedDomains ||
        config.allowed_domains ||
        config.allowedHosts ||
        config.allowed_hosts ||
        config.domains
    )
      .map((item) => {
        const asUrl = normalizeUrl(item);
        if (asUrl?.hostname) return asUrl.hostname;
        return lower(item).replace(/^www\./, "").replace(/^\*\./, "");
      })
      .filter(Boolean)
  );
}

function normalizeInitialPrompts(config = {}) {
  return arr(
    config.initialPrompts || config.initial_prompts || config.quickReplies
  )
    .map((item) => truncate(item, 90))
    .filter(Boolean)
    .slice(0, 4);
}

export function normalizeWidgetConfig(raw = {}, { defaultEnabled = false } = {}) {
  const config = obj(raw);
  const explicitEnabled =
    typeof config.enabled === "boolean"
      ? config.enabled
      : typeof config.publicEnabled === "boolean"
        ? config.publicEnabled
        : null;

  return {
    enabled: explicitEnabled ?? Boolean(defaultEnabled),
    publicWidgetId: normalizeWidgetPublicId(
      config.publicWidgetId ||
        config.public_widget_id ||
        config.widgetPublicId ||
        config.widget_public_id ||
        config.widgetId ||
        config.widget_id
    ),
    allowedOrigins: normalizeAllowedOrigins(config),
    allowedDomains: normalizeAllowedDomains(config),
    title: truncate(config.title || config.widgetTitle || config.widget_title, 80),
    subtitle: truncate(
      config.subtitle || config.widgetSubtitle || config.widget_subtitle,
      140
    ),
    accentColor: s(
      config.accentColor || config.accent_color || config.brandColor || config.brand_color
    ),
    initialPrompts: normalizeInitialPrompts(config),
  };
}

export function normalizeWidgetConfigForSave(input = {}, tenantKey = "") {
  const config = normalizeWidgetConfig(input, {
    defaultEnabled: typeof input.enabled === "boolean" ? input.enabled : false,
  });

  return {
    enabled: config.enabled === true,
    publicWidgetId:
      config.publicWidgetId ||
      normalizeWidgetPublicId(input.publicWidgetId || input.public_widget_id) ||
      generateWidgetPublicId(tenantKey),
    allowedOrigins: config.allowedOrigins,
    allowedDomains: config.allowedDomains,
    title: config.title,
    subtitle: config.subtitle,
    accentColor: config.accentColor,
    initialPrompts: config.initialPrompts,
  };
}

export function widgetStatusAllowsInstall(status = "") {
  const normalized = lower(status);
  if (!normalized) return true;
  return ACTIVE_WIDGET_STATUSES.has(normalized);
}

export function resolveWidgetEnabled(tenant = {}) {
  const statusAllowsInstall = widgetStatusAllowsInstall(tenant.widgetChannelStatus);
  const config = normalizeWidgetConfig(tenant.widgetConfig, {
    defaultEnabled: statusAllowsInstall,
  });

  return config.enabled === true && statusAllowsInstall;
}

export function buildInstallContext(req) {
  const body = obj(req?.body);
  const page = obj(body.page);
  const requestOrigin = normalizeOriginValue(req?.headers?.origin);
  const requestReferer = normalizeUrl(req?.headers?.referer || req?.headers?.referrer);
  const requestRefererOrigin = requestReferer?.origin || "";
  const pageUrl = normalizeUrl(page.url || body.pageUrl);
  const pageOrigin = normalizeOriginValue(page.origin || body.origin);
  const pageTitle = truncate(page.title || body.pageTitle || body.title, 180);
  const pageReferrer = normalizeUrl(page.referrer || body.referrer);
  const trustedOrigins = uniq([requestOrigin, requestRefererOrigin]).map(lower);
  const trustedHosts = uniq([
    requestOrigin ? normalizeUrl(requestOrigin)?.hostname : "",
    requestReferer?.hostname || "",
  ]).map(lower);

  const mismatches = [];

  if (requestOrigin && pageOrigin && lower(requestOrigin) !== lower(pageOrigin)) {
    mismatches.push("page_origin_mismatch");
  }

  if (
    pageUrl?.origin &&
    trustedOrigins.length &&
    !trustedOrigins.some((candidate) => lower(candidate) === lower(pageUrl.origin))
  ) {
    mismatches.push("page_url_origin_mismatch");
  }

  return {
    requestOrigin: lower(requestOrigin),
    requestReferer: requestReferer?.href || "",
    requestRefererOrigin: lower(requestRefererOrigin),
    trustedOrigins: trustedOrigins.filter(Boolean),
    trustedHosts: trustedHosts.filter(Boolean),
    page: {
      url: pageUrl?.href || "",
      title: pageTitle,
      referrer: pageReferrer?.href || s(page.referrer || body.referrer),
      origin: lower(pageUrl?.origin || pageOrigin || ""),
      host: lower(pageUrl?.hostname || ""),
    },
    hasTrustedRequestContext: trustedOrigins.length > 0,
    mismatches,
  };
}

export function validateWidgetInstallContext(tenant = {}, installContext = {}) {
  const config = normalizeWidgetConfig(tenant.widgetConfig, {
    defaultEnabled: widgetStatusAllowsInstall(tenant.widgetChannelStatus),
  });
  const websiteUrl = normalizeUrl(tenant.websiteUrl);
  const trustedOrigins = arr(installContext.trustedOrigins).map(lower).filter(Boolean);
  const trustedHosts = arr(installContext.trustedHosts).map(lower).filter(Boolean);

  if (!config.publicWidgetId) {
    return {
      ok: false,
      reasonCode: "website_widget_unconfigured",
      detail:
        "Website chat is not configured yet. Save the website widget settings to issue a public install ID first.",
    };
  }

  if (!resolveWidgetEnabled(tenant)) {
    return {
      ok: false,
      reasonCode: "website_widget_disabled",
      detail: "Website chat is disabled for this tenant.",
    };
  }

  if (!installContext.hasTrustedRequestContext) {
    return {
      ok: false,
      reasonCode: "website_request_context_missing",
      detail:
        "The widget install request is missing trusted browser origin metadata, so the request was blocked.",
    };
  }

  if (arr(installContext.mismatches).length) {
    return {
      ok: false,
      reasonCode: "website_request_context_mismatch",
      detail:
        "The widget install request contained page metadata that did not match the trusted browser request origin.",
    };
  }

  const allowedOrigins = config.allowedOrigins;
  if (allowedOrigins.length) {
    const matchedOrigin = trustedOrigins.find((origin) =>
      isAllowedOrigin(origin, allowedOrigins, cfg.app.env)
    );

    if (matchedOrigin) {
      return {
        ok: true,
        matchedBy: "allowed_origin",
        matchedValue: matchedOrigin,
      };
    }
  }

  const allowedDomains = config.allowedDomains;
  if (allowedDomains.length) {
    const matchedDomain = allowedDomains.find((rule) =>
      trustedHosts.some((host) => hostMatches(rule, host))
    );

    if (matchedDomain) {
      return {
        ok: true,
        matchedBy: "allowed_domain",
        matchedValue: matchedDomain,
      };
    }
  }

  if (!allowedOrigins.length && !allowedDomains.length && websiteUrl?.hostname) {
    const matchedWebsiteHost = trustedHosts.find((host) =>
      hostMatches(websiteUrl.hostname, host)
    );

    if (matchedWebsiteHost) {
      return {
        ok: true,
        matchedBy: "website_url",
        matchedValue: websiteUrl.href,
      };
    }
  }

  return {
    ok: false,
    reasonCode: "website_origin_mismatch",
    detail:
      "This widget install request did not come from an allowed website origin or domain.",
  };
}

function mapTenantRow(row = {}) {
  return {
    id: s(row.id),
    tenantKey: lower(row.tenant_key),
    companyName: truncate(row.company_name || row.widget_display_name || row.tenant_key, 120),
    timezone: s(row.timezone),
    websiteUrl: s(row.website_url),
    widgetChannelStatus: lower(row.widget_channel_status),
    widgetConfig: obj(row.widget_config),
  };
}

export async function resolveWebsiteWidgetTenant(db, { tenantKey = "", publicWidgetId = "" } = {}) {
  if (!db?.query) return null;

  if (publicWidgetId) {
    const result = await db.query(
      `
      select
        t.id,
        t.tenant_key,
        t.company_name,
        t.timezone,
        coalesce(tp.website_url, '') as website_url,
        coalesce(tc.status, '') as widget_channel_status,
        coalesce(tc.display_name, '') as widget_display_name,
        coalesce(tc.config, '{}'::jsonb) as widget_config
      from tenants t
      left join tenant_profiles tp
        on tp.tenant_id = t.id
      left join lateral (
        select status, display_name, config
        from tenant_channels
        where tenant_id = t.id
          and channel_type = $2::text
          and lower(
            coalesce(
              config->>'publicWidgetId',
              config->>'public_widget_id',
              config->>'widgetPublicId',
              config->>'widget_public_id',
              config->>'widgetId',
              config->>'widget_id',
              ''
            )
          ) = lower($1::text)
        order by is_primary desc, updated_at desc
        limit 1
      ) tc on true
      where tc.config is not null
      limit 1
      `,
      [publicWidgetId, WEBSITE_WIDGET_CHANNEL]
    );

    const row = result.rows?.[0] || null;
    return row ? mapTenantRow(row) : null;
  }

  if (!tenantKey) return null;

  const result = await db.query(
    `
    select
      t.id,
      t.tenant_key,
      t.company_name,
      t.timezone,
      coalesce(tp.website_url, '') as website_url,
      coalesce(tc.status, '') as widget_channel_status,
      coalesce(tc.display_name, '') as widget_display_name,
      coalesce(tc.config, '{}'::jsonb) as widget_config
    from tenants t
    left join tenant_profiles tp
      on tp.tenant_id = t.id
    left join lateral (
      select status, display_name, config
      from tenant_channels
      where tenant_id = t.id
        and channel_type = $2::text
      order by is_primary desc, updated_at desc
      limit 1
    ) tc on true
    where lower(t.tenant_key) = lower($1::text)
    limit 1
    `,
    [tenantKey, WEBSITE_WIDGET_CHANNEL]
  );

  const row = result.rows?.[0] || null;
  return row ? mapTenantRow(row) : null;
}

export async function resolveWebsiteWidgetStatus(db, tenantKey = "") {
  if (!db?.query || !tenantKey) return null;

  const result = await db.query(
    `
    select
      t.id,
      t.tenant_key,
      t.company_name,
      t.timezone,
      coalesce(tp.website_url, '') as website_url,
      coalesce(tc.id::text, '') as widget_channel_id,
      coalesce(tc.status, '') as widget_channel_status,
      coalesce(tc.display_name, '') as widget_display_name,
      coalesce(tc.provider, '') as widget_provider,
      coalesce(tc.config, '{}'::jsonb) as widget_config,
      coalesce(tc.updated_at::text, '') as widget_updated_at
    from tenants t
    left join tenant_profiles tp
      on tp.tenant_id = t.id
    left join lateral (
      select id, status, provider, display_name, config, updated_at
      from tenant_channels
      where tenant_id = t.id
        and channel_type = $2::text
      order by is_primary desc, updated_at desc
      limit 1
    ) tc on true
    where lower(t.tenant_key) = lower($1::text)
    limit 1
    `,
    [tenantKey, WEBSITE_WIDGET_CHANNEL]
  );

  const row = result.rows?.[0] || null;
  if (!row) return null;

  return {
    ...mapTenantRow(row),
    widgetChannelId: s(row.widget_channel_id),
    widgetProvider: lower(row.widget_provider || WEBSITE_WIDGET_PROVIDER),
    widgetUpdatedAt: s(row.widget_updated_at),
  };
}

export function buildWidgetShell(tenant = {}, automation = {}) {
  const config = normalizeWidgetConfig(tenant.widgetConfig, {
    defaultEnabled: resolveWidgetEnabled(tenant),
  });

  return {
    title: config.title || tenant.companyName || tenant.tenantKey || "Website chat",
    subtitle:
      config.subtitle ||
      (automation.available
        ? "Ask a question and get help right here on the site."
        : "Leave a message here and the team can take over."),
    accentColor: config.accentColor || "#0f172a",
    initialPrompts: config.initialPrompts,
  };
}

export function buildWebsiteWidgetInstallSurface(req, tenant = {}) {
  const config = normalizeWidgetConfig(tenant.widgetConfig, {
    defaultEnabled: resolveWidgetEnabled(tenant),
  });
  const widgetBaseUrl = s(cfg.urls.publicBaseUrl) || requestHostOrigin(req);
  const apiOrigin = requestHostOrigin(req) || s(cfg.urls.publicBaseUrl);
  const scriptUrl = widgetBaseUrl
    ? `${widgetBaseUrl.replace(/\/+$/, "")}/website-widget-loader.js`
    : "";
  const apiBase = apiOrigin ? `${apiOrigin.replace(/\/+$/, "")}/api` : "/api";
  const snippet = config.publicWidgetId && scriptUrl
    ? `<script src="${scriptUrl}" data-widget-id="${config.publicWidgetId}" data-api-base="${apiBase}" async></script>`
    : "";

  return {
    widgetBaseUrl,
    apiBase,
    scriptUrl,
    iframePath: "/widget/website-chat",
    embedSnippet: snippet,
  };
}

export const __test__ = {
  buildInstallContext,
  buildWidgetShell,
  buildWebsiteWidgetInstallSurface,
  generateWidgetPublicId,
  hostMatches,
  normalizeAllowedDomains,
  normalizeAllowedOrigins,
  normalizeWidgetConfig,
  normalizeWidgetConfigForSave,
  normalizeWidgetPublicId,
  resolveWidgetEnabled,
  validateWidgetInstallContext,
  widgetStatusAllowsInstall,
};
