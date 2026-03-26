import {
  getTenantVoiceSettings,
  upsertTenantVoiceSettings,
  listVoiceCalls,
  getVoiceCallById,
  listVoiceCallEvents,
  getVoiceDailyUsage,
  listVoiceCallSessions,
  getVoiceCallSessionById,
  updateVoiceCallSession,
  getVoiceCallByProviderSid,
  createVoiceCall,
  updateVoiceCall,
  appendVoiceCallEvent,
  getVoiceCallSessionByProviderCallSid,
  createVoiceCallSession,
} from "../../../db/helpers/voice.js";
import { s } from "./shared.js";

export {
  getTenantVoiceSettings,
  upsertTenantVoiceSettings,
  listVoiceCalls,
  getVoiceCallById,
  listVoiceCallEvents,
  getVoiceDailyUsage,
  listVoiceCallSessions,
  getVoiceCallSessionById,
  updateVoiceCallSession,
  getVoiceCallByProviderSid,
  createVoiceCall,
  updateVoiceCall,
  appendVoiceCallEvent,
  getVoiceCallSessionByProviderCallSid,
  createVoiceCallSession,
};

export async function resolveTenantScope(req, db) {
  const tenantId =
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
    s(req.params?.tenant_id);

  const tenantKey =
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
    s(req.params?.tenant_key);

  if (tenantId) {
    return { tenantId, tenantKey };
  }

  if (!tenantKey) {
    return { tenantId: "", tenantKey: "" };
  }

  if (!db?.query) {
    return { tenantId: "", tenantKey };
  }

  const q = await db.query(
    `
      select
        id::text as id,
        tenant_key
      from tenants
      where lower(tenant_key) = lower($1)
      limit 1
    `,
    [tenantKey]
  );

  const row = q?.rows?.[0] || null;

  return {
    tenantId: s(row?.id),
    tenantKey: s(row?.tenant_key || tenantKey),
  };
}

export async function findTenantByKeyOrPhone(db, { tenantKey, toNumber, normalizePhone }) {
  const key = s(tenantKey).toLowerCase();
  const to = normalizePhone(toNumber);

  if (!db?.query) return null;

  if (key) {
    const q = await db.query(
      `
      select
        t.id,
        t.tenant_key,
        t.company_name,
        t.timezone,
        t.default_language,
        t.meta,
        t.inbox_policy
      from tenants t
      where lower(tenant_key) = lower($1)
      limit 1
      `,
      [key]
    );

    if (q.rows?.[0]) return q.rows[0];
  }

  if (to) {
    const q = await db.query(
      `
      select
        t.id,
        t.tenant_key,
        t.company_name,
        t.timezone,
        t.default_language,
        t.meta,
        t.inbox_policy
      from tenants t
      left join tenant_voice_settings tvs on tvs.tenant_id = t.id
      where
        regexp_replace(coalesce(tvs.twilio_phone_number, ''), '[^0-9+]', '', 'g') = $1
      limit 1
      `,
      [to]
    );

    if (q.rows?.[0]) return q.rows[0];
  }

  return null;
}
