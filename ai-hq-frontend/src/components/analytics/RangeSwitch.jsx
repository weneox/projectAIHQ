import { RANGE_OPTIONS } from "./analytics-data.js";
import { cn } from "./analytics-utils.js";

export default function RangeSwitch({ active, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[22px] bg-white/[0.035] p-2 ring-1 ring-white/8">
      {RANGE_OPTIONS.map((item) => {
        const isActive = active === item.key;

        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={cn(
              "rounded-[16px] px-5 py-3 text-sm font-medium transition-all duration-300",
              isActive
                ? "bg-[linear-gradient(180deg,rgba(126,105,255,0.42),rgba(102,79,228,0.26))] text-white shadow-[0_12px_34px_rgba(89,73,214,0.28)]"
                : "text-white/55 hover:bg-white/[0.05] hover:text-white"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}