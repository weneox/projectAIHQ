import { cx } from "../../lib/cx.js";

export function AppSwitch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange?.(!checked)}
      className={cx(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-[background-color,border-color,box-shadow] duration-150 ease-premium",
        checked
          ? "border-brand bg-brand shadow-[0_8px_20px_-14px_rgba(37,99,235,0.85)]"
          : "border-line bg-surface-subtle"
      )}
    >
      <span
        className={cx(
          "block h-4.5 w-4.5 rounded-full bg-white shadow-[0_2px_8px_-4px_rgba(15,23,42,0.55)] transition-transform duration-150 ease-premium",
          checked ? "translate-x-5" : "translate-x-1"
        )}
      />
    </button>
  );
}

export function AppTextInput({
  value,
  onChange,
  placeholder = "",
  type = "text",
  disabled = false,
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={placeholder}
      className="h-11 w-full rounded-md border border-line bg-white px-3.5 text-[13.5px] font-semibold text-text outline-none transition-[border-color,box-shadow] duration-base ease-premium placeholder:text-text-subtle disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-text-muted focus:border-brand focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
    />
  );
}

export function AppTextArea({
  value,
  onChange,
  placeholder = "",
  rows = 4,
  disabled = false,
}) {
  return (
    <textarea
      value={value}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="min-h-[112px] w-full resize-y rounded-md border border-line bg-white px-3.5 py-3 text-[13.5px] font-semibold leading-6 text-text outline-none transition-[border-color,box-shadow] duration-base ease-premium placeholder:text-text-subtle disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-text-muted focus:border-brand focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
    />
  );
}

export function AppSelectControl({
  value,
  options = [],
  onChange,
  disabled = false,
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.value)}
      className="h-11 w-full rounded-md border border-line bg-white px-3.5 text-[13.5px] font-semibold text-text outline-none transition-[border-color,box-shadow] duration-base ease-premium disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-text-muted focus:border-brand focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

export function AppToggleControl({
  checked,
  onChange,
  enabledLabel = "Enabled",
  disabledLabel = "Disabled",
  label,
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 rounded-md border border-line bg-white px-3.5">
      <div className="text-[13.5px] font-semibold text-text">
        {checked ? enabledLabel : disabledLabel}
      </div>

      <AppSwitch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
