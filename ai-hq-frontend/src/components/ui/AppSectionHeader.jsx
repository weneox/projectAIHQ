import { cx } from "../../lib/cx.js";

export default function AppSectionHeader({
  title,
  description = "",
  actions = null,
  icon: Icon = null,
  className = "",
  contentClassName = "",
}) {
  return (
    <div
      className={cx(
        "border-b border-line-soft px-5 py-4",
        className
      )}
    >
      <div
        className={cx(
          "flex flex-col gap-3 md:flex-row md:items-start md:justify-between",
          contentClassName
        )}
      >
        <div className="flex min-w-0 items-start gap-3.5">
          {Icon ? (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line-soft bg-surface-subtle text-text-muted">
              <Icon className="h-4.5 w-4.5" strokeWidth={2.05} />
            </div>
          ) : null}

          <div className="min-w-0">
            <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              {title}
            </div>

            {description ? (
              <div className="mt-1 max-w-[720px] text-[12.5px] font-medium leading-5 text-text-muted">
                {description}
              </div>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className="flex shrink-0 items-center justify-start gap-2 md:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
