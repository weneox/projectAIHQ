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
          ? "p-6"
          : "p-5";

  const toneClass =
    tone === "info"
      ? "border-[rgba(var(--color-brand),0.18)]"
      : tone === "success"
        ? "border-[rgba(var(--color-success),0.18)]"
        : tone === "warn"
          ? "border-[rgba(var(--color-warning),0.22)]"
          : tone === "danger"
            ? "border-[rgba(var(--color-danger),0.18)]"
            : "border-line";

  const variantClass =
    variant === "plain"
      ? "border-transparent bg-transparent shadow-none"
      : variant === "subtle"
        ? "bg-surface-muted shadow-none"
        : variant === "elevated"
          ? "bg-surface shadow-panel"
          : "bg-surface shadow-none";

  return (
    <div
      className={cx(
        "min-w-0 rounded-panel border transition-colors",
        clip ? "overflow-hidden" : "overflow-visible",
        pad,
        toneClass,
        variantClass,
        interactive && "cursor-pointer hover:border-line-strong",
        className
      )}
    >
      {children}
    </div>
  );
}
