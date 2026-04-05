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
      ? "border-[rgba(var(--color-brand),0.16)]"
      : tone === "success"
      ? "border-[rgba(var(--color-success),0.2)]"
      : tone === "warn"
      ? "border-[rgba(var(--color-warning),0.2)]"
      : tone === "danger"
      ? "border-[rgba(var(--color-danger),0.2)]"
      : "border-line";

  const variantClass =
    variant === "plain"
      ? "border-transparent bg-transparent shadow-none"
      : variant === "subtle"
      ? "border-line-soft bg-surface-muted shadow-none"
      : variant === "elevated"
      ? "bg-white shadow-[0_14px_28px_-16px_rgba(15,23,42,0.12),0_6px_14px_-10px_rgba(15,23,42,0.06)]"
      : "bg-white shadow-[0_6px_18px_-14px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.92)]";

  return (
    <div
      className={cx(
        "min-w-0 rounded-[16px] border transition-[border-color,background-color,box-shadow,transform] duration-fast ease-premium",
        clip ? "overflow-hidden" : "overflow-visible",
        pad,
        toneClass,
        variantClass,
        interactive &&
          "cursor-pointer hover:-translate-y-[1px] hover:border-line-strong hover:shadow-[0_12px_24px_-14px_rgba(15,23,42,0.12),0_6px_14px_-10px_rgba(15,23,42,0.06)]",
        className
      )}
    >
      {children}
    </div>
  );
}