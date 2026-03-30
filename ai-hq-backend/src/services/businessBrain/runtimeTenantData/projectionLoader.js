import {
  getCurrentTenantRuntimeProjection,
  getTenantRuntimeProjectionFreshness,
} from "../../../db/helpers/tenantRuntimeProjection.js";
import { createRuntimeAuthorityError } from "../runtimeAuthority.js";
import { hasDb } from "../runtimeShared.js";
import { runDbStep } from "./logging.js";

async function loadCurrentProjection({ db, tenantId = "", tenantKey = "" }) {
  if (!hasDb(db)) return null;

  const tenantRef = { id: tenantId, tenant_key: tenantKey };

  const current = await runDbStep(
    "getCurrentTenantRuntimeProjection",
    tenantRef,
    () => getCurrentTenantRuntimeProjection({ tenantId, tenantKey }, db)
  );

  if (current) {
    const freshness = await runDbStep(
      "getTenantRuntimeProjectionFreshness",
      tenantRef,
      () =>
        getTenantRuntimeProjectionFreshness(
          {
            tenantId,
            tenantKey,
            runtimeProjection: current,
          },
          db
        )
    );

    if (!freshness?.stale) {
      return { projection: current, freshness };
    }

    throw createRuntimeAuthorityError({
      mode: "strict",
      tenantId,
      tenantKey,
      runtimeProjection: current,
      freshness,
      reasonCode: "runtime_projection_stale",
      reason: "runtime_projection_stale",
      message:
        "Approved runtime projection is stale and automatic rebuild is disabled until a governed runtime refresh occurs.",
    });
  }

  return {
    projection: null,
    freshness: null,
  };
}

export { loadCurrentProjection };
