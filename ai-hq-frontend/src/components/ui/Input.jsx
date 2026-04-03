import { forwardRef } from "react";
import { ChevronDown, X } from "lucide-react";
import { cx } from "../../lib/cx.js";

function surfaceClass({ disabled, readOnly, invalid }) {
  if (disabled) {
    return "border-line-soft bg-surface-subtle text-text-subtle opacity-70";
  }
  if (invalid) {
    return "border-danger/35 bg-surface";
  }
  if (readOnly) {
    return "border-line-soft bg-surface-muted";
  }
  return "border-line bg-surface hover:border-line-strong focus-within:border-brand focus-within:shadow-[var(--focus-ring)]";
}

function FieldShell({
  children,
  className,
  disabled = false,
  readOnly = false,
  invalid = false,
}) {
  return (
    <div
      className={cx(
        "relative w-full overflow-hidden rounded-panel border transition-[border-color,background-color,box-shadow] duration-base ease-premium",
        surfaceClass({ disabled, readOnly, invalid }),
        className
      )}
    >
      {children}
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
    <FieldShell
      className={className}
      disabled={disabled}
      readOnly={readOnly}
      invalid={invalid}
    >
      <div className="flex min-h-[46px] items-center gap-2 px-3.5">
        {leftIcon ? <span className="text-text-subtle">{leftIcon}</span> : null}

        <input
          value={value}
          disabled={disabled}
          readOnly={readOnly}
          placeholder={placeholder}
          className={cx(
            "h-11 w-full border-0 bg-transparent p-0 text-[14px] text-text outline-none placeholder:text-text-subtle",
            disabled && "cursor-not-allowed",
            inputClassName
          )}
          {...props}
        />

        {showClear ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-8 w-8 items-center justify-center rounded-soft text-text-subtle transition-[background-color,color] duration-fast ease-premium hover:bg-surface-muted hover:text-text"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </FieldShell>
  );
}

const Input = forwardRef(function Input(
  { className, inputClassName, disabled, readOnly, invalid = false, leftIcon, right, ...props },
  ref
) {
  return (
    <FieldShell
      className={className}
      disabled={disabled}
      readOnly={readOnly}
      invalid={invalid}
    >
      <div className="flex min-h-[46px] items-center gap-2 px-3.5">
        {leftIcon ? <span className="text-text-subtle">{leftIcon}</span> : null}
        <input
          ref={ref}
          disabled={disabled}
          readOnly={readOnly}
          className={cx(
            "h-11 w-full border-0 bg-transparent p-0 text-[14px] text-text outline-none placeholder:text-text-subtle",
            disabled && "cursor-not-allowed",
            inputClassName
          )}
          {...props}
        />
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </FieldShell>
  );
});

export default Input;

export const Textarea = forwardRef(function Textarea(
  { className, textClassName, disabled, readOnly, invalid = false, rows = 5, ...props },
  ref
) {
  return (
    <FieldShell
      className={className}
      disabled={disabled}
      readOnly={readOnly}
      invalid={invalid}
    >
      <div className="px-4 py-3">
        <textarea
          ref={ref}
          rows={rows}
          disabled={disabled}
          readOnly={readOnly}
          className={cx(
            "min-h-[140px] w-full resize-none border-0 bg-transparent p-0 text-[14px] leading-7 text-text outline-none placeholder:text-text-subtle",
            disabled && "cursor-not-allowed",
            textClassName
          )}
          {...props}
        />
      </div>
    </FieldShell>
  );
});

export const Select = forwardRef(function Select(
  { className, selectClassName, disabled, readOnly, invalid = false, children, ...props },
  ref
) {
  return (
    <FieldShell
      className={className}
      disabled={disabled}
      readOnly={readOnly}
      invalid={invalid}
    >
      <div className="relative px-3.5">
        <select
          ref={ref}
          disabled={disabled || readOnly}
          className={cx(
            "h-11 w-full appearance-none border-0 bg-transparent p-0 pr-8 text-[14px] text-text outline-none",
            (disabled || readOnly) && "cursor-not-allowed",
            selectClassName
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
      </div>
    </FieldShell>
  );
});
