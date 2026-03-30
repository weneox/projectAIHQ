import { createTenantExecutionPolicyControlHelpers } from "../../../db/helpers/tenantExecutionPolicyControls.js";
import { arr, hasDb } from "../runtimeShared.js";
import { runOptionalDbStep } from "./optionalSteps.js";

async function loadTenantPolicyControls({ db, tenant }) {
  if (!hasDb(db) || !tenant?.id) {
    return {
      tenantDefault: {},
      items: [],
    };
  }

  const controls = createTenantExecutionPolicyControlHelpers({ db });
  const rows = await runOptionalDbStep(
    "loadTenantPolicyControls",
    tenant,
    db,
    () =>
      controls.listControls({
        tenantId: tenant.id,
        tenantKey: tenant.tenant_key,
      }),
    []
  );

  return {
    tenantDefault:
      arr(rows).find((item) => String(item.surface).toLowerCase() === "tenant") || {},
    items: arr(rows).filter((item) => String(item.surface).toLowerCase() !== "tenant"),
  };
}

export { loadTenantPolicyControls };
