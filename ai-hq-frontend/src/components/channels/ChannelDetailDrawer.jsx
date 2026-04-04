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
        "group relative overflow-hidden rounded-[28px] border bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] px-5 py-5 transition duration-fast ease-premium",
        selected
          ? "border-brand/30 shadow-[0_24px_54px_-36px_rgba(37,99,235,0.24)]"
          : "border-line shadow-[0_18px_42px_-36px_rgba(15,23,42,0.18)] hover:-translate-y-[1px] hover:border-line-strong hover:shadow-[0_26px_52px_-34px_rgba(15,23,42,0.22)]"
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(37,99,235,0.24),transparent)] opacity-0 transition duration-fast ease-premium group-hover:opacity-100" />

      <div className="flex min-h-[236px] flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="shrink-0">
              <ChannelIcon channel={channel} size="md" />
            </div>

            <div className="min-w-0">
              <div className="truncate text-[18px] font-semibold tracking-[-0.055em] text-text">
                {channel.name}
              </div>

              <div className="mt-2 truncate text-[11px] font-semibold uppercase tracking-[0.13em] text-text-subtle">
                {channel.eyebrow}
              </div>
            </div>
          </div>

          <div className="shrink-0 pt-1">
            <ChannelStatus status={channel.status} />
          </div>
        </div>

        <p
          className="mt-5 text-[14px] leading-8 text-text-muted"
          style={{
            minHeight: "92px",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {channel.summary}
        </p>

        <div className="mt-auto border-t border-line-soft pt-4">
          <div className="flex items-center justify-between gap-3">
            <ChannelInspectButton
              onClick={() => onInspect?.(channel.id)}
              aria-label={`Details for ${channel.name}`}
            />

            <ChannelActionButton
              onClick={() => onRunPrimaryAction?.(channel.primaryAction.path)}
              ariaLabel={`${channel.primaryAction.label} ${channel.name}`}
            >
              {channel.primaryAction.label}
            </ChannelActionButton>
          </div>
        </div>
      </div>
    </article>
  );
}