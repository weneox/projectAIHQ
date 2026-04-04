import { ArrowRight, Circle } from "lucide-react";
import { cx } from "../../lib/cx.js";
import { getChannelStatusMeta } from "./channelCatalogModel.js";

const STATUS_STYLES = {
  success: {
    dot: "fill-emerald-500 text-emerald-500",
    text: "text-emerald-700",
  },
  info: {
    dot: "fill-brand text-brand",
    text: "text-brand",
  },
  warning: {
    dot: "fill-amber-500 text-amber-500",
    text: "text-amber-700",
  },
  neutral: {
    dot: "fill-slate-400 text-slate-400",
    text: "text-text-muted",
  },
};

export function ChannelStatus({ status, className }) {
  const meta = getChannelStatusMeta(status);
  const palette = STATUS_STYLES[meta.tone] || STATUS_STYLES.neutral;

  return (
    <div
      className={cx(
        "inline-flex items-center gap-1.5 text-[12px] font-medium tracking-[-0.01em]",
        palette.text,
        className
      )}
    >
      <Circle className={cx("h-2.5 w-2.5", palette.dot)} />
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
  ...props
}) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full text-[13px] font-semibold tracking-[-0.02em] transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-premium focus-visible:outline-none",
        quiet
          ? "h-10 border border-line/80 bg-white/80 px-4 text-text shadow-[0_10px_28px_-24px_rgba(15,23,42,0.55)] hover:border-line hover:bg-white"
          : "h-10 bg-text px-4.5 text-white shadow-[0_18px_36px_-24px_rgba(15,23,42,0.85)] hover:-translate-y-[1px] hover:bg-slate-900",
        className
      )}
      {...props}
    >
      <span>{children}</span>
      {showArrow ? <ArrowRight className="h-3.5 w-3.5" /> : null}
    </button>
  );
}

export function ChannelCapabilityLine({ capabilities = [], className }) {
  if (!capabilities.length) return null;

  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-x-2 text-[11px] font-medium uppercase tracking-[0.16em] text-text-subtle",
        className
      )}
    >
      {capabilities.map((item, index) => (
        <span key={`${item}-${index}`} className="inline-flex items-center gap-x-2">
          {index ? <span className="h-1 w-1 rounded-full bg-text-subtle" /> : null}
          <span>{item}</span>
        </span>
      ))}
    </div>
  );
}
