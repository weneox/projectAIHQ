import {
  b,
  isLiveVoiceStatus,
  isObj,
  n,
  normalizePhone,
  normalizeTranscriptItem,
  s,
  sameTenant,
  toArray,
} from "../../../modules/voice/shared.js";

export {
  b,
  isLiveVoiceStatus,
  isObj,
  n,
  normalizePhone,
  normalizeTranscriptItem,
  s,
  sameTenant,
  toArray,
};

export function ok(res, data = {}) {
  return res.json({ ok: true, ...data });
}

export function fail(res, status, error, extra = {}) {
  return res.status(status).json({ ok: false, error, ...extra });
}

export function getActor(req) {
  return (
    s(req.user?.email) ||
    s(req.user?.user_email) ||
    s(req.session?.user?.email) ||
    s(req.auth?.email) ||
    "unknown"
  );
}

export function readTenantId(req) {
  return (
    s(req.user?.tenantId) ||
    s(req.user?.tenant_id) ||
    s(req.session?.tenantId) ||
    s(req.session?.tenant_id) ||
    s(req.tenant?.id) ||
    s(req.tenantId) ||
    s(req.headers?.["x-tenant-id"]) ||
    s(req.body?.tenantId) ||
    s(req.body?.tenant_id) ||
    s(req.query?.tenantId) ||
    s(req.query?.tenant_id) ||
    s(req.params?.tenantId) ||
    s(req.params?.tenant_id)
  );
}

export function readTenantKey(req) {
  return (
    s(req.user?.tenantKey) ||
    s(req.user?.tenant_key) ||
    s(req.session?.tenantKey) ||
    s(req.session?.tenant_key) ||
    s(req.tenant?.tenant_key) ||
    s(req.tenant?.key) ||
    s(req.tenantKey) ||
    s(req.headers?.["x-tenant-key"]) ||
    s(req.body?.tenantKey) ||
    s(req.body?.tenant_key) ||
    s(req.query?.tenantKey) ||
    s(req.query?.tenant_key) ||
    s(req.params?.tenantKey) ||
    s(req.params?.tenant_key)
  );
}
