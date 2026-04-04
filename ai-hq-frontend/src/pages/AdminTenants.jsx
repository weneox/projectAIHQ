import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import Input from "../components/ui/Input.jsx";
import SurfaceBanner from "../components/feedback/SurfaceBanner.jsx";
import { useAdminTenantsSurface } from "./hooks/useAdminTenantsSurface.js";

function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

function statusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  if (normalized === "disabled") return "border-rose-400/20 bg-rose-500/10 text-rose-200";
  if (normalized === "draft") return "border-amber-400/20 bg-amber-500/10 text-amber-200";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function planTone(plan) {
  const normalized = String(plan || "").toLowerCase();
  if (normalized === "enterprise") return "border-violet-400/20 bg-violet-500/10 text-violet-200";
  if (normalized === "growth") return "border-sky-400/20 bg-sky-500/10 text-sky-200";
  if (normalized === "starter") return "border-white/10 bg-white/[0.04] text-slate-200";
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

export default function AdminTenants() {
  const {
    items,
    filtered,
    selected,
    selectedKey,
    setSelectedKey,
    query,
    setQuery,
    form,
    patchForm,
    surface,
    actionState,
    createTenantRecord,
    exportJson,
    exportCsv,
    exportZip,
  } = useAdminTenantsSurface();

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-1">
          <div className="text-xl font-semibold text-slate-900 dark:text-white">
            Admin · Tenants
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Create, inspect, and export platform tenants.
          </div>
        </div>
      </Card>

      <SurfaceBanner
        surface={surface}
        unavailableMessage="Tenant administration is temporarily unavailable."
        refreshLabel="Refresh Tenants"
      />

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="space-y-5">
          <Card className="p-5">
            <div className="mb-4">
              <div className="text-base font-semibold text-slate-900 dark:text-white">
                Create Tenant
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Provision a new customer workspace.
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
                  placeholder="customer1"
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
                  placeholder="minimum 8 characters"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={createTenantRecord} disabled={surface.saving}>
                  {actionState.isActionPending("create") ? "Creating..." : "Create Tenant"}
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
                  Existing customer workspaces
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
                placeholder="Search tenant, company, plan..."
              />
            </div>

            <div className="max-h-[620px] space-y-2 overflow-auto pr-1">
              {surface.loading ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                  Loading tenants...
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
                  No tenants matched the current search.
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
                  Summary data and export operations for the selected tenant
                </div>
              </div>
            </div>

            {!selected ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                Select a tenant from the list.
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
                      {selected.created_at ? new Date(selected.created_at).toLocaleString() : "-"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => exportJson(selected.tenant_key)}
                    disabled={surface.saving}
                  >
                    {actionState.isActionPending("export-json") ? "Exporting JSON..." : "Export JSON"}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => exportCsv(selected.tenant_key)}
                    disabled={surface.saving}
                  >
                    {actionState.isActionPending("export-csv") ? "Exporting CSV..." : "Export CSV"}
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => exportZip(selected.tenant_key)}
                    disabled={surface.saving}
                  >
                    {actionState.isActionPending("export-zip") ? "Exporting ZIP..." : "Export ZIP"}
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
