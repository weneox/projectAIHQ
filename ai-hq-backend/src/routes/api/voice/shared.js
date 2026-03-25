export function s(v, d = "") {
  return String(v ?? d).trim();
}

export function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

export function b(v, d = false) {
  if (typeof v === "boolean") return v;
  const x = String(v ?? "").trim().toLowerCase();
  if (!x) return d;
  if (["1", "true", "yes", "y", "on"].includes(x)) return true;
  if (["0", "false", "no", "n", "off"].includes(x)) return false;
  return d;
}

export function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function toArray(v) {
  return Array.isArray(v) ? v : [];
}

export function ok(res, data = {}) {
  return res.json({ ok: true, ...data });
}

export function fail(res, status, error, extra = {}) {
  return res.status(status).json({ ok: false, error, ...extra });
}

export function normalizePhone(v) {
  return s(v).replace(/[^\d+]/g, "");
}

export function isLiveVoiceStatus(v) {
  const x = String(v || "").trim().toLowerCase();
  return [
    "live",
    "active",
    "in_progress",
    "ongoing",
    "ringing",
    "queued",
    "bridged",
    "bot_active",
    "agent_ringing",
    "agent_whisper",
    "agent_live",
  ].includes(x);
}

export function sameTenant(a, b) {
  return s(a) === s(b);
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

export function normalizeTranscriptItem(input = {}) {
  return {
    ts: s(input.ts || new Date().toISOString()),
    role: s(input.role || "customer"),
    text: s(input.text),
  };
}