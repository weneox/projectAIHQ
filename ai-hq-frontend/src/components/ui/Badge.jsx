import { cx } from "../../lib/cx.js";

const toneClasses = {
  neutral:
    "border-[rgb(var(--color-line))] bg-surface text-text",
  brand:
    "border-[rgba(var(--color-brand),0.18)] bg-[rgba(var(--color-brand),0.08)] text-[rgb(var(--color-brand))]",
  success:
    "border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.08)] text-[rgb(5,150,105)]",
  warning:
    "border-[rgba(245,158,11,0.18)] bg-[rgba(245,158,11,0.08)] text-[rgb(217,119,6)]",
  danger:
    "border-[rgba(var(--color-danger),0.18)] bg-[rgba(var(--color-danger),0.08)] text-[rgb(var(--color-danger))]",
  info:
    "border-[rgba(59,130,246,0.18)] bg-[rgba(59,130,246,0.08)] text-[rgb(37,99,235)]",
};

export default function Badge({
  className,
  children,
  tone = "neutral",
  icon = null,
  size = "md",
  ...props
}) {
  const sizeClass =
    size === "sm"
      ? "min-h-[24px] px-2.5 text-[12px]"
      : "min-h-[28px] px-3 text-[12.5px]";

  return (
    <span
      className={cx(
        "ui-radius-badge inline-flex items-center gap-1.5 border font-semibold tracking-[-0.01em]",
        sizeClass,
        toneClasses[tone] || toneClasses.neutral,
        className
      )}
      {...props}
    >
      {icon ? <span className="inline-flex shrink-0 items-center">{icon}</span> : null}
      <span className="inline-flex items-center">{children}</span>
    </span>
  );
}