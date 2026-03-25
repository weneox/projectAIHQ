import { cfg } from "../../../config.js";
import { assertDbReady } from "../../../utils/http.js";
import { dbGetTenantMode, dbSetTenantMode } from "../../../db/helpers/tenants.js";
import { normalizeMode, resolveTenantKey, s } from "./utils.js";

export async function getTenantMode({ db, tenantKey }) {
  const tk = resolveTenantKey(tenantKey);
  assertDbReady(db);

  try {
    const row = await dbGetTenantMode(db, tk);
    return normalizeMode(row?.mode || cfg.app.defaultMode || "manual");
  } catch {
    return normalizeMode(cfg.app.defaultMode || "manual");
  }
}

export async function setTenantMode({ db, tenantKey, mode }) {
  const tk = resolveTenantKey(tenantKey);
  const m = normalizeMode(mode);
  assertDbReady(db);

  const row = await dbSetTenantMode(db, tk, m);

  if (row) {
    return {
      tenant_key: s(row.tenant_key || tk),
      mode: normalizeMode(row.mode),
    };
  }
  throw new Error("tenant mode update failed");
}
