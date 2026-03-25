import { okJson } from "../../../utils/http.js";
import { getTenantMode, setTenantMode } from "./service.js";
import { normalizeMode, resolveTenantKey } from "./utils.js";

export function createModeHandlers({ db, wsHub }) {
  async function getMode(req, res) {
    const tenantKey = resolveTenantKey(
      req.query.tenantKey ||
        req.query.tenant_key ||
        req.query.tenantId ||
        req.query.tenant_id
    );

    try {
      const mode = await getTenantMode({ db, tenantKey });
      return okJson(res, {
        ok: true,
        tenantKey,
        tenant_key: tenantKey,
        mode,
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  async function postMode(req, res) {
    const tenantKey = resolveTenantKey(
      req.body?.tenantKey ||
        req.body?.tenant_key ||
        req.body?.tenantId ||
        req.body?.tenant_id
    );

    const mode = normalizeMode(req.body?.mode);

    try {
      const out = await setTenantMode({ db, tenantKey, mode });

      wsHub?.broadcast?.({
        type: "tenant.mode",
        tenantKey: out.tenant_key,
        tenant_key: out.tenant_key,
        mode: out.mode,
      });

      return okJson(res, {
        ok: true,
        tenantKey: out.tenant_key,
        tenant_key: out.tenant_key,
        mode: out.mode,
        ...(out.warning ? { warning: out.warning } : {}),
        dbDisabled: out.dbDisabled,
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  async function getModeInternalTest(_req, res) {
    return okJson(res, { ok: true });
  }

  return {
    getMode,
    postMode,
    getModeInternalTest,
  };
}