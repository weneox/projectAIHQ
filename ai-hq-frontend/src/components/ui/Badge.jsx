import { cx } from "../../lib/cx.js";

const TONES = {
  neutral: {
    solid: "border-line bg-[rgb(var(--color-text))] text-white",
    subtle: "border-line bg-surface-muted text-text-muted",
    outline: "border-line bg-surface text-text-muted",
    dot: "bg-[rgb(var(--color-text-subtle))]",
  },
  success: {
    solid: "border-success bg-success text-white",
    subtle: "border-[rgba(var(--color-success),0.18)] bg-success-soft text-success",
    outline: "border-success bg-surface text-success",
    dot: "bg-success",
  },
  warning: {
    solid: "border-warning bg-warning text-white",
    subtle: "border-[rgba(var(--color-warning),0.22)] bg-warning-soft text-warning",
    outline: "border-warning bg-surface text-warning",
    dot: "bg-warning",
  },
  danger: {
    solid: "border-danger bg-danger text-white",
    subtle: "border-[rgba(var(--color-danger),0.18)] bg-danger-soft text-danger",
    outline: "border-danger bg-surface text-danger",
    dot: "bg-danger",
  },
  info: {
    solid: "border-brand bg-brand text-white",
    subtle: "border-[rgba(var(--color-brand),0.18)] bg-brand-soft text-brand",
    outline: "border-brand bg-surface text-brand",
    dot: "bg-brand",
  },
};

function normalizeTone(tone = "neutral") {
  const value = String(tone || "neutral").toLowerCase();
  if (value === "warn") return "warning";
  return value;
}

function tonePack(tone = "neutral") {
  return TONES[normalizeTone(tone)] || TONES.neutral;
}

export default function Badge({
  tone = "neutral",
  variant = "subtle",
  size = "sm",
  dot = false,
  className,
  children,
}) {
  const palette = tonePack(tone);

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-pill border font-medium",
        size === "md"
          ? "min-h-[24px] px-3 text-[11px]"
          : size === "lg"
            ? "min-h-[28px] px-3.5 text-[12px]"
            : "min-h-[22px] px-2.5 text-[11px]",
        palette[variant] || palette.subtle,
        className
      )}
    >
      {dot ? <span className={cx("h-1.5 w-1.5 rounded-full", palette.dot)} /> : null}
      <span>{children}</span>
    </span>
  );
}
