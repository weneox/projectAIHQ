// src/components/settings/ChannelEditorCard.jsx
// PREMIUM v3.0 — editorial channel editor card

import { useEffect, useMemo, useState } from "react";
import {
  AtSign,
  BadgeCheck,
  Fingerprint,
  KeyRound,
  Link2,
  Radio,
  Save,
  ShieldBan,
} from "lucide-react";

import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";
import { cx } from "../../lib/cx.js";

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

function StatTile({ label, value, hint, tone = "neutral" }) {
  return (
    <Card
      variant="subtle"
      padded="md"
      tone={tone}
      className="rounded-[22px]"
    >
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          {label}
        </div>
        <div className="truncate text-[18px] font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
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

function statusTone(status) {
  const x = String(status || "").toLowerCase();
  if (x === "connected" || x === "active" || x === "healthy") return "success";
  if (x === "pending" || x === "warning") return "warn";
  if (x === "disconnected" || x === "error" || x === "failed") return "danger";
  return "neutral";
}

function prettyChannelName(value) {
  const raw = String(value || "channel");
  return raw
    .split(/[_-\s]+/g)
    .filter(Boolean)
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
    .join(" ");
}

function normalizeForm(channel) {
  return {
    provider: channel?.provider || "meta",
    display_name: channel?.display_name || "",
    external_account_id: channel?.external_account_id || "",
    external_page_id: channel?.external_page_id || "",
    external_user_id: channel?.external_user_id || "",
    external_username: channel?.external_username || "",
    status: channel?.status || "disconnected",
    is_primary: !!channel?.is_primary,
    secrets_ref: channel?.secrets_ref || "",
  };
}

export default function ChannelEditorCard({
  channel,
  onSave,
  saving = false,
  readOnly = false,
}) {
  const [form, setForm] = useState(() => normalizeForm(channel));

  useEffect(() => {
    setForm(normalizeForm(channel));
  }, [channel]);

  const initialForm = useMemo(() => normalizeForm(channel), [channel]);

  const dirty =
    JSON.stringify(form) !== JSON.stringify(initialForm);

  function patch(key, value) {
    if (readOnly) return;
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (readOnly || saving) return;

    await onSave({
      ...channel,
      ...form,
      external_account_id: form.external_account_id || null,
      external_page_id: form.external_page_id || null,
      external_user_id: form.external_user_id || null,
      external_username: form.external_username || null,
      secrets_ref: form.secrets_ref || null,
      config: channel?.config || {},
      health: channel?.health || {},
      last_sync_at: channel?.last_sync_at || null,
    });
  }

  const channelLabel = prettyChannelName(channel?.channel_type);
  const providerLabel = form.provider || "meta";

  return (
    <Card variant="surface" padded="lg" className="rounded-[28px]">
      <div className="space-y-6">
        {!readOnly ? null : (
          <div className="rounded-[22px] border border-amber-200/80 bg-amber-50/90 px-4 py-3.5 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
            Read-only görünüşdür. Bu channel yalnız owner/admin tərəfindən dəyişdirilə bilər.
          </div>
        )}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="inline-flex flex-wrap items-center gap-2">
              <Badge tone="info" variant="subtle" dot>
                {channelLabel}
              </Badge>
              <Badge tone={statusTone(form.status)} variant="subtle" dot>
                {form.status || "disconnected"}
              </Badge>
              {form.is_primary ? (
                <Badge tone="warn" variant="subtle">
                  Primary
                </Badge>
              ) : null}
              {dirty ? (
                <Badge tone="info" variant="outline">
                  Edited
                </Badge>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <div className="text-[24px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                {form.display_name || channelLabel}
              </div>
              <div className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                Provider config, external routing identifiers və channel state bu
                paneldən idarə olunur.
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px]">
            <StatTile
              label="Provider"
              value={providerLabel}
              hint="Integration source"
              tone="info"
            />
            <StatTile
              label="Status"
              value={form.status || "—"}
              hint="Connection state"
              tone={statusTone(form.status)}
            />
            <StatTile
              label="Primary"
              value={form.is_primary ? "Yes" : "No"}
              hint="Routing preference"
              tone={form.is_primary ? "warn" : "neutral"}
            />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card variant="subtle" padded="lg" className="rounded-[24px]">
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                  <Radio className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </div>

                <div className="space-y-1">
                  <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                    Channel Identity
                  </div>
                  <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Display name, provider və runtime state burada idarə olunur.
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Display Name" hint="Internal display label.">
                  <Input
                    value={form.display_name}
                    disabled={readOnly}
                    onChange={(e) => patch("display_name", e.target.value)}
                  />
                </Field>

                <Field label="Provider" hint="Integration provider source.">
                  <Input
                    value={form.provider}
                    disabled={readOnly}
                    onChange={(e) => patch("provider", e.target.value)}
                  />
                </Field>

                <Field label="Status" hint="Connection lifecycle state.">
                  <Input
                    value={form.status}
                    disabled={readOnly}
                    onChange={(e) => patch("status", e.target.value)}
                  />
                </Field>

                <Field label="Is Primary" hint="Primary routing toggle.">
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => patch("is_primary", !form.is_primary)}
                    className={cx(
                      "flex h-12 w-full items-center justify-between rounded-[22px] border px-4 text-sm font-medium transition-all duration-200",
                      readOnly ? "cursor-not-allowed opacity-60" : "",
                      form.is_primary
                        ? "border-sky-300/80 bg-sky-50/90 text-slate-900 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-white"
                        : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] text-slate-700 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.80))] dark:text-slate-300"
                    )}
                  >
                    <span>{form.is_primary ? "Primary" : "Not Primary"}</span>
                    <BadgeCheck className="h-4 w-4" strokeWidth={1.9} />
                  </button>
                </Field>
              </div>
            </div>
          </Card>

          <Card variant="subtle" padded="lg" className="rounded-[24px]">
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                  <Link2 className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </div>

                <div className="space-y-1">
                  <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                    External Mapping
                  </div>
                  <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                    External account, page, user və username mapping-ləri.
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="External Account ID" hint="Upstream account ID.">
                  <Input
                    value={form.external_account_id}
                    disabled={readOnly}
                    onChange={(e) => patch("external_account_id", e.target.value)}
                  />
                </Field>

                <Field label="External Page ID" hint="Page / page-like identifier.">
                  <Input
                    value={form.external_page_id}
                    disabled={readOnly}
                    onChange={(e) => patch("external_page_id", e.target.value)}
                  />
                </Field>

                <Field label="External User ID" hint="Provider-side user identifier.">
                  <Input
                    value={form.external_user_id}
                    disabled={readOnly}
                    onChange={(e) => patch("external_user_id", e.target.value)}
                  />
                </Field>

                <Field label="External Username" hint="Public or provider username.">
                  <Input
                    value={form.external_username}
                    disabled={readOnly}
                    onChange={(e) => patch("external_username", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </Card>
        </div>

        <Card variant="subtle" padded="lg" className="rounded-[24px]">
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                <KeyRound className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </div>

              <div className="space-y-1">
                <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                  Secure References
                </div>
                <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Secrets reference və əlaqəli təhlükəsiz bağlantı metadata-sı.
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_220px]">
              <Field label="Secrets Ref" hint="Secure credentials reference pointer.">
                <Input
                  value={form.secrets_ref}
                  disabled={readOnly}
                  onChange={(e) => patch("secrets_ref", e.target.value)}
                />
              </Field>

              <StatTile
                label="Channel Type"
                value={channel?.channel_type || "—"}
                hint="Tenant route kind"
                tone="info"
              />

              <StatTile
                label="Sync State"
                value={channel?.last_sync_at ? "Synced" : "No Sync"}
                hint={channel?.last_sync_at || "No sync timestamp"}
                tone={channel?.last_sync_at ? "success" : "neutral"}
              />
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-3 border-t border-slate-200/70 pt-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Fingerprint className="h-4 w-4" />
            {readOnly
              ? "Bu panel read-only rejimdədir."
              : dirty
              ? "Dəyişikliklər hazırdır, saxlamaq olar."
              : "Hazırda əlavə dəyişiklik yoxdur."}
          </div>

          <div className="flex items-center gap-2">
            {readOnly ? (
              <Button variant="secondary" disabled leftIcon={<ShieldBan className="h-4 w-4" />}>
                Read Only
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={saving || !dirty}
                leftIcon={<Save className="h-4 w-4" />}
              >
                {saving ? "Saving..." : "Save Channel"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}