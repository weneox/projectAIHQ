import { isDbReady } from "../../../../utils/http.js";
import { resolveTenantKey } from "../../../../tenancy/index.js";
import {
  getTenantBrainRuntime,
  isRuntimeAuthorityError,
} from "../../../../services/businessBrain/getTenantBrainRuntime.js";
import {
  s,
} from "./shared.js";

export async function getTenantByKey(
  db,
  tenantKey,
  { runtimeLoader = getTenantBrainRuntime } = {}
) {
  if (!isDbReady(db)) return null;

  const resolvedTenantKey = resolveTenantKey(tenantKey);

  try {
    const runtime = await runtimeLoader({
      db,
      tenantKey: resolvedTenantKey,
      authorityMode: "strict",
    });

    if (runtime?.tenant?.id || runtime?.tenant?.tenant_key) {
      return runtime.tenant;
    }
  } catch (error) {
    if (isRuntimeAuthorityError(error)) {
      return null;
    }
    throw error;
  }

  return null;
}

export async function resolveTenantScopeForLead(
  db,
  tenantKey,
  { tenantLoader = getTenantByKey } = {}
) {
  const resolvedTenantKey = resolveTenantKey(tenantKey);

  const tenant = await tenantLoader(db, resolvedTenantKey);
  if (tenant?.id || tenant?.tenant_key) {
    return {
      tenantId: s(tenant?.id || ""),
      tenantKey: s(tenant?.tenant_key || resolvedTenantKey),
      companyName: s(tenant?.company_name || "") || s(tenant?.profile?.brand_name || ""),
    };
  }

  return {
    tenantId: "",
    tenantKey: resolvedTenantKey,
    companyName: "",
  };
}
