import * as React from "react";
import { motion } from "framer-motion";
import { cx } from "../../lib/cx.js";

function Spinner({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cx("h-4 w-4 animate-spin", className)}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="opacity-20"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="opacity-90"
      />
    </svg>
  );
}

const SIZE = {
  sm: "h-9 rounded-xl px-3.5 text-sm",
  md: "h-10 rounded-xl px-4 text-sm",
  lg: "h-11 rounded-2xl px-5 text-sm",
  icon: "h-10 w-10 rounded-xl px-0",
};

function variantClass(variant) {
  switch (variant) {
    case "primary":
      return "bg-cyan-400 text-slate-950 hover:brightness-110";
    case "secondary":
      return "bg-slate-800 text-white hover:bg-slate-700";
    case "outline":
      return "bg-slate-900/70 text-slate-200 hover:bg-slate-800 border border-slate-700";
    case "ghost":
      return "bg-transparent text-slate-300 hover:bg-white/5 hover:text-white";
    case "destructive":
      return "bg-rose-600 text-white hover:bg-rose-500";
    default:
      return "bg-slate-800 text-white hover:bg-slate-700";
  }
}

const Button = React.forwardRef(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    isLoading = false,
    leftIcon,
    rightIcon,
    disabled,
    children,
    type = "button",
    ...props
  },
  ref
) {
  const isDisabled = Boolean(disabled || isLoading);

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      whileHover={isDisabled ? undefined : { y: -1 }}
      whileTap={isDisabled ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className={cx(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "focus:outline-none focus:ring-2 focus:ring-cyan-400/30",
        "whitespace-nowrap",
        SIZE[size] || SIZE.md,
        variantClass(variant),
        className
      )}
      {...props}
    >
      {isLoading ? <Spinner /> : leftIcon ? leftIcon : null}
      {children ? <span>{children}</span> : null}
      {!isLoading && rightIcon ? rightIcon : null}
    </motion.button>
  );
});

export default Button;