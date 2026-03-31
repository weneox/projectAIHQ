import Button from "../ui/Button.jsx";
import SettingsSurfaceBanner from "../settings/SettingsSurfaceBanner.jsx";

export default function AdminPageShell({
  eyebrow = "",
  title,
  description = "",
  surface,
  refreshLabel = "Refresh",
  unavailableMessage = "",
  actions = null,
  children,
}) {
  return (
    <div className="space-y-5">
      <section className="premium-page-hero px-5 py-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            {eyebrow ? (
              <div className="premium-kicker">{eyebrow}</div>
            ) : null}
            <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.045em] text-slate-950">{title}</h1>
            {description ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {actions}
            {surface?.refresh ? (
              <Button
                variant="secondary"
                onClick={surface.refresh}
                disabled={surface.loading || surface.saving}
                className="h-11 rounded-full border-white/80 bg-white/72 px-4 text-sm font-medium text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_24px_-18px_rgba(15,23,42,0.18)] hover:bg-white"
              >
                {refreshLabel}
              </Button>
            ) : null}
          </div>
        </div>

        <SettingsSurfaceBanner
          surface={surface}
          unavailableMessage={unavailableMessage}
          refreshLabel={refreshLabel}
        />
      </section>

      {children}
    </div>
  );
}
