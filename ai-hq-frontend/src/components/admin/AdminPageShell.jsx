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
      <section className="rounded-[28px] border border-white/10 bg-[#07111d] px-5 py-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            {eyebrow ? (
              <div className="text-[11px] uppercase tracking-[0.26em] text-white/42">{eyebrow}</div>
            ) : null}
            <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.04em] text-white">{title}</h1>
            {description ? (
              <p className="mt-2 max-w-3xl text-sm text-white/58">{description}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {actions}
            {surface?.refresh ? (
              <Button
                variant="secondary"
                onClick={surface.refresh}
                disabled={surface.loading || surface.saving}
                className="h-11 rounded-2xl border-white/10 bg-white/[0.05] px-4 text-sm font-medium text-white/86 hover:bg-white/[0.08]"
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
