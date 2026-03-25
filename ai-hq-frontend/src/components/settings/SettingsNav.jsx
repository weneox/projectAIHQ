// src/components/settings/SettingsNav.jsx
// PREMIUM v2.1 — editorial vertical settings rail (stable + accessible)

import { ChevronRight } from "lucide-react";
import { cx } from "../../lib/cx.js";

export default function SettingsNav({ items = [], activeKey, onChange }) {
  return (
    <nav className="space-y-1.5" aria-label="Settings navigation">
      {items.map((item, index) => {
        const itemKey = item?.key || item?.id || item?.value || `item-${index}`;
        const active = String(itemKey) === String(activeKey);
        const dirty = !!item?.dirty;
        const Icon = item?.icon;

        return (
          <button
            key={itemKey}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onChange?.(itemKey)}
            className={cx(
              "group relative flex w-full items-center gap-3 overflow-hidden rounded-[22px] px-3.5 py-3.5 text-left transition-all duration-200",
              active
                ? "bg-[linear-gradient(180deg,rgba(59,130,246,0.10),rgba(59,130,246,0.04))] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_10px_30px_rgba(37,99,235,0.10)] dark:bg-[linear-gradient(180deg,rgba(59,130,246,0.16),rgba(59,130,246,0.06))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_14px_30px_rgba(0,0,0,0.22)]"
                : "hover:bg-slate-100/80 dark:hover:bg-white/[0.045]"
            )}
          >
            <div
              className={cx(
                "absolute left-0 top-2 bottom-2 w-[3px] rounded-full transition-all duration-200",
                active
                  ? "bg-gradient-to-b from-sky-400 via-blue-500 to-indigo-500 opacity-100"
                  : "bg-slate-300/0 opacity-0 group-hover:opacity-100 dark:bg-white/10"
              )}
            />

            <div
              className={cx(
                "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border transition-all duration-200",
                active
                  ? "border-blue-200/70 bg-white/80 text-blue-700 shadow-[0_8px_24px_rgba(37,99,235,0.12)] dark:border-blue-400/20 dark:bg-white/[0.07] dark:text-blue-200"
                  : "border-slate-200/80 bg-white/70 text-slate-500 group-hover:border-slate-300 group-hover:text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400 dark:group-hover:text-slate-200"
              )}
            >
              {Icon ? (
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
              ) : (
                <span className="text-xs font-semibold">
                  {String(index + 1).padStart(2, "0")}
                </span>
              )}

              {dirty ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.18)] dark:bg-amber-300" />
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className={cx(
                    "truncate text-sm font-semibold tracking-[-0.01em]",
                    active
                      ? "text-slate-950 dark:text-white"
                      : "text-slate-700 dark:text-slate-200"
                  )}
                >
                  {item?.label || item?.title || item?.name || `Section ${index + 1}`}
                </div>

                {dirty ? (
                  <span
                    className={cx(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]",
                      active
                        ? "border-blue-200/70 bg-blue-500/10 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200"
                        : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300"
                    )}
                  >
                    Edited
                  </span>
                ) : null}
              </div>

              {item?.description ? (
                <div
                  className={cx(
                    "mt-1 line-clamp-2 text-[12px] leading-5",
                    active
                      ? "text-slate-600 dark:text-slate-300"
                      : "text-slate-500 dark:text-slate-400"
                  )}
                >
                  {item.description}
                </div>
              ) : null}
            </div>

            <div
              className={cx(
                "shrink-0 transition-all duration-200",
                active
                  ? "translate-x-0 opacity-100 text-blue-600 dark:text-blue-300"
                  : "translate-x-1 opacity-0 text-slate-400 group-hover:translate-x-0 group-hover:opacity-100 dark:text-slate-500"
              )}
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            </div>
          </button>
        );
      })}
    </nav>
  );
}