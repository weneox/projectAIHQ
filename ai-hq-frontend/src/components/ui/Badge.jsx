// src/components/ui/Badge.jsx
// ULTRA v4 — Editorial Premium Badge

import { cx } from "../../lib/cx.js";

const TONES = {
  neutral: {
    solid:
      "border-slate-900/90 bg-slate-950 text-white dark:border-slate-100/80 dark:bg-slate-100 dark:text-slate-950",
    subtle:
      "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.025))] dark:text-slate-200 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
    outline:
      "border-slate-300/90 bg-transparent text-slate-700 dark:border-white/14 dark:text-slate-200",
    dot: "bg-slate-400 dark:bg-slate-500",
  },
  success: {
    solid:
      "border-emerald-600/90 bg-emerald-600 text-white dark:border-emerald-400/70 dark:bg-emerald-400 dark:text-slate-950",
    subtle:
      "border-emerald-200/90 bg-emerald-50/90 text-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-emerald-400/18 dark:bg-emerald-400/10 dark:text-emerald-200 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
    outline:
      "border-emerald-300 bg-transparent text-emerald-800 dark:border-emerald-400/24 dark:text-emerald-200",
    dot: "bg-emerald-500",
  },
  warn: {
    solid:
      "border-amber-500/90 bg-amber-500 text-slate-950 dark:border-amber-400/70 dark:bg-amber-400 dark:text-slate-950",
    subtle:
      "border-amber-200/90 bg-amber-50/90 text-amber-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-amber-400/18 dark:bg-amber-400/10 dark:text-amber-200 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
    outline:
      "border-amber-300 bg-transparent text-amber-900 dark:border-amber-400/24 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  danger: {
    solid:
      "border-rose-600/90 bg-rose-600 text-white dark:border-rose-400/70 dark:bg-rose-400 dark:text-slate-950",
    subtle:
      "border-rose-200/90 bg-rose-50/90 text-rose-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-rose-400/18 dark:bg-rose-400/10 dark:text-rose-200 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
    outline:
      "border-rose-300 bg-transparent text-rose-800 dark:border-rose-400/24 dark:text-rose-200",
    dot: "bg-rose-500",
  },
  info: {
    solid:
      "border-sky-600/90 bg-sky-600 text-white dark:border-sky-400/70 dark:bg-sky-400 dark:text-slate-950",
    subtle:
      "border-sky-200/90 bg-sky-50/90 text-sky-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-sky-400/18 dark:bg-sky-400/10 dark:text-sky-200 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
    outline:
      "border-sky-300 bg-transparent text-sky-800 dark:border-sky-400/24 dark:text-sky-200",
    dot: "bg-sky-500",
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

  const sizeCls =
    size === "md"
      ? "h-7 rounded-[14px] px-2.5 text-[12px]"
      : "h-6 rounded-[12px] px-2.25 text-[11px]";

  return (
    <span
      className={cx(
        "relative inline-flex items-center gap-2 border",
        "select-none whitespace-nowrap",
        "font-semibold leading-none tracking-[-0.01em]",
        "transition-[background-color,border-color,color,box-shadow] duration-200",
        sizeCls,
        p[variant] || p.subtle,
        className
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cx(
            "h-1.5 w-1.5 rounded-full",
            p.dot,
            "shadow-[0_0_0_2px_rgba(255,255,255,0.76)] dark:shadow-[0_0_0_2px_rgba(2,6,23,0.76)]"
          )}
        />
      ) : null}

      <span className="relative top-[0.25px]">{children}</span>
    </span>
  );
}