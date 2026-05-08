import Card from "./Card.jsx";
import AppIcon from "./AppIcon.jsx";

export default function AppStatCard({ icon, label, value }) {
  return (
    <Card padded={false} clip>
      <div className="flex h-[68px] items-center gap-4 px-4">
        <div className="shrink-0 text-text">
          <AppIcon icon={icon} size="lg" tone="text" strokeWidth={2.05} />
        </div>

        <div className="min-w-0">
          <div className="truncate text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
            {label}
          </div>
          <div className="mt-1 text-[22px] font-semibold leading-none tracking-[-0.04em] text-text">
            {value}
          </div>
        </div>
      </div>
    </Card>
  );
}
