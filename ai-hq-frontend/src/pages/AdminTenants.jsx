import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import Input from "../components/ui/Input.jsx";
import SurfaceBanner from "../components/feedback/SurfaceBanner.jsx";
import {
  PageCanvas,
  PageHeader,
} from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";
import { useAdminTenantsSurface } from "./hooks/useAdminTenantsSurface.js";

function statusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "disabled") return "border-rose-200 bg-rose-50 text-rose-700";
  if (normalized === "draft") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-line bg-surface-muted text-text-muted";
}

function planTone(plan) {
  const normalized = String(plan || "").toLowerCase();
  if (normalized === "enterprise") return "border-violet-200 bg-violet-50 text-violet-700";
  if (normalized === "growth") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-line bg-surface-muted text-text-muted";
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

function DetailTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-muted p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-text-subtle">
        {label}
      </div>
      <div className="mt-2 text-sm text-text">{value}</div>
    </div>
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
    <PageCanvas className="space-y-6">
      <PageHeader
        eyebrow="Admin workspace"
        title="Tenant control"
        description="Create, inspect, and export customer workspaces without leaving the core product language."
      />

      <SurfaceBanner
        surface={surface}
        unavailableMessage="Tenant administration is temporarily unavailable."
        refreshLabel="Refresh tenants"
      />

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="space-y-5">
          <Card className="p-5">
            <div className="mb-4">
              <div className="text-base font-semibold text-text">Create tenant</div>
              <div className="mt-1 text-sm text-text-muted">
                Provision a new customer workspace.
              </div>
            </div>

            <div className="space-y-4">
              <label>
                <div className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-text-subtle">
                  Tenant key
                </div>
                <Input
                  value={form.tenant_key}
                  onChange={(e) => patchForm("tenant_key", e.target.value)}
                  placeholder="customer1"
                />
              </label>

              <label>
                <div className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-text-subtle">
                  Company name
                </div>
                <Input
                  value={form.company_name}
                  onChange={(e) => patchForm("company_name", e.target.value)}
                  placeholder="Company LLC"
                />
              </label>

              <label>
                <div className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-text-subtle">
                  Owner email
                </div>
                <Input
                  value={form.owner_email}
                  onChange={(e) => patchForm("owner_email", e.target.value)}
                  placeholder="owner@company.com"
                />
              </label>

              <label>
                <div className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-text-subtle">
                  Owner password
                </div>
                <Input
                  type="password"
                  value={form.owner_password}
                  onChange={(e) => patchForm("owner_password", e.target.value)}
                  placeholder="minimum 8 characters"
                />
              </label>

              <div className="flex justify-end pt-1">
                <Button onClick={createTenantRecord} disabled={surface.saving}>
                  {actionState.isActionPending("create") ? "Creating..." : "Create tenant"}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-text">Tenant list</div>
                <div className="mt-1 text-sm text-text-muted">
                  Existing customer workspaces
                </div>
              </div>

              <Chip className="border-line bg-surface text-text-muted">{items.length}</Chip>
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
                <div className="rounded-2xl border border-line bg-surface-muted p-4 text-sm text-text-muted">
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
                          ? "border-brand/15 bg-brand-soft"
                          : "border-line bg-surface hover:border-line-strong hover:bg-surface-muted"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-text">
                            {tenant.company_name || tenant.tenant_key}
                          </div>
                          <div className="mt-1 truncate text-xs text-text-subtle">
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
                <div className="rounded-2xl border border-dashed border-line bg-surface-muted p-4 text-sm text-text-muted">
                  No tenants matched the current search.
                </div>
              )}
            </div>
          </Card>
        </section>

        <section className="space-y-5">
          <Card className="p-6">
            <div className="mb-5">
              <div className="text-base font-semibold text-text">Tenant detail</div>
              <div className="mt-1 text-sm text-text-muted">
                Summary data and export operations for the selected tenant.
              </div>
            </div>

            {!selected ? (
              <div className="rounded-2xl border border-dashed border-line bg-surface-muted p-5 text-sm text-text-muted">
                Select a tenant from the list.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <DetailTile label="Company" value={selected.company_name || "-"} />
                  <DetailTile label="Tenant key" value={selected.tenant_key || "-"} />
                  <DetailTile
                    label="Region"
                    value={`${selected.country_code || "-"} · ${selected.timezone || "-"}`}
                  />
                  <DetailTile label="Language" value={selected.default_language || "-"} />
                  <DetailTile label="Industry" value={selected.industry_key || "-"} />
                  <DetailTile
                    label="Created"
                    value={selected.created_at ? new Date(selected.created_at).toLocaleString() : "-"}
                  />
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
    </PageCanvas>
  );
}
