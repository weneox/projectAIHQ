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
        "rounded-panel border bg-surface p-4",
        selected ? "border-line-strong" : "border-line"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ChannelIcon channel={channel} size="md" />

          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-text">
              {channel.name}
            </div>
            <div className="truncate text-[12px] text-text-muted">
              {channel.eyebrow}
            </div>
          </div>
        </div>

        <ChannelStatus status={channel.status} />
      </div>

      <p className="mt-3 text-[13px] leading-6 text-text-muted">
        {channel.summary}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line-soft pt-3">
        <ChannelInspectButton
          onClick={() => onInspect?.(channel.id)}
          aria-label={`Details ${channel.name}`}
        />

        <ChannelActionButton
          onClick={() => onRunPrimaryAction?.(channel)}
          ariaLabel={`${channel.primaryAction.label} ${channel.name}`}
        >
          {channel.primaryAction.label}
        </ChannelActionButton>
      </div>
    </article>
  );
}
