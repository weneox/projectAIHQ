import { ArrowRight, ArrowUpRight } from "lucide-react";
import { cx } from "../../lib/cx.js";
import Button from "../ui/Button.jsx";
import { getChannelStatusMeta } from "./channelCatalogModel.js";

const STATUS_TONES = {
  success: "text-[#264ca5]",
  info: "text-[#264ca5]",
  warning: "text-[#667085]",
  neutral: "text-[#667085]",
};

export function ChannelStatus({ status, className }) {
  const meta = getChannelStatusMeta(status);

  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 text-[12px] font-semibold tracking-[-0.01em]",
        STATUS_TONES[meta.tone] || STATUS_TONES.info,
        className
      )}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-current opacity-95"
      />
      <span>{meta.label}</span>
    </span>
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
    <Button
      type={type}
      aria-label={ariaLabel}
      variant={quiet ? "secondary" : "primary"}
      size="sm"
      fullWidth={fullWidth}
      rightIcon={showArrow ? <ArrowRight className="h-4 w-4" strokeWidth={2.3} /> : undefined}
      className={cx(
        "!h-[34px] !rounded-[8px] !px-3.5 !text-[10px] !font-bold !uppercase !tracking-[0.12em] !shadow-none transition duration-fast ease-premium",
        fullWidth && "!justify-between",
        quiet
          ? "!border-line !bg-white !text-[#667085] hover:!border-line-strong hover:!bg-surface-muted hover:!text-[#101828]"
          : "!border-0 !bg-[linear-gradient(180deg,#355ebc_0%,#264ca5_100%)] !text-white hover:-translate-y-[1px] hover:shadow-[0_10px_20px_-12px_rgba(38,76,165,0.38)]",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
}

export function ChannelInspectButton({
  className,
  children = "Details",
  ...props
}) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center gap-2 px-0 text-[10px] font-bold uppercase tracking-[0.11em] text-[#667085] transition duration-fast ease-premium hover:text-[#101828]",
        className
      )}
      {...props}
    >
      <span>{children}</span>
      <ArrowUpRight className="h-[15px] w-[15px] shrink-0" strokeWidth={2.35} />
    </button>
  );
}

export function ChannelCapabilityLine({ capabilities = [], className }) {
  if (!capabilities.length) return null;

  const label = capabilities.join(" · ");

  return (
    <div
      title={label}
      className={cx(
        "truncate text-[11px] font-bold uppercase tracking-[0.09em] text-[#667085]",
        className
      )}
    >
      {label}
    </div>
  );
}