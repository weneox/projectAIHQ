import { dbGetTenantByKey } from "../../db/helpers/settings.js";

export async function getTenantByKey(db, tenantKey) {
  return dbGetTenantByKey(db, tenantKey);
}
