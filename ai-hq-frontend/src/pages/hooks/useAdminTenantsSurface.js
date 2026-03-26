import { useCallback, useEffect, useMemo, useState } from "react";

import {
  listTenants,
  createTenant,
  exportTenantJson,
  exportTenantCsvBundle,
  downloadTenantZip,
} from "../../api/tenants.js";
import { useSettingsSurfaceState } from "../Settings/hooks/useSettingsSurfaceState.js";
import { useSurfaceActionState } from "../../components/settings/hooks/useSurfaceActionState.js";

const EMPTY_FORM = {
  tenant_key: "",
  company_name: "",
  owner_email: "",
  owner_password: "",
};

function downloadTextFile(filename, content, mime = "application/json;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function useAdminTenantsSurface() {
  const [selectedKey, setSelectedKey] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const {
    data: items,
    surface,
    beginRefresh,
    succeedRefresh,
    failRefresh,
    beginSave,
    succeedSave,
    failSave,
    clearSaveState,
  } = useSettingsSurfaceState({
    initialData: () => [],
    initialLoading: true,
  });
  const actionState = useSurfaceActionState();

  const refreshTenants = useCallback(async () => {
    beginRefresh();
    try {
      const rows = await listTenants();
      return succeedRefresh(Array.isArray(rows) ? rows : []);
    } catch (error) {
      return failRefresh(error, {
        fallbackData: [],
      });
    }
  }, [beginRefresh, failRefresh, succeedRefresh]);

  useEffect(() => {
    refreshTenants();
  }, [refreshTenants]);

  const filtered = useMemo(() => {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) return items;

    return items.filter((tenant) => {
      const haystack = [
        tenant?.tenant_key,
        tenant?.company_name,
        tenant?.legal_name,
        tenant?.industry_key,
        tenant?.country_code,
        tenant?.plan_key,
        tenant?.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [items, query]);

  const selected =
    filtered.find((tenant) => tenant.tenant_key === selectedKey) ||
    items.find((tenant) => tenant.tenant_key === selectedKey) ||
    null;

  useEffect(() => {
    if (!selectedKey && filtered[0]?.tenant_key) {
      setSelectedKey(filtered[0].tenant_key);
    }
    if (
      selectedKey &&
      !items.some((tenant) => tenant.tenant_key === selectedKey) &&
      filtered[0]?.tenant_key
    ) {
      setSelectedKey(filtered[0].tenant_key);
    }
  }, [filtered, items, selectedKey]);

  const patchForm = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const createTenantRecord = useCallback(async () => {
    beginSave();

    return actionState.runAction("create", async () => {
      try {
        const tenant_key = String(form.tenant_key || "").trim().toLowerCase();
        const company_name = String(form.company_name || "").trim();
        const owner_email = String(form.owner_email || "").trim().toLowerCase();
        const owner_password = String(form.owner_password || "");

        if (!tenant_key) throw new Error("Tenant key is required");
        if (!company_name) throw new Error("Company name is required");
        if (!owner_email) throw new Error("Owner email is required");
        if (!owner_password) throw new Error("Owner password is required");
        if (owner_password.length < 8) throw new Error("Owner password must be at least 8 characters");

        const result = await createTenant({
          tenant: {
            tenant_key,
            company_name,
            timezone: "Asia/Baku",
            default_language: "az",
            enabled_languages: ["az"],
            country_code: "AZ",
            industry_key: "generic_business",
          },
          owner: {
            user_email: owner_email,
            full_name: company_name,
            password: owner_password,
          },
        });

        setForm(EMPTY_FORM);
        await refreshTenants();
        const createdKey = result?.tenant?.tenant_key || tenant_key;
        setSelectedKey(createdKey);
        succeedSave({
          message: `${createdKey} tenant created.`,
        });
        return result;
      } catch (error) {
        failSave(error);
        throw error;
      }
    });
  }, [actionState, beginSave, failSave, form, refreshTenants, succeedSave]);

  const exportJson = useCallback(async (tenantKey) => {
    if (!tenantKey) return null;

    beginSave();
    return actionState.runAction("export-json", async () => {
      try {
        const result = await exportTenantJson(tenantKey);
        const content = JSON.stringify(result?.export || result, null, 2);
        downloadTextFile(`${tenantKey}-export.json`, content, "application/json;charset=utf-8");
        succeedSave({
          message: `${tenantKey} JSON export prepared.`,
        });
        return result;
      } catch (error) {
        failSave(error);
        throw error;
      }
    });
  }, [actionState, beginSave, failSave, succeedSave]);

  const exportCsv = useCallback(async (tenantKey) => {
    if (!tenantKey) return null;

    beginSave();
    return actionState.runAction("export-csv", async () => {
      try {
        const result = await exportTenantCsvBundle(tenantKey);
        const entries = Object.entries(result?.files || {});
        if (!entries.length) {
          throw new Error("CSV export returned no files");
        }

        for (const [filename, content] of entries) {
          downloadTextFile(filename, content || "", "text/csv;charset=utf-8");
        }

        succeedSave({
          message: `${tenantKey} CSV export prepared.`,
        });
        return result;
      } catch (error) {
        failSave(error);
        throw error;
      }
    });
  }, [actionState, beginSave, failSave, succeedSave]);

  const exportZip = useCallback(async (tenantKey) => {
    if (!tenantKey) return null;

    beginSave();
    return actionState.runAction("export-zip", async () => {
      try {
        await downloadTenantZip(tenantKey);
        succeedSave({
          message: `${tenantKey} ZIP export started.`,
        });
        return true;
      } catch (error) {
        failSave(error);
        throw error;
      }
    });
  }, [actionState, beginSave, failSave, succeedSave]);

  return {
    items,
    filtered,
    selected,
    selectedKey,
    setSelectedKey,
    query,
    setQuery,
    form,
    patchForm,
    surface: {
      ...surface,
      refresh: refreshTenants,
      clearSaveState,
    },
    actionState,
    createTenantRecord,
    exportJson,
    exportCsv,
    exportZip,
  };
}
