import { randomUUID } from "crypto";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function j(value, fallback = {}) {
  if (value && typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function safeUuid(value) {
  return s(value) || randomUUID();
}

async function one(db, sql, params = []) {
  const result = await db.query(sql, params);
  return result.rows?.[0] || null;
}

async function many(db, sql, params = []) {
  const result = await db.query(sql, params);
  return result.rows || [];
}

const STATUSES = new Set([
  "new",
  "in_review",
  "waiting_customer",
  "contacted",
  "scheduled",
  "resolved",
  "cancelled",
  "failed",
]);

const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const SOURCE_CHANNELS = new Set(["voice", "webchat", "whatsapp", "email", "manual", "api", "other"]);

function normalizeStatus(value) {
  const raw = s(value).toLowerCase();
  return STATUSES.has(raw) ? raw : "new";
}

function normalizePriority(value) {
  const raw = s(value).toLowerCase();
  return PRIORITIES.has(raw) ? raw : "normal";
}

function normalizeSourceChannel(value) {
  const raw = s(value).toLowerCase();
  return SOURCE_CHANNELS.has(raw) ? raw : "voice";
}

export function normalizeOperationRequest(row = {}) {
  if (!row) return null;
  return {
    id: s(row.id),
    tenantId: s(row.tenant_id ?? row.tenantId),
    tenantKey: s(row.tenant_key ?? row.tenantKey),
    sourceChannel: normalizeSourceChannel(row.source_channel ?? row.sourceChannel),
    sourceCallId: s(row.source_call_id ?? row.sourceCallId),
    sourceEventId: s(row.source_event_id ?? row.sourceEventId),
    sourceToolCallId: s(row.source_tool_call_id ?? row.sourceToolCallId),
    operationType: s(row.operation_type ?? row.operationType),
    requestType: s(row.request_type ?? row.requestType),
    businessFamily: s(row.business_family ?? row.businessFamily, "generic_business"),
    status: normalizeStatus(row.status),
    priority: normalizePriority(row.priority),
    title: s(row.title),
    description: s(row.description),
    customerName: s(row.customer_name ?? row.customerName),
    customerPhone: s(row.customer_phone ?? row.customerPhone),
    customerEmail: s(row.customer_email ?? row.customerEmail),
    companyName: s(row.company_name ?? row.companyName),
    requestedDate: s(row.requested_date ?? row.requestedDate),
    requestedTime: s(row.requested_time ?? row.requestedTime),
    location: s(row.location),
    address: s(row.address),
    assignedTo: s(row.assigned_to ?? row.assignedTo),
    dueAt: row.due_at ?? row.dueAt ?? null,
    resolvedAt: row.resolved_at ?? row.resolvedAt ?? null,
    slots: j(row.slots, {}),
    extraction: j(row.extraction, {}),
    meta: j(row.meta, {}),
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

export async function createOperationRequest(db, input = {}) {
  if (!db || !input.tenantId) return null;

  const row = await one(
    db,
    `
      insert into operation_requests (
        id,
        tenant_id,
        tenant_key,
        source_channel,
        source_call_id,
        source_event_id,
        source_tool_call_id,
        operation_type,
        request_type,
        business_family,
        status,
        priority,
        title,
        description,
        customer_name,
        customer_phone,
        customer_email,
        company_name,
        requested_date,
        requested_time,
        location,
        address,
        assigned_to,
        due_at,
        resolved_at,
        slots,
        extraction,
        meta
      )
      values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26::jsonb,$27::jsonb,$28::jsonb
      )
      on conflict (tenant_id, source_channel, source_tool_call_id)
        where source_tool_call_id is not null
        do nothing
      returning *
    `,
    [
      safeUuid(input.id),
      s(input.tenantId),
      s(input.tenantKey),
      normalizeSourceChannel(input.sourceChannel),
      s(input.sourceCallId) || null,
      s(input.sourceEventId) || null,
      s(input.sourceToolCallId) || null,
      s(input.operationType, "create_request"),
      s(input.requestType, "custom_request"),
      s(input.businessFamily, "generic_business"),
      normalizeStatus(input.status),
      normalizePriority(input.priority),
      s(input.title),
      s(input.description),
      s(input.customerName) || null,
      s(input.customerPhone) || null,
      s(input.customerEmail) || null,
      s(input.companyName) || null,
      s(input.requestedDate) || null,
      s(input.requestedTime) || null,
      s(input.location) || null,
      s(input.address) || null,
      s(input.assignedTo) || null,
      input.dueAt || null,
      input.resolvedAt || null,
      JSON.stringify(obj(input.slots)),
      JSON.stringify(obj(input.extraction)),
      JSON.stringify(obj(input.meta)),
    ]
  );

  return row ? normalizeOperationRequest(row) : null;
}

export async function getOperationRequestByIdForTenant(db, { id, tenantId } = {}) {
  if (!db || !id || !tenantId) return null;
  const row = await one(
    db,
    `
      select *
      from operation_requests
      where id = $1 and tenant_id = $2
      limit 1
    `,
    [id, tenantId]
  );
  return row ? normalizeOperationRequest(row) : null;
}

export async function listOperationRequestsForTenant(
  db,
  { tenantId, status = "", requestType = "", limit = 50 } = {}
) {
  if (!db || !tenantId) return [];

  const params = [tenantId];
  const where = ["tenant_id = $1"];

  if (s(status)) {
    params.push(normalizeStatus(status));
    where.push(`status = $${params.length}`);
  }

  if (s(requestType)) {
    params.push(s(requestType));
    where.push(`request_type = $${params.length}`);
  }

  params.push(Math.max(1, Math.min(Number(limit) || 50, 200)));

  const rows = await many(
    db,
    `
      select *
      from operation_requests
      where ${where.join(" and ")}
      order by created_at desc
      limit $${params.length}
    `,
    params
  );

  return rows.map(normalizeOperationRequest);
}

export async function updateOperationRequestForTenant(
  db,
  { id, tenantId, patch = {} } = {}
) {
  if (!db || !id || !tenantId) return null;

  const current = await getOperationRequestByIdForTenant(db, { id, tenantId });
  if (!current) return null;
  const next = {
    ...current,
    ...patch,
    slots: Object.keys(obj(patch.slots)).length ? obj(patch.slots) : current.slots,
    extraction: Object.keys(obj(patch.extraction)).length ? obj(patch.extraction) : current.extraction,
    meta: Object.keys(obj(patch.meta)).length ? obj(patch.meta) : current.meta,
  };

  const row = await one(
    db,
    `
      update operation_requests
      set
        tenant_key = $3,
        source_channel = $4,
        source_call_id = $5,
        source_event_id = $6,
        source_tool_call_id = $7,
        operation_type = $8,
        request_type = $9,
        business_family = $10,
        status = $11,
        priority = $12,
        title = $13,
        description = $14,
        customer_name = $15,
        customer_phone = $16,
        customer_email = $17,
        company_name = $18,
        requested_date = $19,
        requested_time = $20,
        location = $21,
        address = $22,
        assigned_to = $23,
        due_at = $24,
        resolved_at = $25,
        slots = $26::jsonb,
        extraction = $27::jsonb,
        meta = $28::jsonb,
        updated_at = now()
      where id = $1 and tenant_id = $2
      returning *
    `,
    [
      id,
      tenantId,
      s(next.tenantKey),
      normalizeSourceChannel(next.sourceChannel),
      s(next.sourceCallId) || null,
      s(next.sourceEventId) || null,
      s(next.sourceToolCallId) || null,
      s(next.operationType, "create_request"),
      s(next.requestType, "custom_request"),
      s(next.businessFamily, "generic_business"),
      normalizeStatus(next.status),
      normalizePriority(next.priority),
      s(next.title),
      s(next.description),
      s(next.customerName) || null,
      s(next.customerPhone) || null,
      s(next.customerEmail) || null,
      s(next.companyName) || null,
      s(next.requestedDate) || null,
      s(next.requestedTime) || null,
      s(next.location) || null,
      s(next.address) || null,
      s(next.assignedTo) || null,
      next.dueAt || null,
      next.resolvedAt || null,
      JSON.stringify(obj(next.slots)),
      JSON.stringify(obj(next.extraction)),
      JSON.stringify(obj(next.meta)),
    ]
  );

  return row ? normalizeOperationRequest(row) : null;
}
