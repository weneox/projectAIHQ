function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function Eyebrow({ children, dark = false }) {
  return (
    <div className={cx("ui-kicker", dark ? "text-white/42" : "text-app-faint")}>
      {children}
    </div>
  );
}

function Badge({ children, tone = "default" }) {
  const tones = {
    default: "ui-badge",
    subtle: "ui-badge ui-badge-subtle",
    dark: "ui-badge ui-badge-dark",
    darkSoft:
      "inline-flex h-[34px] items-center rounded-full border border-white/10 bg-white/[0.06] px-3.5 text-[13px] font-medium tracking-[-0.012em] text-white/82",
    success:
      "inline-flex h-7 items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 text-[12px] font-medium tracking-[-0.01em] text-emerald-700",
    warn:
      "inline-flex h-7 items-center rounded-full border border-amber-200 bg-amber-50 px-3 text-[12px] font-medium tracking-[-0.01em] text-amber-700",
  };

  return <div className={tones[tone] || tones.default}>{children}</div>;
}

function ActionButton({
  children,
  tone = "primary",
  disabled = false,
  className = "",
}) {
  const tones = {
    primary: "ui-button ui-button-primary",
    secondary: "ui-button",
    quiet: "ui-button ui-button-quiet",
    muted: "ui-button bg-slate-100 text-slate-400",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      className={cx(
        tones[tone] || tones.primary,
        "disabled:cursor-not-allowed disabled:opacity-55",
        className
      )}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="ui-panel rounded-[22px] px-7 py-6">
      <div className="ui-kicker">{label}</div>
      <div className="mt-6 text-[34px] font-semibold leading-none tracking-[-0.045em] text-app">
        {value}
      </div>
    </div>
  );
}

function Field({ label, placeholder = "", value = "", suffix = null }) {
  return (
    <label className="block">
      <div className="ui-label">{label}</div>
      <div className="ui-input-shell">
        <input
          readOnly
          value={value}
          placeholder={placeholder}
          className="!h-full !w-full !border-0 !bg-transparent !p-0 !text-[15px] !font-medium !tracking-[-0.015em] !text-app !shadow-none placeholder:!text-app-faint focus:!outline-none focus:!ring-0"
        />
        {suffix ? <div className="ml-3 shrink-0">{suffix}</div> : null}
      </div>
    </label>
  );
}

function TextareaField({ label, placeholder = "", value = "" }) {
  return (
    <label className="block">
      <div className="ui-label">{label}</div>
      <div className="ui-textarea-shell">
        <textarea
          readOnly
          value={value}
          placeholder={placeholder}
          className="!min-h-[128px] !w-full !resize-none !border-0 !bg-transparent !p-0 !text-[14px] !leading-6 !tracking-[-0.012em] !text-app !shadow-none placeholder:!text-app-faint focus:!outline-none focus:!ring-0"
        />
      </div>
    </label>
  );
}

function SourceRow({ title, meta, state, tone = "default" }) {
  const surface = tone === "subtle" ? "bg-subtle" : "bg-elevated";
  const badgeTone =
    state === "Live" ? "success" : state === "Review" ? "warn" : "default";

  return (
    <div
      className={cx(
        "flex items-center justify-between gap-4 rounded-[16px] border border-subtle px-4 py-3.5",
        surface
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold tracking-[-0.015em] text-app">
          {title}
        </div>
        <div className="mt-1 truncate text-[12px] text-app-muted">{meta}</div>
      </div>

      <div className="shrink-0">
        <Badge tone={badgeTone}>{state}</Badge>
      </div>
    </div>
  );
}

function DarkMetricRow({ label, value }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-4 last:border-b-0 last:pb-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/36">
        {label}
      </div>
      <div className="text-[34px] font-semibold leading-none tracking-[-0.05em] text-white">
        {value}
      </div>
    </div>
  );
}

function SignalRow({ title, state }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="h-2 w-2 rounded-full bg-white/42" />
        <div className="truncate text-[13px] font-medium tracking-[-0.012em] text-white/90">
          {title}
        </div>
      </div>

      <div className="shrink-0">
        <Badge tone="darkSoft">{state}</Badge>
      </div>
    </div>
  );
}

export default function DesignLab() {
  return (
    <div className="mx-auto max-w-[1380px] px-6 py-10 xl:px-8">
      <div className="space-y-7">
        <header className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-[960px] space-y-4">
            <Eyebrow>Sandbox</Eyebrow>

            <div className="space-y-4">
              <h1 className="ui-title-hero max-w-[560px] font-bold">Design lab</h1>

              <p className="ui-body-lg max-w-[860px]">
                A premium operator surface with tighter hierarchy, cleaner
                control density, quieter decoration, and one consistent visual
                system from top to bottom.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Badge tone="subtle">Light</Badge>
            <Badge>Ready</Badge>
            <Badge tone="dark">Internal</Badge>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard label="Sessions" value="12" />
          <StatCard label="Sources" value="5" />
          <StatCard label="Ready" value="3" />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="ui-panel rounded-[26px] p-7 lg:p-8">
            <div className="flex flex-col gap-7">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <Eyebrow>Primary canvas</Eyebrow>

                  <div className="space-y-3">
                    <h2 className="ui-title-xl max-w-[660px] font-bold">
                      Unified intake scene
                    </h2>

                    <p className="ui-body max-w-[720px]">
                      Less soft admin chrome. Better field rhythm. Stronger
                      content priority. Clearer active vs passive controls.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge tone="subtle">Draft</Badge>
                  <Badge>Connected</Badge>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Field label="Search" placeholder="Search" />
                <Field
                  label="Primary source"
                  value="Instagram"
                  suffix={<Badge tone="success">Connected</Badge>}
                />
                <Field label="Business name" placeholder="Business name" />
                <Field label="Website URL" placeholder="Website URL" />
              </div>

              <TextareaField
                label="Operator note"
                placeholder="Write a clean operator note, import instruction, or context for the source sync."
              />

              <div className="rounded-[18px] border border-subtle bg-subtle px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <div className="text-[13px] font-semibold tracking-[-0.012em] text-app">
                      Surface direction
                    </div>
                    <div className="text-[13px] leading-6 text-app-soft">
                      Fewer decorative pills. Stronger controls. Cleaner panel
                      segmentation.
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge tone="subtle">Keyboard-first</Badge>
                    <Badge tone="subtle">Operator-grade</Badge>
                    <Badge>Quiet premium</Badge>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 border-t border-subtle pt-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2.5">
                  <ActionButton tone="primary">Continue</ActionButton>
                  <ActionButton tone="secondary">Review draft</ActionButton>
                  <ActionButton tone="muted" disabled>
                    Disabled
                  </ActionButton>
                </div>

                <div className="text-[12px] text-app-muted">
                  Buttons should look like actions, not decorative chips.
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-[26px] border border-[#0f172a] bg-[linear-gradient(180deg,#08101d_0%,#050814_100%)] p-6 text-white shadow-float">
              <div className="space-y-3">
                <Eyebrow dark>Runtime snapshot</Eyebrow>

                <h3 className="ui-title-lg font-bold text-white">Command rail</h3>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge tone="darkSoft">Default</Badge>
                  <Badge tone="darkSoft">Approved</Badge>
                  <Badge tone="darkSoft">Primary</Badge>
                </div>
              </div>

              <div className="mt-7 space-y-4">
                <DarkMetricRow label="Sessions" value="12" />
                <DarkMetricRow label="Sources" value="5" />
                <DarkMetricRow label="Ready" value="3" />
              </div>

              <div className="mt-7 space-y-3">
                <Eyebrow dark>Signals</Eyebrow>
                <SignalRow title="Neutral surface density" state="Quiet" />
                <SignalRow title="Connected source state" state="Good" />
                <SignalRow title="Primary action clarity" state="Active" />
              </div>
            </div>

            <div className="ui-panel rounded-[24px] p-5">
              <div className="space-y-3">
                <Eyebrow>Sources</Eyebrow>
                <h3 className="ui-title-lg text-[26px] font-bold">Connected stack</h3>
              </div>

              <div className="mt-4 space-y-3">
                <SourceRow title="Website" meta="weneox.com" state="Live" />
                <SourceRow
                  title="Instagram"
                  meta="@neoxhq"
                  state="Manual"
                  tone="subtle"
                />
                <SourceRow
                  title="Google Maps"
                  meta="Needs review"
                  state="Review"
                  tone="subtle"
                />
              </div>
            </div>

            <div className="rounded-[20px] border border-subtle bg-subtle px-5 py-4">
              <Eyebrow>Note</Eyebrow>

              <div className="mt-3 text-[24px] font-bold leading-none tracking-[-0.035em] text-app">
                One scene, one voice
              </div>

              <p className="mt-3 text-[14px] leading-6 text-app-soft">
                Decorative softness was reduced. Hierarchy and component roles
                are now clearer, so the surface reads more like a working
                operator tool and less like a UI sandbox.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}