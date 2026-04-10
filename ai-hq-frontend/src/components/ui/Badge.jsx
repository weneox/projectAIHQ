import { cx } from "../../lib/cx.js";

const TONES = {
  neutral: {
    solid: "border-[rgba(var(--color-surface-inverse),0.08)] bg-[rgb(var(--color-surface-inverse))] text-white",
    subtle:
      "border-line-soft bg-surface-muted text-text-muted",
    outline:
      "border-line bg-surface text-text-muted",
    soft:
      "border-line-soft bg-surface-subtle text-text",
    dot: "bg-[rgb(var(--color-text-subtle))]",
  },

  success: {
    solid: "border-[rgba(var(--color-success),0.18)] bg-success text-white",
    subtle:
      "border-[rgba(var(--color-success),0.16)] bg-success-soft text-success",
    outline:
      "border-[rgba(var(--color-success),0.24)] bg-surface text-success",
    soft:
      "border-[rgba(var(--color-success),0.12)] bg-[rgba(var(--color-success),0.08)] text-success",
    dot: "bg-success",
  },

  warning: {
    solid: "border-[rgba(var(--color-warning),0.18)] bg-warning text-white",
    subtle:
      "border-[rgba(var(--color-warning),0.18)] bg-warning-soft text-warning",
    outline:
      "border-[rgba(var(--color-warning),0.24)] bg-surface text-warning",
    soft:
      "border-[rgba(var(--color-warning),0.12)] bg-[rgba(var(--color-warning),0.08)] text-warning",
    dot: "bg-warning",
  },

  danger: {
    solid: "border-[rgba(var(--color-danger),0.18)] bg-danger text-white",
    subtle:
      "border-[rgba(var(--color-danger),0.16)] bg-danger-soft text-danger",
    outline:
      "border-[rgba(var(--color-danger),0.24)] bg-surface text-danger",
    soft:
      "border-[rgba(var(--color-danger),0.12)] bg-[rgba(var(--color-danger),0.08)] text-danger",
    dot: "bg-danger",
  },

  info: {
    solid: "border-[rgba(var(--color-brand),0.16)] bg-brand text-white",
    subtle:
      "border-[rgba(var(--color-brand),0.16)] bg-brand-soft text-brand",
    outline:
      "border-[rgba(var(--color-brand),0.24)] bg-surface text-brand",
    soft:
      "border-[rgba(var(--color-brand),0.12)] bg-[rgba(var(--color-brand),0.07)] text-brand",
    dot: "bg-brand",
  },
};

function normalizeTone(tone = "neutral") {
  const value = String(tone || "neutral").trim().toLowerCase();
  if (value === "warn") return "warning";
  if (value === "accent" || value === "brand") return "info";
  return value;
}

function tonePack(tone = "neutral") {
  return TONES[normalizeTone(tone)] || TONES.neutral;
}

function sizeClass(size = "sm") {
  if (size === "lg") {
    return "min-h-[28px] px-3.5 text-[12px]";
  }

  if (size === "md") {
    return "min-h-[24px] px-3 text-[11px]";
  }

  return "min-h-[22px] px-2.5 text-[11px]";
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
        "inline-flex items-center gap-1.5 rounded-pill border font-semibold tracking-[-0.01em] whitespace-nowrap transition-colors",
        sizeClass(size),
        palette[variant] || palette.subtle,
        className
      )}
    >
      {dot ? (
        <span className={cx("h-1.5 w-1.5 rounded-full", palette.dot)} />
      ) : null}
      <span>{children}</span>
    </span>
  );
}