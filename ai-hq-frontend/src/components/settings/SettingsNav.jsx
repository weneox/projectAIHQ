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
        const status = String(item?.status || "").trim();
        const meta = String(item?.meta || item?.description || "").trim();

        return (
          <button
            key={itemKey}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onChange?.(itemKey)}
            className={cx(
              "group relative flex w-full items-center gap-3 overflow-hidden rounded-[26px] border px-4 py-3.5 text-left transition-all duration-200",
              active
                ? "border-slate-300/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,247,250,0.92))] shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:border-white/12 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.68))]"
                : "border-transparent hover:border-slate-200/80 hover:bg-white/72 dark:hover:border-white/10 dark:hover:bg-white/[0.04]"
            )}
          >
            <div
              className={cx(
                "absolute left-0 top-3 bottom-3 w-[2px] rounded-full transition-all duration-200",
                active
                  ? "bg-gradient-to-b from-slate-900 via-slate-500 to-slate-300 opacity-100 dark:from-white dark:via-slate-300 dark:to-transparent"
                  : "bg-slate-300/0 opacity-0 group-hover:opacity-100 dark:bg-white/0"
              )}
            />

            <div
              className={cx(
                "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] border transition-all duration-200",
                active
                  ? "border-slate-200/90 bg-white text-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
                  : "border-slate-200/80 bg-white/76 text-slate-500 group-hover:border-slate-300/80 group-hover:text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:group-hover:border-white/12 dark:group-hover:text-white"
              )}
            >
              {Icon ? (
                <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
              ) : (
                <span className="text-xs font-semibold">
                  {String(index + 1).padStart(2, "0")}
                </span>
              )}

              {dirty ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.18)]" />
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div
                  className={cx(
                    "truncate text-sm font-semibold tracking-[-0.01em]",
                    active ? "text-slate-950 dark:text-white" : "text-slate-700 dark:text-slate-100"
                  )}
                >
                  {item?.label || item?.title || item?.name || `Section ${index + 1}`}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {status ? (
                    <span
                      className={cx(
                        "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                        active
                          ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                          : "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"
                      )}
                    >
                      {status}
                    </span>
                  ) : null}

                  {dirty ? (
                    <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.18)]" />
                  ) : null}
                </div>
              </div>

              {meta ? (
                <div
                  className={cx(
                    "mt-1 line-clamp-2 text-[12px] leading-5",
                    active ? "text-slate-600 dark:text-slate-300" : "text-slate-500 dark:text-slate-400"
                  )}
                >
                  {meta}
                </div>
              ) : null}
            </div>

            <div
              className={cx(
                "shrink-0 transition-all duration-200",
                active
                  ? "translate-x-0 opacity-100 text-slate-500 dark:text-slate-300"
                  : "translate-x-1 opacity-0 text-slate-300 group-hover:translate-x-0 group-hover:opacity-100 dark:text-slate-600"
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
