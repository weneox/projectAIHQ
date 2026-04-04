import { ArrowUpRight } from "lucide-react";
import { cx } from "../../lib/cx.js";
import ChannelIcon from "./ChannelIcon.jsx";
import {
  ChannelActionButton,
  ChannelCapabilityLine,
  ChannelStatus,
} from "./ChannelPrimitives.jsx";

export default function ChannelOverviewCard({
  channel,
  selected = false,
  onInspect,
  onRunPrimaryAction,
}) {
  return (
    <article
      className={cx(
        "relative flex h-full flex-col gap-6 rounded-[30px] border px-5 py-5 transition-[border-color,background-color,box-shadow,transform] duration-200 ease-premium",
        "bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.88))] shadow-[0_24px_48px_-34px_rgba(15,23,42,0.3)]",
        selected
          ? "border-brand/20 bg-[linear-gradient(180deg,rgba(239,246,255,0.84),rgba(255,255,255,0.98))] shadow-[0_30px_56px_-36px_rgba(37,99,235,0.42)]"
          : "border-line/80 hover:-translate-y-[1px] hover:border-line hover:bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.94))]"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex flex-1 items-center gap-3">
          <ChannelIcon channel={channel} className="h-7 w-7 object-contain text-text" />
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onInspect?.(channel.id)}
              className="inline-flex max-w-full items-center gap-1 text-left transition hover:text-brand"
              aria-label={`Inspect ${channel.name}`}
            >
              <span className="truncate text-[15px] font-semibold tracking-[-0.03em] text-text">
                {channel.name}
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-text-subtle transition" />
            </button>
            <ChannelCapabilityLine capabilities={channel.capabilities} className="mt-2" />
          </div>
        </div>

        <ChannelStatus status={channel.status} className="shrink-0" />
      </div>

      <div className="min-h-[72px] text-[15px] leading-7 tracking-[-0.015em] text-text-muted">
        {channel.summary}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onInspect?.(channel.id)}
          className="text-sm font-medium tracking-[-0.015em] text-text-muted transition hover:text-text"
          aria-label={`Open ${channel.name} details`}
        >
          Details
        </button>

        <ChannelActionButton
          onClick={() => onRunPrimaryAction?.(channel.primaryAction.path)}
          aria-label={`${channel.primaryAction.label} ${channel.name}`}
          className="shrink-0"
        >
          {channel.primaryAction.label}
        </ChannelActionButton>
      </div>
    </article>
  );
}
