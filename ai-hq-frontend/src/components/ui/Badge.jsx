import { cx } from "../../lib/cx.js";

const TONES = {
  neutral: {
    solid: "border-text bg-text text-white",
    subtle: "border-line bg-surface-muted text-text-muted",
    outline: "border-line text-text-muted",
    dot: "bg-text-subtle",
  },
  success: {
    solid: "border-success bg-success text-white",
    subtle: "border-success/20 bg-success/10 text-success",
    outline: "border-success/20 text-success",
    dot: "bg-success",
  },
  warn: {
    solid: "border-warning bg-warning text-white",
    subtle: "border-warning/20 bg-warning/10 text-warning",
    outline: "border-warning/20 text-warning",
    dot: "bg-warning",
  },
  danger: {
    solid: "border-danger bg-danger text-white",
    subtle: "border-danger/20 bg-danger/10 text-danger",
    outline: "border-danger/20 text-danger",
    dot: "bg-danger",
  },
  info: {
    solid: "border-brand bg-brand text-white",
    subtle: "border-brand/20 bg-brand/10 text-brand",
    outline: "border-brand/20 text-brand",
    dot: "bg-brand",
  },
};

function tonePack(tone = "neutral") {
  return TONES[tone] || TONES.neutral;
}

export default function Badge({
  tone = "neutral",
  variant = "subtle",
  size = "sm",
  dot = false,
  className,
  children,
}) {
  const p = tonePack(tone);

  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-pill border font-semibold tracking-[-0.01em]",
        size === "md" ? "min-h-[30px] px-3 text-[12px]" : "min-h-[26px] px-2.5 text-[11px]",
        p[variant] || p.subtle,
        className
      )}
    >
      {dot ? <span className={cx("h-1.5 w-1.5 rounded-full", p.dot)} /> : null}
      <span>{children}</span>
    </span>
  );
}
