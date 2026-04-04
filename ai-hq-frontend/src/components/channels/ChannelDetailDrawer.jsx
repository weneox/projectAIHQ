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
import { getChannelStatusMeta } from "./channelCatalogModel.js";

function QuickActionRow({ action, onNavigate, channelName }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate?.(action.path)}
      className="group -mx-2 flex w-[calc(100%+1rem)] items-start justify-between gap-4 rounded-[16px] px-2 py-3.5 text-left transition hover:bg-black/[0.03]"
      aria-label={`${action.label} for ${channelName}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold tracking-[-0.02em] text-text">
          {action.label}
        </span>
        <span className="mt-1 block text-sm leading-6 text-text-muted">
          {action.hint}
        </span>
      </span>

      <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-text-subtle transition group-hover:text-text" />
    </button>
  );
}

function AdvancedMetaRow({ item }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm first:pt-0 last:pb-0">
      <span className="text-text-muted">{item.label}</span>
      <span className="max-w-[56%] text-right font-medium tracking-[-0.015em] text-text">
        {item.value}
      </span>
    </div>
  );
}

function SectionEyebrow({ children }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-subtle">
      {children}
    </div>
  );
}

const DRAWER_TONES = {
  success: {
    bar: "bg-[linear-gradient(90deg,rgba(16,185,129,0.84),rgba(16,185,129,0.12),transparent)]",
    wash: "bg-[radial-gradient(620px_circle_at_0%_0%,rgba(16,185,129,0.06),transparent_62%)]",
  },
  info: {
    bar: "bg-[linear-gradient(90deg,rgba(37,99,235,0.84),rgba(37,99,235,0.12),transparent)]",
    wash: "bg-[radial-gradient(620px_circle_at_0%_0%,rgba(37,99,235,0.06),transparent_62%)]",
  },
  warning: {
    bar: "bg-[linear-gradient(90deg,rgba(245,158,11,0.84),rgba(245,158,11,0.12),transparent)]",
    wash: "bg-[radial-gradient(620px_circle_at_0%_0%,rgba(245,158,11,0.07),transparent_62%)]",
  },
  neutral: {
    bar: "bg-[linear-gradient(90deg,rgba(100,116,139,0.74),rgba(100,116,139,0.1),transparent)]",
    wash: "bg-[radial-gradient(620px_circle_at_0%_0%,rgba(100,116,139,0.06),transparent_62%)]",
  },
};

function resolveDrawerTone(status) {
  const meta = getChannelStatusMeta(status);
  return DRAWER_TONES[meta.tone] || DRAWER_TONES.neutral;
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

  const tone = resolveDrawerTone(channel.status);

  return (
    <FocusDialog
      open={open}
      onClose={onClose}
      title={channel.name}
      backdropClassName="bg-overlay/60 backdrop-blur-[12px]"
      panelClassName="ml-auto h-full max-h-[calc(100vh-1rem)] w-full max-w-[470px]"
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-l-[26px] border-l border-black/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.986),rgba(244,247,250,0.994))] shadow-[0_36px_90px_-40px_rgba(10,18,34,0.36)]">
        <div
          aria-hidden="true"
          className={cx("pointer-events-none absolute inset-x-0 top-0 h-[2px]", tone.bar)}
        />
        <div
          aria-hidden="true"
          className={cx("pointer-events-none absolute inset-0", tone.wash)}
        />

        <div className="relative flex-1 overflow-y-auto px-7 pb-7 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <ChannelIcon
                  channel={channel}
                  className="h-6 w-6 object-contain text-text"
                  stackClassName="-space-x-2"
                />
                <ChannelStatus status={channel.status} />
              </div>

              <h2 className="mt-4 font-display text-[2.05rem] font-semibold leading-[0.92] tracking-[-0.06em] text-text">
                {channel.name}
              </h2>

              <ChannelCapabilityLine
                capabilities={channel.capabilities}
                className="mt-3"
              />

              <p className="mt-4 text-[15px] leading-7 tracking-[-0.018em] text-text-muted">
                {channel.detailSummary}
              </p>

              {channel.detailNote ? (
                <p className="mt-2 text-[14px] leading-6 text-text-muted">
                  {channel.detailNote}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => onClose?.()}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-black/[0.06] bg-black/[0.025] text-text-muted transition hover:bg-black/[0.05] hover:text-text"
              aria-label="Close channel details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 rounded-[20px] border border-black/[0.06] bg-[linear-gradient(180deg,rgba(250,251,253,0.98),rgba(245,247,250,0.96))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <ChannelActionButton
              onClick={() => onNavigate?.(channel.primaryAction.path)}
              ariaLabel={`${channel.primaryAction.label} ${channel.name}`}
              className="!h-12 !w-full !justify-between !rounded-[16px] !px-[18px] !text-[14px]"
            >
              {channel.primaryAction.label}
            </ChannelActionButton>
          </div>

          {channel.quickActions?.length ? (
            <section className="mt-7">
              <SectionEyebrow>Quick controls</SectionEyebrow>
              <div className="mt-3 rounded-[20px] border border-black/[0.06] bg-[linear-gradient(180deg,rgba(250,251,253,0.98),rgba(245,247,250,0.96))] px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                {channel.quickActions.slice(0, 4).map((action, index) => (
                  <div
                    key={`${channel.id}-${action.label}`}
                    className={cx(index > 0 && "border-t border-black/[0.05]")}
                  >
                    <QuickActionRow
                      action={action}
                      onNavigate={onNavigate}
                      channelName={channel.name}
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-7">
            <button
              type="button"
              onClick={() => setAdvancedOpen((value) => !value)}
              className="flex w-full items-start justify-between gap-4 text-left"
              aria-expanded={advancedOpen}
            >
              <div>
                <div className="text-[14px] font-semibold tracking-[-0.02em] text-text">
                  Advanced
                </div>
                <div className="mt-1 text-sm leading-6 text-text-muted">
                  Lower-priority scope, metadata, and context notes.
                </div>
              </div>

              <ChevronDown
                className={cx(
                  "mt-1 h-4 w-4 shrink-0 text-text-subtle transition-transform",
                  advancedOpen && "rotate-180"
                )}
              />
            </button>

            {advancedOpen ? (
              <div className="mt-3 rounded-[20px] border border-black/[0.06] bg-[linear-gradient(180deg,rgba(250,251,253,0.98),rgba(245,247,250,0.96))] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                {channel.advanced?.note ? (
                  <div className="text-sm leading-6 text-text-muted">
                    {channel.advanced.note}
                  </div>
                ) : null}

                {channel.advanced?.items?.length ? (
                  <div className="mt-3 divide-y divide-black/[0.05]">
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