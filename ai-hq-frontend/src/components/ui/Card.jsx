// src/components/ui/Card.jsx
// ULTRA v7 — Editorial Premium Surface System
// ✅ calmer premium surfaces
// ✅ better fit for Settings / premium control pages
// ✅ variants: surface | subtle | elevated | plain
// ✅ restrained interactive motion
// ✅ tone accents preserved

import { cx } from "../../lib/cx.js";

function toneRing(tone) {
  switch (tone) {
    case "info":
      return "ring-1 ring-inset ring-sky-500/14 dark:ring-sky-400/14";
    case "success":
      return "ring-1 ring-inset ring-emerald-500/14 dark:ring-emerald-400/14";
    case "warn":
      return "ring-1 ring-inset ring-amber-500/16 dark:ring-amber-400/16";
    case "danger":
      return "ring-1 ring-inset ring-rose-500/14 dark:ring-rose-400/14";
    default:
      return "";
  }
}

function toneGlow(tone) {
  switch (tone) {
    case "info":
      return "bg-sky-500/10 dark:bg-sky-400/10";
    case "success":
      return "bg-emerald-500/10 dark:bg-emerald-400/10";
    case "warn":
      return "bg-amber-500/10 dark:bg-amber-400/10";
    case "danger":
      return "bg-rose-500/10 dark:bg-rose-400/10";
    default:
      return "bg-white/0";
  }
}

function toneTopAccent(tone) {
  switch (tone) {
    case "info":
      return "from-sky-400/42";
    case "success":
      return "from-emerald-400/42";
    case "warn":
      return "from-amber-400/42";
    case "danger":
      return "from-rose-400/42";
    default:
      return "from-white/0";
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
  const pad =
    padded === false
      ? "p-0"
      : padded === "sm"
      ? "p-3.5"
      : padded === "lg"
      ? "p-5 md:p-6"
      : "p-4 md:p-5";

  const base = cx(
    "relative min-w-0 rounded-[28px] border",
    clip ? "overflow-hidden" : "overflow-visible",
    "transition-[transform,box-shadow,border-color,background-color] duration-250",
    "focus-within:outline-none",
    pad
  );

  const surface = cx(
    "border-slate-200/75",
    "bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))]",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_18px_52px_rgba(15,23,42,0.08)]",
    "dark:border-white/10",
    "dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.78))]",
    "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_26px_72px_rgba(0,0,0,0.56)]"
  );

  const subtle = cx(
    "border-slate-200/65",
    "bg-[linear-gradient(180deg,rgba(248,250,252,0.94),rgba(241,245,249,0.88))]",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_10px_28px_rgba(15,23,42,0.05)]",
    "dark:border-white/8",
    "dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))]",
    "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_44px_rgba(0,0,0,0.34)]"
  );

  const elevated = cx(
    "border-slate-200/80",
    "bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))]",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.80),0_28px_90px_rgba(15,23,42,0.14)]",
    "dark:border-white/10",
    "dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.88))]",
    "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_36px_96px_rgba(0,0,0,0.70)]"
  );

  const plain = "border-transparent bg-transparent shadow-none";

  const variantClass =
    variant === "plain"
      ? plain
      : variant === "subtle"
      ? subtle
      : variant === "elevated"
      ? elevated
      : surface;

  const interactiveFx = interactive
    ? cx(
        "cursor-pointer",
        "hover:-translate-y-[2px]",
        "hover:border-slate-300/80 dark:hover:border-white/14",
        variant === "subtle" &&
          "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.74),0_16px_40px_rgba(15,23,42,0.08)] dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_56px_rgba(0,0,0,0.42)]",
        variant !== "subtle" &&
          "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_24px_72px_rgba(15,23,42,0.12)] dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_32px_82px_rgba(0,0,0,0.66)]"
      )
    : "";

  return (
    <div className={cx(base, variantClass, toneRing(tone), interactiveFx, className)}>
      {variant !== "plain" ? (
        <>
          <div
            aria-hidden="true"
            className={cx(
              "pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[28px] bg-gradient-to-r",
              toneTopAccent(tone),
              "via-white/50 to-transparent dark:via-white/12"
            )}
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(120%_100%_at_50%_0%,rgba(255,255,255,0.10),transparent_46%)] dark:bg-[radial-gradient(120%_100%_at_50%_0%,rgba(255,255,255,0.045),transparent_44%)]"
          />

          <div
            aria-hidden="true"
            className={cx(
              "pointer-events-none absolute -right-10 top-0 h-24 w-24 rounded-full blur-3xl",
              toneGlow(tone)
            )}
          />
        </>
      ) : null}

      <div className="relative z-10 min-w-0">{children}</div>
    </div>
  );
}