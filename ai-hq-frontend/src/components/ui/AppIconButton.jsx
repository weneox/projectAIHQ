import { cx } from "../../lib/cx.js";

export default function AppIconButton({
  children,
  onClick,
  disabled,
  label = "Action",
  className = "",
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white text-text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_1px_2px_rgba(15,23,42,0.05)] transition-[background-color,border-color,color,box-shadow] duration-150 ease-premium hover:border-line-strong hover:bg-surface-subtle hover:text-text disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}
