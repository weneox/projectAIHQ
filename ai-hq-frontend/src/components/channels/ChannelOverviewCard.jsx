import { cx } from "../../lib/cx.js";
import ChannelIcon from "./ChannelIcon.jsx";
import {
  ChannelActionButton,
  ChannelCapabilityLine,
  ChannelInspectButton,
  ChannelStatus,
} from "./ChannelPrimitives.jsx";

function CardMetaGrid({ items = [] }) {
  if (!items.length) return null;

  return (
    <dl className="grid gap-px border border-line-soft bg-line-soft sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="bg-surface-subtle px-3 py-3">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
            {item.label}
          </dt>
          <dd className="mt-1 text-[13px] font-semibold tracking-[-0.02em] text-text">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function ChannelOverviewCard({
  channel,
  selected = false,
  onInspect,
  onRunPrimaryAction,
}) {
  const metaItems = channel.advanced?.items?.slice(0, 2) || [];

  return (
    <article
      className={cx(
        "flex h-full min-h-[260px] flex-col bg-surface",
        selected && "bg-[rgba(var(--color-brand),0.05)]"
      )}
    >
      <div className="flex items-start gap-3 border-b border-line-soft px-4 py-4">
        <ChannelIcon channel={channel} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[16px] font-semibold tracking-[-0.045em] text-text">
                {channel.name}
              </div>
              <ChannelCapabilityLine
                capabilities={channel.capabilities}
                className="mt-1"
              />
            </div>

            <ChannelStatus status={channel.status} className="shrink-0 pt-1" />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 py-4">
        <p className="text-[13px] leading-6 text-text-muted">{channel.summary}</p>

        {metaItems.length ? (
          <div className="mt-4">
            <CardMetaGrid items={metaItems} />
          </div>
        ) : null}
      </div>

      <div className="mt-auto grid grid-cols-[116px_minmax(0,1fr)] gap-px border-t border-line-soft bg-line-soft">
        <ChannelInspectButton
          onClick={() => onInspect?.(channel.id)}
          aria-label={`Inspect ${channel.name}`}
        />

        <ChannelActionButton
          fullWidth
          onClick={() => onRunPrimaryAction?.(channel.primaryAction.path)}
          ariaLabel={`${channel.primaryAction.label} ${channel.name}`}
        >
          {channel.primaryAction.label}
        </ChannelActionButton>
      </div>
    </article>
  );
}
