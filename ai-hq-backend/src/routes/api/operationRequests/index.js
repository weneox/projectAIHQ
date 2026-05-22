import express from "express";

import {
  getOperationRequestByIdForTenant,
  listOperationRequestsForTenant,
  updateOperationRequestForTenant,
} from "../../../db/helpers/operationRequests.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function ok(res, payload = {}) {
  return res.json({ ok: true, ...payload });
}

function fail(res, status, code) {
  return res.status(status).json({
    ok: false,
    error: code,
    code,
  });
}

function readTenant(req = {}) {
  return {
    tenantId: s(req.auth?.tenantId || req.tenantId),
    tenantKey: s(req.auth?.tenantKey || req.tenantKey || req.tenant?.tenant_key),
  };
}

function n(value, fallback = 50) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

const ALLOWED_PATCH_FIELDS = new Set([
  "status",
  "priority",
  "assignedTo",
  "dueAt",
  "resolvedAt",
  "title",
  "description",
  "notes",
  "meta",
]);

const ALLOWED_META_FIELDS = new Set(["notes", "operatorNotes"]);

const FORBIDDEN_PATCH_FIELDS = new Set([
  "tenantId",
  "tenant_id",
  "tenantKey",
  "tenant_key",
  "sourceCallId",
  "source_call_id",
  "sourceToolCallId",
  "source_tool_call_id",
  "sourceChannel",
  "source_channel",
  "operationType",
  "operation_type",
  "requestType",
  "request_type",
  "businessFamily",
  "business_family",
  "customerPhone",
  "customer_phone",
  "slots",
  "extraction",
]);

function findRejectedPatchFields(body = {}) {
  const keys = Object.keys(obj(body));
  const rejected = keys.filter(
    (key) => FORBIDDEN_PATCH_FIELDS.has(key) || !ALLOWED_PATCH_FIELDS.has(key)
  );
  const metaKeys = Object.keys(obj(body.meta));
  for (const key of metaKeys) {
    if (!ALLOWED_META_FIELDS.has(key)) {
      rejected.push(`meta.${key}`);
    }
  }
  return rejected;
}

function buildPatch(body = {}, current = {}) {
  const input = obj(body);
  const patch = {};

  for (const key of ["status", "priority", "assignedTo", "dueAt", "resolvedAt", "title", "description"]) {
    if (input[key] !== undefined) {
      patch[key] = input[key];
    }
  }

  if (s(input.status).toLowerCase() === "resolved" && !input.resolvedAt && !current.resolvedAt) {
    patch.resolvedAt = new Date().toISOString();
  }

  const nextMeta = {
    ...obj(current.meta),
  };
  let hasMetaPatch = false;

  if (input.notes !== undefined) {
    nextMeta.notes = s(input.notes);
    hasMetaPatch = true;
  }

  for (const [key, value] of Object.entries(obj(input.meta))) {
    if (ALLOWED_META_FIELDS.has(key)) {
      nextMeta[key] = s(value);
      hasMetaPatch = true;
    }
  }

  if (hasMetaPatch) {
    patch.meta = nextMeta;
  }

  return patch;
}

async function auditOperationRequestPatch({ audit, req, request, before = {}, patch = {} } = {}) {
  if (!audit?.log) return;
  try {
    await audit.log({
      action: "operation_request.updated",
      objectType: "operation_request",
      objectId: s(request?.id),
      tenantId: s(req.auth?.tenantId || req.tenantId),
      tenantKey: s(req.auth?.tenantKey || req.tenantKey),
      actor: s(req.auth?.userId || req.user?.id || "user"),
      meta: {
        status: {
          before: s(before.status),
          after: s(request?.status),
          changed: patch.status !== undefined,
        },
        priority: {
          before: s(before.priority),
          after: s(request?.priority),
          changed: patch.priority !== undefined,
        },
      },
    });
  } catch {}
}

export async function listOperationRequestsHandler(req, res, { db, dbDisabled = false } = {}) {
  if (dbDisabled || !db) return fail(res, 503, "db_unavailable");
  const { tenantId } = readTenant(req);
  if (!tenantId) return fail(res, 401, "missing_authenticated_tenant_context");

  const requests = await listOperationRequestsForTenant(db, {
    tenantId,
    status: s(req.query?.status),
    requestType: s(req.query?.requestType || req.query?.request_type),
    limit: n(req.query?.limit, 50),
  });

  return ok(res, {
    requests,
    items: requests,
    count: requests.length,
  });
}

export async function getOperationRequestHandler(req, res, { db, dbDisabled = false } = {}) {
  if (dbDisabled || !db) return fail(res, 503, "db_unavailable");
  const { tenantId } = readTenant(req);
  if (!tenantId) return fail(res, 401, "missing_authenticated_tenant_context");

  const request = await getOperationRequestByIdForTenant(db, {
    id: s(req.params?.id),
    tenantId,
  });

  if (!request) return fail(res, 404, "operation_request_not_found");
  return ok(res, { request });
}

export async function patchOperationRequestHandler(
  req,
  res,
  { db, dbDisabled = false, audit = null } = {}
) {
  if (dbDisabled || !db) return fail(res, 503, "db_unavailable");
  const { tenantId } = readTenant(req);
  if (!tenantId) return fail(res, 401, "missing_authenticated_tenant_context");

  const rejectedFields = findRejectedPatchFields(req.body);
  if (rejectedFields.length) {
    return fail(res, 400, "operation_request_patch_forbidden_fields");
  }

  const current = await getOperationRequestByIdForTenant(db, {
    id: s(req.params?.id),
    tenantId,
  });
  if (!current) return fail(res, 404, "operation_request_not_found");

  const patch = buildPatch(req.body, current);
  const updated = await updateOperationRequestForTenant(db, {
    id: current.id,
    tenantId,
    patch,
  });

  if (!updated) return fail(res, 404, "operation_request_not_found");
  await auditOperationRequestPatch({
    audit,
    req,
    request: updated,
    before: current,
    patch,
  });

  return ok(res, { request: updated });
}

export function operationRequestsRoutes({ db, dbDisabled = false, audit = null } = {}) {
  const router = express.Router();

  router.get("/operation-requests", (req, res) =>
    listOperationRequestsHandler(req, res, { db, dbDisabled })
  );
  router.get("/operation-requests/:id", (req, res) =>
    getOperationRequestHandler(req, res, { db, dbDisabled })
  );
  router.patch("/operation-requests/:id", (req, res) =>
    patchOperationRequestHandler(req, res, { db, dbDisabled, audit })
  );

  return router;
}

export const __test__ = {
  buildPatch,
  findRejectedPatchFields,
  getOperationRequestHandler,
  listOperationRequestsHandler,
  patchOperationRequestHandler,
  readTenant,
};
