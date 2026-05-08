import { cn } from "./proposal-utils.js";

function ToneBadge({ tone = "neutral", children, className = "" }) {
  const map = {
    neutral:
      "border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.025))] text-white/68",
    success:
      "border-emerald-400/18 bg-[linear-gradient(180deg,rgba(16,185,129,0.14),rgba(16,185,129,0.07))] text-emerald-100/92",
    warn:
      "border-amber-400/18 bg-[linear-gradient(180deg,rgba(245,158,11,0.14),rgba(245,158,11,0.07))] text-amber-100/92",
    danger:
      "border-rose-400/18 bg-[linear-gradient(180deg,rgba(244,63,94,0.14),rgba(244,63,94,0.07))] text-rose-100/92",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[-0.01em]",
        "transition-[background,border-color,color] duration-200",
        map[tone] || map.neutral,
        className
      )}
    >
      {children}
    </span>
  );
}

function GlassButton({
  children,
  className = "",
  variant = "default",
  size = "md",
  disabled,
  ...props
}) {
  const variants = {
    default:
      "border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.03))] text-white/80 hover:border-white/[0.12] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.04))] hover:text-white",
    primary:
      "border-cyan-300/18 bg-[linear-gradient(180deg,rgba(34,211,238,0.16),rgba(34,211,238,0.08))] text-cyan-50 hover:border-cyan-300/26 hover:bg-[linear-gradient(180deg,rgba(34,211,238,0.22),rgba(34,211,238,0.10))]",
    danger:
      "border-rose-300/18 bg-[linear-gradient(180deg,rgba(244,63,94,0.16),rgba(244,63,94,0.08))] text-rose-50 hover:border-rose-300/26 hover:bg-[linear-gradient(180deg,rgba(244,63,94,0.22),rgba(244,63,94,0.10))]",
  };

  const sizes = {
    sm: "h-9 rounded-[14px] px-3 text-[11px]",
    md: "h-10 rounded-[16px] px-3.5 text-[12px]",
    lg: "h-11 rounded-[18px] px-4 text-[12px]",
  };

  return (
    <button
      {...props}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 border font-medium",
        "transition-[background,border-color,color,transform,opacity] duration-200 ease-out",
        "shadow-[0_10px_24px_rgba(0,0,0,0.14)]",
        variants[variant] || variants.default,
        sizes[size] || sizes.md,
        disabled && "cursor-not-allowed opacity-45 hover:bg-inherit hover:text-inherit",
        className
      )}
    >
      {children}
    </button>
  );
}

function SurfacePill({ children, className = "" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-white/[0.055] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))] px-2.5 py-1 text-[11px] text-white/54",
        "transition-[background,border-color,color] duration-200",
        className
      )}
    >
      {children}
    </span>
  );
}

export { ToneBadge, GlassButton, SurfacePill };