// src/components/settings/WorkspaceGeneralForm.jsx
// PREMIUM v3.1 — editorial workspace general form (read-only aware)

import {
  Activity,
  Building2,
  Globe2,
  Hash,
  Languages,
  MapPinned,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import Badge from "../ui/Badge.jsx";
import SettingsSection from "./SettingsSection.jsx";

function Field({ label, hint, children }) {
  return (
    <label className="block space-y-2.5">
      <div className="space-y-1">
        <div className="text-[13px] font-semibold tracking-[-0.01em] text-slate-800 dark:text-slate-100">
          {label}
        </div>
        {hint ? (
          <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            {hint}
          </div>
        ) : null}
      </div>
      {children}
    </label>
  );
}

function MetaTile({ icon, label, value, tone = "neutral" }) {
  const Icon = icon;

  return (
    <Card
      variant="subtle"
      padded="sm"
      tone={tone}
      className="rounded-[24px]"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] border border-slate-200/80 bg-white/80 text-slate-600 shadow-[0_8px_20px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
          <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
        </div>

        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            {label}
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
            {value || "—"}
          </div>
        </div>
      </div>
    </Card>
  );
}

function StatTile({ label, value, hint, tone = "neutral" }) {
  return (
    <Card
      variant="subtle"
      padded="md"
      tone={tone}
      className="rounded-[24px]"
    >
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          {label}
        </div>
        <div className="text-[20px] font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
          {value || "—"}
        </div>
        {hint ? (
          <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            {hint}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function stringifyCsv(arr) {
  return Array.isArray(arr) ? arr.join(", ") : "";
}

function parseCsv(text) {
  return String(text || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function statusTone(status) {
  const x = String(status || "").toLowerCase();
  if (x === "active") return "success";
  if (x === "pending" || x === "draft") return "warn";
  if (x === "disabled" || x === "inactive" || x === "suspended") return "danger";
  return "neutral";
}

function planTone(plan) {
  const x = String(plan || "").toLowerCase();
  if (x === "enterprise" || x === "pro") return "info";
  if (x === "starter" || x === "basic") return "neutral";
  return "neutral";
}

export default function WorkspaceGeneralForm({
  tenantKey,
  tenant = {},
  entitlements = {},
  patchTenant,
  canManage = true,
  canDirectEdit = true,
  governance = {},
}) {
  const canEdit = canManage && canDirectEdit;
  const companyName = tenant.company_name || "Untitled Workspace";
  const enabledLanguages = tenant.enabled_languages || [];
  const activeText = tenant.active ? "Enabled" : "Disabled";
  const restrictedCapabilities = Array.isArray(entitlements?.summary?.restricted)
    ? entitlements.summary.restricted
    : [];
  const restrictedLabels = restrictedCapabilities.map((item) =>
    String(item || "")
      .replace(/([A-Z])/g, " $1")
      .replace(/[_-]+/g, " ")
      .trim()
  );

  return (
    <SettingsSection
      eyebrow="Workspace"
      title="Workspace Settings"
      subtitle="Workspace identity, localization, market coverage və əsas tenant metadata burada idarə olunur."
      tone="default"
    >
      <div className="space-y-6">
        {!canDirectEdit ? (
          <Card variant="subtle" padded="lg" className="rounded-[28px]">
            <div className="space-y-3">
              <Badge tone="warn" variant="subtle" dot>
                Governed through review
              </Badge>
              <div className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                Workspace identity and localization no longer save directly from Settings.
                Stage those changes through setup review so approved truth and runtime projection stay aligned.
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={governance?.setupRoute || "/setup"}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                >
                  Open setup review
                </Link>
                <Link
                  to={governance?.truthRoute || "/truth"}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                >
                  View approved truth
                </Link>
              </div>
            </div>
          </Card>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <Card
            variant="surface"
            padded="lg"
            className="rounded-[28px]"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="inline-flex items-center gap-2">
                  <Badge tone="info" variant="subtle" dot>
                    Workspace Profile
                  </Badge>
                  <Badge tone={statusTone(tenant.status)} variant="subtle" dot>
                    {tenant.status || "unknown"}
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[26px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                    {companyName}
                  </div>
                  <div className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Tenant identity, primary language, region və operational workspace metadata.
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px]">
                <MetaTile
                  icon={Hash}
                  label="Tenant Key"
                  value={tenantKey}
                  tone="info"
                />
                <MetaTile
                  icon={ShieldCheck}
                  label="Plan"
                  value={tenant.plan_key || "—"}
                  tone={planTone(tenant.plan_key)}
                />
                <MetaTile
                  icon={Activity}
                  label="Runtime"
                  value={activeText}
                  tone={tenant.active ? "success" : "danger"}
                />
              </div>
            </div>
          </Card>

          <Card
            variant="subtle"
            padded="lg"
            className="rounded-[28px]"
          >
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  System State
                </div>
                <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                  Workspace Snapshot
                </div>
                <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Bunlar system-controlled dəyərlərdir və burada yalnız görünüş üçündür.
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <StatTile
                  label="Plan"
                  value={tenant.plan_key || "—"}
                  hint="Billing / tier source"
                  tone={planTone(tenant.plan_key)}
                />
                <StatTile
                  label="Status"
                  value={tenant.status || "—"}
                  hint="Workspace lifecycle state"
                  tone={statusTone(tenant.status)}
                />
                <StatTile
                  label="Active"
                  value={tenant.active ? "true" : "false"}
                  hint="Availability flag"
                  tone={tenant.active ? "success" : "danger"}
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card variant="subtle" padded="lg" className="rounded-[28px] xl:col-span-2">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </div>

              <div className="space-y-2">
                <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                  Managed Plan Boundary
                </div>
                <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {entitlements?.billing?.message ||
                    "Plan assignment is managed internally. Self-serve billing is not enabled."}
                </div>
                <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {restrictedLabels.length
                    ? `Restricted on this workspace plan: ${restrictedLabels.join(", ")}.`
                    : "No additional plan-restricted workspace capabilities are currently flagged here."}
                </div>
              </div>
            </div>
          </Card>

          <Card variant="surface" padded="lg" className="rounded-[28px]">
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                  <Building2 className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </div>

                <div className="space-y-1">
                  <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                    Workspace Identity
                  </div>
                  <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Əsas tenant adı, legal ad və industry classification burada saxlanılır.
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Company Name"
                  hint="Workspace daxilində görünən əsas ad."
                >
                  <Input
                    value={tenant.company_name || ""}
                    placeholder="Neox Company"
                    disabled={!canEdit}
                    onChange={(e) => patchTenant("company_name", e.target.value)}
                  />
                </Field>

                <Field
                  label="Legal Name"
                  hint="Owner/Admin üçün saxlanılan rəsmi ad."
                >
                  <Input
                    value={tenant.legal_name || ""}
                    placeholder="Neox Company LLC"
                    disabled={!canEdit}
                    onChange={(e) => patchTenant("legal_name", e.target.value)}
                  />
                </Field>

                <Field
                  label="Industry"
                  hint="Internal classification və routing üçün istifadə oluna bilər."
                >
                  <Input
                    value={tenant.industry_key || ""}
                    placeholder="technology"
                    disabled={!canEdit}
                    onChange={(e) => patchTenant("industry_key", e.target.value)}
                  />
                </Field>

                <Field
                  label="Tenant Key"
                  hint="System workspace ID. Dəyişdirilə bilməz."
                >
                  <Input value={tenantKey || ""} readOnly />
                </Field>
              </div>
            </div>
          </Card>

          <Card variant="surface" padded="lg" className="rounded-[28px]">
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                  <Globe2 className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </div>

                <div className="space-y-1">
                  <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                    Localization & Market
                  </div>
                  <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Language, timezone, country və market region burada idarə olunur.
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Timezone"
                  hint="Primary workspace timezone."
                >
                  <Input
                    value={tenant.timezone || ""}
                    placeholder="Asia/Baku"
                    disabled={!canEdit}
                    onChange={(e) => patchTenant("timezone", e.target.value)}
                  />
                </Field>

                <Field
                  label="Default Language"
                  hint="Default UI / content locale."
                >
                  <Input
                    value={tenant.default_language || ""}
                    placeholder="az"
                    disabled={!canEdit}
                    onChange={(e) =>
                      patchTenant("default_language", e.target.value)
                    }
                  />
                </Field>

                <Field
                  label="Country Code"
                  hint="ISO-style market country code."
                >
                  <Input
                    value={tenant.country_code || ""}
                    placeholder="AZ"
                    disabled={!canEdit}
                    onChange={(e) => patchTenant("country_code", e.target.value)}
                  />
                </Field>

                <Field
                  label="Market Region"
                  hint="Regional grouping for routing or reporting."
                >
                  <Input
                    value={tenant.market_region || ""}
                    placeholder="CIS"
                    disabled={!canEdit}
                    onChange={(e) => patchTenant("market_region", e.target.value)}
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field
                    label="Enabled Languages"
                    hint="Comma separated list. Məsələn: az, en, tr"
                  >
                    <Input
                      value={stringifyCsv(enabledLanguages)}
                      placeholder="az, en"
                      disabled={!canEdit}
                      onChange={(e) =>
                        patchTenant("enabled_languages", parseCsv(e.target.value))
                      }
                    />
                  </Field>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <MetaTile
                  icon={Languages}
                  label="Default"
                  value={tenant.default_language || "—"}
                  tone="info"
                />
                <MetaTile
                  icon={MapPinned}
                  label="Region"
                  value={tenant.market_region || "—"}
                  tone="neutral"
                />
                <MetaTile
                  icon={Sparkles}
                  label="Languages"
                  value={enabledLanguages.length || 0}
                  tone="success"
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </SettingsSection>
  );
}
