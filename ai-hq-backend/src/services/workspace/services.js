// src/services/workspace/services.js
// FINAL v1.2 — workspace service catalog setup services, projection-safe setup status gating

import { normalizeStringArray, obj, s } from "./shared.js";
import { buildSetupState } from "./setup.js";

function jsonb(value) {
  return JSON.stringify(value ?? {});
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function toBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  const x = s(value).toLowerCase();
  if (!x) return fallback;
  if (["true", "1", "yes", "on"].includes(x)) return true;
  if (["false", "0", "no", "off"].includes(x)) return false;
  return fallback;
}

function slugify(value = "") {
  const out = s(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

  return out || "service";
}

async function q(db, text, params = []) {
  if (!db || typeof db.query !== "function") {
    throw new Error("Database client is not available");
  }
  return db.query(text, params);
}

async function resolveTenantScope({ db, tenantId, tenantKey, tenant = null }) {
  const existingId = s(tenant?.id || tenantId);
  const existingKey = s(tenant?.tenant_key || tenant?.key || tenantKey);

  let result;

  if (existingId) {
    result = await q(
      db,
      `
        select
          id,
          tenant_key,
          company_name
        from tenants
        where id = $1::uuid
        limit 1
      `,
      [existingId]
    );
  } else if (existingKey) {
    result = await q(
      db,
      `
        select
          id,
          tenant_key,
          company_name
        from tenants
        where tenant_key = $1
        limit 1
      `,
      [existingKey]
    );
  } else {
    throw new Error("Tenant scope is required");
  }

  const row = result?.rows?.[0];
  if (!row) {
    throw new Error("Tenant could not be resolved");
  }

  return {
    id: s(row.id),
    tenantKey: s(row.tenant_key),
    companyName: s(row.company_name),
  };
}

function normalizeServiceInput(input = {}) {
  const body = obj(input);

  const title = s(body.title || body.name);
  const description = s(body.description || body.summary);
  const category = s(body.category || "general").toLowerCase() || "general";

  const rawPrice =
    body.priceFrom ?? body.price_from ?? body.startingPrice ?? body.starting_price;
  const priceFrom =
    rawPrice === "" || rawPrice == null ? null : Number(rawPrice);

  const currency = s(body.currency || "AZN").toUpperCase() || "AZN";
  const pricingModel = s(
    body.pricingModel || body.pricing_model || "custom_quote"
  ).toLowerCase() || "custom_quote";

  const rawDuration = body.durationMinutes ?? body.duration_minutes;
  const durationMinutes =
    rawDuration === "" || rawDuration == null ? null : Number(rawDuration);

  const isActive = toBoolean(
    body.isActive ?? body.is_active ?? body.enabled ?? body.active,
    true
  );

  const rawSort = body.sortOrder ?? body.sort_order;
  const sortOrder = rawSort === "" || rawSort == null ? 0 : Number(rawSort);

  const highlights = normalizeStringArray(
    body.highlights ??
      body.highlightsText ??
      body.highlights_text
  );

  if (!title) {
    throw new Error("Service title is required");
  }

  if (priceFrom != null && !Number.isFinite(priceFrom)) {
    throw new Error("Price must be a valid number");
  }

  if (durationMinutes != null && !Number.isFinite(durationMinutes)) {
    throw new Error("Duration must be a valid number");
  }

  if (!Number.isFinite(sortOrder)) {
    throw new Error("Sort order must be a valid number");
  }

  return {
    title,
    description,
    category,
    priceFrom,
    currency,
    pricingModel,
    durationMinutes,
    isActive,
    sortOrder,
    highlights,
  };
}

function mapServiceRow(row = {}) {
  return {
    id: s(row.id),
    serviceKey: s(row.service_key),
    title: s(row.title),
    description: s(row.description),
    category: s(row.category || "general"),
    priceFrom: row.price_from == null ? null : Number(row.price_from),
    currency: s(row.currency || "AZN"),
    pricingModel: s(row.pricing_model || "custom_quote"),
    durationMinutes:
      row.duration_minutes == null ? null : Number(row.duration_minutes),
    isActive: !!row.is_active,
    sortOrder: Number(row.sort_order || 0),
    highlights: Array.isArray(row.highlights_json) ? row.highlights_json : [],
    createdAt: s(row.created_at),
    updatedAt: s(row.updated_at),
  };
}

async function buildUniqueServiceKey(db, tenantId, title) {
  const base = slugify(title);

  const existing = await q(
    db,
    `
      select service_key
      from tenant_services
      where tenant_id = $1::uuid
        and service_key like $2
      order by created_at asc
    `,
    [tenantId, `${base}%`]
  );

  const taken = new Set(
    arr(existing?.rows).map((row) => s(row.service_key)).filter(Boolean)
  );

  if (!taken.has(base)) {
    return base;
  }

  for (let i = 2; i <= 999; i += 1) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  return `${base}-${Date.now().toString(36)}`;
}

async function maybeBuildSetup({
  includeSetup = true,
  db,
  tenantId,
  tenantKey,
  role = "",
  tenant = null,
}) {
  if (!includeSetup) return null;

  return buildSetupState({
    db,
    tenantId,
    tenantKey,
    role,
    tenant,
  });
}

export async function listSetupServices({
  db,
  tenantId,
  tenantKey,
  role = "",
  tenant = null,
  includeSetup = true,
}) {
  const scope = await resolveTenantScope({
    db,
    tenantId,
    tenantKey,
    tenant,
  });

  const { rows } = await q(
    db,
    `
      select
        id,
        service_key,
        title,
        description,
        category,
        price_from,
        currency,
        pricing_model,
        duration_minutes,
        is_active,
        sort_order,
        highlights_json,
        created_at,
        updated_at
      from tenant_services
      where tenant_id = $1::uuid
      order by sort_order asc, created_at asc
    `,
    [scope.id]
  );

  const setup = await maybeBuildSetup({
    includeSetup,
    db,
    tenantId: scope.id,
    tenantKey: scope.tenantKey,
    role,
    tenant,
  });

  return {
    items: rows.map(mapServiceRow),
    ...(setup ? { setup } : {}),
  };
}

export async function createSetupService({
  db,
  tenantId,
  tenantKey,
  role = "",
  tenant = null,
  body = {},
  includeSetup = true,
}) {
  const scope = await resolveTenantScope({
    db,
    tenantId,
    tenantKey,
    tenant,
  });

  const service = normalizeServiceInput(body);
  const serviceKey = await buildUniqueServiceKey(db, scope.id, service.title);

  const { rows } = await q(
    db,
    `
      insert into tenant_services (
        tenant_id,
        tenant_key,
        service_key,
        title,
        description,
        category,
        price_from,
        currency,
        pricing_model,
        duration_minutes,
        is_active,
        sort_order,
        highlights_json,
        metadata_json
      )
      values (
        $1::uuid,
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
        $13::jsonb,
        $14::jsonb
      )
      returning *
    `,
    [
      scope.id,
      scope.tenantKey,
      serviceKey,
      service.title,
      service.description,
      service.category,
      service.priceFrom,
      service.currency,
      service.pricingModel,
      service.durationMinutes,
      service.isActive,
      service.sortOrder,
      jsonb(service.highlights),
      jsonb({ source: "setup_services" }),
    ]
  );

  const setup = await maybeBuildSetup({
    includeSetup,
    db,
    tenantId: scope.id,
    tenantKey: scope.tenantKey,
    role,
    tenant,
  });

  return {
    item: mapServiceRow(rows?.[0] || {}),
    ...(setup ? { setup } : {}),
  };
}

export async function updateSetupService({
  db,
  tenantId,
  tenantKey,
  role = "",
  tenant = null,
  serviceId,
  body = {},
  includeSetup = true,
}) {
  const scope = await resolveTenantScope({
    db,
    tenantId,
    tenantKey,
    tenant,
  });

  const id = s(serviceId);
  if (!id) {
    throw new Error("Service id is required");
  }

  const service = normalizeServiceInput(body);

  const { rows } = await q(
    db,
    `
      update tenant_services
      set
        title = $3,
        description = $4,
        category = $5,
        price_from = $6,
        currency = $7,
        pricing_model = $8,
        duration_minutes = $9,
        is_active = $10,
        sort_order = $11,
        highlights_json = $12::jsonb,
        metadata_json = coalesce(metadata_json, '{}'::jsonb) || $13::jsonb,
        updated_at = now()
      where id = $1::uuid
        and tenant_id = $2::uuid
      returning *
    `,
    [
      id,
      scope.id,
      service.title,
      service.description,
      service.category,
      service.priceFrom,
      service.currency,
      service.pricingModel,
      service.durationMinutes,
      service.isActive,
      service.sortOrder,
      jsonb(service.highlights),
      jsonb({ source: "setup_services_update" }),
    ]
  );

  if (!rows?.length) {
    throw new Error("Service not found");
  }

  const setup = await maybeBuildSetup({
    includeSetup,
    db,
    tenantId: scope.id,
    tenantKey: scope.tenantKey,
    role,
    tenant,
  });

  return {
    item: mapServiceRow(rows[0]),
    ...(setup ? { setup } : {}),
  };
}

export async function deleteSetupService({
  db,
  tenantId,
  tenantKey,
  role = "",
  tenant = null,
  serviceId,
  includeSetup = true,
}) {
  const scope = await resolveTenantScope({
    db,
    tenantId,
    tenantKey,
    tenant,
  });

  const id = s(serviceId);
  if (!id) {
    throw new Error("Service id is required");
  }

  const { rows } = await q(
    db,
    `
      delete from tenant_services
      where id = $1::uuid
        and tenant_id = $2::uuid
      returning id, title
    `,
    [id, scope.id]
  );

  if (!rows?.length) {
    throw new Error("Service not found");
  }

  const setup = await maybeBuildSetup({
    includeSetup,
    db,
    tenantId: scope.id,
    tenantKey: scope.tenantKey,
    role,
    tenant,
  });

  return {
    deleted: {
      id: s(rows[0].id),
      title: s(rows[0].title),
    },
    ...(setup ? { setup } : {}),
  };
}
