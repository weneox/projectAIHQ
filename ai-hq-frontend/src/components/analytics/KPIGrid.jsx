import { Activity, Layers3, MousePointer2, Users } from "lucide-react";
import Surface from "./Surface.jsx";

function KpiCard({ icon: Icon, label, value, sub }) {
  return (
    <Surface className="px-4 py-4 md:px-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/42">
            {label}
          </div>
          <div className="mt-3 text-[30px] font-semibold tracking-[-0.05em] text-white">
            {value}
          </div>
          <div className="mt-1 text-sm text-white/36">{sub}</div>
        </div>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/10 text-white/65">
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </Surface>
  );
}

export default function KPIGrid({ platform }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      <KpiCard icon={Users} label="Audience" value={platform.stats.audience} sub="Current community scale" />
      <KpiCard icon={Activity} label="Engagement" value={platform.stats.engagement} sub="Interaction efficiency" />
      <KpiCard icon={MousePointer2} label="Clicks" value={platform.stats.clicks} sub="Traffic action volume" />
      <KpiCard icon={Layers3} label="Output" value={platform.stats.output} sub="Published content inventory" />
    </div>
  );
}