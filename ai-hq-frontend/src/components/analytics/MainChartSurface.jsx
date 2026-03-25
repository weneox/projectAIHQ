import { useMemo } from "react";
import { RadioTower } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Surface from "./Surface.jsx";
import { cn, compact } from "./analytics-utils.js";

function SoftTooltip({ active, payload, label, platform }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[190px] rounded-[22px] bg-[rgba(242,245,251,0.96)] px-4 py-3 text-[#181b24] shadow-[0_24px_80px_rgba(0,0,0,0.36)] ring-1 ring-black/5 backdrop-blur-xl">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#6f7586]">
        {platform.label}
      </div>
      <div className="mt-1 text-sm text-[#676d7d]">{label}</div>
      <div className="mt-3 text-[28px] font-semibold tracking-[-0.05em] text-[#181b24]">
        {compact(payload[0].value)}
      </div>
      <div className="mt-2 text-xs text-[#707686]">
        Audience momentum remains stable in this segment.
      </div>
    </div>
  );
}

export default function MainChartSurface({ platform, activeRange, series }) {
  const growth = useMemo(() => {
    if (!series.length) return 0;
    const start = series[0].value;
    const end = series[series.length - 1].value;
    return (((end - start) / start) * 100).toFixed(1);
  }, [series]);

  return (
    <Surface className="px-5 py-5 md:px-6 md:py-6">
      <div className={cn("pointer-events-none absolute inset-0 opacity-100", platform.heroGlow)} />
      <div className="pointer-events-none absolute left-0 right-0 top-[58%] border-t border-dashed border-cyan-300/18" />

      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/[0.04] ring-1 ring-white/10 text-white/78">
            <RadioTower className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[30px] font-semibold tracking-[-0.05em] text-white">
              {platform.headline}
            </div>
            <div className="mt-2 text-sm text-white/42">
              {platform.label} performance across the selected {activeRange.toLowerCase()} window
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:min-w-[280px]">
          <div className="rounded-[22px] bg-white/[0.03] px-4 py-3 ring-1 ring-white/8">
            <div className="text-xs text-white/42">Momentum</div>
            <div className="mt-1 text-[28px] font-semibold tracking-[-0.05em] text-white">
              {platform.momentum}
            </div>
          </div>
          <div className="rounded-[22px] bg-white/[0.03] px-4 py-3 ring-1 ring-white/8">
            <div className="text-xs text-white/42">Range growth</div>
            <div className="mt-1 text-[28px] font-semibold tracking-[-0.05em] text-white">
              +{growth}%
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-5 h-[360px] w-full md:h-[460px]">
        <div className="pointer-events-none absolute left-[61%] top-[42%] z-10 h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_0_8px_rgba(110,255,210,0.08),0_0_24px_rgba(110,255,210,0.94)]" />
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 10, right: 0, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="analytics-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(86,230,209,0.40)" />
                <stop offset="55%" stopColor="rgba(59,181,165,0.14)" />
                <stop offset="100%" stopColor="rgba(59,181,165,0.00)" />
              </linearGradient>
              <linearGradient id="analytics-stroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#58e7d4" />
                <stop offset="100%" stopColor="#6fb9ff" />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />

            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.42)", fontSize: 12 }}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              width={58}
              tickFormatter={(value) => compact(value)}
              tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 12 }}
            />

            <Tooltip
              cursor={{ stroke: "rgba(111,185,255,0.18)", strokeWidth: 1 }}
              content={<SoftTooltip platform={platform} />}
            />

            <Area
              type="monotone"
              dataKey="value"
              stroke="url(#analytics-stroke)"
              strokeWidth={3}
              fill="url(#analytics-fill)"
              activeDot={{ r: 6, fill: "#d6fff8", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Surface>
  );
}