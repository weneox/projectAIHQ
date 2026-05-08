import { cx } from "../../lib/cx.js";

export default function AppInfoRow({ label, value, className = "" }) {
  return (
    <div
      className={cx(
        "grid grid-cols-[96px_minmax(0,1fr)] gap-4 rounded-md border border-line-soft bg-white px-3.5 py-3",
        className
      )}
    >
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
        {label}
      </div>
      <div className="min-w-0 truncate text-right text-[13px] font-semibold text-text">
        {value || "—"}
      </div>
    </div>
  );
}
