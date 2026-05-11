import { Check } from "lucide-react";

import { cx } from "../../lib/cx.js";

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

export function AppPageField({ label, children }) {
  return (
    <label className="grid gap-2">
      <span className="text-[12px] font-semibold text-text-muted">{label}</span>
      {children}
    </label>
  );
}

export function AppPageInput({
  value,
  onChange,
  placeholder = "",
  disabled = false,
  autoComplete = "new-password",
  name = "",
  type = "text",
}) {
  return (
    <div className="team-soft-control flex h-11 items-center rounded-md bg-white px-3.5 transition-[background-color,box-shadow] duration-150 ease-premium">
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        name={name || undefined}
        className="h-full min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-[13.5px] font-semibold text-text outline-none ring-0 shadow-none placeholder:text-text-subtle disabled:cursor-not-allowed focus:border-0 focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none"
      />
    </div>
  );
}


export function AppPageSelect({
  value,
  onChange,
  disabled = false,
  children,
  name = "",
}) {
  return (
    <div className="team-soft-control flex h-11 items-center rounded-md bg-white px-3.5 transition-[background-color,box-shadow] duration-150 ease-premium">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        name={name || undefined}
        className="h-full min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-[13.5px] font-semibold text-text outline-none ring-0 shadow-none disabled:cursor-not-allowed focus:border-0 focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none"
      >
        {children}
      </select>
    </div>
  );
}

export function AppPageTextarea({
  value,
  onChange,
  placeholder = "",
  disabled = false,
  name = "",
  rows = 4,
}) {
  return (
    <div className="team-soft-control rounded-md bg-white px-3.5 py-3 transition-[background-color,box-shadow] duration-150 ease-premium">
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        name={name || undefined}
        rows={rows}
        autoComplete="new-password"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        className="min-h-[92px] w-full resize-none appearance-none border-0 bg-transparent p-0 text-[13.5px] font-semibold leading-5 text-text outline-none ring-0 shadow-none placeholder:text-text-subtle disabled:cursor-not-allowed focus:border-0 focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none"
      />
    </div>
  );
}
export function AppChoiceButton({ selected, disabled = false, children, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "flex h-10 min-w-0 items-center justify-between gap-2 rounded-md px-3 text-left text-[13px] font-semibold transition-[background-color,box-shadow,color] duration-150 ease-premium disabled:cursor-not-allowed disabled:opacity-55",
        selected
          ? "bg-brand/5 text-brand shadow-[inset_0_0_0_2px_rgba(37,99,235,0.24),inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(37,99,235,0.08)]"
          : "bg-[rgb(var(--color-surface-subtle))] text-text-muted shadow-[inset_0_0_0_1px_rgba(203,213,225,0.86),inset_0_1px_0_rgba(255,255,255,0.76),0_1px_2px_rgba(15,23,42,0.035)] hover:bg-white hover:text-text hover:shadow-[inset_0_0_0_1px_rgba(148,163,184,0.72),inset_0_1px_0_rgba(255,255,255,0.9),0_2px_6px_rgba(15,23,42,0.04)]"
      )}
    >
      <span className="min-w-0 truncate whitespace-nowrap">{children}</span>
      {selected ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-brand" strokeWidth={2.45} />
      ) : null}
    </button>
  );
}

export function AppChoiceGroup({
  label,
  value,
  options,
  disabled = false,
  onChange,
}) {
  return (
    <div className="grid gap-2">
      <span className="text-[12px] font-semibold text-text-muted">{label}</span>
      <div className="grid gap-2 sm:grid-cols-2">
        {arr(options).map((option) => (
          <AppChoiceButton
            key={option.value}
            selected={value === option.value}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </AppChoiceButton>
        ))}
      </div>
    </div>
  );
}
