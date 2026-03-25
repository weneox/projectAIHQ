// src/components/settings/BrandProfileForm.jsx
// PREMIUM v3.1 — editorial brand profile form (read-only aware)

import {
  BadgeCheck,
  Globe2,
  Mail,
  Megaphone,
  Phone,
  Quote,
  Sparkles,
  Target,
  PenSquare,
  ShieldBan,
} from "lucide-react";

import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import Badge from "../ui/Badge.jsx";
import SettingsSection from "./SettingsSection.jsx";
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
  min = 120,
  placeholder = "",
  disabled = false,
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
        placeholder={placeholder}
        disabled={disabled}
        style={{ minHeight: min }}
        className={cx(
          "relative z-10 w-full resize-y bg-transparent px-4 py-3.5 text-[14px] outline-none",
          "text-slate-900 placeholder:text-slate-400",
          "dark:text-slate-100 dark:placeholder:text-slate-500"
        )}
      />
    </div>
  );
}

function MetaTile({ icon, label, value, tone = "neutral" }) {
  const Icon = icon;

  return (
    <Card variant="subtle" padded="sm" tone={tone} className="rounded-[24px]">
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

function stringifyCsv(arr) {
  return Array.isArray(arr) ? arr.join(", ") : "";
}

function parseCsv(text) {
  return String(text || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function phraseCount(value) {
  return Array.isArray(value) ? value.length : 0;
}

export default function BrandProfileForm({
  profile = {},
  patchProfile,
  canManage = true,
}) {
  const brandName = profile.brand_name || "Untitled Brand";
  const website = profile.website_url || "No website set";
  const bannedCount = phraseCount(profile.banned_phrases);

  return (
    <SettingsSection
      eyebrow="Brand"
      title="Brand & Profile"
      subtitle="Prompt system, content engine və outward-facing communication bu profilə əsaslanacaq."
      tone="default"
    >
      <div className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <Card variant="surface" padded="lg" className="rounded-[28px]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="inline-flex flex-wrap items-center gap-2">
                  <Badge tone="info" variant="subtle" dot>
                    Brand Profile
                  </Badge>
                  <Badge tone="success" variant="subtle" dot>
                    Content Ready
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[26px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                    {brandName}
                  </div>
                  <div className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Public brand presence, tone of voice, audience context və CTA
                    direction burada formalaşdırılır.
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px]">
                <MetaTile
                  icon={Globe2}
                  label="Website"
                  value={website}
                  tone="info"
                />
                <MetaTile
                  icon={Megaphone}
                  label="Tone"
                  value={profile.tone_of_voice || "—"}
                  tone="neutral"
                />
                <MetaTile
                  icon={ShieldBan}
                  label="Banned"
                  value={bannedCount}
                  tone={bannedCount > 0 ? "warn" : "neutral"}
                />
              </div>
            </div>
          </Card>

          <Card variant="subtle" padded="lg" className="rounded-[28px]">
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  Profile Snapshot
                </div>
                <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                  Public Brand Signals
                </div>
                <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Brand identity və conversion intent üçün əsas siqnallar.
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <MetaTile
                  icon={Mail}
                  label="Public Email"
                  value={profile.public_email || "—"}
                  tone="info"
                />
                <MetaTile
                  icon={Phone}
                  label="Public Phone"
                  value={profile.public_phone || "—"}
                  tone="neutral"
                />
                <MetaTile
                  icon={Target}
                  label="Preferred CTA"
                  value={profile.preferred_cta || "—"}
                  tone="success"
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card variant="surface" padded="lg" className="rounded-[28px]">
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                  <BadgeCheck className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </div>

                <div className="space-y-1">
                  <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                    Brand Identity
                  </div>
                  <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Public-facing identity və əsas contact məlumatları burada saxlanılır.
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Brand Name" hint="Public brand display name.">
                  <Input
                    value={profile.brand_name || ""}
                    placeholder="Neox"
                    disabled={!canManage}
                    onChange={(e) => patchProfile("brand_name", e.target.value)}
                  />
                </Field>

                <Field label="Website" hint="Canonical website URL.">
                  <Input
                    value={profile.website_url || ""}
                    placeholder="https://example.com"
                    disabled={!canManage}
                    onChange={(e) => patchProfile("website_url", e.target.value)}
                  />
                </Field>

                <Field label="Public Email" hint="Customer-facing email address.">
                  <Input
                    value={profile.public_email || ""}
                    placeholder="hello@example.com"
                    disabled={!canManage}
                    onChange={(e) => patchProfile("public_email", e.target.value)}
                  />
                </Field>

                <Field label="Public Phone" hint="Customer-facing contact number.">
                  <Input
                    value={profile.public_phone || ""}
                    placeholder="+994 ..."
                    disabled={!canManage}
                    onChange={(e) => patchProfile("public_phone", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card variant="surface" padded="lg" className="rounded-[28px]">
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                  <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </div>

                <div className="space-y-1">
                  <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                    Voice & Conversion
                  </div>
                  <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Brand tone, CTA direction və communication behavior burada təyin olunur.
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Tone of Voice"
                  hint="Məsələn: sharp, premium, warm, direct."
                >
                  <Input
                    value={profile.tone_of_voice || ""}
                    placeholder="premium, confident, clear"
                    disabled={!canManage}
                    onChange={(e) =>
                      patchProfile("tone_of_voice", e.target.value)
                    }
                  />
                </Field>

                <Field
                  label="Preferred CTA"
                  hint="Default call-to-action wording."
                >
                  <Input
                    value={profile.preferred_cta || ""}
                    placeholder="Book a strategy call"
                    disabled={!canManage}
                    onChange={(e) =>
                      patchProfile("preferred_cta", e.target.value)
                    }
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field
                    label="Audience Summary"
                    hint="Kimə danışdığınızı qısa və aydın şəkildə yazın."
                  >
                    <SurfaceTextArea
                      min={120}
                      disabled={!canManage}
                      value={profile.audience_summary || ""}
                      placeholder="Primary audience, buyer intent, expectations..."
                      onChange={(e) =>
                        patchProfile("audience_summary", e.target.value)
                      }
                    />
                  </Field>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card variant="surface" padded="lg" className="rounded-[28px]">
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                  <PenSquare className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </div>

                <div className="space-y-1">
                  <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                    Offer Narrative
                  </div>
                  <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Services və value proposition content engine üçün əsas narrative bazasıdır.
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Field
                  label="Services Summary"
                  hint="Əsas xidmətlər və capability sahələri."
                >
                  <SurfaceTextArea
                    min={132}
                    disabled={!canManage}
                    value={profile.services_summary || ""}
                    placeholder="What the company does, core services, delivery shape..."
                    onChange={(e) =>
                      patchProfile("services_summary", e.target.value)
                    }
                  />
                </Field>

                <Field
                  label="Value Proposition"
                  hint="Müştəriyə verdiyiniz əsas dəyər və fərq."
                >
                  <SurfaceTextArea
                    min={132}
                    disabled={!canManage}
                    value={profile.value_proposition || ""}
                    placeholder="Why this brand matters, why buyers should choose it..."
                    onChange={(e) =>
                      patchProfile("value_proposition", e.target.value)
                    }
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card variant="surface" padded="lg" className="rounded-[28px]">
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                  <Quote className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </div>

                <div className="space-y-1">
                  <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                    Brand Narrative
                  </div>
                  <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Brand summary və language guardrails burada saxlanılır.
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Field
                  label="Brand Summary"
                  hint="Brand story, positioning və overall identity."
                >
                  <SurfaceTextArea
                    min={160}
                    disabled={!canManage}
                    value={profile.brand_summary || ""}
                    placeholder="Brand story, positioning, worldview, authority..."
                    onChange={(e) =>
                      patchProfile("brand_summary", e.target.value)
                    }
                  />
                </Field>

                <Field
                  label="Banned Phrases"
                  hint="Comma separated. İstifadə olunmamalı sözlər və ifadələr."
                >
                  <Input
                    value={stringifyCsv(profile.banned_phrases)}
                    placeholder="cheap, guaranteed results, best in the world"
                    disabled={!canManage}
                    onChange={(e) =>
                      patchProfile("banned_phrases", parseCsv(e.target.value))
                    }
                  />
                </Field>

                <div className="grid gap-3 sm:grid-cols-3">
                  <MetaTile
                    icon={ShieldBan}
                    label="Guardrails"
                    value={bannedCount}
                    tone={bannedCount > 0 ? "warn" : "neutral"}
                  />
                  <MetaTile
                    icon={Megaphone}
                    label="Voice"
                    value={profile.tone_of_voice || "—"}
                    tone="info"
                  />
                  <MetaTile
                    icon={Target}
                    label="CTA"
                    value={profile.preferred_cta || "—"}
                    tone="success"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </SettingsSection>
  );
}