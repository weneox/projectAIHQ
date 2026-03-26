import { cfg } from "../config.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function normalizePhone(v) {
  return s(v).replace(/[^\d+]/g, "");
}

function isDevLikeEnv() {
  return ["", "development", "dev", "test"].includes(
    s(cfg.APP_ENV, "development").toLowerCase()
  );
}

export async function resolveTenantFromRequest(req) {
  const tenantKey =
    s(req.headers["x-tenant-key"]) ||
    s(req.query?.tenantKey) ||
    s(req.body?.tenantKey);

  const toNumber =
    normalizePhone(req.body?.To) ||
    normalizePhone(req.query?.To) ||
    normalizePhone(req.body?.Called) ||
    normalizePhone(req.query?.Called);

  if (tenantKey && cfg.ALLOW_UNSAFE_TENANT_KEY_RESOLUTION && isDevLikeEnv()) {
    return {
      ok: true,
      tenantKey,
      matchedBy: "tenantKey",
      toNumber: toNumber || null,
    };
  }

  if (toNumber) {
    return {
      ok: true,
      tenantKey: null,
      matchedBy: "toNumber",
      toNumber,
    };
  }

  return {
    ok: false,
    error: tenantKey
      ? "unsafe_tenant_key_resolution_blocked"
      : "tenant_resolution_required",
    tenantKey: "",
    matchedBy: "",
    toNumber: null,
  };
}
