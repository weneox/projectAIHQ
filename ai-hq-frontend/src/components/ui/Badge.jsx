import { cx } from "../../lib/cx.js";

const TONES = {
  neutral: {
    solid: "border-line bg-text text-white",
    subtle: "border-line-soft bg-surface-muted text-text-muted",
    outline: "border-line text-text-muted",
    dot: "bg-text-subtle",
  },
  success: {
    solid: "border-success bg-success text-white",
    subtle: "border-line bg-success-soft text-success",
    outline: "border-success text-success",
    dot: "bg-success",
  },
  warning: {
    solid: "border-warning bg-warning text-white",
    subtle: "border-line bg-warning-soft text-warning",
    outline: "border-warning text-warning",
    dot: "bg-warning",
  },
  danger: {
    solid: "border-danger bg-danger text-white",
    subtle: "border-line bg-danger-soft text-danger",
    outline: "border-danger text-danger",
    dot: "bg-danger",
  },
  info: {
    solid: "border-brand bg-brand text-white",
    subtle: "border-line bg-brand-soft text-brand",
    outline: "border-brand text-brand",
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
        "inline-flex items-center gap-2 rounded-pill border font-medium tracking-[-0.01em]",
        size === "md"
          ? "min-h-[30px] px-3 text-[12px]"
          : size === "lg"
          ? "min-h-[34px] px-3.5 text-[13px]"
          : "min-h-[26px] px-2.5 text-[11px]",
        palette[variant] || palette.subtle,
        className
      )}
    >
      {dot ? <span className={cx("h-1.5 w-1.5 rounded-full", palette.dot)} /> : null}
      <span>{children}</span>
    </span>
  );
}