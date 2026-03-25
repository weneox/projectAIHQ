// src/pages/AdminTenants.jsx

import { useEffect, useMemo, useState } from "react";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import Input from "../components/ui/Input.jsx";
import {
  listTenants,
  createTenant,
  exportTenantJson,
  exportTenantCsvBundle,
  downloadTenantZip,
} from "../api/tenants.js";

function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  if (s === "disabled") return "border-rose-400/20 bg-rose-500/10 text-rose-200";
  if (s === "draft") return "border-amber-400/20 bg-amber-500/10 text-amber-200";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function planTone(plan) {
  const p = String(plan || "").toLowerCase();
  if (p === "enterprise") return "border-violet-400/20 bg-violet-500/10 text-violet-200";
  if (p === "growth") return "border-sky-400/20 bg-sky-500/10 text-sky-200";
  if (p === "starter") return "border-white/10 bg-white/[0.04] text-slate-200";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function Chip({ children, className = "" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

function downloadTextFile(filename, content, mime = "application/json;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const EMPTY_FORM = {
  tenant_key: "",
  company_name: "",
  owner_email: "",
  owner_password: "",
};

export default function AdminTenants() {
  const [items, setItems] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await listTenants();
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(String(e?.message || e || "Failed to load tenants"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return items;

    return items.filter((t) => {
      const hay = [
        t?.tenant_key,
        t?.company_name,
        t?.legal_name,
        t?.industry_key,
        t?.country_code,
        t?.plan_key,
        t?.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [items, query]);

  const selected =
    filtered.find((x) => x.tenant_key === selectedKey) ||
    items.find((x) => x.tenant_key === selectedKey) ||
    null;

  useEffect(() => {
    if (!selectedKey && filtered[0]?.tenant_key) {
      setSelectedKey(filtered[0].tenant_key);
    }
    if (
      selectedKey &&
      !items.some((x) => x.tenant_key === selectedKey) &&
      filtered[0]?.tenant_key
    ) {
      setSelectedKey(filtered[0].tenant_key);
    }
  }, [filtered, items, selectedKey]);

  function patchForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreate() {
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const tenant_key = String(form.tenant_key || "").trim().toLowerCase();
      const company_name = String(form.company_name || "").trim();
      const owner_email = String(form.owner_email || "").trim().toLowerCase();
      const owner_password = String(form.owner_password || "");

      if (!tenant_key) throw new Error("Tenant key tələb olunur");
      if (!company_name) throw new Error("Company name tələb olunur");
      if (!owner_email) throw new Error("Owner email tələb olunur");
      if (!owner_password) throw new Error("Owner password tələb olunur");
      if (owner_password.length < 8) throw new Error("Owner password minimum 8 simvol olmalıdır");

      const res = await createTenant({
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

      setSuccess(`✅ ${tenant_key} tenant yaradıldı`);
      setForm(EMPTY_FORM);
      await load();

      const createdKey = res?.tenant?.tenant_key || tenant_key;
      setSelectedKey(createdKey);
    } catch (e) {
      setError(String(e?.message || e || "Failed to create tenant"));
    } finally {
      setCreating(false);
    }
  }

  async function handleExportJson(tenantKey) {
    if (!tenantKey) return;
    setExportingJson(true);
    setError("");
    setSuccess("");

    try {
      const res = await exportTenantJson(tenantKey);
      const content = JSON.stringify(res?.export || res, null, 2);
      downloadTextFile(`${tenantKey}-export.json`, content, "application/json;charset=utf-8");
      setSuccess(`✅ ${tenantKey} JSON export hazırlandı`);
    } catch (e) {
      setError(String(e?.message || e || "Failed to export JSON"));
    } finally {
      setExportingJson(false);
    }
  }

  async function handleExportCsv(tenantKey) {
    if (!tenantKey) return;
    setExportingCsv(true);
    setError("");
    setSuccess("");

    try {
      const res = await exportTenantCsvBundle(tenantKey);
      const files = res?.files || {};
      const entries = Object.entries(files);

      if (!entries.length) {
        throw new Error("CSV export boş gəldi");
      }

      for (const [filename, content] of entries) {
        downloadTextFile(filename, content || "", "text/csv;charset=utf-8");
      }

      setSuccess(`✅ ${tenantKey} CSV export hazırlandı`);
    } catch (e) {
      setError(String(e?.message || e || "Failed to export CSV"));
    } finally {
      setExportingCsv(false);
    }
  }

  async function handleExportZip(tenantKey) {
    if (!tenantKey) return;
    setExportingZip(true);
    setError("");
    setSuccess("");

    try {
      await downloadTenantZip(tenantKey);
      setSuccess(`✅ ${tenantKey} ZIP export başladıldı`);
    } catch (e) {
      setError(String(e?.message || e || "Failed to export ZIP"));
    } finally {
      setExportingZip(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-1">
          <div className="text-xl font-semibold text-slate-900 dark:text-white">
            Admin · Tenants
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Platform səviyyəsində tenant yarat, bax və export et.
          </div>
        </div>
      </Card>

      {error ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="space-y-5">
          <Card className="p-5">
            <div className="mb-4">
              <div className="text-base font-semibold text-slate-900 dark:text-white">
                Create Tenant
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Yeni müştəri workspace-i yarat.
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Tenant Key
                </label>
                <Input
                  value={form.tenant_key}
                  onChange={(e) => patchForm("tenant_key", e.target.value)}
                  placeholder="musteri1"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Company Name
                </label>
                <Input
                  value={form.company_name}
                  onChange={(e) => patchForm("company_name", e.target.value)}
                  placeholder="Company LLC"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Owner Email
                </label>
                <Input
                  value={form.owner_email}
                  onChange={(e) => patchForm("owner_email", e.target.value)}
                  placeholder="owner@company.com"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Owner Password
                </label>
                <Input
                  type="password"
                  value={form.owner_password}
                  onChange={(e) => patchForm("owner_password", e.target.value)}
                  placeholder="minimum 8 simvol"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? "Creating..." : "Create Tenant"}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-slate-900 dark:text-white">
                  Tenant List
                </div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Mövcud müştəri workspace-ləri
                </div>
              </div>

              <Chip className="border-white/10 bg-white/[0.04] text-slate-200">
                {items.length}
              </Chip>
            </div>

            <div className="mb-4">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Axtar: tenant, company, plan..."
              />
            </div>

            <div className="max-h-[620px] space-y-2 overflow-auto pr-1">
              {loading ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                  Yüklənir...
                </div>
              ) : filtered.length ? (
                filtered.map((tenant) => {
                  const active = tenant.tenant_key === selectedKey;

                  return (
                    <button
                      key={tenant.tenant_key}
                      type="button"
                      onClick={() => setSelectedKey(tenant.tenant_key)}
                      className={cx(
                        "w-full rounded-2xl border p-3 text-left transition",
                        active
                          ? "border-sky-400/35 bg-sky-500/10"
                          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-white">
                            {tenant.company_name || tenant.tenant_key}
                          </div>
                          <div className="mt-1 truncate text-xs text-slate-400">
                            {tenant.tenant_key}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <Chip className={statusTone(tenant.status)}>
                            {tenant.status || "active"}
                          </Chip>
                          <Chip className={planTone(tenant.plan_key)}>
                            {tenant.plan_key || "starter"}
                          </Chip>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                  Tenant tapılmadı
                </div>
              )}
            </div>
          </Card>
        </section>

        <section className="space-y-5">
          <Card className="p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-slate-900 dark:text-white">
                  Tenant Detail
                </div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Seçilmiş tenant haqqında ümumi məlumat və export əməliyyatları
                </div>
              </div>
            </div>

            {!selected ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                Soldan tenant seç.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Company
                    </div>
                    <div className="mt-2 text-sm font-medium text-white">
                      {selected.company_name || "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Tenant Key
                    </div>
                    <div className="mt-2 text-sm font-medium text-white">
                      {selected.tenant_key || "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Region
                    </div>
                    <div className="mt-2 text-sm text-slate-200">
                      {selected.country_code || "-"} · {selected.timezone || "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Language
                    </div>
                    <div className="mt-2 text-sm text-slate-200">
                      {selected.default_language || "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Industry
                    </div>
                    <div className="mt-2 text-sm text-slate-200">
                      {selected.industry_key || "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Created
                    </div>
                    <div className="mt-2 text-sm text-slate-200">
                      {selected.created_at
                        ? new Date(selected.created_at).toLocaleString()
                        : "-"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleExportJson(selected.tenant_key)}
                    disabled={exportingJson}
                  >
                    {exportingJson ? "Exporting JSON..." : "Export JSON"}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleExportCsv(selected.tenant_key)}
                    disabled={exportingCsv}
                  >
                    {exportingCsv ? "Exporting CSV..." : "Export CSV"}
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => handleExportZip(selected.tenant_key)}
                    disabled={exportingZip}
                  >
                    {exportingZip ? "Exporting ZIP..." : "Export ZIP"}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}