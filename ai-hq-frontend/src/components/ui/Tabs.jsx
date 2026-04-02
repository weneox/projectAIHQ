import { cx } from "../../lib/cx.js";

function Count({ n, active }) {
  if (n == null) return null;

  return (
    <span
      className={cx(
        "inline-flex min-w-[22px] items-center justify-center rounded-pill px-1.5 py-0.5 text-[11px] font-semibold",
        active ? "bg-surface text-text" : "bg-surface-muted text-text-muted"
      )}
    >
      {Number(n) || 0}
    </span>
  );
}

export function Tabs({ value, onChange, items = [], className }) {
  return (
    <div
      role="tablist"
      aria-label="Tabs"
      className={cx("flex w-full flex-wrap gap-2 rounded-[18px] border border-line bg-surface-muted p-2", className)}
    >
      {items.map((it) => {
        const active = String(it.value) === String(value);

        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => (onChange ? onChange(it.value) : null)}
            className={cx(
              "inline-flex items-center gap-2 rounded-[14px] border px-3.5 py-2 text-[12px] font-semibold tracking-[-0.01em] transition",
              active
                ? "border-line bg-surface text-text shadow-panel"
                : "border-transparent bg-transparent text-text-muted hover:bg-surface hover:text-text"
            )}
          >
            <span>{it.label}</span>
            <Count n={it.count} active={active} />
          </button>
        );
      })}
    </div>
  );
}
