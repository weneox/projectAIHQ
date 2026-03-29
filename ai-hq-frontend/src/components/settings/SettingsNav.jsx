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
              "group relative flex w-full items-center gap-3 overflow-hidden rounded-[22px] px-3.5 py-3 text-left transition-all duration-200",
              active
                ? "bg-[#f8f1e4] shadow-[inset_0_1px_0_rgba(255,255,255,0.62),0_10px_24px_rgba(120,102,73,0.08)]"
                : "hover:bg-[#fbf7f0]"
            )}
          >
            <div
              className={cx(
                "absolute left-0 top-2 bottom-2 w-[3px] rounded-full transition-all duration-200",
                active
                  ? "bg-gradient-to-b from-[#d9c18f] via-[#cda96d] to-[#c19a5f] opacity-100"
                  : "bg-stone-300/0 opacity-0 group-hover:opacity-100"
              )}
            />

            <div
              className={cx(
                "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] border transition-all duration-200",
                active
                  ? "border-[#dfcfb2] bg-white text-stone-800 shadow-[0_8px_20px_rgba(120,102,73,0.08)]"
                  : "border-[#ece2d3] bg-[#fffdfa] text-stone-500 group-hover:border-[#dfcfb2] group-hover:text-stone-700"
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
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className={cx(
                    "truncate text-sm font-semibold tracking-[-0.01em]",
                    active ? "text-stone-950" : "text-stone-700"
                  )}
                >
                  {item?.label || item?.title || item?.name || `Section ${index + 1}`}
                </div>

                {dirty ? (
                  <span
                    className={cx(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]",
                      active
                        ? "border-[#dfcfb2] bg-[#f5ead3] text-stone-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
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
                    active ? "text-stone-600" : "text-stone-500"
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
                  ? "translate-x-0 opacity-100 text-stone-500"
                  : "translate-x-1 opacity-0 text-stone-300 group-hover:translate-x-0 group-hover:opacity-100"
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
