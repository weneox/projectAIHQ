import { cx } from "../../lib/cx.js";

function paddingClass(padded = "md") {
  if (padded === false) return "p-0";
  if (padded === "xs") return "p-3";
  if (padded === "sm") return "p-4";
  if (padded === "lg") return "p-6";
  if (padded === "xl") return "p-7";
  return "p-5";
}

function toneClass(tone = "neutral") {
  if (tone === "info" || tone === "brand" || tone === "accent") {
    return "border-[rgba(var(--color-brand),0.18)]";
  }

  if (tone === "success") {
    return "border-[rgba(var(--color-success),0.2)]";
  }

  if (tone === "warn" || tone === "warning") {
    return "border-[rgba(var(--color-warning),0.22)]";
  }

  if (tone === "danger") {
    return "border-[rgba(var(--color-danger),0.2)]";
  }

  return "border-line-soft";
}

function variantClass(variant = "surface") {
  switch (variant) {
    case "plain":
      return "border-transparent bg-transparent shadow-none";

    case "subtle":
      return [
        "bg-surface-muted",
        "shadow-[0_1px_0_rgba(255,255,255,0.86)_inset]",
      ].join(" ");

    case "elevated":
      return [
        "bg-surface",
        "shadow-[0_28px_68px_-50px_rgba(15,23,42,0.28),0_1px_0_rgba(255,255,255,0.96)_inset]",
      ].join(" ");

    case "surface":
    default:
      return [
        "bg-surface",
        "shadow-[0_1px_0_rgba(255,255,255,0.96)_inset,0_18px_46px_-40px_rgba(15,23,42,0.26)]",
      ].join(" ");
  }
}

export default function Card({
  className,
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
        "min-w-0 rounded-panel border transition-[border-color,background-color,box-shadow] duration-base ease-premium",
        clip ? "overflow-hidden" : "overflow-visible",
        paddingClass(padded),
        toneClass(tone),
        variantClass(variant),
        interactive &&
          "cursor-pointer hover:border-line hover:shadow-[0_24px_60px_-46px_rgba(15,23,42,0.3),0_1px_0_rgba(255,255,255,0.96)_inset]",
        className
      )}
    >
      {children}
    </div>
  );
}
