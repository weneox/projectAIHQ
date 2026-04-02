import { cx } from "../../lib/cx.js";

export default function Card({
  className,
  children,
  variant = "surface",
  interactive = false,
  padded = "md",
  clip = false,
  tone = "neutral",
}) {
  const pad =
    padded === false
      ? "p-0"
      : padded === "sm"
      ? "p-4"
      : padded === "lg"
      ? "p-6 md:p-7"
      : "p-5 md:p-6";

  const toneClass =
    tone === "info"
      ? "border-brand/15"
      : tone === "success"
      ? "border-success/20"
      : tone === "warn"
      ? "border-warning/20"
      : tone === "danger"
      ? "border-danger/20"
      : "border-line";

  const variantClass =
    variant === "plain"
      ? "border-transparent bg-transparent shadow-none"
      : variant === "subtle"
      ? "bg-surface-muted shadow-none"
      : variant === "elevated"
      ? "bg-surface shadow-panel-strong"
      : "bg-surface shadow-panel";

  return (
    <div
      className={cx(
        "min-w-0 rounded-panel border transition-[transform,box-shadow,border-color,background-color] duration-200",
        clip ? "overflow-hidden" : "overflow-visible",
        pad,
        toneClass,
        variantClass,
        interactive &&
          "cursor-pointer hover:-translate-y-[1px] hover:border-line-strong hover:shadow-panel-strong",
        className
      )}
    >
      {children}
    </div>
  );
}
