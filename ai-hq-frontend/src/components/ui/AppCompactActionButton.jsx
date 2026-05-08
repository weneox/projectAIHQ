import { cx } from "../../lib/cx.js";

export default function AppCompactActionButton({
  children,
  onClick,
  disabled,
  loading = false,
  muted = false,
  tone = "default",
  className = "",
}) {
  const toneClass = muted
    ? "border-line-soft bg-surface-subtle text-text-subtle shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
    : tone === "danger"
      ? "border-danger/28 bg-danger/5 text-danger shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_1px_2px_rgba(190,24,93,0.08)] hover:border-danger/42 hover:bg-danger/8"
      : tone === "success"
        ? "border-success/28 bg-success/5 text-success shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_1px_2px_rgba(22,101,52,0.08)] hover:border-success/42 hover:bg-success/8"
        : "border-line bg-white text-text shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_1px_2px_rgba(15,23,42,0.05)] hover:bg-surface-subtle";

  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={cx(
        "inline-flex h-8 w-[74px] items-center justify-center rounded-md border px-2 text-[12px] font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 ease-premium disabled:cursor-not-allowed disabled:opacity-55",
        toneClass,
        className
      )}
    >
      {loading ? "..." : children}
    </button>
  );
}
