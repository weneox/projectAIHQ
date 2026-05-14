import { dbCreateTenantUser } from "../../db/helpers/tenantUsers.js";
import {
  syncCanonicalIdentityAndMembership,
  withTransaction,
} from "./canonicalUserAccess.js";

export async function createTenantUser(db, tenantId, input) {
  return withTransaction(db, async (tx) => {
    const user = await dbCreateTenantUser(tx, tenantId, input);
    await syncCanonicalIdentityAndMembership(tx, tenantId, user);
    return user;
  });
}
