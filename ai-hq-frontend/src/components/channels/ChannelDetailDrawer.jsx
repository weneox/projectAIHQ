import { ArrowUpRight, X } from "lucide-react";
import { cx } from "../../lib/cx.js";
import FocusDialog from "../ui/FocusDialog.jsx";
import ChannelIcon from "./ChannelIcon.jsx";
import {
  ChannelActionButton,
  ChannelCapabilityLine,
  ChannelStatus,
} from "./ChannelPrimitives.jsx";

function DrawerSection({ label, className, children }) {
  return (
    <section className={cx("border-t border-line-soft px-5 py-5", className)}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
        {label}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function QuickActionRow({ action, onNavigate, channelName, bordered = false }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate?.(action.path)}
      className={cx(
        "flex w-full items-start justify-between gap-4 bg-surface px-4 py-3 text-left transition duration-fast ease-premium hover:bg-surface-subtle",
        bordered && "border-t border-line-soft"
      )}
      aria-label={`${action.label} for ${channelName}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold tracking-[-0.02em] text-text">
          {action.label}
        </span>
        {action.hint ? (
          <span className="mt-1 block text-[12px] leading-5 text-text-muted">
            {action.hint}
          </span>
        ) : null}
      </span>

      <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-text-subtle" />
    </button>
  );
}

function MetaGrid({ items = [] }) {
  if (!items.length) return null;

  return (
    <div className="grid gap-px overflow-hidden border border-line-soft bg-line-soft sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="bg-surface px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            {item.label}
          </div>
          <div className="mt-1 text-[13px] font-semibold tracking-[-0.02em] text-text">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChannelDetailDrawer({
  channel,
  open = false,
  onClose,
  onNavigate,
}) {
  if (!channel) return null;

  const secondaryActions = (channel.quickActions || [])
    .filter((action) => action.path !== channel.primaryAction.path)
    .slice(0, 3);

  return (
    <FocusDialog
      open={open}
      onClose={onClose}
      title={channel.name}
      backdropClassName="bg-overlay/72"
      panelClassName="ml-auto h-full w-full max-w-[520px] px-0 py-0"
    >
      <div className="flex h-full flex-col border-l border-line bg-surface">
        <div className="border-b border-line-soft px-5 py-5">
          <div className="flex items-start gap-4">
            <ChannelIcon channel={channel} size="lg" />

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
                    Channel panel
                  </div>

                  <h2 className="mt-2 text-[1.8rem] font-semibold leading-[0.95] tracking-[-0.06em] text-text">
                    {channel.name}
                  </h2>
                </div>

                <ChannelStatus status={channel.status} className="shrink-0 pt-1" />
              </div>

              <div className="mt-3">
                <ChannelCapabilityLine capabilities={channel.capabilities} />
              </div>

              <p className="mt-4 text-[13px] leading-6 text-text-muted">
                {channel.summary}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onClose?.()}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-line-soft bg-surface text-text-muted transition duration-fast ease-premium hover:border-line hover:bg-surface-subtle hover:text-text"
              aria-label="Close channel details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <DrawerSection label="Primary route" className="border-t-0">
            <ChannelActionButton
              fullWidth
              onClick={() => onNavigate?.(channel.primaryAction.path)}
              ariaLabel={`${channel.primaryAction.label} ${channel.name}`}
            >
              {channel.primaryAction.label}
            </ChannelActionButton>
          </DrawerSection>

          <DrawerSection label="Position">
            <div className="text-[14px] leading-7 text-text">{channel.detailSummary}</div>
            {channel.detailNote ? (
              <div className="mt-3 text-[12px] leading-6 text-text-subtle">
                {channel.detailNote}
              </div>
            ) : null}
          </DrawerSection>

          {secondaryActions.length ? (
            <DrawerSection label="Quick controls">
              <div className="overflow-hidden border border-line-soft bg-line-soft">
                {secondaryActions.map((action, index) => (
                  <QuickActionRow
                    key={`${channel.id}-${action.label}`}
                    action={action}
                    onNavigate={onNavigate}
                    channelName={channel.name}
                    bordered={index > 0}
                  />
                ))}
              </div>
            </DrawerSection>
          ) : null}

          {channel.advanced?.items?.length ? (
            <DrawerSection label="Operational data">
              <MetaGrid items={channel.advanced.items} />
              {channel.advanced?.note ? (
                <div className="mt-3 text-[12px] leading-6 text-text-subtle">
                  {channel.advanced.note}
                </div>
              ) : null}
            </DrawerSection>
          ) : null}
        </div>
      </div>
    </FocusDialog>
  );
}
