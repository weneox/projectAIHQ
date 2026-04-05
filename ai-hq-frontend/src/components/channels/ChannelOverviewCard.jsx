import { cx } from "../../lib/cx.js";
import ChannelIcon from "./ChannelIcon.jsx";
import {
  ChannelActionButton,
  ChannelInspectButton,
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
        "group relative overflow-hidden rounded-[13px] border bg-white px-4 py-3.5 transition-all duration-300 ease-premium",
        selected
          ? "border-[#c7d1de] shadow-[0_12px_24px_-16px_rgba(15,23,42,0.14),0_4px_10px_-8px_rgba(15,23,42,0.06)]"
          : "border-[#d9e1ea] shadow-[0_4px_12px_-8px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.03)] hover:-translate-y-[2px] hover:border-[#c8d2df] hover:shadow-[0_12px_22px_-14px_rgba(15,23,42,0.11),0_4px_10px_-8px_rgba(15,23,42,0.05)]"
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.96),transparent)]" />

      <div className="grid min-h-[146px] grid-rows-[auto_1fr_auto]">
        <div className="flex min-h-[44px] items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ChannelIcon channel={channel} size="md" />

            <div className="min-w-0 pt-[1px]">
              <div className="truncate text-[15px] font-semibold tracking-[-0.035em] text-[#101828]">
                {channel.name}
              </div>

              <div className="mt-0.5 truncate text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#667085]">
                {channel.eyebrow}
              </div>
            </div>
          </div>

          <div className="shrink-0 pt-[3px]">
            <ChannelStatus status={channel.status} />
          </div>
        </div>

        <div className="pt-2.5">
          <p
            className="text-[14px] font-medium leading-8 text-[#475467]"
            style={{
              minHeight: "56px",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {channel.summary}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#edf1f5] pt-2.5">
          <ChannelInspectButton
            onClick={() => onInspect?.(channel.id)}
            aria-label={`Details for ${channel.name}`}
            className="px-0 py-0 text-[10px] tracking-[0.1em] text-[#667085] hover:text-[#101828]"
          />

          <ChannelActionButton
            onClick={() => onRunPrimaryAction?.(channel)}
            ariaLabel={`${channel.primaryAction.label} ${channel.name}`}
            className="!h-[32px] !rounded-[8px] !px-3.5 !text-[10px]"
          >
            {channel.primaryAction.label}
          </ChannelActionButton>
        </div>
      </div>
    </article>
  );
}