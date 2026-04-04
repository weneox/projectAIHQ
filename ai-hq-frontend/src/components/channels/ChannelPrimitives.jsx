import { ArrowRight } from "lucide-react";
import { cx } from "../../lib/cx.js";
import { getChannelStatusMeta } from "./channelCatalogModel.js";

const STATUS_STYLES = {
  success: {
    dot: "bg-emerald-500",
    pill: "border-emerald-500/16 bg-emerald-500/[0.06] text-emerald-700",
  },
  info: {
    dot: "bg-[#2563eb]",
    pill: "border-[#2563eb]/16 bg-[#2563eb]/[0.06] text-[#2563eb]",
  },
  warning: {
    dot: "bg-amber-500",
    pill: "border-amber-500/16 bg-amber-500/[0.07] text-amber-700",
  },
  neutral: {
    dot: "bg-slate-400",
    pill: "border-black/[0.08] bg-black/[0.03] text-text-muted",
  },
};

export function ChannelStatus({ status, className }) {
  const meta = getChannelStatusMeta(status);
  const palette = STATUS_STYLES[meta.tone] || STATUS_STYLES.neutral;

  return (
    <div
      className={cx(
        "inline-flex h-8 items-center gap-2 rounded-[8px] border px-3 text-[10px] font-semibold uppercase tracking-[0.18em]",
        palette.pill,
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cx("h-1.5 w-1.5 shrink-0 rounded-full", palette.dot)}
      />
      <span>{meta.label}</span>
    </div>
  );
}

export function ChannelActionButton({
  children,
  className,
  quiet = false,
  showArrow = true,
  type = "button",
  ariaLabel,
  fullWidth = false,
  ...props
}) {
  return (
    <button
      type={type}
      aria-label={ariaLabel}
      className={cx(
        "relative inline-flex items-center justify-center gap-2.5 whitespace-nowrap border text-[13px] font-semibold tracking-[-0.02em] transition-all duration-200 ease-premium focus-visible:outline-none focus-visible:ring-4",
        fullWidth && "w-full",
        quiet
          ? [
              "h-10 rounded-[8px] border-black/[0.08] bg-white px-4 text-text",
              "shadow-[0_10px_24px_-22px_rgba(15,23,42,0.22)]",
              "hover:border-black/[0.14] hover:bg-black/[0.02]",
              "focus-visible:ring-black/5",
            ]
          : [
              "h-11 overflow-hidden rounded-[8px] border-[#1f5eff] px-4 text-white",
              "bg-[linear-gradient(180deg,#3f7cff_0%,#2563eb_100%)]",
              "shadow-[0_14px_28px_-18px_rgba(37,99,235,0.38)]",
              "hover:-translate-y-[1px] hover:border-[#1c55da] hover:bg-[linear-gradient(180deg,#4b84ff_0%,#1f5eff_100%)]",
              "hover:shadow-[0_18px_30px_-16px_rgba(37,99,235,0.44)]",
              "focus-visible:ring-[#2563eb]/14",
              "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:bg-[linear-gradient(180deg,rgba(255,255,255,0.16),transparent)]",
            ],
        className
      )}
      {...props}
    >
      <span className="relative z-[1]">{children}</span>
      {showArrow ? (
        <ArrowRight className="relative z-[1] h-3.5 w-3.5 shrink-0 opacity-90" />
      ) : null}
    </button>
  );
}

export function ChannelCapabilityLine({ capabilities = [], className }) {
  if (!capabilities.length) return null;

  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-text-subtle",
        className
      )}
    >
      {capabilities.map((item, index) => (
        <span
          key={`${item}-${index}`}
          className="inline-flex h-7 items-center rounded-[7px] border border-black/[0.07] bg-black/[0.025] px-2.5"
        >
          {item}
        </span>
      ))}
    </div>
  );
}