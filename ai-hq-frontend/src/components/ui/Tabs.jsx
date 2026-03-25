// src/components/ui/Tabs.jsx
// ULTRA v5 — Editorial Premium Segmented Tabs

import { cx } from "../../lib/cx.js";

function Count({ n, active }) {
  if (n == null) return null;

  return (
    <span
      className={cx(
        "ml-2 inline-flex min-w-[22px] items-center justify-center rounded-[10px] px-1.5 py-0.5 text-[11px] font-semibold",
        active
          ? "bg-slate-900/8 text-slate-700 dark:bg-white/10 dark:text-slate-100"
          : "bg-slate-200/70 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"
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
      className={cx(
        "w-full min-w-0 rounded-[24px] border p-1.5",
        "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_12px_32px_rgba(15,23,42,0.06)]",
        "dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.80))]",
        "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_44px_rgba(0,0,0,0.46)]",
        className
      )}
    >
      <div className="flex min-w-0 w-full flex-wrap gap-1">
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
                "relative inline-flex items-center rounded-[16px] px-3.5 py-2 text-[12px] font-semibold tracking-[-0.01em]",
                "border transition-[box-shadow,background-color,border-color,color,transform] duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/16",
                active
                  ? cx(
                      "border-slate-200/90 bg-white text-slate-900",
                      "shadow-[inset_0_1px_0_rgba(255,255,255,0.80),0_10px_24px_rgba(15,23,42,0.08)]",
                      "dark:border-white/10 dark:bg-slate-900/78 dark:text-white",
                      "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_36px_rgba(0,0,0,0.46)]"
                    )
                  : cx(
                      "border-transparent text-slate-500",
                      "hover:bg-slate-50 hover:text-slate-900",
                      "dark:text-slate-300 dark:hover:bg-white/[0.05] dark:hover:text-white"
                    )
              )}
            >
              {active ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-[16px] bg-[linear-gradient(180deg,rgba(255,255,255,0.24),transparent_44%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_40%)]"
                />
              ) : null}

              <span className="relative z-10">{it.label}</span>
              <Count n={it.count} active={active} />
            </button>
          );
        })}
      </div>
    </div>
  );
}