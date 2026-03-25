// src/components/settings/AgentEditorCard.jsx
// PREMIUM v3.0 — editorial agent editor card

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Cpu,
  Fingerprint,
  Gauge,
  Save,
  ShieldBan,
  Sparkles,
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

function SurfaceTextArea({
  value,
  onChange,
  disabled = false,
  placeholder = "",
  min = 124,
}) {
  return (
    <div
      className={cx(
        "relative w-full min-w-0 overflow-hidden rounded-[22px] border",
        "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_12px_32px_rgba(15,23,42,0.06)]",
        "transition-[border-color,box-shadow,background-color] duration-200",
        "focus-within:border-sky-300/90 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_0_0_4px_rgba(56,189,248,0.08),0_16px_38px_rgba(15,23,42,0.08)]",
        "dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.80))]",
        "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_44px_rgba(0,0,0,0.46)]",
        "dark:focus-within:border-sky-400/30 dark:focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_4px_rgba(56,189,248,0.10),0_18px_46px_rgba(0,0,0,0.52)]",
        disabled ? "opacity-70" : ""
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.20),transparent_44%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_38%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/10"
      />
      <textarea
        value={value || ""}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        style={{ minHeight: min }}
        className="relative z-10 w-full resize-y bg-transparent px-4 py-3.5 text-[14px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
    </div>
  );
}

function StatTile({ label, value, hint, tone = "neutral" }) {
  return (
    <Card variant="subtle" padded="md" tone={tone} className="rounded-[22px]">
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

function normalizeForm(agent) {
  return {
    display_name: agent?.display_name || agent?.agent_key || "",
    role_summary: agent?.role_summary || "",
    enabled: !!agent?.enabled,
    model: agent?.model || "gpt-5",
    temperature: agent?.temperature ?? 0.5,
  };
}

export default function AgentEditorCard({
  agent,
  onSave,
  saving = false,
  readOnly = false,
}) {
  const [form, setForm] = useState(() => normalizeForm(agent));

  useEffect(() => {
    setForm(normalizeForm(agent));
  }, [agent]);

  const initialForm = useMemo(() => normalizeForm(agent), [agent]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  function patch(key, value) {
    if (readOnly) return;
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (readOnly || saving) return;

    await onSave(agent.agent_key, {
      ...agent,
      ...form,
      prompt_overrides: agent?.prompt_overrides || {},
      tool_access: agent?.tool_access || {},
      limits: agent?.limits || {},
    });
  }

  const agentLabel = agent?.display_name || agent?.agent_key || "agent";

  return (
    <Card variant="surface" padded="lg" className="rounded-[28px]">
      <div className="space-y-6">
        {readOnly ? (
          <div className="rounded-[22px] border border-amber-200/80 bg-amber-50/90 px-4 py-3.5 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
            Read-only görünüşdür. Bu agent yalnız owner/admin tərəfindən dəyişdirilə bilər.
          </div>
        ) : null}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="inline-flex flex-wrap items-center gap-2">
              <Badge tone="info" variant="subtle" dot>
                {agent?.agent_key || "agent"}
              </Badge>
              <Badge
                tone={form.enabled ? "success" : "neutral"}
                variant="subtle"
                dot={form.enabled}
              >
                {form.enabled ? "Enabled" : "Disabled"}
              </Badge>
              {dirty ? (
                <Badge tone="info" variant="outline">
                  Edited
                </Badge>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <div className="text-[24px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                {agentLabel}
              </div>
              <div className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                Agent identity, role summary, model selection və runtime behavior
                bu paneldən idarə olunur.
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px]">
            <StatTile
              label="Model"
              value={form.model}
              hint="Assigned runtime model"
              tone="info"
            />
            <StatTile
              label="Temp"
              value={String(form.temperature)}
              hint="Sampling temperature"
              tone="neutral"
            />
            <StatTile
              label="State"
              value={form.enabled ? "Enabled" : "Disabled"}
              hint="Execution availability"
              tone={form.enabled ? "success" : "warn"}
            />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card variant="subtle" padded="lg" className="rounded-[24px]">
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                  <Bot className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </div>

                <div className="space-y-1">
                  <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                    Agent Identity
                  </div>
                  <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Display name, runtime model və execution state burada saxlanılır.
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Display Name" hint="Visible agent label.">
                  <Input
                    value={form.display_name}
                    disabled={readOnly}
                    onChange={(e) => patch("display_name", e.target.value)}
                  />
                </Field>

                <Field label="Model" hint="Assigned model key.">
                  <Input
                    value={form.model}
                    disabled={readOnly}
                    onChange={(e) => patch("model", e.target.value)}
                  />
                </Field>

                <Field label="Temperature" hint="0–2 sampling range.">
                  <Input
                    type="number"
                    step="0.1"
                    min={0}
                    max={2}
                    value={form.temperature}
                    disabled={readOnly}
                    onChange={(e) =>
                      patch("temperature", Number(e.target.value || 0))
                    }
                  />
                </Field>

                <Field label="Enabled" hint="Execution toggle.">
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => patch("enabled", !form.enabled)}
                    className={cx(
                      "flex h-12 w-full items-center justify-between rounded-[22px] border px-4 text-sm font-medium transition-all duration-200",
                      readOnly ? "cursor-not-allowed opacity-60" : "",
                      form.enabled
                        ? "border-sky-300/80 bg-sky-50/90 text-slate-900 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-white"
                        : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] text-slate-700 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.80))] dark:text-slate-300"
                    )}
                  >
                    <span>{form.enabled ? "Enabled" : "Disabled"}</span>
                    <CheckCircle2 className="h-4 w-4" strokeWidth={1.9} />
                  </button>
                </Field>
              </div>
            </div>
          </Card>

          <Card variant="subtle" padded="lg" className="rounded-[24px]">
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                  <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </div>

                <div className="space-y-1">
                  <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                    Role Summary
                  </div>
                  <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Agentin vəzifəsi, davranışı və məsuliyyət sərhədləri burada yazılır.
                  </div>
                </div>
              </div>

              <Field
                label="Role Summary"
                hint="Agentin nə etdiyini və hansı kontekstdə işlədiyini qısa yaz."
              >
                <SurfaceTextArea
                  value={form.role_summary}
                  disabled={readOnly}
                  placeholder="Handles proposals review, drafts strategic responses, escalates edge cases..."
                  onChange={(e) => patch("role_summary", e.target.value)}
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile
                  label="Agent Key"
                  value={agent?.agent_key || "—"}
                  hint="Stable identifier"
                  tone="info"
                />
                <StatTile
                  label="Enabled"
                  value={form.enabled ? "Yes" : "No"}
                  hint="Runtime availability"
                  tone={form.enabled ? "success" : "warn"}
                />
                <StatTile
                  label="Model"
                  value={form.model || "—"}
                  hint="Current engine"
                  tone="neutral"
                />
              </div>
            </div>
          </Card>
        </div>

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
              <Button
                variant="secondary"
                disabled
                leftIcon={<ShieldBan className="h-4 w-4" />}
              >
                Read Only
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={saving || !dirty}
                leftIcon={<Save className="h-4 w-4" />}
              >
                {saving ? "Saving..." : "Save Agent"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}