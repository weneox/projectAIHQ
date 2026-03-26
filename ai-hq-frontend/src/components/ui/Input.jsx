// src/components/ui/Input.jsx
// ULTRA v6 — Editorial Premium Input
// ✅ calmer premium field surface
// ✅ better fit for Settings / forms / control pages
// ✅ stronger readOnly + disabled states
// ✅ compatible with existing Input and InputGroup usage

import { forwardRef } from "react";
import { cx } from "../../lib/cx.js";

function XIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cx("h-4 w-4", className)}
      aria-hidden="true"
    >
      <path
        d="M18 6L6 18M6 6l12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Surface({
  children,
  className,
  disabled = false,
  readOnly = false,
  invalid = false,
}) {
  return (
    <div
      className={cx(
        "relative w-full min-w-0 overflow-hidden rounded-[22px] border",
        "transition-[border-color,box-shadow,background-color,transform] duration-200",
        "focus-within:outline-none",
        invalid
          ? "border-rose-300/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(254,242,242,0.88))] shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_12px_30px_rgba(244,63,94,0.08)] dark:border-rose-400/30 dark:bg-[linear-gradient(180deg,rgba(127,29,29,0.18),rgba(15,23,42,0.82))]"
          : readOnly
          ? "border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.90))] shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_8px_20px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))]"
          : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_12px_32px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.80))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_44px_rgba(0,0,0,0.46)]",
        !disabled &&
          !readOnly &&
          !invalid &&
          "focus-within:border-sky-300/90 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_0_0_4px_rgba(56,189,248,0.08),0_16px_38px_rgba(15,23,42,0.08)] dark:focus-within:border-sky-400/30 dark:focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_4px_rgba(56,189,248,0.10),0_18px_46px_rgba(0,0,0,0.52)]",
        disabled ? "opacity-55" : "",
        className
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.20),transparent_44%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_38%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/10"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

export function InputGroup({
  className,
  inputClassName,
  leftIcon,
  right,
  onClear,
  value,
  placeholder,
  disabled,
  readOnly,
  invalid = false,
  ...props
}) {
  const showClear =
    typeof onClear === "function" &&
    !disabled &&
    !readOnly &&
    String(value ?? "").length > 0;

  return (
    <div className="relative w-full min-w-0">
      <Surface
        className={className}
        disabled={disabled}
        readOnly={readOnly}
        invalid={invalid}
      >
        <div className="flex h-12 items-center gap-2.5 px-3.5">
          {leftIcon ? (
            <span
              className={cx(
                "shrink-0 transition-colors",
                readOnly
                  ? "text-slate-400 dark:text-slate-500"
                  : "text-slate-400 dark:text-slate-500"
              )}
            >
              {leftIcon}
            </span>
          ) : null}

          <input
            value={value}
            disabled={disabled}
            readOnly={readOnly}
            placeholder={placeholder}
            className={cx(
              "min-w-0 w-full bg-transparent text-[14px] outline-none",
              "placeholder:text-slate-400 dark:placeholder:text-slate-500",
              readOnly
                ? "text-slate-600 dark:text-slate-300"
                : "text-slate-900 dark:text-slate-100",
              disabled ? "cursor-not-allowed" : "",
              inputClassName
            )}
            {...props}
          />

          {showClear ? (
            <button
              type="button"
              onClick={onClear}
              className={cx(
                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px]",
                "text-slate-500 transition-[background-color,color,box-shadow] duration-200",
                "hover:bg-slate-100 hover:text-slate-800",
                "dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/16"
              )}
              aria-label="Clear"
              title="Clear"
            >
              <XIcon />
            </button>
          ) : null}

          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      </Surface>
    </div>
  );
}

const Input = forwardRef(function Input({
  className,
  inputClassName,
  disabled,
  readOnly,
  invalid = false,
  leftIcon,
  right,
  ...props
}, ref) {
  return (
    <div className="relative w-full min-w-0">
      <Surface
        className={className}
        disabled={disabled}
        readOnly={readOnly}
        invalid={invalid}
      >
        <div className="flex h-12 items-center gap-2.5 px-3.5">
          {leftIcon ? (
            <span
              className={cx(
                "shrink-0 transition-colors",
                readOnly
                  ? "text-slate-400 dark:text-slate-500"
                  : "text-slate-400 dark:text-slate-500"
              )}
            >
              {leftIcon}
            </span>
          ) : null}

          <input
            ref={ref}
            disabled={disabled}
            readOnly={readOnly}
            className={cx(
              "min-w-0 w-full bg-transparent text-[14px] outline-none",
              "placeholder:text-slate-400 dark:placeholder:text-slate-500",
              readOnly
                ? "text-slate-600 dark:text-slate-300"
                : "text-slate-900 dark:text-slate-100",
              disabled ? "cursor-not-allowed" : "",
              inputClassName
            )}
            {...props}
          />

          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      </Surface>
    </div>
  );
});

export default Input;
