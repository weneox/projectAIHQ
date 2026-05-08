import { cx } from "../../lib/cx.js";

const TONE = {
  neutral: "border-line-soft bg-surface-subtle text-text-muted",
  brand: "border-brand/20 bg-brand/5 text-brand",
  success: "border-success/20 bg-success/5 text-success",
  warning: "border-warning/24 bg-warning/6 text-warning",
  danger: "border-danger/24 bg-danger/5 text-danger",
};

export default function AppTag({
  children,
  tone = "neutral",
  dot = false,
  className = "",
}) {
  return (
    <span
      className={cx(
        "inline-flex h-7 max-w-full items-center gap-2 rounded-md border px-2.5 text-[12px] font-semibold",
        TONE[tone] || TONE.neutral,
        className
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-md bg-current opacity-80" /> : null}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
