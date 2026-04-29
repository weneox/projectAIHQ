import { cx } from "../../lib/cx.js";

function paddedClass(padded = "md") {
  if (padded === false) return "ui-card--padded-none";
  if (padded === "xs") return "ui-card--padded-xs";
  if (padded === "sm") return "ui-card--padded-sm";
  if (padded === "lg") return "ui-card--padded-lg";
  if (padded === "xl") return "ui-card--padded-xl";
  return "ui-card--padded-md";
}

function variantClass(variant = "surface") {
  if (variant === "plain") return "ui-card--plain";
  if (variant === "subtle") return "ui-card--subtle";
  if (variant === "elevated") return "ui-card--elevated";
  return "ui-card--surface";
}

function toneClass(tone = "neutral") {
  if (tone === "info" || tone === "brand" || tone === "accent") {
    return "ui-card--tone-brand";
  }

  if (tone === "success") return "ui-card--tone-success";
  if (tone === "warn" || tone === "warning") return "ui-card--tone-warning";
  if (tone === "danger") return "ui-card--tone-danger";

  return "";
}

export default function Card({
  className,
  outerClassName,
  innerClassName,
  children,
  variant = "surface",
  interactive = false,
  padded = "md",
  clip = false,
  tone = "neutral",
}) {
  return (
    <div
      className={cx(
        "ui-card",
        variantClass(variant),
        toneClass(tone),
        interactive && "ui-card--interactive",
        outerClassName
      )}
    >
      <div
        className={cx(
          "ui-card__inner",
          clip ? "ui-card__inner--clip" : "ui-card__inner--open",
          paddedClass(padded),
          className,
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}