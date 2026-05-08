import { cx } from "../../lib/cx.js";

export default function CommentMiniInfo({
  label,
  value,
  icon: Icon,
  className,
}) {
  return (
    <div
      className={cx(
        "rounded-[14px] border border-line-soft bg-surface-subtle px-3.5 py-3",
        className
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
        {label}
      </div>

      <div className="mt-2 flex items-center gap-2.5 text-[13px] font-medium leading-5 text-text">
        {Icon ? (
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface text-text-subtle">
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : null}
        <span className="min-w-0 truncate">{value || "—"}</span>
      </div>
    </div>
  );
}