import { getTenantBrainRuntime, isRuntimeAuthorityError } from "../../../services/businessBrain/getTenantBrainRuntime.js";
import { findTenantByKeyOrPhone } from "../repository.js";
import { normalizePhone, s } from "../shared.js";
import { firstNonEmpty } from "./primitives.js";
import {
  buildStableTenantScope,
  normalizedRuntimeTenantKey,
} from "./tenant.js";
import {
  hydrateTenantRowIfNeeded,
  needsTenantHydration,
} from "./tenantHydration.js";

export async function resolveVoiceTenantContext({
  db,
  tenantKey,
  toNumber,
  getRuntime = getTenantBrainRuntime,
}) {
  const normalizedTenantKey = s(tenantKey);
  const normalizedToNumber = s(toNumber);

  let tenant = null;
  let runtime = null;
  let runtimeAuthorityError = null;

  if (normalizedTenantKey) {
    try {
      runtime = await getRuntime({
        db,
        tenantKey: normalizedTenantKey,
        authorityMode: "strict",
      });
    } catch (error) {
      if (isRuntimeAuthorityError(error)) {
        runtimeAuthorityError = error;
      } else {
        throw error;
      }
    }
  }

  const runtimeTenantKey = normalizedRuntimeTenantKey(runtime);
  const shouldResolveTenantFromDb =
    !tenant ||
    needsTenantHydration(
      buildStableTenantScope({
        tenant,
        runtime,
        tenantKey: normalizedTenantKey,
        toNumber: normalizedToNumber,
      })
    );

  if (shouldResolveTenantFromDb) {
    const resolvedTenant = await findTenantByKeyOrPhone(db, {
      tenantKey: firstNonEmpty(normalizedTenantKey, runtimeTenantKey),
      toNumber: normalizedToNumber,
      normalizePhone,
    });

    if (resolvedTenant) {
      tenant = resolvedTenant;
    }
  }

  if (!runtime && tenant) {
    try {
      runtime = await getRuntime({
        db,
        tenantId: tenant.id,
        tenantKey: tenant.tenant_key,
        authorityMode: "strict",
      });
      runtimeAuthorityError = null;
    } catch (error) {
      if (isRuntimeAuthorityError(error)) {
        runtimeAuthorityError = error;
      } else {
        throw error;
      }
    }
  }

  const normalizedTenant = await hydrateTenantRowIfNeeded({
    db,
    tenant,
    runtime,
    tenantKey: normalizedTenantKey,
    toNumber: normalizedToNumber,
  });

  return {
    tenant: normalizedTenant,
    runtime,
    runtimeAuthorityError,
  };
}


