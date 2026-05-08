import { createElement, isValidElement } from "react";
import { cx } from "../../lib/cx.js";

const SIZE = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-[22px] w-[22px]",
};

const TONE = {
  default: "text-text-muted",
  muted: "text-text-muted",
  text: "text-text",
  brand: "text-brand",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export default function AppIcon({
  icon,
  size = "md",
  tone = "muted",
  strokeWidth = 2.1,
  className = "",
}) {
  if (!icon) return null;

  const iconClassName = cx(SIZE[size] || SIZE.md, TONE[tone] || TONE.muted, className);

  if (isValidElement(icon)) {
    return icon;
  }

  return createElement(icon, {
    className: iconClassName,
    strokeWidth,
    "aria-hidden": true,
  });
}
