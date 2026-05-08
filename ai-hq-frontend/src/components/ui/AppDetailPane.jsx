import { cx } from "../../lib/cx.js";

export default function AppDetailPane({
  children,
  className = "",
}) {
  return (
    <aside
      className={cx(
        "border-t border-line-soft bg-white xl:border-l xl:border-t-0",
        className
      )}
    >
      {children}
    </aside>
  );
}

export function AppDetailHeader({ children, className = "" }) {
  return (
    <div className={cx("border-b border-line-soft px-5 py-5", className)}>
      {children}
    </div>
  );
}

export function AppDetailBody({ children, className = "" }) {
  return <div className={cx("space-y-3 px-5 py-5", className)}>{children}</div>;
}

export function AppDetailEmpty({
  icon,
  title = "Select a record",
  description = "Choose a row to inspect details.",
}) {
  return (
    <div className="flex min-h-[520px] items-center justify-center px-6 py-10 text-center">
      <div className="max-w-[340px]">
        {icon ? (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-line bg-surface-subtle text-text-muted">
            {icon}
          </div>
        ) : null}

        <div className="mt-5 text-[16px] font-semibold text-text">{title}</div>
        <p className="mt-2 text-[13.5px] font-medium leading-6 text-text-muted">
          {description}
        </p>
      </div>
    </div>
  );
}
