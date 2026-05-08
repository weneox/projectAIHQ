import { createElement, isValidElement } from "react";
import { cx } from "../../lib/cx.js";

const SIZE = {
  sm: "h-8 w-8 text-[11.5px]",
  md: "h-9 w-9 text-[12.5px]",
  lg: "h-10 w-10 text-[13px]",
};

const TONE = {
  brand: "text-brand",
  muted: "text-text-muted",
  text: "text-text",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export default function AppIdentityMark({
  children,
  label = "",
  icon,
  size = "md",
  tone = "brand",
  className = "",
}) {
  const body = icon
    ? isValidElement(icon)
      ? icon
      : createElement(icon, {
          className: "h-[22px] w-[22px]",
          strokeWidth: 2.05,
          "aria-hidden": true,
        })
    : children || label || "•";

  return (
    <span
      className={cx(
        "flex shrink-0 items-center justify-center rounded-md border border-line-soft bg-surface-subtle font-semibold tracking-[var(--tracking-tight-lg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]",
        SIZE[size] || SIZE.md,
        TONE[tone] || TONE.brand,
        className
      )}
    >
      {body}
    </span>
  );
}
