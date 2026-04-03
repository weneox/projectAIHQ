// src/db/helpers/settings.js
// FINAL v2.0.0 — tenant settings helpers (workspace-safe + frontend-compatible)

import { buildTenantEntitlements } from "../../services/tenantEntitlements.js";

function isMissingSchemaError(error) {
  const code = cleanString(error?.code).toUpperCase();
  const message = cleanString(error?.message).toLowerCase();

  if (code === "42P01" || code === "42703") {
    return true;
  }

  return (
    message.includes("does not exist") ||
    message.includes("undefined column") ||
    message.includes("undefined table")
  );
}

async function queryOptionalWorkspaceSlice(db, query, params, fallback, label) {
  try {
    return await db.query(query, params);
  } catch (error) {
    if (!isMissingSchemaError(error)) {
      throw error;
    }

    console.warn(`[settings] optional workspace slice unavailable: ${label}`, {
      code: error?.code || null,
      message: error?.message || String(error),
    });
    return fallback;
  }
}

function rowOrNull(r) {
  return r?.rows?.[0] || null;
}

function rows(r) {
  return Array.isArray(r?.rows) ? r.rows : [];
}

function cleanString(v, fallback = "") {
  if (v === null || v === undefined) return String(fallback ?? "").trim();
  const s = String(v).trim();
  if (!s) return String(fallback ?? "").trim();
  if (s.toLowerCase() === "null" || s.toLowerCase() === "undefined") {
    return String(fallback ?? "").trim();
  }
  return s;
}

function cleanNullableString(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return null;
  return s;
}

function cleanLower(v, fallback = "") {
  return cleanString(v, fallback).toLowerCase();
}

function asBool(v, fallback = false) {
  if (typeof v === "boolean") return v;
  return fallback;
}

function asNumberOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asJsonObject(v, fallback = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : fallback;
}

function asJsonArray(v, fallback = []) {
  return Array.isArray(v) ? v : fallback;
}

function json(v, fallback) {
  try {
    return JSON.stringify(v ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

function normalizeTenantRow(row) {
  if (!row) return null;

  const enabledLanguages = asJsonArray(row.enabled_languages, []);
  const supportedLanguages = asJsonArray(row.supported_languages, enabledLanguages);

  return {
    id: cleanString(row.id),
    tenant_key: cleanString(row.tenant_key),
    company_name: cleanString(row.company_name),
    legal_name: cleanString(row.legal_name),
    industry_key: cleanLower(row.industry_key, "generic_business"),
    country_code: cleanString(row.country_code || "AZ").toUpperCase(),
    timezone: cleanString(row.timezone || "Asia/Baku"),
    default_language: cleanLower(row.default_language || "az"),
    supported_languages: supportedLanguages.length ? supportedLanguages : enabledLanguages,
    enabled_languages: enabledLanguages.length ? enabledLanguages : ["az"],
    market_region: cleanString(row.market_region),
    plan_key: cleanString(row.plan_key || "starter"),
    status: cleanLower(row.status || "active", "active"),
    active: typeof row.active === "boolean" ? row.active : true,
    onboarding_completed_at: row.onboarding_completed_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

function normalizeProfileRow(row) {
  return {
    brand_name: cleanString(row?.brand_name),
    website_url: cleanString(row?.website_url),
    public_email: cleanString(row?.public_email),
    public_phone: cleanString(row?.public_phone),
    audience_summary: cleanString(row?.audience_summary),
    services_summary: cleanString(row?.services_summary),
    value_proposition: cleanString(row?.value_proposition),
    brand_summary: cleanString(row?.brand_summary),
    tone_of_voice: cleanLower(row?.tone_of_voice || "professional", "professional"),
    preferred_cta: cleanString(row?.preferred_cta),
    banned_phrases: asJsonArray(row?.banned_phrases, []),
    communication_rules: asJsonObject(row?.communication_rules, {}),
    visual_style: asJsonObject(row?.visual_style, {}),
    extra_context: asJsonObject(row?.extra_context, {}),
  };
}

function normalizeAiPolicyRow(row) {
  return {
    auto_reply_enabled: asBool(row?.auto_reply_enabled, true),
    suppress_ai_during_handoff: asBool(row?.suppress_ai_during_handoff, true),
    mark_seen_enabled: asBool(row?.mark_seen_enabled, true),
    typing_indicator_enabled: asBool(row?.typing_indicator_enabled, true),
    create_lead_enabled: asBool(row?.create_lead_enabled, true),
    approval_required_content: asBool(row?.approval_required_content, true),
    approval_required_publish: asBool(row?.approval_required_publish, true),
    quiet_hours_enabled: asBool(row?.quiet_hours_enabled, false),
    quiet_hours: asJsonObject(row?.quiet_hours, { startHour: 0, endHour: 0 }),
    inbox_policy: asJsonObject(row?.inbox_policy, {}),
    comment_policy: asJsonObject(row?.comment_policy, {}),
    content_policy: asJsonObject(row?.content_policy, {}),
    escalation_rules: asJsonObject(row?.escalation_rules, {}),
    risk_rules: asJsonObject(row?.risk_rules, {}),
    lead_scoring_rules: asJsonObject(row?.lead_scoring_rules, {}),
    publish_policy: asJsonObject(row?.publish_policy, {}),
  };
}

function normalizeChannelRow(row) {
  return {
    id: cleanString(row?.id),
    tenant_id: cleanString(row?.tenant_id),
    channel_type: cleanLower(row?.channel_type),
    provider: cleanLower(row?.provider || "meta", "meta"),
    display_name: cleanString(row?.display_name),
    external_account_id: cleanString(row?.external_account_id),
    external_page_id: cleanString(row?.external_page_id),
    external_user_id: cleanString(row?.external_user_id),
    external_username: cleanString(row?.external_username),
    status: cleanLower(row?.status || "disconnected", "disconnected"),
    is_primary: asBool(row?.is_primary, false),
    config: asJsonObject(row?.config, {}),
    secrets_ref: cleanString(row?.secrets_ref),
    health: asJsonObject(row?.health, {}),
    last_sync_at: row?.last_sync_at || null,
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
  };
}

function normalizeAgentRow(row) {
  return {
    id: cleanString(row?.id),
    tenant_id: cleanString(row?.tenant_id),
    agent_key: cleanLower(row?.agent_key),
    display_name: cleanString(row?.display_name),
    role_summary: cleanString(row?.role_summary),
    enabled: asBool(row?.enabled, true),
    model: cleanString(row?.model),
    temperature: row?.temperature == null ? null : Number(row.temperature),
    prompt_overrides: asJsonObject(row?.prompt_overrides, {}),
    tool_access: asJsonObject(row?.tool_access, {}),
    limits: asJsonObject(row?.limits, {}),
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
  };
}

function normalizeUserRow(row) {
  return {
    id: cleanString(row?.id),
    tenant_id: cleanString(row?.tenant_id),
    user_email: cleanString(row?.user_email),
    full_name: cleanString(row?.full_name),
    role: cleanLower(row?.role || "member", "member"),
    status: cleanLower(row?.status || "active", "active"),
    permissions: asJsonObject(row?.permissions, {}),
    meta: asJsonObject(row?.meta, {}),
    last_seen_at: row?.last_seen_at || null,
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
  };
}

export async function dbGetTenantByKey(db, tenantKey) {
  if (!db || !tenantKey) return null;

  const key = cleanLower(tenantKey);
  if (!key) return null;

  const q = await db.query(
    `
      select *
      from tenants
      where lower(tenant_key) = $1
      limit 1
    `,
    [key]
  );

  return normalizeTenantRow(rowOrNull(q));
}

export async function dbGetWorkspaceSettings(db, tenantKey) {
  if (!db || !tenantKey) return null;

  const tenantRawQ = await db.query(
    `
      select *
      from tenants
      where lower(tenant_key) = $1
      limit 1
    `,
    [cleanLower(tenantKey)]
  );

  const tenantRaw = rowOrNull(tenantRawQ);
  const tenant = normalizeTenantRow(tenantRaw);
  if (!tenant?.id) return null;

  const emptyResult = { rows: [] };
  const [profileQ, policyQ, channelsQ, agentsQ, usersQ] = await Promise.all([
    queryOptionalWorkspaceSlice(
      db,
      `
        select *
        from tenant_profiles
        where tenant_id = $1
        limit 1
      `,
      [tenant.id],
      emptyResult,
      "tenant_profiles"
    ),
    queryOptionalWorkspaceSlice(
      db,
      `
        select *
        from tenant_ai_policies
        where tenant_id = $1
        limit 1
      `,
      [tenant.id],
      emptyResult,
      "tenant_ai_policies"
    ),
    queryOptionalWorkspaceSlice(
      db,
      `
        select *
        from tenant_channels
        where tenant_id = $1
        order by channel_type asc, created_at asc
      `,
      [tenant.id],
      emptyResult,
      "tenant_channels"
    ),
    queryOptionalWorkspaceSlice(
      db,
      `
        select *
        from tenant_agent_configs
        where tenant_id = $1
        order by agent_key asc
      `,
      [tenant.id],
      emptyResult,
      "tenant_agent_configs"
    ),
    queryOptionalWorkspaceSlice(
      db,
      `
        select
          id,
          tenant_id,
          user_email,
          full_name,
          role,
          status,
          permissions,
          meta,
          last_seen_at,
          created_at,
          updated_at
        from tenant_users
        where tenant_id = $1
        order by created_at asc
      `,
      [tenant.id],
      emptyResult,
      "tenant_users"
    ),
  ]);

  return {
    tenant,
    entitlements: buildTenantEntitlements(tenant),
    profile: normalizeProfileRow(rowOrNull(profileQ)),
    aiPolicy: normalizeAiPolicyRow(rowOrNull(policyQ)),
    channels: rows(channelsQ).map(normalizeChannelRow),
    agents: rows(agentsQ).map(normalizeAgentRow),
    users: rows(usersQ).map(normalizeUserRow),
  };
}

export async function dbUpsertTenantCore(db, tenantKey, input = {}) {
  if (!db || !tenantKey) return null;

  const key = cleanLower(tenantKey);
  if (!key) return null;

  const companyName = cleanString(input.company_name, "");
  const legalName =
    Object.prototype.hasOwnProperty.call(input, "legal_name")
      ? cleanNullableString(input.legal_name)
      : null;

  const industryKey = cleanLower(input.industry_key, "generic_business");
  const countryCode = cleanNullableString(input.country_code)?.toUpperCase() || null;
  const timezone = cleanString(input.timezone, "Asia/Baku");
  const defaultLanguage = cleanLower(input.default_language, "az");

  let enabledLanguages = asJsonArray(input.enabled_languages, ["az"])
    .map((x) => cleanLower(x))
    .filter(Boolean);

  if (!enabledLanguages.length) enabledLanguages = ["az"];

  const marketRegion = cleanNullableString(input.market_region);

  const q = await db.query(
    `
      insert into tenants (
        tenant_key,
        company_name,
        legal_name,
        industry_key,
        country_code,
        timezone,
        default_language,
        enabled_languages,
        market_region,
        plan_key,
        status,
        active,
        onboarding_completed_at
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8::jsonb,
        $9,
        'starter',
        'active',
        true,
        null
      )
      on conflict (tenant_key) do update
      set
        company_name = excluded.company_name,
        legal_name = coalesce(excluded.legal_name, tenants.legal_name),
        industry_key = excluded.industry_key,
        country_code = excluded.country_code,
        timezone = excluded.timezone,
        default_language = excluded.default_language,
        enabled_languages = excluded.enabled_languages,
        market_region = excluded.market_region
      returning *
    `,
    [
      key,
      companyName,
      legalName,
      industryKey,
      countryCode,
      timezone,
      defaultLanguage,
      json(enabledLanguages, ["az"]),
      marketRegion,
    ]
  );

  return normalizeTenantRow(rowOrNull(q));
}

export async function dbUpsertTenantProfile(db, tenantId, input = {}) {
  if (!db || !tenantId) return null;

  const q = await db.query(
    `
      insert into tenant_profiles (
        tenant_id,
        brand_name,
        website_url,
        public_email,
        public_phone,
        audience_summary,
        services_summary,
        value_proposition,
        brand_summary,
        tone_of_voice,
        preferred_cta,
        banned_phrases,
        communication_rules,
        visual_style,
        extra_context
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12::jsonb,
        $13::jsonb,
        $14::jsonb,
        $15::jsonb
      )
      on conflict (tenant_id) do update
      set
        brand_name = excluded.brand_name,
        website_url = excluded.website_url,
        public_email = excluded.public_email,
        public_phone = excluded.public_phone,
        audience_summary = excluded.audience_summary,
        services_summary = excluded.services_summary,
        value_proposition = excluded.value_proposition,
        brand_summary = excluded.brand_summary,
        tone_of_voice = excluded.tone_of_voice,
        preferred_cta = excluded.preferred_cta,
        banned_phrases = excluded.banned_phrases,
        communication_rules = excluded.communication_rules,
        visual_style = excluded.visual_style,
        extra_context = excluded.extra_context
      returning *
    `,
    [
      tenantId,
      cleanString(input.brand_name, ""),
      cleanNullableString(input.website_url),
      cleanNullableString(input.public_email),
      cleanNullableString(input.public_phone),
      cleanString(input.audience_summary, ""),
      cleanString(input.services_summary, ""),
      cleanString(input.value_proposition, ""),
      cleanString(input.brand_summary, ""),
      cleanLower(input.tone_of_voice, "professional"),
      cleanString(input.preferred_cta, ""),
      json(asJsonArray(input.banned_phrases, []), []),
      json(asJsonObject(input.communication_rules, {}), {}),
      json(asJsonObject(input.visual_style, {}), {}),
      json(asJsonObject(input.extra_context, {}), {}),
    ]
  );

  return normalizeProfileRow(rowOrNull(q));
}

export async function dbUpsertTenantAiPolicy(db, tenantId, input = {}) {
  if (!db || !tenantId) return null;

  const q = await db.query(
    `
      insert into tenant_ai_policies (
        tenant_id,
        auto_reply_enabled,
        suppress_ai_during_handoff,
        mark_seen_enabled,
        typing_indicator_enabled,
        create_lead_enabled,
        approval_required_content,
        approval_required_publish,
        quiet_hours_enabled,
        quiet_hours,
        inbox_policy,
        comment_policy,
        content_policy,
        escalation_rules,
        risk_rules,
        lead_scoring_rules,
        publish_policy
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10::jsonb,
        $11::jsonb,
        $12::jsonb,
        $13::jsonb,
        $14::jsonb,
        $15::jsonb,
        $16::jsonb,
        $17::jsonb
      )
      on conflict (tenant_id) do update
      set
        auto_reply_enabled = excluded.auto_reply_enabled,
        suppress_ai_during_handoff = excluded.suppress_ai_during_handoff,
        mark_seen_enabled = excluded.mark_seen_enabled,
        typing_indicator_enabled = excluded.typing_indicator_enabled,
        create_lead_enabled = excluded.create_lead_enabled,
        approval_required_content = excluded.approval_required_content,
        approval_required_publish = excluded.approval_required_publish,
        quiet_hours_enabled = excluded.quiet_hours_enabled,
        quiet_hours = excluded.quiet_hours,
        inbox_policy = excluded.inbox_policy,
        comment_policy = excluded.comment_policy,
        content_policy = excluded.content_policy,
        escalation_rules = excluded.escalation_rules,
        risk_rules = excluded.risk_rules,
        lead_scoring_rules = excluded.lead_scoring_rules,
        publish_policy = excluded.publish_policy
      returning *
    `,
    [
      tenantId,
      asBool(input.auto_reply_enabled, true),
      asBool(input.suppress_ai_during_handoff, true),
      asBool(input.mark_seen_enabled, true),
      asBool(input.typing_indicator_enabled, true),
      asBool(input.create_lead_enabled, true),
      asBool(input.approval_required_content, true),
      asBool(input.approval_required_publish, true),
      asBool(input.quiet_hours_enabled, false),
      json(asJsonObject(input.quiet_hours, {}), {}),
      json(asJsonObject(input.inbox_policy, {}), {}),
      json(asJsonObject(input.comment_policy, {}), {}),
      json(asJsonObject(input.content_policy, {}), {}),
      json(asJsonObject(input.escalation_rules, {}), {}),
      json(asJsonObject(input.risk_rules, {}), {}),
      json(asJsonObject(input.lead_scoring_rules, {}), {}),
      json(asJsonObject(input.publish_policy, {}), {}),
    ]
  );

  return normalizeAiPolicyRow(rowOrNull(q));
}

export async function dbListTenantChannels(db, tenantId) {
  if (!db || !tenantId) return [];

  const q = await db.query(
    `
      select *
      from tenant_channels
      where tenant_id = $1
      order by channel_type asc, created_at asc
    `,
    [tenantId]
  );

  return rows(q).map(normalizeChannelRow);
}

export async function dbUpsertTenantChannel(db, tenantId, channelType, input = {}) {
  if (!db || !tenantId || !channelType) return null;

  const safeChannelType = cleanLower(channelType);
  const provider = cleanLower(input.provider, "meta");

  const externalAccountId = cleanNullableString(input.external_account_id);
  const externalPageId = cleanNullableString(input.external_page_id);
  const externalUserId = cleanNullableString(input.external_user_id);
  const externalUsername = cleanNullableString(input.external_username);
  const displayName = cleanString(input.display_name, "");
  const status = cleanLower(input.status, "disconnected");
  const isPrimary = asBool(input.is_primary, false);
  const config = asJsonObject(input.config, {});
  const secretsRef = cleanNullableString(input.secrets_ref);
  const health = asJsonObject(input.health, {});
  const lastSyncAt = cleanNullableString(input.last_sync_at);

  const existing = await db.query(
    `
      select id
      from tenant_channels
      where tenant_id = $1
        and channel_type = $2
      order by is_primary desc, created_at asc
      limit 1
    `,
    [tenantId, safeChannelType]
  );

  const current = rowOrNull(existing);

  if (current?.id) {
    const q = await db.query(
      `
        update tenant_channels
        set
          provider = $2,
          display_name = $3,
          external_account_id = $4,
          external_page_id = $5,
          external_user_id = $6,
          external_username = $7,
          status = $8,
          is_primary = $9,
          config = $10::jsonb,
          secrets_ref = $11,
          health = $12::jsonb,
          last_sync_at = $13
        where id = $1
        returning *
      `,
      [
        current.id,
        provider,
        displayName,
        externalAccountId,
        externalPageId,
        externalUserId,
        externalUsername,
        status,
        isPrimary,
        json(config, {}),
        secretsRef,
        json(health, {}),
        lastSyncAt,
      ]
    );

    return normalizeChannelRow(rowOrNull(q));
  }

  const q = await db.query(
    `
      insert into tenant_channels (
        tenant_id,
        channel_type,
        provider,
        display_name,
        external_account_id,
        external_page_id,
        external_user_id,
        external_username,
        status,
        is_primary,
        config,
        secrets_ref,
        health,
        last_sync_at
      )
      values (
        $1,$2,$3,$4,
        $5,$6,$7,$8,
        $9,$10,$11::jsonb,$12,$13::jsonb,$14
      )
      returning *
    `,
    [
      tenantId,
      safeChannelType,
      provider,
      displayName,
      externalAccountId,
      externalPageId,
      externalUserId,
      externalUsername,
      status,
      isPrimary,
      json(config, {}),
      secretsRef,
      json(health, {}),
      lastSyncAt,
    ]
  );

  return normalizeChannelRow(rowOrNull(q));
}

export async function dbListTenantAgents(db, tenantId) {
  if (!db || !tenantId) return [];

  const q = await db.query(
    `
      select *
      from tenant_agent_configs
      where tenant_id = $1
      order by agent_key asc
    `,
    [tenantId]
  );

  return rows(q).map(normalizeAgentRow);
}

export async function dbUpsertTenantAgent(db, tenantId, agentKey, input = {}) {
  if (!db || !tenantId || !agentKey) return null;

  const safeAgentKey = cleanLower(agentKey);

  const q = await db.query(
    `
      insert into tenant_agent_configs (
        tenant_id,
        agent_key,
        display_name,
        role_summary,
        enabled,
        model,
        temperature,
        prompt_overrides,
        tool_access,
        limits
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8::jsonb,
        $9::jsonb,
        $10::jsonb
      )
      on conflict (tenant_id, agent_key) do update
      set
        display_name = excluded.display_name,
        role_summary = excluded.role_summary,
        enabled = excluded.enabled,
        model = excluded.model,
        temperature = excluded.temperature,
        prompt_overrides = excluded.prompt_overrides,
        tool_access = excluded.tool_access,
        limits = excluded.limits
      returning *
    `,
    [
      tenantId,
      safeAgentKey,
      cleanString(input.display_name, ""),
      cleanString(input.role_summary, ""),
      asBool(input.enabled, true),
      cleanNullableString(input.model),
      asNumberOrNull(input.temperature),
      json(asJsonObject(input.prompt_overrides, {}), {}),
      json(asJsonObject(input.tool_access, {}), {}),
      json(asJsonObject(input.limits, {}), {}),
    ]
  );

  return normalizeAgentRow(rowOrNull(q));
}

export async function dbListTenantUsers(db, tenantId) {
  if (!db || !tenantId) return [];

  const q = await db.query(
    `
      select
        id,
        tenant_id,
        user_email,
        full_name,
        role,
        status,
        permissions,
        meta,
        last_seen_at,
        created_at,
        updated_at
      from tenant_users
      where tenant_id = $1
      order by created_at asc
    `,
    [tenantId]
  );

  return rows(q).map(normalizeUserRow);
}
