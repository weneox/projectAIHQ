import { cx } from "../../lib/cx.js";

export function appToneText(tone = "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "brand" || tone === "info") return "text-brand";
  return "text-text-muted";
}

export function appToneDot(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "brand" || tone === "info") return "bg-brand";
  return "bg-[rgb(var(--color-text-soft))]";
}

export default function AppStatusText({
  tone = "neutral",
  children,
  className = "",
  minWidth = "min-w-[82px]",
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 text-[12.5px] font-semibold",
        minWidth,
        appToneText(tone),
        className
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-md", appToneDot(tone))} />
      {children}
    </span>
  );
}
