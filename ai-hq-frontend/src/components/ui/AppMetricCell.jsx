import { cx } from "../../lib/cx.js";

export default function AppMetricCell({
  icon: Icon,
  label,
  value,
  helper,
  tone = "neutral",
  className = "",
}) {
  return (
    <div
      className={cx(
        "min-h-[132px] border-b border-line-soft px-5 py-4 md:border-r xl:border-b-0",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
            {label}
          </div>

          <div className="mt-2 text-[27px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
            {value}
          </div>
        </div>

        <div
          className={cx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border",
            tone === "brand"
              ? "border-brand/20 bg-brand/5 text-brand"
              : tone === "success"
                ? "border-success/20 bg-success/5 text-success"
                : tone === "warning"
                  ? "border-warning/25 bg-warning/5 text-warning"
                  : tone === "danger"
                    ? "border-danger/20 bg-danger/5 text-danger"
                    : "border-line-soft bg-surface-subtle text-text-muted"
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={2.05} />
        </div>
      </div>

      {helper ? (
        <div className="mt-3 text-[12.5px] font-medium leading-5 text-text-muted">
          {helper}
        </div>
      ) : null}
    </div>
  );
}
