import { cx } from "../../lib/cx.js";

export default function AppSegmentedControl({
  value,
  options = [],
  onChange,
  size = "md",
}) {
  const heightClass =
    size === "sm" ? "h-8 px-3 text-[12.5px]" : "h-9 px-4 text-[13px]";

  return (
    <div className="inline-flex rounded-md border border-line bg-surface-subtle p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange?.(option.id)}
          className={cx(
            "rounded-[5px] font-semibold transition-[background-color,color,box-shadow] duration-base ease-premium",
            heightClass,
            value === option.id
              ? "bg-white text-text shadow-[0_6px_18px_-16px_rgba(15,23,42,0.8)]"
              : "text-text-muted hover:text-text"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
