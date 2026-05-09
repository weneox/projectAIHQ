import { Check, ChevronDown, Search } from "lucide-react";
import { cx } from "../../lib/cx.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

export function normalizeAppFilterList(values = []) {
  return Array.isArray(values) ? values.map((value) => lower(value)).filter(Boolean) : [];
}

export function toggleAppFilterListValue(values = [], value = "") {
  const safeValue = lower(value);
  const safeValues = normalizeAppFilterList(values);

  if (!safeValue) return safeValues;

  return safeValues.includes(safeValue)
    ? safeValues.filter((item) => item !== safeValue)
    : [...safeValues, safeValue];
}

export function AppTableHeaderFilter({
  id,
  label,
  openFilter,
  active = false,
  onOpen,
  children,
  align = "left",
}) {
  const open = openFilter === id;

  return (
    <div className="relative min-w-0 px-2 first:pl-3 last:pr-3">
      <button
        type="button"
        onClick={() => onOpen(open ? "" : id)}
        className={cx(
          "relative flex h-8 w-full min-w-0 items-center justify-between gap-1.5 rounded-md px-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors duration-base ease-premium",
          active || open
            ? "bg-surface-subtle text-text"
            : "text-text-subtle hover:bg-surface-subtle hover:text-text"
        )}
      >
        <span className="min-w-0 truncate whitespace-nowrap">{label}</span>
        <ChevronDown
          className={cx(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-base ease-premium",
            open ? "rotate-180" : "",
            active ? "text-brand" : "text-text-subtle"
          )}
          strokeWidth={2.2}
        />

        {active ? (
          <span className="pointer-events-none absolute inset-x-2 bottom-0 h-[2px] rounded-md bg-brand/80" />
        ) : null}
      </button>

      {open ? (
        <div
          className={cx(
            "absolute top-[calc(100%+7px)] z-40 w-full min-w-[176px] overflow-visible rounded-md border border-line bg-white shadow-[0_18px_45px_-34px_rgba(15,23,42,0.65)]",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function AppFilterMenuShell({ children }) {
  return <div className="grid gap-1 p-1.5">{children}</div>;
}

export function AppFilterSearchInput({
  value,
  onChange,
  placeholder = "Search...",
}) {
  return (
    <div className="p-1.5">
      <div className="team-filter-control flex h-8 min-w-0 items-center gap-2 rounded-md bg-white px-2.5 text-text-muted transition-[background-color,box-shadow] duration-150 ease-premium focus-within:text-text">
        <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={2.1} />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          className="h-full min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-[12.5px] font-semibold text-text outline-none ring-0 shadow-none placeholder:text-text-subtle focus:border-0 focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none"
        />
      </div>
    </div>
  );
}
export function AppFilterOption({ selected, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex h-8 w-full items-center justify-between gap-3 rounded-md px-2.5 text-left text-[12.5px] font-semibold transition-colors duration-base ease-premium",
        selected ? "bg-brand/5 text-brand" : "text-text hover:bg-surface-subtle"
      )}
    >
      <span
        className={cx(
          "min-w-0 flex-1 truncate whitespace-nowrap",
          selected ? "text-brand" : "text-text"
        )}
      >
        {children}
      </span>

      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {selected ? (
          <Check className="h-3.5 w-3.5 text-brand" strokeWidth={2.45} />
        ) : null}
      </span>
    </button>
  );
}

export function AppFilterAction({ children, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-7 w-full rounded-md px-2.5 text-left text-[12px] font-semibold text-text-muted transition-colors duration-base ease-premium hover:bg-surface-subtle hover:text-text disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className="block truncate whitespace-nowrap">{children}</span>
    </button>
  );
}

export function AppMultiSelectMenu({ options, selectedValues, onToggle, onClear, allLabel }) {
  const selected = normalizeAppFilterList(selectedValues);

  return (
    <AppFilterMenuShell>
      <AppFilterOption selected={!selected.length} onClick={onClear}>
        {allLabel}
      </AppFilterOption>

      {(Array.isArray(options) ? options : []).map((option) => (
        <AppFilterOption
          key={option.value}
          selected={selected.includes(option.value)}
          onClick={() => onToggle(option.value)}
        >
          {option.label}
        </AppFilterOption>
      ))}
    </AppFilterMenuShell>
  );
}

