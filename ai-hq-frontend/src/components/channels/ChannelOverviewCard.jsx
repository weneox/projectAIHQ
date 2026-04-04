import { ArrowUpRight } from "lucide-react";
import { cx } from "../../lib/cx.js";
import ChannelIcon from "./ChannelIcon.jsx";
import {
  ChannelActionButton,
  ChannelCapabilityLine,
  ChannelStatus,
} from "./ChannelPrimitives.jsx";

function PlainChannelIcon({ channel }) {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden">
      <ChannelIcon
        channel={channel}
        className="h-full w-full object-contain text-text"
      />
    </div>
  );
}

export default function ChannelOverviewCard({
  channel,
  selected = false,
  onInspect,
  onRunPrimaryAction,
}) {
  return (
    <article
      className={cx(
        "group relative overflow-hidden rounded-[8px] border bg-white",
        "shadow-[0_16px_30px_-26px_rgba(15,23,42,0.18)] transition-all duration-300 ease-premium",
        selected
          ? "border-[#2563eb]/18 shadow-[0_18px_34px_-22px_rgba(37,99,235,0.16)]"
          : "border-black/[0.08] hover:-translate-y-[1px] hover:border-black/[0.12] hover:shadow-[0_22px_36px_-22px_rgba(15,23,42,0.2)]"
      )}
    >
      <div className="relative px-3.5 pb-3 pt-3.5">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex flex-1 items-start gap-3">
            <PlainChannelIcon channel={channel} />

            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onInspect?.(channel.id)}
                className="inline-flex max-w-full items-center gap-1.5 text-left transition hover:text-text"
                aria-label={`Inspect ${channel.name}`}
              >
                <span className="truncate text-[16px] font-semibold leading-none tracking-[-0.04em] text-text">
                  {channel.name}
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-text-subtle" />
              </button>

              <ChannelCapabilityLine
                capabilities={(channel.capabilities || []).slice(0, 3)}
                className="mt-2"
              />
            </div>
          </div>

          <ChannelStatus status={channel.status} className="shrink-0" />
        </div>

        <p
          className="mt-3 text-[14px] leading-6 tracking-[-0.015em] text-text-muted"
          style={{
            minHeight: "48px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {channel.summary}
        </p>

        <div className="mt-3 flex items-center gap-2 border-t border-black/[0.06] pt-2.5">
          <button
            type="button"
            onClick={() => onInspect?.(channel.id)}
            className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-subtle transition hover:text-text"
            aria-label={`Open ${channel.name} details`}
          >
            <span>Inspect</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>

          <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(0,0,0,0.08),transparent)]" />
        </div>
      </div>

      <div className="relative border-t border-black/[0.06]">
        <ChannelActionButton
          fullWidth
          onClick={() => onRunPrimaryAction?.(channel.primaryAction.path)}
          ariaLabel={`${channel.primaryAction.label} ${channel.name}`}
          className="!h-[52px] !justify-between !rounded-none !border-0 !px-4 !text-[14px] !shadow-none hover:!translate-y-0 hover:!shadow-none"
        >
          {channel.primaryAction.label}
        </ChannelActionButton>
      </div>
    </article>
  );
}