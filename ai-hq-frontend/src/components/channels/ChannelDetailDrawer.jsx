import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronDown, X } from "lucide-react";
import FocusDialog from "../ui/FocusDialog.jsx";
import { cx } from "../../lib/cx.js";
import ChannelIcon from "./ChannelIcon.jsx";
import {
  ChannelActionButton,
  ChannelCapabilityLine,
  ChannelStatus,
} from "./ChannelPrimitives.jsx";

function QuickActionRow({ action, onNavigate, channelName }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate?.(action.path)}
      className="group flex w-full items-start justify-between gap-4 py-4 text-left transition first:pt-0 last:pb-0"
      aria-label={`${action.label} for ${channelName}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold tracking-[-0.02em] text-text">
          {action.label}
        </span>
        <span className="mt-1 block text-sm text-text-muted">{action.hint}</span>
      </span>
      <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-text-subtle transition group-hover:text-text" />
    </button>
  );
}

function AdvancedMetaRow({ item }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
      <span className="text-text-muted">{item.label}</span>
      <span className="text-right font-medium text-text">{item.value}</span>
    </div>
  );
}

export default function ChannelDetailDrawer({
  channel,
  open = false,
  onClose,
  onNavigate,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    setAdvancedOpen(false);
  }, [channel?.id]);

  if (!channel) return null;

  return (
    <FocusDialog
      open={open}
      onClose={onClose}
      title={channel.name}
      backdropClassName="bg-overlay/60 backdrop-blur-[10px]"
      panelClassName="ml-auto h-full max-h-[calc(100vh-2rem)] w-full max-w-[480px]"
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[34px] border border-line/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] shadow-panel-strong">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(480px_circle_at_0%_0%,rgba(37,99,235,0.09),transparent_52%)]" />

        <div className="relative flex-1 overflow-y-auto px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <ChannelIcon
                  channel={channel}
                  className="h-8 w-8 object-contain text-text"
                  stackClassName="-space-x-2.5"
                />
                <ChannelStatus status={channel.status} />
              </div>

              <div className="mt-4 font-display text-[2rem] font-semibold leading-[0.94] tracking-[-0.05em] text-text">
                {channel.name}
              </div>
              <div className="mt-3 max-w-[26rem] text-[15px] leading-7 tracking-[-0.015em] text-text-muted">
                {channel.detailSummary}
              </div>
              <ChannelCapabilityLine capabilities={channel.capabilities} className="mt-4" />
              <div className="mt-3 text-sm text-text-muted">{channel.detailNote}</div>
            </div>

            <button
              type="button"
              onClick={() => onClose?.()}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line/80 bg-white/80 text-text-muted transition hover:border-line hover:text-text"
              aria-label="Close channel details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-7">
            <ChannelActionButton
              onClick={() => onNavigate?.(channel.primaryAction.path)}
              aria-label={`${channel.primaryAction.label} ${channel.name}`}
              className="h-11 px-5 text-[14px]"
            >
              {channel.primaryAction.label}
            </ChannelActionButton>
          </div>

          <section className="mt-8 border-t border-line-soft pt-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-subtle">
              Quick controls
            </div>
            <div className="mt-4 divide-y divide-line-soft">
              {channel.quickActions.slice(0, 4).map((action) => (
                <QuickActionRow
                  key={`${channel.id}-${action.label}`}
                  action={action}
                  onNavigate={onNavigate}
                  channelName={channel.name}
                />
              ))}
            </div>
          </section>

          <section className="mt-8 border-t border-line-soft pt-5">
            <button
              type="button"
              onClick={() => setAdvancedOpen((value) => !value)}
              className="flex w-full items-center justify-between gap-3 text-left"
              aria-expanded={advancedOpen}
            >
              <div>
                <div className="text-sm font-semibold text-text">Advanced</div>
                <div className="mt-1 text-sm text-text-muted">
                  Lower-priority scope and context notes.
                </div>
              </div>
              <ChevronDown
                className={cx(
                  "h-4 w-4 shrink-0 text-text-subtle transition-transform",
                  advancedOpen && "rotate-180"
                )}
              />
            </button>

            {advancedOpen ? (
              <div className="mt-4 space-y-4">
                {channel.advanced?.note ? (
                  <div className="text-sm leading-6 text-text-muted">
                    {channel.advanced.note}
                  </div>
                ) : null}

                {channel.advanced?.items?.length ? (
                  <div className="divide-y divide-line-soft">
                    {channel.advanced.items.map((item) => (
                      <AdvancedMetaRow
                        key={`${channel.id}-${item.label}`}
                        item={item}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </FocusDialog>
  );
}
