import Card from "./Card.jsx";
import { cx } from "../../lib/cx.js";

export function AppTableCard({ children, className = "" }) {
  return (
    <Card padded={false} clip className={className}>
      {children}
    </Card>
  );
}

export function AppTableToolbar({
  title,
  description,
  controls,
  filters,
  className = "",
}) {
  return (
    <div className={cx("border-b border-line-soft px-4 py-4", className)}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          {title ? (
            <div className="text-[15px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              {title}
            </div>
          ) : null}

          {description ? (
            <div className="mt-1 text-[12.5px] font-medium text-text-muted">
              {description}
            </div>
          ) : null}
        </div>

        {controls ? <div className="w-full xl:w-auto">{controls}</div> : null}
      </div>

      {filters ? <div className="mt-3">{filters}</div> : null}
    </div>
  );
}

export function AppTableHeaderRow({
  children,
  minWidthClass = "",
  gridStyle,
  className = "",
}) {
  return (
    <div
      className={cx(
        "grid h-11 items-center border-b border-line-soft bg-white text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text-subtle",
        minWidthClass,
        className
      )}
      style={gridStyle}
    >
      {children}
    </div>
  );
}

export function AppTableHeaderCell({ children, align = "left", className = "" }) {
  return (
    <div
      className={cx(
        "min-w-0 px-4",
        align === "right" ? "text-right" : "",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AppTableRow({
  children,
  selected = false,
  onClick,
  minWidthClass = "",
  gridStyle,
  className = "",
}) {
  const interactive = typeof onClick === "function";

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!interactive) return;
        if (event.key === "Enter" || event.key === " ") onClick();
      }}
      className={cx(
        "grid min-h-[58px] items-center gap-0 border-b border-line-soft text-left transition-colors duration-base ease-premium last:border-b-0",
        interactive ? "cursor-pointer" : "",
        selected ? "bg-brand/5" : "bg-white hover:bg-surface-subtle/55",
        minWidthClass,
        className
      )}
      style={gridStyle}
    >
      {children}
    </div>
  );
}

export function AppTableCell({ children, align = "left", className = "" }) {
  return (
    <div
      className={cx(
        "min-w-0 px-4",
        align === "right" ? "text-right" : "",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AppTableText({ children, muted = false, className = "" }) {
  return (
    <div
      className={cx(
        "truncate text-[13px] font-medium",
        muted ? "text-text-muted" : "text-text",
        className
      )}
    >
      {children || "—"}
    </div>
  );
}

export function AppTableEmptyState({
  icon,
  title = "No records found",
  description = "Adjust filters or refresh the page.",
  action,
}) {
  return (
    <div className="flex min-h-[340px] items-center justify-center px-6 py-12 text-center">
      <div className="max-w-[520px]">
        {icon ? (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-line bg-surface-subtle text-text-muted">
            {icon}
          </div>
        ) : null}

        <h2 className="mt-5 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
          {title}
        </h2>

        <p className="mt-2 text-[13.5px] font-medium leading-6 text-text-muted">
          {description}
        </p>

        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
