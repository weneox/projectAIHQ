import Button from "../ui/Button.jsx";
import SurfaceBanner from "../feedback/SurfaceBanner.jsx";

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
      <section className="border-b border-line-soft px-1 py-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            {eyebrow ? (
              <div className="text-sm text-text-muted">{eyebrow}</div>
            ) : null}
            <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.03em] text-text">{title}</h1>
            {description ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">{description}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {actions}
            {surface?.refresh ? (
              <Button
                variant="secondary"
                onClick={surface.refresh}
                disabled={surface.loading || surface.saving}
                className="h-10 px-4"
              >
                {refreshLabel}
              </Button>
            ) : null}
          </div>
        </div>

        <SurfaceBanner
          surface={surface}
          unavailableMessage={unavailableMessage}
          refreshLabel={refreshLabel}
        />
      </section>

      {children}
    </div>
  );
}
