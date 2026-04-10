import { cx } from "../../lib/cx.js";

function paddingClass(padded = "md") {
  if (padded === false) return "p-0";
  if (padded === "sm") return "p-4";
  if (padded === "lg") return "p-6";
  if (padded === "xl") return "p-7";
  return "p-5";
}

function toneClass(tone = "neutral") {
  if (tone === "info") {
    return "border-[rgba(var(--color-brand),0.14)]";
  }

  if (tone === "success") {
    return "border-[rgba(var(--color-success),0.14)]";
  }

  if (tone === "warn" || tone === "warning") {
    return "border-[rgba(var(--color-warning),0.16)]";
  }

  if (tone === "danger") {
    return "border-[rgba(var(--color-danger),0.14)]";
  }

  return "border-line-soft";
}

function variantClass(variant = "surface") {
  switch (variant) {
    case "plain":
      return "border-transparent bg-transparent shadow-none";

    case "subtle":
      return "bg-surface-muted shadow-none";

    case "elevated":
      return "bg-surface shadow-panel";

    case "surface":
    default:
      return "bg-surface shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]";
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
        "min-w-0 rounded-panel border transition-[border-color,background-color,box-shadow,transform] duration-base ease-premium",
        clip ? "overflow-hidden" : "overflow-visible",
        paddingClass(padded),
        toneClass(tone),
        variantClass(variant),
        interactive &&
          "cursor-pointer hover:-translate-y-[1px] hover:border-line hover:shadow-panel",
        className
      )}
    >
      {children}
    </div>
  );
}