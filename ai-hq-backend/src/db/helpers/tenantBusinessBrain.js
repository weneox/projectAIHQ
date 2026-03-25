// src/db/helpers/tenantBusinessBrain.js
// FINAL v1.3 — schema-safe tenant business brain helpers

function rowOrNull(r) {
  return r?.rows?.[0] || null;
}

function rows(r) {
  return Array.isArray(r?.rows) ? r.rows : [];
}

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function bool(v, fallback = false) {
  if (typeof v === "boolean") return v;
  const x = String(v ?? "").trim().toLowerCase();
  if (!x) return fallback;
  if (["1", "true", "yes", "y", "on"].includes(x)) return true;
  if (["0", "false", "no", "n", "off"].includes(x)) return false;
  return fallback;
}

function int(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function json(v, fallback) {
  try {
    return JSON.stringify(v ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

function nullable(v) {
  const x = s(v);
  return x || null;
}

function compactText(v = "", max = 2000) {
  const x = s(v).replace(/\s+/g, " ").trim();
  if (!x) return "";
  if (x.length <= max) return x;
  return `${x.slice(0, max - 1).trim()}…`;
}

function normalizeFactKey(v = "") {
  return lower(v)
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

// ---------------------------------------------------------
// business facts
// ---------------------------------------------------------

export async function dbListTenantBusinessFacts(db, tenantId, opts = {}) {
  if (!db || !tenantId) return [];

  const language = lower(opts.language);
  const factGroup = lower(opts.factGroup);
  const enabledOnly = opts.enabledOnly !== false;

  const params = [tenantId];
  const where = [`tenant_id = $1`];

  if (enabledOnly) {
    where.push(`enabled = true`);
  }

  if (language) {
    params.push(language);
    const langIdx = params.length;

    params.push("en");
    const enIdx = params.length;

    where.push(
      `(lower(coalesce(language, '')) = $${langIdx} or lower(coalesce(language, '')) = $${enIdx} or coalesce(language, '') = '')`
    );
  }

  if (factGroup) {
    params.push(factGroup);
    where.push(`lower(fact_group) = $${params.length}`);
  }

  const q = await db.query(
    `
      select *
      from tenant_business_facts
      where ${where.join(" and ")}
      order by
        case
          when lower(coalesce(language, '')) = lower(${language ? "$2" : "''"}) then 0
          when lower(coalesce(language, '')) = 'en' then 1
          else 2
        end,
        priority asc,
        updated_at desc,
        created_at desc
    `,
    params
  );

  return rows(q);
}

export async function dbUpsertTenantBusinessFact(db, tenantId, input = {}) {
  if (!db || !tenantId) return null;

  const factKey = normalizeFactKey(input.fact_key || input.factKey);
  if (!factKey) return null;

  const rawLanguage = lower(input.language);
  const language = rawLanguage || "az";

  const rawValueJson =
    input.value_json !== undefined
      ? input.value_json
      : input.valueJson !== undefined
        ? input.valueJson
        : {};

  const inputMeta = obj(input.meta);
  const mergedMeta = {
    ...inputMeta,
    category: lower(input.category || input.fact_category || inputMeta.category || "other"),
  };

  const title = compactText(input.title, 240);
  const valueText = compactText(input.value_text || input.valueText, 4000);
  const sourceType = lower(input.source_type || input.sourceType || "manual");
  const sourceRef = nullable(input.source_ref || input.sourceRef);
  const factGroup = lower(input.fact_group || input.factGroup || "general");

  const q = await db.query(
    `
      insert into tenant_business_facts (
        tenant_id,
        fact_key,
        fact_group,
        title,
        value_text,
        value_json,
        language,
        channel_scope,
        usecase_scope,
        priority,
        enabled,
        source_type,
        source_ref,
        meta
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::jsonb,
        $7,
        $8::jsonb,
        $9::jsonb,
        $10,
        $11,
        $12,
        $13,
        $14::jsonb
      )
      on conflict (tenant_id, fact_key, language) do update
      set
        fact_group = excluded.fact_group,
        title = case
          when btrim(excluded.title) <> '' then excluded.title
          else tenant_business_facts.title
        end,
        value_text = case
          when btrim(excluded.value_text) <> '' then excluded.value_text
          else tenant_business_facts.value_text
        end,
        value_json = case
          when excluded.value_json <> '{}'::jsonb then excluded.value_json
          else tenant_business_facts.value_json
        end,
        channel_scope = case
          when excluded.channel_scope <> '[]'::jsonb then excluded.channel_scope
          else tenant_business_facts.channel_scope
        end,
        usecase_scope = case
          when excluded.usecase_scope <> '[]'::jsonb then excluded.usecase_scope
          else tenant_business_facts.usecase_scope
        end,
        priority = excluded.priority,
        enabled = excluded.enabled,
        source_type = case
          when btrim(excluded.source_type) <> '' then excluded.source_type
          else tenant_business_facts.source_type
        end,
        source_ref = coalesce(excluded.source_ref, tenant_business_facts.source_ref),
        meta = case
          when tenant_business_facts.meta is null or tenant_business_facts.meta = '{}'::jsonb
            then excluded.meta
          when excluded.meta is null or excluded.meta = '{}'::jsonb
            then tenant_business_facts.meta
          else tenant_business_facts.meta || excluded.meta
        end,
        updated_at = now()
      returning *
    `,
    [
      tenantId,
      factKey,
      factGroup,
      title,
      valueText,
      json(typeof rawValueJson === "object" && rawValueJson !== null ? rawValueJson : {}, {}),
      language,
      json(arr(input.channel_scope || input.channelScope), []),
      json(arr(input.usecase_scope || input.usecaseScope), []),
      int(input.priority, 100),
      bool(input.enabled, true),
      sourceType,
      sourceRef,
      json(mergedMeta, {}),
    ]
  );

  return rowOrNull(q);
}

export async function dbDeleteTenantBusinessFact(db, tenantId, factId) {
  if (!db || !tenantId || !factId) return false;

  const q = await db.query(
    `
      delete from tenant_business_facts
      where tenant_id = $1
        and id = $2
      returning id
    `,
    [tenantId, factId]
  );

  return !!rowOrNull(q);
}

// ---------------------------------------------------------
// channel policies
// ---------------------------------------------------------

export async function dbListTenantChannelPolicies(db, tenantId) {
  if (!db || !tenantId) return [];

  const q = await db.query(
    `
      select *
      from tenant_channel_policies
      where tenant_id = $1
      order by channel asc, subchannel asc, updated_at desc
    `,
    [tenantId]
  );

  return rows(q);
}

export async function dbUpsertTenantChannelPolicy(db, tenantId, input = {}) {
  if (!db || !tenantId) return null;

  const channel = lower(input.channel);
  if (!channel) return null;

  const subchannel = lower(input.subchannel || "default");

  const q = await db.query(
    `
      insert into tenant_channel_policies (
        tenant_id,
        channel,
        subchannel,
        enabled,
        auto_reply_enabled,
        ai_reply_enabled,
        human_handoff_enabled,
        pricing_visibility,
        public_reply_mode,
        contact_capture_mode,
        escalation_mode,
        reply_style,
        max_reply_sentences,
        rules,
        meta
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
        $12,
        $13,
        $14::jsonb,
        $15::jsonb
      )
      on conflict (tenant_id, channel, subchannel) do update
      set
        enabled = excluded.enabled,
        auto_reply_enabled = excluded.auto_reply_enabled,
        ai_reply_enabled = excluded.ai_reply_enabled,
        human_handoff_enabled = excluded.human_handoff_enabled,
        pricing_visibility = excluded.pricing_visibility,
        public_reply_mode = excluded.public_reply_mode,
        contact_capture_mode = excluded.contact_capture_mode,
        escalation_mode = excluded.escalation_mode,
        reply_style = excluded.reply_style,
        max_reply_sentences = excluded.max_reply_sentences,
        rules = excluded.rules,
        meta = excluded.meta
      returning *
    `,
    [
      tenantId,
      channel,
      subchannel,
      bool(input.enabled, true),
      bool(input.auto_reply_enabled, true),
      bool(input.ai_reply_enabled, true),
      bool(input.human_handoff_enabled, true),
      lower(input.pricing_visibility || "inherit"),
      lower(input.public_reply_mode || "inherit"),
      lower(input.contact_capture_mode || "inherit"),
      lower(input.escalation_mode || "inherit"),
      s(input.reply_style),
      int(input.max_reply_sentences, 2),
      json(obj(input.rules), {}),
      json(obj(input.meta), {}),
    ]
  );

  return rowOrNull(q);
}

export async function dbDeleteTenantChannelPolicy(db, tenantId, policyId) {
  if (!db || !tenantId || !policyId) return false;

  const q = await db.query(
    `
      delete from tenant_channel_policies
      where tenant_id = $1
        and id = $2
      returning id
    `,
    [tenantId, policyId]
  );

  return !!rowOrNull(q);
}

// ---------------------------------------------------------
// locations
// ---------------------------------------------------------

export async function dbListTenantLocations(db, tenantId) {
  if (!db || !tenantId) return [];

  const q = await db.query(
    `
      select *
      from tenant_locations
      where tenant_id = $1
      order by sort_order asc, updated_at desc, created_at desc
    `,
    [tenantId]
  );

  return rows(q);
}

export async function dbUpsertTenantLocation(db, tenantId, input = {}) {
  if (!db || !tenantId) return null;

  const locationKey = lower(input.location_key || input.locationKey);
  if (!locationKey) return null;

  const q = await db.query(
    `
      insert into tenant_locations (
        tenant_id,
        location_key,
        title,
        country_code,
        city,
        address_line,
        map_url,
        phone,
        email,
        working_hours,
        delivery_areas,
        is_primary,
        enabled,
        sort_order,
        meta
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
        $12,
        $13,
        $14,
        $15::jsonb
      )
      on conflict (tenant_id, location_key) do update
      set
        title = excluded.title,
        country_code = excluded.country_code,
        city = excluded.city,
        address_line = excluded.address_line,
        map_url = excluded.map_url,
        phone = excluded.phone,
        email = excluded.email,
        working_hours = excluded.working_hours,
        delivery_areas = excluded.delivery_areas,
        is_primary = excluded.is_primary,
        enabled = excluded.enabled,
        sort_order = excluded.sort_order,
        meta = excluded.meta
      returning *
    `,
    [
      tenantId,
      locationKey,
      s(input.title),
      nullable(input.country_code || input.countryCode),
      nullable(input.city),
      nullable(input.address_line || input.addressLine),
      nullable(input.map_url || input.mapUrl),
      nullable(input.phone),
      nullable(input.email),
      json(obj(input.working_hours || input.workingHours), {}),
      json(arr(input.delivery_areas || input.deliveryAreas), []),
      bool(input.is_primary, false),
      bool(input.enabled, true),
      int(input.sort_order, 0),
      json(obj(input.meta), {}),
    ]
  );

  return rowOrNull(q);
}

export async function dbDeleteTenantLocation(db, tenantId, locationId) {
  if (!db || !tenantId || !locationId) return false;

  const q = await db.query(
    `
      delete from tenant_locations
      where tenant_id = $1
        and id = $2
      returning id
    `,
    [tenantId, locationId]
  );

  return !!rowOrNull(q);
}

// ---------------------------------------------------------
// contacts
// ---------------------------------------------------------

export async function dbListTenantContacts(db, tenantId) {
  if (!db || !tenantId) return [];

  const q = await db.query(
    `
      select *
      from tenant_contacts
      where tenant_id = $1
      order by sort_order asc, updated_at desc, created_at desc
    `,
    [tenantId]
  );

  return rows(q);
}

export async function dbUpsertTenantContact(db, tenantId, input = {}) {
  if (!db || !tenantId) return null;

  const contactKey = lower(input.contact_key || input.contactKey);
  if (!contactKey) return null;

  const q = await db.query(
    `
      insert into tenant_contacts (
        tenant_id,
        contact_key,
        channel,
        label,
        value,
        is_primary,
        enabled,
        visible_public,
        visible_in_ai,
        sort_order,
        meta
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
        $11::jsonb
      )
      on conflict (tenant_id, contact_key) do update
      set
        channel = excluded.channel,
        label = excluded.label,
        value = excluded.value,
        is_primary = excluded.is_primary,
        enabled = excluded.enabled,
        visible_public = excluded.visible_public,
        visible_in_ai = excluded.visible_in_ai,
        sort_order = excluded.sort_order,
        meta = excluded.meta
      returning *
    `,
    [
      tenantId,
      contactKey,
      lower(input.channel || "other"),
      s(input.label),
      s(input.value),
      bool(input.is_primary, false),
      bool(input.enabled, true),
      bool(input.visible_public, true),
      bool(input.visible_in_ai, true),
      int(input.sort_order, 0),
      json(obj(input.meta), {}),
    ]
  );

  return rowOrNull(q);
}

export async function dbDeleteTenantContact(db, tenantId, contactId) {
  if (!db || !tenantId || !contactId) return false;

  const q = await db.query(
    `
      delete from tenant_contacts
      where tenant_id = $1
        and id = $2
      returning id
    `,
    [tenantId, contactId]
  );

  return !!rowOrNull(q);
}