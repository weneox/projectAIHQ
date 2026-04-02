function LabSection({ title, children }) {
  return (
    <section className="space-y-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {title}
      </div>
      {children}
    </section>
  );
}

function LabCard({ children, className = "" }) {
  return (
    <div
      className={[
        "rounded-[28px] border border-slate-200/80 bg-white/72 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)] backdrop-blur-sm",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function DemoButton({ children, tone = "default", disabled = false }) {
  const tones = {
    primary:
      "bg-slate-950 text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)] hover:bg-slate-900",
    soft: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    ghost: "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium tracking-[-0.02em] transition",
        "disabled:cursor-not-allowed disabled:opacity-45",
        tones[tone] || tones.default,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function DemoInput({ placeholder = "", value = "", right = null }) {
  return (
    <div className="flex h-12 items-center rounded-[18px] border border-slate-200 bg-white px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      <input
        readOnly
        value={value}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none"
      />
      {right ? <div className="ml-3 shrink-0">{right}</div> : null}
    </div>
  );
}

function DemoTextarea({ placeholder = "" }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      <textarea
        readOnly
        placeholder={placeholder}
        className="min-h-[112px] w-full resize-none bg-transparent text-sm leading-6 text-slate-950 placeholder:text-slate-400 focus:outline-none"
      />
    </div>
  );
}

function DemoPill({ children, tone = "default" }) {
  const tones = {
    default: "border-slate-200 bg-white text-slate-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-700",
    dark: "border-slate-900 bg-slate-950 text-white",
  };

  return (
    <div
      className={[
        "inline-flex h-9 items-center rounded-full border px-3 text-[12px] font-medium tracking-[-0.01em]",
        tones[tone] || tones.default,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function Metric({ label, value, tone = "default" }) {
  const tones = {
    default: "bg-white",
    soft: "bg-slate-50",
    success: "bg-emerald-50",
  };

  return (
    <div
      className={[
        "rounded-[22px] border border-slate-200/80 p-4",
        tones[tone] || tones.default,
      ].join(" ")}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-[26px] font-semibold tracking-[-0.05em] text-slate-950">
        {value}
      </div>
    </div>
  );
}

function Row({ title, meta, right }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[20px] border border-slate-200/80 bg-white px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium tracking-[-0.02em] text-slate-950">
          {title}
        </div>
        {meta ? (
          <div className="mt-1 truncate text-xs text-slate-400">{meta}</div>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export default function DesignLab() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            sandbox
          </div>
          <h1 className="mt-2 text-[32px] font-semibold tracking-[-0.05em] text-slate-950">
            Design lab
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <DemoPill>Light</DemoPill>
          <DemoPill tone="success">Ready</DemoPill>
          <DemoPill tone="dark">Internal</DemoPill>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <div className="space-y-6">
          <LabSection title="Buttons">
            <LabCard>
              <div className="flex flex-wrap gap-3">
                <DemoButton tone="primary">Primary</DemoButton>
                <DemoButton tone="soft">Secondary</DemoButton>
                <DemoButton tone="ghost">Ghost</DemoButton>
                <DemoButton tone="danger">Danger</DemoButton>
                <DemoButton tone="soft" disabled>
                  Disabled
                </DemoButton>
              </div>
            </LabCard>
          </LabSection>

          <LabSection title="Inputs">
            <LabCard className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <DemoInput placeholder="Search" />
                <DemoInput
                  value="Instagram"
                  right={
                    <DemoPill tone="success">
                      Connected
                    </DemoPill>
                  }
                />
                <DemoInput placeholder="Business name" />
                <DemoInput placeholder="Website URL" />
              </div>

              <DemoTextarea placeholder="Write note..." />
            </LabCard>
          </LabSection>

          <LabSection title="Rows">
            <div className="space-y-3">
              <Row
                title="Website"
                meta="weneox.com"
                right={<DemoPill tone="success">Live</DemoPill>}
              />
              <Row
                title="Instagram"
                meta="@neoxhq"
                right={<DemoPill>Manual</DemoPill>}
              />
              <Row
                title="Google Maps"
                meta="Needs review"
                right={<DemoPill tone="warn">Check</DemoPill>}
              />
            </div>
          </LabSection>
        </div>

        <div className="space-y-6">
          <LabSection title="Badges">
            <LabCard>
              <div className="flex flex-wrap gap-2">
                <DemoPill>Default</DemoPill>
                <DemoPill tone="success">Approved</DemoPill>
                <DemoPill tone="warn">Draft</DemoPill>
                <DemoPill tone="dark">Primary</DemoPill>
              </div>
            </LabCard>
          </LabSection>

          <LabSection title="Metrics">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Sessions" value="12" />
              <Metric label="Sources" value="5" tone="soft" />
              <Metric label="Ready" value="3" tone="success" />
            </div>
          </LabSection>

          <LabSection title="Surfaces">
            <LabCard className="space-y-4">
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-slate-950">
                    Neutral surface
                  </div>
                  <DemoPill>Quiet</DemoPill>
                </div>
              </div>

              <div className="rounded-[22px] border border-emerald-200/80 bg-emerald-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-emerald-900">
                    Success surface
                  </div>
                  <DemoPill tone="success">Good</DemoPill>
                </div>
              </div>

              <div className="rounded-[22px] border border-amber-200/80 bg-amber-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-amber-900">
                    Review surface
                  </div>
                  <DemoPill tone="warn">Pending</DemoPill>
                </div>
              </div>
            </LabCard>
          </LabSection>
        </div>
      </div>
    </div>
  );
}