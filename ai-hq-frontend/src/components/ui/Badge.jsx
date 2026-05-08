import { cx } from "../../lib/cx.js";

function toneClass(tone = "neutral") {
  if (tone === "brand" || tone === "info" || tone === "accent") {
    return "ui-badge--brand";
  }

  if (tone === "success") return "ui-badge--success";
  if (tone === "warning" || tone === "warn") return "ui-badge--warning";
  if (tone === "danger" || tone === "error") return "ui-badge--danger";

  return "ui-badge--neutral";
}

function sizeClass(size = "md") {
  return size === "sm" ? "ui-badge--sm" : "ui-badge--md";
}

export default function Badge({
  className,
  children,
  tone = "neutral",
  icon = null,
  size = "md",
  ...props
}) {
  return (
    <span
      className={cx("ui-badge", sizeClass(size), toneClass(tone), className)}
      {...props}
    >
      {icon ? <span className="ui-badge__icon">{icon}</span> : null}
      <span className="ui-badge__content">{children}</span>
    </span>
  );
}