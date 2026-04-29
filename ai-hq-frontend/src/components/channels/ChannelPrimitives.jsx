import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import { getChannelStatusMeta } from "./channelCatalogModel.js";

const STATUS_TONES = {
  success: "success",
  info: "brand",
  warning: "warning",
  neutral: "neutral",
  danger: "danger",
};

function dotClass(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "brand" || tone === "info") return "bg-brand";
  return "bg-[rgb(var(--color-text-soft))]";
}

export function ChannelStatus({ status, className }) {
  const meta = getChannelStatusMeta(status);
  const tone = STATUS_TONES[meta.tone] || "neutral";

  return (
    <Badge tone={tone} size="sm" className={className}>
      <span className={["h-1.5 w-1.5 rounded-full", dotClass(tone)].join(" ")} />
      {meta.label}
    </Badge>
  );
}

export function ChannelActionButton({
  children,
  className,
  quiet = false,
  showArrow: _showArrow = true,
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
      className={className}
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
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      {...props}
    >
      {children}
    </Button>
  );
}

export function ChannelCapabilityLine({ capabilities = [], className }) {
  if (!capabilities.length) return null;

  const label = capabilities.slice(0, 3).join(" · ");

  return (
    <div
      title={label}
      className={[
        "truncate text-[12.5px] font-medium leading-5 text-text-muted",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label}
    </div>
  );
}