import { PLATFORMS } from "./analytics-data.js";
import { cn } from "./analytics-utils.js";

export default function PlatformSwitch({ active, onChange }) {
  const items = Object.values(PLATFORMS);

  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => {
        const Icon = item.Icon;
        const isActive = active === item.key;

        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={cn(
              "group inline-flex items-center gap-2 rounded-[18px] px-4 py-3 text-sm font-medium transition-all duration-300",
              isActive
                ? "bg-white/[0.09] text-white shadow-[0_14px_40px_rgba(0,0,0,0.18)] ring-1 ring-white/14"
                : "bg-white/[0.025] text-white/58 ring-1 ring-white/8 hover:bg-white/[0.05] hover:text-white"
            )}
          >
            <Icon
              className={cn(
                "h-4.5 w-4.5",
                isActive ? "text-white" : "text-white/42 group-hover:text-white/75"
              )}
            />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}