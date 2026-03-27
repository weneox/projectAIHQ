import { createTenantSourcesHelpers } from "../../../../db/helpers/tenantSources.js";
import { createTenantKnowledgeHelpers } from "../../../../db/helpers/tenantKnowledge.js";
import { requireOwnerOrAdmin } from "../utils.js";
import {
  bad,
  hasDb,
  pickTenantId,
  pickTenantKey,
} from "./shared.js";

export function createSettingsSourcesRouteContext({
  db,
  createSourcesHelpers = createTenantSourcesHelpers,
  createKnowledgeHelpers = createTenantKnowledgeHelpers,
} = {}) {
  function requireSettingsWriteRole(req, res) {
    return requireOwnerOrAdmin(req, res);
  }

  function requireDbOr503(res) {
    if (hasDb(db)) return true;
    bad(res, 503, "db disabled", { dbDisabled: true });
    return false;
  }

  function getSources() {
    if (!hasDb(db)) return null;
    return createSourcesHelpers({ db });
  }

  function getKnowledge() {
    if (!hasDb(db)) return null;
    return createKnowledgeHelpers({ db });
  }

  async function resolveTenantOr400(req, res) {
    if (!requireDbOr503(res)) return null;

    const sources = getSources();
    if (!sources) {
      bad(res, 503, "db disabled", { dbDisabled: true });
      return null;
    }

    const tenant = await sources.resolveTenantIdentity({
      tenantId: pickTenantId(req),
      tenantKey: pickTenantKey(req),
    });
    if (!tenant) {
      bad(res, 400, "tenant not found");
      return null;
    }
    return tenant;
  }

  return {
    db,
    requireSettingsWriteRole,
    requireDbOr503,
    getSources,
    getKnowledge,
    resolveTenantOr400,
  };
}
