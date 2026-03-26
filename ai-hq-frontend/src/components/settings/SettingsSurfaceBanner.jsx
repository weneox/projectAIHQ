import Button from "../ui/Button.jsx";

function Banner({ tone = "neutral", children, action }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200/80 bg-emerald-50/90 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
      : tone === "warn"
        ? "border-amber-200/80 bg-amber-50/90 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200"
        : tone === "danger"
          ? "border-rose-200/80 bg-rose-50/90 text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200"
          : "border-slate-200/80 bg-white/80 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300";

  return (
    <div className={`rounded-[24px] border px-4 py-4 text-sm ${toneClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>{children}</div>
        {action?.onClick ? (
          <Button variant="secondary" onClick={action.onClick} disabled={action.disabled}>
            {action.label || "Refresh"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function SettingsSurfaceBanner({
  surface,
  errorMessage = "",
  unavailableMessage = "",
  saveErrorMessage = "",
  saveSuccessMessage = "",
  refreshLabel = "Refresh",
}) {
  const items = [];

  if (surface?.saveSuccess || saveSuccessMessage) {
    items.push(
      <Banner key="save-success" tone="success">
        {saveSuccessMessage || surface.saveSuccess}
      </Banner>
    );
  }

  if (surface?.saveError || saveErrorMessage) {
    items.push(
      <Banner key="save-error" tone="danger">
        {saveErrorMessage || surface.saveError}
      </Banner>
    );
  }

  if (!surface?.unavailable && (surface?.error || errorMessage)) {
    items.push(
      <Banner
        key="error"
        tone="danger"
        action={
          surface?.refresh
            ? {
                onClick: surface.refresh,
                label: refreshLabel,
                disabled: surface.loading || surface.saving,
              }
            : null
        }
      >
        {errorMessage || surface.error}
      </Banner>
    );
  }

  if (surface?.unavailable) {
    items.push(
      <Banner
        key="unavailable"
        tone="warn"
        action={
          surface?.refresh
            ? {
                onClick: surface.refresh,
                label: refreshLabel,
                disabled: surface.loading || surface.saving,
              }
            : null
        }
      >
        {unavailableMessage || surface.error || "This settings surface is temporarily unavailable."}
      </Banner>
    );
  }

  if (!items.length) return null;
  return <div className="space-y-3">{items}</div>;
}
